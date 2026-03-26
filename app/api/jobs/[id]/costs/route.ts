/**
 * Route Handler — /api/jobs/[id]/costs
 *
 * GET → Retorna breakdown de custos LLM do job
 *
 * Busca registros detalhados de uso LLM (llm_usage_logs) e
 * retorna agregado por step, por equipamento e registros individuais.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

// ─── GET /api/jobs/:id/costs ──────────────────────────────

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    if (!UUID_RE.test(id)) {
      return error("INVALID_ID", "Job ID must be a valid UUID");
    }

    // Verificar que o job existe e pegar campos de custo
    const job = await prisma.job.findUnique({
      where: { id },
    }) as AnyRecord | null;

    if (!job) {
      return error("NOT_FOUND", `Job ${id} not found`, 404);
    }

    // Buscar registros detalhados de uso LLM via raw query
    // (llm_usage_logs table created by Prisma migration)
    const logs = await prisma.$queryRaw<AnyRecord[]>`
      SELECT * FROM llm_usage_logs
      WHERE job_id = ${id}::uuid
      ORDER BY created_at ASC
    `.catch(() => [] as AnyRecord[]);

    // Agregar por step
    const byStep: Record<string, { costUsd: number; tokens: number; calls: number }> = {};
    for (const log of logs) {
      const step = log.step as string;
      if (!byStep[step]) {
        byStep[step] = { costUsd: 0, tokens: 0, calls: 0 };
      }
      byStep[step].costUsd += Number(log.estimated_cost_usd ?? 0);
      byStep[step].tokens += Number(log.total_tokens ?? 0);
      byStep[step].calls += 1;
    }

    // Agregar por equipamento
    const byEquipment: Record<string, { costUsd: number; tokens: number; calls: number }> = {};
    for (const log of logs) {
      if (log.equipment_name) {
        const equip = log.equipment_name as string;
        if (!byEquipment[equip]) {
          byEquipment[equip] = { costUsd: 0, tokens: 0, calls: 0 };
        }
        byEquipment[equip].costUsd += Number(log.estimated_cost_usd ?? 0);
        byEquipment[equip].tokens += Number(log.total_tokens ?? 0);
        byEquipment[equip].calls += 1;
      }
    }

    // Pipeline version info
    let pipelineVersion: AnyRecord | null = null;
    const versionId = job.pipeline_version_id ?? job.pipelineVersionId;
    if (versionId) {
      const versions = await prisma.$queryRaw<AnyRecord[]>`
        SELECT * FROM pipeline_versions
        WHERE id = ${versionId}
        LIMIT 1
      `.catch(() => [] as AnyRecord[]);
      pipelineVersion = versions[0] ?? null;
    }

    const totalCost = logs.reduce((sum: number, l: AnyRecord) => sum + Number(l.estimated_cost_usd ?? 0), 0);
    const totalTokens = logs.reduce((sum: number, l: AnyRecord) => sum + Number(l.total_tokens ?? 0), 0);

    return success({
      summary: {
        totalCostUsd: Number(job.llm_cost_usd ?? job.llmCostUsd ?? totalCost),
        totalTokens: Number(job.llm_total_tokens ?? job.llmTotalTokens ?? totalTokens),
        callCount: Number(job.llm_call_count ?? job.llmCallCount ?? logs.length),
      },
      byStep,
      byEquipment,
      pipelineVersion: pipelineVersion
        ? {
            id: pipelineVersion.id as string,
            llmModel: (pipelineVersion.llm_model ?? pipelineVersion.llmModel) as string,
            embeddingModel: (pipelineVersion.embedding_model ?? pipelineVersion.embeddingModel) as string,
            ragStrategy: (pipelineVersion.rag_strategy ?? pipelineVersion.ragStrategy) as string,
            createdAt: new Date(pipelineVersion.created_at ?? pipelineVersion.createdAt).toISOString(),
          }
        : null,
      records: logs.map((log: AnyRecord) => ({
        id: String(log.id),
        flow: log.flow as string,
        step: log.step as string,
        provider: log.provider as string,
        model: log.model as string,
        callType: log.call_type as string,
        inputTokens: Number(log.input_tokens ?? 0),
        outputTokens: Number(log.output_tokens ?? 0),
        totalTokens: Number(log.total_tokens ?? 0),
        tokensSource: log.tokens_source as string,
        estimatedCostUsd: Number(log.estimated_cost_usd ?? 0),
        durationMs: Number(log.duration_ms ?? 0),
        success: Boolean(log.success),
        errorMessage: log.error_message as string | null,
        retryAttempt: log.retry_attempt != null ? Number(log.retry_attempt) : null,
        equipmentName: log.equipment_name as string | null,
        promptChars: Number(log.prompt_chars ?? 0),
        responseChars: Number(log.response_chars ?? 0),
        createdAt: new Date(log.created_at).toISOString(),
      })),
    });
  } catch (err) {
    console.error(`[GET /api/jobs/${(await params).id}/costs]`, err);
    return error("INTERNAL_ERROR", "Failed to fetch cost breakdown", 500);
  }
}
