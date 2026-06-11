/**
 * Route Handler — /api/jobs/[id]/complement
 *
 * GET   → Retorna complementação discriminada por documentType
 * PATCH → Atualiza dados da complementação em transação
 */

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeObservations } from "@/lib/normalizeObservations";
import { getJobDocumentType } from "@/lib/documents";
import type { ApiResponse } from "@/lib/types";

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

interface PatchReportInput {
  razaoSocial?: string;
  site?: string;
  localVistoriado?: string;
  dataAvaliacao?: string;
  contrato?: string;
  observacoesGerais?: string;
  artNumero?: string;
  codigoDocumento?: string;
  responsavel?: string;
  registroProfissional?: string;
  // Áreas — Fase 2
  escopoComplementar?: string;
  tipoUnidade?: string;
  equipeResponsavel?: unknown;
  equipeProjectExplo?: unknown;
  artPdfUrl?: string;
}

interface RevisionInput {
  version: string;
  date: string;
  author: string;
  description: string;
}

interface PatchDhaEquipmentInput {
  id: string;
  localInstalacao?: string;
  funcaoOperacional?: string;
  observacoesExtras?: string;
}

interface PatchAreaInput {
  id: string;
  description?: string;
  operationalNotes?: string;
  ventilationPremises?: string;
}

interface PatchAreaSourceInput {
  id: string;
  notes?: string;
  epl?: string;
  classeTemperatura?: string;
  grupo?: string;
}

interface PatchAreaSubstanceInput {
  substanceName: string;
  grupo?: string;
  classeTemperatura?: string;
  epl?: string;
  notes?: string;
  propertiesJson?: unknown;
  // Tabela 1 — Fase 2
  tipo?: string;
  pontoFulgor?: string;
  lii?: string;
  densidadeRelativa?: string;
  tai?: string;
  cme?: string;
  mit?: string;
  sitCamada?: string;
  tmax?: string;
  st?: string;
  legendNotes?: string[];
}

interface PatchAreaReferenceInput {
  title: string;
  documentCode?: string;
  documentUrl?: string;
  notes?: string;
}

interface PatchComplementBody {
  report?: PatchReportInput;
  revisions?: RevisionInput[];
  equipments?: PatchDhaEquipmentInput[];
  areas?: PatchAreaInput[];
  sources?: PatchAreaSourceInput[];
  substances?: PatchAreaSubstanceInput[];
  references?: PatchAreaReferenceInput[];
}

