/**
 * Route Handler — /api/jobs/[id]/download
 *
 * GET → Gera uma signed URL curta para o PDF do job e retorna ao client.
 *
 * Regras:
 *   - Job deve existir e ter status === "done"
 *   - pdfPath não pode ser null
 *   - URL assinada expira em 60 segundos
 *   - Nunca expõe credenciais do Supabase ao client
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSupabaseAdmin, REPORTS_BUCKET } from "@/lib/supabaseServer";
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

// UUID v4 regex
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Nome do bucket onde os PDFs são armazenados */
const PDF_BUCKET = REPORTS_BUCKET;

/** Tempo de expiração da signed URL em segundos */
const SIGNED_URL_EXPIRY_SECONDS = 60;

type RouteParams = { params: Promise<{ id: string }> };

// ─── GET /api/jobs/:id/download ───────────────────────────

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    if (!UUID_RE.test(id)) {
      return error("INVALID_ID", "Job ID must be a valid UUID");
    }

    // 1. Buscar job via Prisma
    const job = await prisma.job.findUnique({
      where: { id },
      select: { id: true, status: true, pdfPath: true },
    });

    if (!job) {
      return error("NOT_FOUND", `Job ${id} not found`, 404);
    }

    // 2. Validar status
    if (job.status !== "done") {
      return error(
        "JOB_NOT_DONE",
        "O PDF só está disponível quando o job está concluído (status=done).",
        409,
      );
    }

    // 3. Validar pdfPath
    if (!job.pdfPath) {
      return error(
        "PDF_NOT_AVAILABLE",
        "O PDF ainda não foi gerado para este job.",
        404,
      );
    }

    // 4. Gerar signed URL via Supabase Storage
    const supabase = getSupabaseAdmin();
    const { data: signedData, error: storageError } = await supabase.storage
      .from(PDF_BUCKET)
      .createSignedUrl(job.pdfPath, SIGNED_URL_EXPIRY_SECONDS);

    if (storageError || !signedData?.signedUrl) {
      console.error(
        `[GET /api/jobs/${id}/download] Supabase signed URL error:`,
        storageError,
      );
      return error(
        "STORAGE_ERROR",
        "Falha ao gerar link de download. Tente novamente.",
        502,
      );
    }

    // 5. Retornar URL assinada
    return success({ url: signedData.signedUrl });
  } catch (err) {
    console.error(`[GET /api/jobs/${(await params).id}/download]`, err);
    return error("INTERNAL_ERROR", "Failed to generate download link", 500);
  }
}
