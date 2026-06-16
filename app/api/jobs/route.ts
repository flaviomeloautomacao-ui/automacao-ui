/**
 * Route Handler — /api/jobs
 *
 * GET  → Lista jobs (limit/offset via query string)
 * POST → Recebe planilha via FormData, valida, persiste e cria Report vazio
 *        para complementação. Não dispara processamento.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { listJobsQuerySchema } from "@/lib/validators";
import { parseSpreadsheet } from "@/lib/spreadsheetParser";
import { validateSpreadsheet, normalizeRow } from "@/lib/spreadsheetContract";
import { validateAreaSpreadsheet } from "@/lib/spreadsheetContractAreas";
import { getArchiveExpirationDate, formatDatePath } from "@/lib/date";
import { getDatabaseErrorMessage } from "@/lib/databaseError";
import { getSupabaseAdmin, STORAGE_BUCKET, ensureStorageBucket } from "@/lib/supabaseServer";
import { MAX_UPLOAD_MB, ALLOWED_EXTENSIONS, PIPELINE_STEPS } from "@/lib/constants";
import {
  DOCUMENT_SCHEMA_V2,
  documentTypeToLegacyProfile,
  getDocumentTypeLabel,
  isDocumentType,
  legacyProfileToDocumentType,
  type DocumentType,
} from "@/lib/documents";
import type { ApiResponse } from "@/lib/types";

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

const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
const BATCH_SIZE = 500;

interface UploadValidationResult {
  valid: boolean;
  errors: unknown[];
  warnings: unknown[];
  rows: Record<string, string>[];
  rowCount: number;
  metadata: Record<string, string>;
}

function resolveRequestedDocumentType(formData: FormData): DocumentType | null {
  const explicitDocumentType = (formData.get("documentType") as string | null)?.trim();
  if (isDocumentType(explicitDocumentType)) {
    return explicitDocumentType;
  }

  const legacyProfile = (formData.get("profile") as string | null)?.trim();
  return legacyProfileToDocumentType(legacyProfile);
}

function collectDhaEquipmentSeeds(rows: Record<string, string>[]) {
  const equipmentGroups = new Map<
    string,
    { equipmentName: string; equipmentDescription: string | null }
  >();

  for (const row of rows) {
    const equipmentName = (row["Equipamento"] ?? "").trim();
    if (!equipmentName) continue;

    if (!equipmentGroups.has(equipmentName)) {
      equipmentGroups.set(equipmentName, {
        equipmentName,
        equipmentDescription: (row["Descrição do equipamento"] ?? "").trim() || null,
      });
    }
  }

  return Array.from(equipmentGroups.values());
}

function collectAreaSeeds(rows: Record<string, string>[]) {
  const areas = new Map<
    string,
    {
      areaName: string;
      orderIndex: number;
      description: string | null;
      sources: Array<{
        tagReferencia: string | null;
        substanceName: string;
        sourceName: string;
        liberationDegree: string;
        ventilationType: string;
        ventilationDegree: string;
        ventilationAvailability: string;
        zone: string;
        extension: string;
        grupo: string | null;
        classeTemperatura: string | null;
        epl: string | null;
        temperaturaProcesso: string | null;
        pressaoProcesso: string | null;
        volumeProcesso: string | null;
        notes: string | null;
      }>;
    }
  >();

  const substances = new Map<
    string,
    {
      substanceName: string;
      orderIndex: number;
      grupo: string | null;
      classeTemperatura: string | null;
      epl: string | null;
      tipo: string | null;
      zones: Set<string>;
    }
  >();

  for (const row of rows) {
    const areaName = (row.area_local ?? "").trim();
    if (!areaName) continue;

    if (!areas.has(areaName)) {
      areas.set(areaName, {
        areaName,
        orderIndex: areas.size + 1,
        description: null,
        sources: [],
      });
    }

    const area = areas.get(areaName)!;
    const areaDescription = (row.area_descricao ?? "").trim();
    if (areaDescription && !area.description) {
      area.description = areaDescription;
    }
    area.sources.push({
      tagReferencia: row.tag_referencia?.trim() || null,
      substanceName: row.substancia,
      sourceName: row.fonte_liberacao,
      liberationDegree: row.grau_liberacao,
      ventilationType: row.ventilacao_tipo,
      ventilationDegree: row.grau_ventilacao,
      ventilationAvailability: row.disponibilidade_ventilacao,
      zone: row.zona,
      extension: row.extensao,
      grupo: row.grupo?.trim() || null,
      classeTemperatura: row.classe_temperatura?.trim() || null,
      epl: row.epl?.trim() || null,
      temperaturaProcesso: row.temperatura_processo?.trim() || null,
      pressaoProcesso: row.pressao_processo?.trim() || null,
      volumeProcesso: row.volume_processo?.trim() || null,
      notes: row.observacoes?.trim() || null,
    });

    const substanceName = (row.substancia ?? "").trim();
    if (substanceName) {
      if (!substances.has(substanceName)) {
        substances.set(substanceName, {
          substanceName,
          orderIndex: substances.size + 1,
          grupo: row.grupo?.trim() || null,
          classeTemperatura: row.classe_temperatura?.trim() || null,
          epl: row.epl?.trim() || null,
          tipo: null,
          zones: new Set<string>(),
        });
      }
      const sub = substances.get(substanceName)!;
      const z = (row.zona ?? "").trim();
      if (z) sub.zones.add(z);
    }
  }

  // Auto-detecção de tipo (gás/vapor vs poeira/fibra) com base nas zonas observadas.
  const GAS_ZONES = new Set(["0", "1", "2"]);
  const DUST_ZONES = new Set(["20", "21", "22"]);
  const detectedSubstances = Array.from(substances.values()).map((sub) => {
    const hasGas = Array.from(sub.zones).some((z) => GAS_ZONES.has(z));
    const hasDust = Array.from(sub.zones).some((z) => DUST_ZONES.has(z));
    let tipo: string | null = null;
    if (hasGas && !hasDust) tipo = "gas_vapor";
    else if (hasDust && !hasGas) tipo = "poeira_fibra";
    return {
      substanceName: sub.substanceName,
      orderIndex: sub.orderIndex,
      grupo: sub.grupo,
      classeTemperatura: sub.classeTemperatura,
      epl: sub.epl,
      tipo,
    };
  });

  return {
    areas: Array.from(areas.values()),
    substances: detectedSubstances,
  };
}

async function persistDhaData(tx: {
  dhaSpreadsheetUpload: typeof prisma.dhaSpreadsheetUpload;
  dhaSpreadsheetRow: typeof prisma.dhaSpreadsheetRow;
  dhaReportEquipment: typeof prisma.dhaReportEquipment;
}, {
  jobId,
  originalFilename,
  file,
  validation,
  reportId,
}: {
  jobId: string;
  originalFilename: string;
  file: File;
  validation: UploadValidationResult;
  reportId: string;
}) {
  const upload = await tx.dhaSpreadsheetUpload.create({
    data: {
      jobId,
      originalFilename,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      rowCount: validation.rowCount,
      metadata: validation.metadata,
    },
  });

  for (let i = 0; i < validation.rows.length; i += BATCH_SIZE) {
    const batch = validation.rows.slice(i, i + BATCH_SIZE);
    await tx.dhaSpreadsheetRow.createMany({
      data: batch.map((row, batchIndex) => ({
        uploadId: upload.id,
        rowIndex: i + batchIndex + 1,
        equipmentName: row["Equipamento"] || null,
        equipmentDescription: row["Descrição do equipamento"] || null,
        rawJson: row,
        normalizedJson: normalizeRow(row),
      })),
    });
  }

  const equipmentEntries = collectDhaEquipmentSeeds(validation.rows);
  if (equipmentEntries.length > 0) {
    await tx.dhaReportEquipment.createMany({
      data: equipmentEntries.map((entry, index) => ({
        reportId,
        equipmentName: entry.equipmentName,
        equipmentDescription: entry.equipmentDescription,
        orderIndex: index + 1,
      })),
    });
  }

  return { equipmentCount: equipmentEntries.length };
}

async function persistAreaData(tx: {
  areaSpreadsheetUpload: typeof prisma.areaSpreadsheetUpload;
  areaSpreadsheetRow: typeof prisma.areaSpreadsheetRow;
  areaReportArea: typeof prisma.areaReportArea;
  areaReportSource: typeof prisma.areaReportSource;
  areaReportSubstance: typeof prisma.areaReportSubstance;
}, {
  jobId,
  originalFilename,
  file,
  validation,
  reportId,
}: {
  jobId: string;
  originalFilename: string;
  file: File;
  validation: UploadValidationResult;
  reportId: string;
}) {
  const upload = await tx.areaSpreadsheetUpload.create({
    data: {
      jobId,
      originalFilename,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      rowCount: validation.rowCount,
      metadata: validation.metadata,
    },
  });

  for (let i = 0; i < validation.rows.length; i += BATCH_SIZE) {
    const batch = validation.rows.slice(i, i + BATCH_SIZE);
    await tx.areaSpreadsheetRow.createMany({
      data: batch.map((row, batchIndex) => ({
        uploadId: upload.id,
        rowIndex: i + batchIndex + 1,
        areaLocal: row.area_local,
        tagReferencia: row.tag_referencia || null,
        substancia: row.substancia,
        fonteLiberacao: row.fonte_liberacao,
        grauLiberacao: row.grau_liberacao,
        ventilacaoTipo: row.ventilacao_tipo,
        grauVentilacao: row.grau_ventilacao,
        disponibilidadeVentilacao: row.disponibilidade_ventilacao,
        zona: row.zona,
        extensao: row.extensao,
        grupo: row.grupo || null,
        classeTemperatura: row.classe_temperatura || null,
        epl: row.epl || null,
        observacoes: row.observacoes || null,
        temperaturaProcesso: row.temperatura_processo || null,
        pressaoProcesso: row.pressao_processo || null,
        volumeProcesso: row.volume_processo || null,
        rawJson: row,
        normalizedJson: row,
      })),
    });
  }

  const seeds = collectAreaSeeds(validation.rows);

  for (const area of seeds.areas) {
    const createdArea = await tx.areaReportArea.create({
      data: {
        reportId,
        areaName: area.areaName,
        orderIndex: area.orderIndex,
        ...(area.description && { description: area.description }),
      },
    });

    if (area.sources.length > 0) {
      await tx.areaReportSource.createMany({
        data: area.sources.map((source, index) => ({
          areaId: createdArea.id,
          orderIndex: index + 1,
          tagReferencia: source.tagReferencia,
          substanceName: source.substanceName,
          sourceName: source.sourceName,
          liberationDegree: source.liberationDegree,
          ventilationType: source.ventilationType,
          ventilationDegree: source.ventilationDegree,
          ventilationAvailability: source.ventilationAvailability,
          zone: source.zone,
          extension: source.extension,
          grupo: source.grupo,
          classeTemperatura: source.classeTemperatura,
          epl: source.epl,
          temperaturaProcesso: source.temperaturaProcesso,
          pressaoProcesso: source.pressaoProcesso,
          volumeProcesso: source.volumeProcesso,
          notes: source.notes,
        })),
      });
    }
  }

  if (seeds.substances.length > 0) {
    await tx.areaReportSubstance.createMany({
      data: seeds.substances.map((substance) => ({
        reportId,
        substanceName: substance.substanceName,
        orderIndex: substance.orderIndex,
        grupo: substance.grupo,
        classeTemperatura: substance.classeTemperatura,
        epl: substance.epl,
        tipo: substance.tipo,
        legendNotes: [],
      })),
    });
  }

  return { areaCount: seeds.areas.length, substanceCount: seeds.substances.length };
}

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
        queryResult.error.issues.map((issue) => issue.message).join("; "),
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
    return error("DATABASE_UNAVAILABLE", getDatabaseErrorMessage(err), 503);
  }
}

export async function POST(request: NextRequest) {
  try {
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return error("INVALID_FORM", "Request must be multipart/form-data.");
    }

    const file = formData.get("file") as File | null;
    const documentType = resolveRequestedDocumentType(formData);

    if (!file || !(file instanceof File) || file.size === 0) {
      return error("MISSING_FILE", "O campo 'file' é obrigatório.");
    }

    if (!documentType) {
      return error(
        "MISSING_DOCUMENT_TYPE",
        "O campo 'documentType' é obrigatório e deve ser 'dha' ou 'areas'.",
      );
    }

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

    if (file.size > MAX_UPLOAD_BYTES) {
      return error(
        "FILE_TOO_LARGE",
        `Arquivo excede o limite de ${MAX_UPLOAD_MB}MB (${(file.size / (1024 * 1024)).toFixed(1)}MB).`,
      );
    }

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

    let validation: UploadValidationResult;
    if (documentType === "areas") {
      const result = validateAreaSpreadsheet(rawRows);
      validation = {
        valid: result.valid,
        errors: result.errors,
        warnings: result.warnings,
        rows: result.rows,
        rowCount: result.rowCount,
        metadata: result.metadata,
      };
    } else {
      const result = validateSpreadsheet(rawRows);
      validation = {
        valid: result.valid,
        errors: result.errors,
        warnings: result.warnings,
        rows: result.rows,
        rowCount: result.rowCount,
        metadata: result.metadata as unknown as Record<string, string>,
      };
    }

    if (!validation.valid) {
      return error(
        "INVALID_SPREADSHEET",
        `A planilha de ${getDocumentTypeLabel(documentType)} contém ${validation.errors.length} erro(s) de validação.`,
        422,
        validation.errors,
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const job = await tx.job.create({
        data: {
          filename: originalFilename,
          profile: documentTypeToLegacyProfile(documentType),
          documentType,
          documentSchemaVersion: DOCUMENT_SCHEMA_V2,
          status: "awaiting_complement",
          progress: 0,
          currentStep: "Aguardando complementação",
          rowCount: validation.rowCount,
        },
      });

      await tx.jobStep.createMany({
        data: PIPELINE_STEPS.map((step) => ({
          jobId: job.id,
          name: step.name,
          label: step.label,
          order: step.order,
          status: "queued",
        })),
      });

      const report = await tx.report.create({
        data: {
          jobId: job.id,
          ...(documentType === "areas" && {
            ...(validation.metadata?.cliente && {
              razaoSocial: validation.metadata.cliente,
            }),
            ...(validation.metadata?.tipo_unidade && {
              tipoUnidade: validation.metadata.tipo_unidade,
            }),
            ...(validation.metadata?.local_vistoriado && {
              localVistoriado: validation.metadata.local_vistoriado,
            }),
            ...(validation.metadata?.contrato && {
              contrato: validation.metadata.contrato,
            }),
            ...(validation.metadata?.art && {
              artNumero: validation.metadata.art,
            }),
          }),
        },
      });

      const persistedData = documentType === "areas"
        ? await persistAreaData(tx, {
          jobId: job.id,
          originalFilename,
          file,
          validation,
          reportId: report.id,
        })
        : await persistDhaData(tx, {
          jobId: job.id,
          originalFilename,
          file,
          validation,
          reportId: report.id,
        });

      return { job, report, persistedData };
    });

    const { job } = result;
    const now = new Date();
    const archiveExpiresAt = getArchiveExpirationDate(now);
    const storagePath = `${job.id}/${formatDatePath(now)}/${originalFilename}`;

    try {
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

      await prisma.$transaction([
        prisma.job.update({
          where: { id: job.id },
          data: {
            archivePath: storagePath,
            archiveExpiresAt,
            progress: 5,
            currentStep: "Upload concluído — aguardando complementação",
          },
        }),
        prisma.jobStep.updateMany({
          where: { jobId: job.id, name: "upload_storage" },
          data: { status: "done", completedAt: new Date() },
        }),
      ]);
    } catch (storageErr) {
      console.error("[POST /api/jobs] Storage upload failed:", storageErr);
    }

    const responseData: Record<string, unknown> = {
      jobId: job.id,
      redirectTo: `/jobs/${job.id}/complement`,
    };

    if (validation.warnings.length > 0) {
      responseData.warnings = validation.warnings;
    }

    return success(responseData, 201);
  } catch (err) {
    console.error("[POST /api/jobs]", err);
    return error("INTERNAL_ERROR", "Falha ao criar o job.", 500);
  }
}
