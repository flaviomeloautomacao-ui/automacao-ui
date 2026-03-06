/**
 * Route Handler — /api/jobs
 *
 * GET  → Lista jobs (limit/offset via query string)
 * POST → Recebe planilha via FormData, valida, persiste e clona no Storage
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { listJobsQuerySchema } from "@/lib/validators";
import { parseSpreadsheet } from "@/lib/spreadsheetParser";
import { validateSpreadsheet } from "@/lib/spreadsheetContract";
import { getArchiveExpirationDate, formatDatePath } from "@/lib/date";
import { getSupabaseAdmin, STORAGE_BUCKET, ensureStorageBucket } from "@/lib/supabaseServer";
import { MAX_UPLOAD_MB, ALLOWED_EXTENSIONS, PYTHON_SERVICE_URL, PIPELINE_STEPS } from "@/lib/constants";
import type { ApiResponse, CreateJobResponse } from "@/lib/types";

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
  details?: unknown[],
) {
  return NextResponse.json(
    { data: null, error: { code, message, ...(details ? { details } : {}) } },
    { status },
  );
}

// ─── Constantes ───────────────────────────────────────────

const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
const BATCH_SIZE = 500; // linhas por createMany

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

    const jobs = await prisma.job.findMany({
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
    // 1. Parse multipart/form-data
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return error("INVALID_FORM", "Request must be multipart/form-data.");
    }

    const file = formData.get("file") as File | null;
    const profile = (formData.get("profile") as string | null)?.trim();

    // 2. Validar campos obrigatórios
    if (!file || !(file instanceof File) || file.size === 0) {
      return error("MISSING_FILE", "O campo 'file' é obrigatório.");
    }

    if (!profile) {
      return error("MISSING_PROFILE", "O campo 'profile' é obrigatório.");
    }

    // 3. Validar extensão
    const originalFilename = file.name;
    const ext = originalFilename.toLowerCase().split(".").pop();
    if (
      !ext ||
      !ALLOWED_EXTENSIONS.includes(`.${ext}` as (typeof ALLOWED_EXTENSIONS)[number])
    ) {
      return error(
        "INVALID_EXTENSION",
        `Extensão .${ext} não permitida. Use: ${ALLOWED_EXTENSIONS.join(", ")}`,
      );
    }

    // 4. Validar tamanho
    if (file.size > MAX_UPLOAD_BYTES) {
      return error(
        "FILE_TOO_LARGE",
        `Arquivo excede o limite de ${MAX_UPLOAD_MB}MB (${(file.size / (1024 * 1024)).toFixed(1)}MB).`,
      );
    }

    // 5. Ler arquivo em memória e parsear
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let rawRows: string[][];
    try {
      rawRows = parseSpreadsheet(buffer, file.type, originalFilename);
    } catch (parseErr) {
      return error(
        "PARSE_ERROR",
        `Falha ao ler a planilha: ${parseErr instanceof Error ? parseErr.message : "Erro desconhecido"}`,
      );
    }

    // 6. Validar contra o contrato
    const validation = validateSpreadsheet(rawRows);

    if (!validation.valid) {
      return error(
        "INVALID_SPREADSHEET",
        `A planilha contém ${validation.errors.length} erro(s) de validação.`,
        422,
        validation.errors,
      );
    }

    // 7. Persistir em transação Prisma (Job + Rows + Steps)
    const now = new Date();
    const archiveExpiresAt = getArchiveExpirationDate(now);

    const result = await prisma.$transaction(async (tx) => {
      // 7a. Criar Job
      const job = await tx.job.create({
        data: {
          filename: originalFilename,
          profile,
          status: "queued",
          progress: 0,
          currentStep: "Aguardando processamento",
          rowCount: validation.rowCount,
        },
      });

      // 7b. Criar SpreadsheetUpload
      const upload = await tx.spreadsheetUpload.create({
        data: {
          jobId: job.id,
          originalFilename,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
          rowCount: validation.rowCount,
          metadata: validation.metadata as Record<string, string>,
        },
      });

      // 7c. Inserir SpreadsheetRows em batches
      for (let i = 0; i < validation.rows.length; i += BATCH_SIZE) {
        const batch = validation.rows.slice(i, i + BATCH_SIZE);
        await tx.spreadsheetRow.createMany({
          data: batch.map((row, batchIdx) => ({
            uploadId: upload.id,
            rowIndex: i + batchIdx + 1, // 1-based
            equipmentName: row["Equipamento"] || null,
            equipmentDescription: row["Descrição do equipamento"] || null,
            rawJson: row,
            normalizedJson: row,
          })),
        });
      }

      // 7d. Criar etapas do pipeline
      await tx.jobStep.createMany({
        data: PIPELINE_STEPS.map((step) => ({
          jobId: job.id,
          name: step.name,
          label: step.label,
          order: step.order,
          status: "queued",
        })),
      });

      return { job, upload };
    });

    // 8. Upload do clone no Supabase Storage (fora da transação)
    const { job } = result;
    const storagePath = `${job.id}/${formatDatePath(now)}/${originalFilename}`;

    try {
      // Garantir que o bucket existe antes do upload
      await ensureStorageBucket();

      const { error: storageError } = await getSupabaseAdmin().storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, buffer, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });

      if (storageError) {
        throw storageError;
      }

      // Salvar path e expiração no Job + marcar step 1 como done
      await prisma.$transaction([
        prisma.job.update({
          where: { id: job.id },
          data: {
            archivePath: storagePath,
            archiveExpiresAt,
            progress: 10,
            currentStep: "Upload concluído",
          },
        }),
        prisma.jobStep.updateMany({
          where: { jobId: job.id, name: "upload_storage" },
          data: { status: "done", completedAt: new Date() },
        }),
      ]);
    } catch (storageErr) {
      console.error("[POST /api/jobs] Storage upload failed:", storageErr);

      // Marcar Job como error, mas NÃO reverter os dados
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: "error",
          errorCode: "STORAGE_UPLOAD_FAILED",
          errorMessage: `Falha ao salvar arquivo no storage: ${storageErr instanceof Error ? storageErr.message : "Erro desconhecido"}`,
        },
      });

      // Ainda retorna sucesso parcial — Job criado mas sem arquivo
      return success(
        {
          jobId: job.id,
          status: job.status,
          warning: "Job criado, mas o upload do arquivo no storage falhou. O job foi marcado como error.",
        },
        201,
      );
    }

    // 9. Disparar processamento no Python Service (fire-and-forget)
    //    O front-end não espera — redireciona imediatamente para /jobs/{jobId}
    try {
      const pyForm = new FormData();
      pyForm.append("file", new Blob([buffer], { type: file.type || "application/octet-stream" }), originalFilename);
      pyForm.append("profile", profile);
      pyForm.append("job_id", job.id);

      // Fire-and-forget: NÃO usamos await aqui
      fetch(`${PYTHON_SERVICE_URL}/process`, {
        method: "POST",
        body: pyForm,
      }).catch((err) => {
        console.error("[POST /api/jobs] Fire-and-forget to Python failed:", err);
        // Atualizar job como error de forma assíncrona
        prisma.job.update({
          where: { id: job.id },
          data: {
            status: "error",
            errorCode: "PYTHON_SERVICE_UNREACHABLE",
            errorMessage: `Falha ao conectar com o serviço de geração: ${err instanceof Error ? err.message : "Erro desconhecido"}`,
          },
        }).catch(console.error);
      });
    } catch (pyErr) {
      console.error("[POST /api/jobs] Python Service dispatch failed:", pyErr);
      // Não falha o request — o job foi criado com sucesso
    }

    // 10. Retorno imediato — front redireciona para /jobs/{jobId}
    return success(
      {
        jobId: job.id,
        status: "queued" as const,
      },
      201,
    );
  } catch (err) {
    console.error("[POST /api/jobs]", err);
    return error("INTERNAL_ERROR", "Falha ao criar o job.", 500);
  }
}
