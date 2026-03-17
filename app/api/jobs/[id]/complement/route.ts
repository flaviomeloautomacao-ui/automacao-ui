/**
 * Route Handler — /api/jobs/[id]/complement
 *
 * GET   → Retorna Report + ReportEquipments + EquipmentImages do job
 * PATCH → Atualiza dados da complementação (report + equipments) em transação
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeObservations } from "@/lib/normalizeObservations";
import type { ApiResponse } from "@/lib/types";

// ─── Helpers ──────────────────────────────────────────────

function success<T>(data: T, status = 200) {
  return NextResponse.json<ApiResponse<T>>(
    { data, error: null },
    { status },
  );
}

function error(code: string, message: string, status = 400) {
  return NextResponse.json<ApiResponse<never>>(
    { data: null, error: { code, message } },
    { status },
  );
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RouteParams = { params: Promise<{ id: string }> };

// ─── GET /api/jobs/:id/complement ─────────────────────────

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    if (!UUID_RE.test(id)) {
      return error("INVALID_ID", "Job ID must be a valid UUID");
    }

    const job = await prisma.job.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!job) {
      return error("NOT_FOUND", `Job ${id} not found`, 404);
    }

    const report = await prisma.report.findUnique({
      where: { jobId: id },
    });

    if (!report) {
      return error(
        "REPORT_NOT_FOUND",
        `No report found for job ${id}. Ensure the job was created with the complement flow.`,
        404,
      );
    }

    const equipments = await prisma.reportEquipment.findMany({
      where: { reportId: report.id },
      orderBy: { orderIndex: "asc" },
      include: {
        images: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    return success({ report, equipments });
  } catch (err) {
    console.error(`[GET /api/jobs/complement]`, err);
    return error("INTERNAL_ERROR", "Failed to fetch complement data", 500);
  }
}

// ─── PATCH /api/jobs/:id/complement ───────────────────────

interface PatchReportInput {
  razaoSocial?: string;
  site?: string;
  localVistoriado?: string;
  dataAvaliacao?: string; // ISO-8601
  contrato?: string;
  observacoesGerais?: string;
}

interface PatchEquipmentInput {
  id: string;
  localInstalacao?: string;
  funcaoOperacional?: string;
  observacoesExtras?: string;
}

interface PatchComplementBody {
  report?: PatchReportInput;
  equipments?: PatchEquipmentInput[];
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    if (!UUID_RE.test(id)) {
      return error("INVALID_ID", "Job ID must be a valid UUID");
    }

    let body: PatchComplementBody;
    try {
      body = await request.json();
    } catch {
      return error("INVALID_JSON", "Request body must be valid JSON");
    }

    if (!body.report && !body.equipments) {
      return error(
        "EMPTY_PAYLOAD",
        "At least 'report' or 'equipments' must be provided",
      );
    }

    // Verify job + report exist
    const job = await prisma.job.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!job) {
      return error("NOT_FOUND", `Job ${id} not found`, 404);
    }

    if (job.status !== "awaiting_complement") {
      return error(
        "INVALID_STATUS",
        `Job is '${job.status}', expected 'awaiting_complement'`,
        409,
      );
    }

    const report = await prisma.report.findUnique({
      where: { jobId: id },
    });

    if (!report) {
      return error(
        "REPORT_NOT_FOUND",
        `No report found for job ${id}`,
        404,
      );
    }

    // Use an interactive transaction so we can set a per-call timeout.
    // Each operation is a round-trip to the remote DB; with many equipments
    // the default 5 s is easily exceeded.
    await prisma.$transaction(
      async (tx) => {
        // Report update
        if (body.report) {
          const {
            razaoSocial,
            site,
            localVistoriado,
            dataAvaliacao,
            contrato,
            observacoesGerais,
          } = body.report;

          // Seção 7: Normalizar observações → prompt simplificado (sem LLM)
          const observacoesGeraisPrompt =
            observacoesGerais !== undefined
              ? normalizeObservations(observacoesGerais)
              : undefined;

          await tx.report.update({
            where: { id: report.id },
            data: {
              ...(razaoSocial !== undefined && { razaoSocial }),
              ...(site !== undefined && { site }),
              ...(localVistoriado !== undefined && { localVistoriado }),
              ...(dataAvaliacao !== undefined && {
                dataAvaliacao: new Date(dataAvaliacao),
              }),
              ...(contrato !== undefined && { contrato }),
              ...(observacoesGerais !== undefined && { observacoesGerais }),
              ...(observacoesGeraisPrompt !== undefined && {
                observacoesGeraisPrompt,
              }),
            },
          });
        }

        // Equipment updates — run in parallel inside the transaction
        if (body.equipments && body.equipments.length > 0) {
          const eqOps = body.equipments
            .filter((eq) => UUID_RE.test(eq.id))
            .filter((eq) =>
              eq.localInstalacao !== undefined ||
              eq.funcaoOperacional !== undefined ||
              eq.observacoesExtras !== undefined
            )
            .map((eq) =>
              tx.reportEquipment.update({
                where: { id: eq.id },
                data: {
                  ...(eq.localInstalacao !== undefined && {
                    localInstalacao: eq.localInstalacao,
                  }),
                  ...(eq.funcaoOperacional !== undefined && {
                    funcaoOperacional: eq.funcaoOperacional,
                  }),
                  ...(eq.observacoesExtras !== undefined && {
                    observacoesExtras: eq.observacoesExtras,
                  }),
                },
              }),
            );

          if (eqOps.length > 0) {
            await Promise.all(eqOps);
          }
        }
      },
      {
        maxWait: 10000,
        timeout: 60000,
      },
    );

    return success({ updated: true });
  } catch (err) {
    console.error(`[PATCH /api/jobs/complement]`, err);
    return error("INTERNAL_ERROR", "Failed to update complement data", 500);
  }
}
