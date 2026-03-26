/**
 * Route Handler — /api/jobs/[id]/start-processing
 *
 * POST → Valida complementação, atualiza status para 'processing'
 *        e dispara processamento no Python Service.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PYTHON_SERVICE_URL } from "@/lib/constants";
import type { ApiResponse } from "@/lib/types";

// ─── Helpers ──────────────────────────────────────────────

function success<T>(data: T, status = 200) {
  return NextResponse.json<ApiResponse<T>>(
    { data, error: null },
    { status },
  );
}

function error(
  code: string,
  message: string,
  status = 400,
  details?: string[],
) {
  return NextResponse.json(
    { data: null, error: { code, message, ...(details ? { details } : {}) } },
    { status },
  );
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RouteParams = { params: Promise<{ id: string }> };

/** Campos do report que devem estar preenchidos para iniciar processamento */
const REQUIRED_REPORT_FIELDS = [
  "razaoSocial",
] as const;

// ─── POST /api/jobs/:id/start-processing ──────────────────

export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    if (!UUID_RE.test(id)) {
      return error("INVALID_ID", "Job ID must be a valid UUID");
    }

    // 1. Fetch job
    const job = await prisma.job.findUnique({
      where: { id },
      select: { id: true, status: true, profile: true },
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

    // 2. Validate report exists
    const report = await prisma.report.findUnique({
      where: { jobId: id },
    });

    if (!report) {
      return error(
        "REPORT_NOT_FOUND",
        `No report found for job ${id}. Complete the complement step first.`,
        404,
      );
    }

    // 3. Validate mandatory metadata
    const missing: string[] = [];
    for (const field of REQUIRED_REPORT_FIELDS) {
      const value = report[field];
      if (!value || (typeof value === "string" && value.trim() === "")) {
        missing.push(field);
      }
    }

    if (missing.length > 0) {
      return error(
        "MISSING_METADATA",
        `Campos obrigatórios não preenchidos: ${missing.join(", ")}`,
        422,
        missing,
      );
    }

    // 4. Transition status to processing
    await prisma.job.update({
      where: { id },
      data: {
        status: "processing",
        progress: 10,
        currentStep: "Iniciando processamento…",
        startedAt: new Date(),
      },
    });

    // 5. Dispatch to Python service (await to ensure request is sent)
    try {
      const pyHeaders: Record<string, string> = { "Content-Type": "application/json" };
      if (process.env.INTERNAL_API_KEY) {
        pyHeaders["X-Internal-API-Key"] = process.env.INTERNAL_API_KEY;
      }
      const pyResponse = await fetch(`${PYTHON_SERVICE_URL}/process`, {
        method: "POST",
        headers: pyHeaders,
        body: JSON.stringify({ job_id: id }),
      });

      if (!pyResponse.ok) {
        console.error(
          `[POST /api/jobs/start-processing] Python service returned ${pyResponse.status}`,
        );
        // Mark job as error since the Python service rejected the request
        await prisma.job.update({
          where: { id },
          data: {
            status: "error",
            errorCode: "PYTHON_SERVICE_ERROR",
            errorMessage: `Serviço de geração retornou status ${pyResponse.status}`,
          },
        });
      }
    } catch (pyErr) {
      console.error(
        "[POST /api/jobs/start-processing] Python Service dispatch failed:",
        pyErr,
      );
      // Mark job as error since we couldn't reach the Python service
      await prisma.job.update({
        where: { id },
        data: {
          status: "error",
          errorCode: "PYTHON_SERVICE_UNREACHABLE",
          errorMessage: `Falha ao conectar com o serviço de geração: ${pyErr instanceof Error ? pyErr.message : "Erro desconhecido"}`,
        },
      }).catch(console.error);
    }

    return success({ status: "processing" });
  } catch (err) {
    console.error(`[POST /api/jobs/start-processing]`, err);
    return error("INTERNAL_ERROR", "Failed to start processing", 500);
  }
}
