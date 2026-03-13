/**
 * Route Handler — /api/jobs/[id]/steps/[stepName]
 *
 * PATCH → Atualiza uma etapa do pipeline pelo nome (ex: "llm_analysis")
 *
 * Usado internamente pelo Python Service para reportar progresso.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateStepSchema } from "@/lib/validators";
import { PIPELINE_STEPS } from "@/lib/constants";
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

type RouteParams = { params: Promise<{ id: string; stepName: string }> };

// ─── PATCH /api/jobs/:id/steps/:stepName ──────────────────

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id, stepName } = await params;

    if (!UUID_RE.test(id)) {
      return error("INVALID_ID", "Job ID must be a valid UUID");
    }

    // Validate step name against known pipeline steps
    const validStepNames = PIPELINE_STEPS.map((s) => s.name);
    if (!validStepNames.includes(stepName as typeof validStepNames[number])) {
      return error(
        "INVALID_STEP",
        `Step "${stepName}" is not valid. Expected one of: ${validStepNames.join(", ")}`,
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return error("INVALID_JSON", "Request body must be valid JSON");
    }

    const parseResult = updateStepSchema.safeParse(body);
    if (!parseResult.success) {
      return error(
        "INVALID_PAYLOAD",
        parseResult.error.issues.map((i) => i.message).join("; "),
      );
    }

    const { status, startedAt, completedAt, errorMessage } = parseResult.data;

    // Buscar step pelo jobId + nome
    const step = await prisma.jobStep.findFirst({
      where: { jobId: id, name: stepName },
    });

    if (!step) {
      return error(
        "NOT_FOUND",
        `Step "${stepName}" not found for job ${id}`,
        404,
      );
    }

    const updated = await prisma.jobStep.update({
      where: { id: step.id },
      data: {
        ...(status !== undefined && { status }),
        ...(startedAt !== undefined && { startedAt: new Date(startedAt) }),
        ...(completedAt !== undefined && {
          completedAt: new Date(completedAt),
        }),
        ...(errorMessage !== undefined && { errorMessage }),
      },
    });

    return success(updated);
  } catch (err) {
    console.error("[PATCH /api/jobs/steps]", err);
    return error("INTERNAL_ERROR", "Failed to update step", 500);
  }
}
