/**
 * Route Handler — /api/jobs/[id]/retry
 *
 * POST → Reseta um job com status 'error' e re-dispara o processamento
 *        no Python Service.
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
) {
  return NextResponse.json(
    { data: null, error: { code, message } },
    { status },
  );
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RouteParams = { params: Promise<{ id: string }> };

// ─── POST /api/jobs/:id/retry ─────────────────────────────

export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    if (!UUID_RE.test(id)) {
      return error("INVALID_ID", "Job ID must be a valid UUID");
    }

    // 1. Fetch job
    const job = await prisma.job.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!job) {
      return error("NOT_FOUND", `Job ${id} not found`, 404);
    }

    if (job.status !== "error") {
      return error(
        "INVALID_STATUS",
        `Job is '${job.status}', expected 'error'`,
        409,
      );
    }

    // 2. Reset job status and clear error fields
    await prisma.job.update({
      where: { id },
      data: {
        status: "processing",
        progress: 10,
        currentStep: "Reiniciando processamento…",
        errorCode: null,
        errorMessage: null,
        startedAt: new Date(),
        finishedAt: null,
        pdfPath: null,
      },
    });

    // 3. Reset job steps (back to queued)
    await prisma.jobStep.updateMany({
      where: { jobId: id },
      data: {
        status: "queued",
        startedAt: null,
        completedAt: null,
        errorMessage: null,
      },
    });

    // 4. Dispatch to Python service
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
          `[POST /api/jobs/retry] Python service returned ${pyResponse.status}`,
        );
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
        "[POST /api/jobs/retry] Python Service dispatch failed:",
        pyErr,
      );
      await prisma.job
        .update({
          where: { id },
          data: {
            status: "error",
            errorCode: "PYTHON_SERVICE_UNREACHABLE",
            errorMessage: `Falha ao conectar com o serviço de geração: ${pyErr instanceof Error ? pyErr.message : "Erro desconhecido"}`,
          },
        })
        .catch(console.error);
    }

    return success({ status: "processing" });
  } catch (err) {
    console.error(`[POST /api/jobs/retry]`, err);
    return error("INTERNAL_ERROR", "Failed to retry processing", 500);
  }
}
