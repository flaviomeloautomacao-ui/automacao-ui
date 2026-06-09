/**
 * Route Handler — /api/llm-costs
 *
 * GET → Retorna visão global de custos LLM de TODOS os jobs.
 *
 * Agregações:
 *  - summary: totais gerais (custo, tokens, chamadas, avg por job)
 *  - byModel: custo/tokens/chamadas agrupados por modelo
 *  - byStep: custo/tokens/chamadas agrupados por etapa do pipeline
 *  - byJob: custo/tokens/chamadas por job (com filename e status)
 *  - timeline: custo por dia (últimos 30 dias)
 *  - recentRecords: últimos N registros individuais (drill-down)
 *
 * Query params:
 *  - days: período em dias para filtrar (default: 30)
 *  - limit: max registros individuais (default: 50)
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

// ─── GET /api/llm-costs ───────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const days = Math.min(Number(searchParams.get("days") ?? 30), 365);
    const limit = Math.min(Number(searchParams.get("limit") ?? 50), 200);

    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);

    // ── 1. Totais gerais ─────────────────────────────────
    const totalAgg = await prisma.$queryRaw<AnyRecord[]>`
      SELECT
        COUNT(*)::int                      AS call_count,
        COALESCE(SUM(total_tokens), 0)::int AS total_tokens,
        COALESCE(SUM(input_tokens), 0)::int AS input_tokens,
        COALESCE(SUM(output_tokens), 0)::int AS output_tokens,
        COALESCE(SUM(estimated_cost_usd), 0)::float AS total_cost_usd,
        COALESCE(AVG(duration_ms), 0)::float AS avg_duration_ms,
        COUNT(DISTINCT job_id)::int        AS job_count,
        COUNT(*) FILTER (WHERE success = false)::int AS error_count
      FROM llm_usage_logs
      WHERE created_at >= ${sinceDate}
    `.catch(() => [{}] as AnyRecord[]);

    const agg = totalAgg[0] ?? {};

    const summary = {
      callCount: Number(agg.call_count ?? 0),
      totalTokens: Number(agg.total_tokens ?? 0),
      inputTokens: Number(agg.input_tokens ?? 0),
      outputTokens: Number(agg.output_tokens ?? 0),
      totalCostUsd: Number(agg.total_cost_usd ?? 0),
      avgDurationMs: Number(agg.avg_duration_ms ?? 0),
      jobCount: Number(agg.job_count ?? 0),
      errorCount: Number(agg.error_count ?? 0),
      avgCostPerJob:
        Number(agg.job_count ?? 0) > 0
          ? Number(agg.total_cost_usd ?? 0) / Number(agg.job_count ?? 1)
          : 0,
      avgTokensPerCall:
        Number(agg.call_count ?? 0) > 0
          ? Math.round(Number(agg.total_tokens ?? 0) / Number(agg.call_count ?? 1))
          : 0,
      periodDays: days,
    };

    // ── 2. Agrupado por modelo ──────────────────────────
    const byModelRaw = await prisma.$queryRaw<AnyRecord[]>`
      SELECT
        model,
        provider,
        COUNT(*)::int                      AS calls,
        COALESCE(SUM(total_tokens), 0)::int AS tokens,
        COALESCE(SUM(estimated_cost_usd), 0)::float AS cost_usd,
        COALESCE(AVG(duration_ms), 0)::float AS avg_duration_ms,
        COUNT(*) FILTER (WHERE success = false)::int AS errors
      FROM llm_usage_logs
      WHERE created_at >= ${sinceDate}
      GROUP BY model, provider
      ORDER BY cost_usd DESC
    `.catch(() => [] as AnyRecord[]);

    const byModel = byModelRaw.map((r) => ({
      model: r.model as string,
      provider: r.provider as string,
      calls: Number(r.calls),
      tokens: Number(r.tokens),
      costUsd: Number(r.cost_usd),
      avgDurationMs: Number(r.avg_duration_ms),
      errors: Number(r.errors),
    }));

    // ── 3. Agrupado por step ────────────────────────────
    const byStepRaw = await prisma.$queryRaw<AnyRecord[]>`
      SELECT
        step,
        call_type,
        COUNT(*)::int                      AS calls,
        COALESCE(SUM(total_tokens), 0)::int AS tokens,
        COALESCE(SUM(estimated_cost_usd), 0)::float AS cost_usd,
        COALESCE(AVG(duration_ms), 0)::float AS avg_duration_ms,
        COUNT(*) FILTER (WHERE success = false)::int AS errors
      FROM llm_usage_logs
      WHERE created_at >= ${sinceDate}
      GROUP BY step, call_type
      ORDER BY cost_usd DESC
    `.catch(() => [] as AnyRecord[]);

    const byStep = byStepRaw.map((r) => ({
      step: r.step as string,
      callType: r.call_type as string,
      calls: Number(r.calls),
      tokens: Number(r.tokens),
      costUsd: Number(r.cost_usd),
      avgDurationMs: Number(r.avg_duration_ms),
      errors: Number(r.errors),
    }));

    // ── 4. Agrupado por job ─────────────────────────────
    const byJobRaw = await prisma.$queryRaw<AnyRecord[]>`
      SELECT
        l.job_id,
        j.filename,
        COALESCE(j.document_type::text, CASE WHEN j.profile = 'dust' THEN 'dha' ELSE j.profile END) AS profile,
        j.status,
        j.created_at AS job_created_at,
        COUNT(*)::int                      AS calls,
        COALESCE(SUM(l.total_tokens), 0)::int AS tokens,
        COALESCE(SUM(l.estimated_cost_usd), 0)::float AS cost_usd,
        COALESCE(AVG(l.duration_ms), 0)::float AS avg_duration_ms,
        COUNT(*) FILTER (WHERE l.success = false)::int AS errors
      FROM llm_usage_logs l
      JOIN jobs j ON j.id = l.job_id
      WHERE l.created_at >= ${sinceDate}
      GROUP BY l.job_id, j.filename, j.document_type, j.profile, j.status, j.created_at
      ORDER BY cost_usd DESC
      LIMIT 100
    `.catch(() => [] as AnyRecord[]);

    const byJob = byJobRaw.map((r) => ({
      jobId: String(r.job_id),
      filename: r.filename as string | null,
      profile: r.profile as string,
      status: r.status as string,
      jobCreatedAt: r.job_created_at ? new Date(r.job_created_at).toISOString() : null,
      calls: Number(r.calls),
      tokens: Number(r.tokens),
      costUsd: Number(r.cost_usd),
      avgDurationMs: Number(r.avg_duration_ms),
      errors: Number(r.errors),
    }));

    // ── 5. Timeline (custo por dia) ─────────────────────
    const timelineRaw = await prisma.$queryRaw<AnyRecord[]>`
      SELECT
        DATE(created_at) AS day,
        COUNT(*)::int AS calls,
        COALESCE(SUM(total_tokens), 0)::int AS tokens,
        COALESCE(SUM(estimated_cost_usd), 0)::float AS cost_usd,
        COUNT(DISTINCT job_id)::int AS jobs
      FROM llm_usage_logs
      WHERE created_at >= ${sinceDate}
      GROUP BY DATE(created_at)
      ORDER BY day ASC
    `.catch(() => [] as AnyRecord[]);

    const timeline = timelineRaw.map((r) => ({
      day: r.day ? new Date(r.day).toISOString().split("T")[0] : "",
      calls: Number(r.calls),
      tokens: Number(r.tokens),
      costUsd: Number(r.cost_usd),
      jobs: Number(r.jobs),
    }));

    // ── 6. Registros recentes (drill-down) ──────────────
    const recentRaw = await prisma.$queryRaw<AnyRecord[]>`
      SELECT
        l.*,
        j.filename AS job_filename
      FROM llm_usage_logs l
      LEFT JOIN jobs j ON j.id = l.job_id
      WHERE l.created_at >= ${sinceDate}
      ORDER BY l.created_at DESC
      LIMIT ${limit}
    `.catch(() => [] as AnyRecord[]);

    const recentRecords = recentRaw.map((r) => ({
      id: String(r.id),
      jobId: String(r.job_id),
      jobFilename: r.job_filename as string | null,
      flow: r.flow as string,
      step: r.step as string,
      provider: r.provider as string,
      model: r.model as string,
      callType: r.call_type as string,
      inputTokens: Number(r.input_tokens ?? 0),
      outputTokens: Number(r.output_tokens ?? 0),
      totalTokens: Number(r.total_tokens ?? 0),
      tokensSource: r.tokens_source as string,
      estimatedCostUsd: Number(r.estimated_cost_usd ?? 0),
      durationMs: Number(r.duration_ms ?? 0),
      success: Boolean(r.success),
      errorMessage: r.error_message as string | null,
      retryAttempt: r.retry_attempt != null ? Number(r.retry_attempt) : null,
      equipmentName: r.equipment_name as string | null,
      promptChars: Number(r.prompt_chars ?? 0),
      responseChars: Number(r.response_chars ?? 0),
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : "",
    }));

    return success({
      summary,
      byModel,
      byStep,
      byJob,
      timeline,
      recentRecords,
    });
  } catch (err) {
    console.error("[GET /api/llm-costs]", err);
    return error("INTERNAL_ERROR", "Failed to fetch global LLM costs", 500);
  }
}
