/**
 * Route Handler — /api/jobs/[id]
 *
 * GET   → Retorna job pelo UUID
 * PATCH → Atualiza status / progress / error (para testes)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateJobSchema } from "@/lib/validators";
import type { ApiResponse, JobDetailResponse } from "@/lib/types";

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

// UUID v4 regex
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RouteParams = { params: Promise<{ id: string }> };

// ─── GET /api/jobs/:id ────────────────────────────────────

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    if (!UUID_RE.test(id)) {
      return error("INVALID_ID", "Job ID must be a valid UUID");
    }

    const job = await prisma.job.findUnique({
      where: { id },
      include: { steps: { orderBy: { order: "asc" } } },
    });

    if (!job) {
      return error("NOT_FOUND", `Job ${id} not found`, 404);
    }

    const { steps, ...jobData } = job;

    const response: JobDetailResponse = {
      job: jobData,
      steps: steps.length > 0 ? steps : null,
    };

    return success(response);
  } catch (err) {
    console.error(`[GET /api/jobs/${(await params).id}]`, err);
    return error("INTERNAL_ERROR", "Failed to fetch job", 500);
  }
}

// ─── PATCH /api/jobs/:id ──────────────────────────────────

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    if (!UUID_RE.test(id)) {
      return error("INVALID_ID", "Job ID must be a valid UUID");
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return error("INVALID_JSON", "Request body must be valid JSON");
    }

    const parseResult = updateJobSchema.safeParse(body);

    if (!parseResult.success) {
      return error(
        "INVALID_PAYLOAD",
        parseResult.error.issues.map((i) => i.message).join("; "),
      );
    }

    const { status, progress, currentStep, errorCode, errorMessage, pdfPath, startedAt, finishedAt } =
      parseResult.data;

    // Verifica existência antes de atualizar
    const existing = await prisma.job.findUnique({ where: { id } });
    if (!existing) {
      return error("NOT_FOUND", `Job ${id} not found`, 404);
    }

    const updated = await prisma.job.update({
      where: { id },
      data: {
        ...(status !== undefined && { status }),
        ...(progress !== undefined && { progress }),
        ...(currentStep !== undefined && { currentStep }),
        ...(errorCode !== undefined && { errorCode }),
        ...(errorMessage !== undefined && { errorMessage }),
        ...(pdfPath !== undefined && { pdfPath }),
        ...(startedAt !== undefined && { startedAt: new Date(startedAt) }),
        ...(finishedAt !== undefined && { finishedAt: new Date(finishedAt) }),
      },
    });

    return success(updated);
  } catch (err) {
    console.error(`[PATCH /api/jobs/${(await params).id}]`, err);
    return error("INTERNAL_ERROR", "Failed to update job", 500);
  }
}
