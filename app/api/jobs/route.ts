/**
 * Route Handler — /api/jobs
 *
 * GET  → Lista jobs (limit/offset via query string)
 * POST → Cria job com status 'queued'
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createJobSchema, listJobsQuerySchema } from "@/lib/validators";
import type { ApiResponse, Job } from "@/lib/types";

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

// ─── GET /api/jobs ────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;

    const queryResult = listJobsQuerySchema.safeParse({
      limit: searchParams.get("limit") ?? undefined,
      offset: searchParams.get("offset") ?? undefined,
    });

    if (!queryResult.success) {
      return error(
        "INVALID_QUERY",
        queryResult.error.issues.map((i) => i.message).join("; "),
      );
    }

    const { limit, offset } = queryResult.data;

    const jobs: Job[] = await prisma.job.findMany({
      take: limit,
      skip: offset,
      orderBy: { createdAt: "desc" },
    });

    return success(jobs);
  } catch (err) {
    console.error("[GET /api/jobs]", err);
    return error("INTERNAL_ERROR", "Failed to fetch jobs", 500);
  }
}

// ─── POST /api/jobs ───────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return error("INVALID_JSON", "Request body must be valid JSON");
    }

    const parseResult = createJobSchema.safeParse(body);

    if (!parseResult.success) {
      return error(
        "INVALID_PAYLOAD",
        parseResult.error.issues.map((i) => i.message).join("; "),
      );
    }

    const { filename, profile } = parseResult.data;

    const job: Job = await prisma.job.create({
      data: {
        filename,
        profile,
        status: "queued",
        progress: 0,
      },
    });

    return success(job, 201);
  } catch (err) {
    console.error("[POST /api/jobs]", err);
    return error("INTERNAL_ERROR", "Failed to create job", 500);
  }
}