async function updateSharedReport(
  tx: {
    report: typeof prisma.report;
    reportRevision: typeof prisma.reportRevision;
  },
  reportId: string,
  reportInput?: PatchReportInput,
  revisions?: RevisionInput[],
) {
  if (reportInput) {
    const {
      razaoSocial,
      site,
      localVistoriado,
      dataAvaliacao,
      contrato,
      observacoesGerais,
      artNumero,
      codigoDocumento,
      responsavel,
      registroProfissional,
      escopoComplementar,
      tipoUnidade,
      equipeResponsavel,
      equipeProjectExplo,
      artPdfUrl,
    } = reportInput;

    const observacoesGeraisPrompt =
      observacoesGerais !== undefined
        ? normalizeObservations(observacoesGerais)
        : undefined;

    await tx.report.update({
      where: { id: reportId },
      data: {
        ...(razaoSocial !== undefined && { razaoSocial }),
        ...(site !== undefined && { site }),
        ...(localVistoriado !== undefined && { localVistoriado }),
        ...(dataAvaliacao !== undefined && {
          dataAvaliacao: new Date(dataAvaliacao),
        }),
        ...(contrato !== undefined && { contrato }),
        ...(observacoesGerais !== undefined && { observacoesGerais }),
        ...(observacoesGeraisPrompt !== undefined && {
          observacoesGeraisPrompt,
        }),
        ...(artNumero !== undefined && { artNumero }),
        ...(codigoDocumento !== undefined && { codigoDocumento }),
        ...(responsavel !== undefined && { responsavel }),
        ...(registroProfissional !== undefined && { registroProfissional }),
        ...(escopoComplementar !== undefined && { escopoComplementar }),
        ...(tipoUnidade !== undefined && { tipoUnidade }),
        ...(equipeResponsavel !== undefined && {
          equipeResponsavel:
            equipeResponsavel === null
              ? Prisma.JsonNull
              : (equipeResponsavel as Prisma.InputJsonValue),
        }),
        ...(equipeProjectExplo !== undefined && {
          equipeProjectExplo:
            equipeProjectExplo === null
              ? Prisma.JsonNull
              : (equipeProjectExplo as Prisma.InputJsonValue),
        }),
        ...(artPdfUrl !== undefined && { artPdfUrl }),
      },
    });
  }

  if (revisions) {
    await tx.reportRevision.deleteMany({
      where: { reportId },
    });

    if (revisions.length > 0) {
      await tx.reportRevision.createMany({
        data: revisions.map((revision) => ({
          reportId,
          version: revision.version,
          date: revision.date,
          author: revision.author,
          description: revision.description,
        })),
      });
    }
  }
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    if (!UUID_RE.test(id)) {
      return error("INVALID_ID", "Job ID must be a valid UUID");
    }

    const job = await prisma.job.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        profile: true,
        documentType: true,
        documentSchemaVersion: true,
      },
    });

    if (!job) {
      return error("NOT_FOUND", `Job ${id} not found`, 404);
    }

    const report = await prisma.report.findUnique({
      where: { jobId: id },
    });

    if (!report) {
      return error("REPORT_NOT_FOUND", `No report found for job ${id}`, 404);
    }

    const revisions = await prisma.reportRevision.findMany({
      where: { reportId: report.id },
      orderBy: { version: "asc" },
    });

    const documentType = getJobDocumentType(job);
    const isV2 = job.documentSchemaVersion === "v2";

    if (isV2 && documentType === "areas") {
      const areas = await prisma.areaReportArea.findMany({
        where: { reportId: report.id },
        orderBy: { orderIndex: "asc" },
        include: {
          sources: {
            orderBy: { orderIndex: "asc" },
          },
          photos: {
            orderBy: { createdAt: "asc" },
          },
        },
      });

      const substances = await prisma.areaReportSubstance.findMany({
        where: { reportId: report.id },
        orderBy: { orderIndex: "asc" },
      });

      const references = await prisma.areaReferenceDocument.findMany({
        where: { reportId: report.id },
        orderBy: { orderIndex: "asc" },
      });

      return success({
        documentType,
        report,
        revisions,
        areas,
        substances,
        references,
      });
    }

    if (isV2 && documentType === "dha") {
      const equipments = await prisma.dhaReportEquipment.findMany({
        where: { reportId: report.id },
        orderBy: { orderIndex: "asc" },
        include: {
          images: {
            orderBy: { createdAt: "asc" },
          },
        },
      });

      return success({
        documentType,
        report,
        revisions,
        equipments,
      });
    }

    const equipments = await prisma.reportEquipment.findMany({
      where: { reportId: report.id },
      orderBy: { orderIndex: "asc" },
      include: {
        images: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    return success({
      documentType,
      report,
      revisions,
      equipments,
    });
  } catch (err) {
    console.error("[GET /api/jobs/complement]", err);
    return error("INTERNAL_ERROR", "Failed to fetch complement data", 500);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    if (!UUID_RE.test(id)) {
      return error("INVALID_ID", "Job ID must be a valid UUID");
    }

    let body: PatchComplementBody;
    try {
      body = await request.json();
    } catch {
      return error("INVALID_JSON", "Request body must be valid JSON");
    }

    if (
      !body.report &&
      !body.revisions &&
      !body.equipments &&
      !body.areas &&
      !body.sources &&
      !body.substances &&
      !body.references
    ) {
      return error(
        "EMPTY_PAYLOAD",
        "At least one complement section must be provided.",
      );
    }

    const job = await prisma.job.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        profile: true,
        documentType: true,
        documentSchemaVersion: true,
      },
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

    const report = await prisma.report.findUnique({
      where: { jobId: id },
      select: { id: true },
    });

    if (!report) {
      return error("REPORT_NOT_FOUND", `No report found for job ${id}`, 404);
    }

    const documentType = getJobDocumentType(job);
    const isV2 = job.documentSchemaVersion === "v2";

    // Run independent row-level UPDATEs outside the transaction to avoid
    // holding a DB connection for the full duration (85 sources × ~700ms = timeout).
    const parallelUpdates: Promise<unknown>[] = [];

    if (isV2 && documentType === "dha" && body.equipments?.length) {
      const ops = body.equipments
        .filter((equipment) => UUID_RE.test(equipment.id))
        .map((equipment) =>
          prisma.dhaReportEquipment.update({
            where: { id: equipment.id },
            data: {
              ...(equipment.localInstalacao !== undefined && {
                localInstalacao: equipment.localInstalacao,
              }),
              ...(equipment.funcaoOperacional !== undefined && {
                funcaoOperacional: equipment.funcaoOperacional,
              }),
              ...(equipment.observacoesExtras !== undefined && {
                observacoesExtras: equipment.observacoesExtras,
              }),
            },
          }),
        );
      parallelUpdates.push(...ops);
    }

    if (isV2 && documentType === "areas") {
      if (body.areas?.length) {
        const ops = body.areas
          .filter((area) => UUID_RE.test(area.id))
          .map((area) =>
            prisma.areaReportArea.update({
              where: { id: area.id },
              data: {
                ...(area.description !== undefined && {
                  description: area.description,
                }),
                ...(area.operationalNotes !== undefined && {
                  operationalNotes: area.operationalNotes,
                }),
                ...(area.ventilationPremises !== undefined && {
                  ventilationPremises: area.ventilationPremises,
                }),
              },
            }),
          );
        parallelUpdates.push(...ops);
      }

      if (body.sources?.length) {
        const ops = body.sources
          .filter((source) => UUID_RE.test(source.id))
          .map((source) =>
            prisma.areaReportSource.update({
              where: { id: source.id },
              data: {
                ...(source.notes !== undefined && { notes: source.notes }),
                ...(source.epl !== undefined && { epl: source.epl }),
                ...(source.classeTemperatura !== undefined && {
                  classeTemperatura: source.classeTemperatura,
                }),
                ...(source.grupo !== undefined && { grupo: source.grupo }),
              },
            }),
          );
        parallelUpdates.push(...ops);
      }
    }

    if (!isV2 && body.equipments?.length) {
      const ops = body.equipments
        .filter((equipment) => UUID_RE.test(equipment.id))
        .map((equipment) =>
          prisma.reportEquipment.update({
            where: { id: equipment.id },
            data: {
              ...(equipment.localInstalacao !== undefined && {
                localInstalacao: equipment.localInstalacao,
              }),
              ...(equipment.funcaoOperacional !== undefined && {
                funcaoOperacional: equipment.funcaoOperacional,
              }),
              ...(equipment.observacoesExtras !== undefined && {
                observacoesExtras: equipment.observacoesExtras,
              }),
            },
          }),
        );
      parallelUpdates.push(...ops);
    }

    if (parallelUpdates.length > 0) {
      await Promise.all(parallelUpdates);
    }

    // Use a transaction only for the operations that truly need atomicity:
    // report/revisions update and substances/references delete+recreate.
    await prisma.$transaction(
      async (tx) => {
        await updateSharedReport(tx, report.id, body.report, body.revisions);

        if (isV2 && documentType === "areas") {
          if (body.substances) {
            await tx.areaReportSubstance.deleteMany({
              where: { reportId: report.id },
            });

            if (body.substances.length > 0) {
              await tx.areaReportSubstance.createMany({
                data: body.substances.map((substance, index) => ({
                  reportId: report.id,
                  substanceName: substance.substanceName,
                  orderIndex: index + 1,
                  grupo: substance.grupo || null,
                  classeTemperatura: substance.classeTemperatura || null,
                  epl: substance.epl || null,
                  notes: substance.notes || null,
                  tipo: substance.tipo || null,
                  pontoFulgor: substance.pontoFulgor || null,
                  lii: substance.lii || null,
                  densidadeRelativa: substance.densidadeRelativa || null,
                  tai: substance.tai || null,
                  cme: substance.cme || null,
                  mit: substance.mit || null,
                  sitCamada: substance.sitCamada || null,
                  tmax: substance.tmax || null,
                  st: substance.st || null,
                  legendNotes: substance.legendNotes ?? [],
                  ...(substance.propertiesJson !== undefined && {
                    propertiesJson:
                      substance.propertiesJson === null
                        ? Prisma.JsonNull
                        : (substance.propertiesJson as Prisma.InputJsonValue),
                  }),
                })),
              });
            }
          }

          if (body.references) {
            await tx.areaReferenceDocument.deleteMany({
              where: { reportId: report.id },
            });

            if (body.references.length > 0) {
              await tx.areaReferenceDocument.createMany({
                data: body.references.map((reference, index) => ({
                  reportId: report.id,
                  orderIndex: index + 1,
                  title: reference.title,
                  documentCode: reference.documentCode || null,
                  documentUrl: reference.documentUrl || null,
                  notes: reference.notes || null,
                })),
              });
            }
          }
        }
      },
      {
        maxWait: 10000,
        timeout: 30000,
      },
    );

    return success({ updated: true });
  } catch (err) {
    console.error("[PATCH /api/jobs/complement]", err);
    return error("INTERNAL_ERROR", "Failed to update complement data", 500);
  }
}
