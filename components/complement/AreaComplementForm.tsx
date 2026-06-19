"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardFooter, CardHeader } from "@/components/ui/Card";
import { DropZone } from "@/components/ui/DropZone";
import type { ApiResponse } from "@/lib/types";
import { prepareImageForUpload } from "@/lib/prepareImageForUpload";

import css from "./ComplementForm.module.css";
import acss from "./AreaComplementForm.module.css";

type ReportFormValues = {
  razaoSocial: string;
  site: string;
  localVistoriado: string;
  dataAvaliacao: string;
  contrato: string;
  observacoesGerais: string;
  tipoUnidade: string;
};

export interface AreaComplementTeamMember {
  nome: string;
  papel: string;
  registro?: string;
}

export interface AreaComplementImage {
  id: string;
  publicId: string;
  secureUrl: string;
  width?: number | null;
  height?: number | null;
  caption?: string | null;
  createdAt?: string;
}

export interface AreaComplementRevision {
  id?: string;
  version: string;
  date: string;
  author: string;
  description: string;
}

export interface AreaComplementReport {
  id: string;
  jobId: string;
  razaoSocial: string | null;
  site: string | null;
  localVistoriado: string | null;
  dataAvaliacao: string | null;
  contrato: string | null;
  observacoesGerais: string | null;
  coverImageUrl: string | null;
  artNumero: string | null;
  codigoDocumento: string | null;
  tipoUnidade?: string | null;
  escopoComplementar?: string | null;
  equipeResponsavel?: AreaComplementTeamMember[] | null;
  equipeProjectExplo?: AreaComplementTeamMember[] | null;
  artPdfUrl?: string | null;
}

export interface AreaComplementSource {
  id: string;
  orderIndex: number;
  tagReferencia: string | null;
  substanceName: string;
  sourceName: string;
  zone: string;
  extension: string;
  grupo: string | null;
  classeTemperatura: string | null;
  epl: string | null;
  notes: string | null;
}

export interface AreaComplementArea {
  id: string;
  areaName: string;
  orderIndex: number;
  description?: string | null;
  operationalNotes: string | null;
  ventilationPremises: string | null;
  sources: AreaComplementSource[];
  photos?: AreaComplementImage[];
}

export interface AreaComplementSubstance {
  substanceName: string;
  orderIndex: number;
  grupo: string | null;
  classeTemperatura: string | null;
  epl: string | null;
  notes: string | null;
  propertiesJson?: unknown;
  tipo?: string | null;
  pontoFulgor?: string | null;
  lii?: string | null;
  densidadeRelativa?: string | null;
  tai?: string | null;
  cme?: string | null;
  mit?: string | null;
  sitCamada?: string | null;
  tmax?: string | null;
  st?: string | null;
  legendNotes?: string[] | null;
}

export interface AreaComplementReference {
  title: string;
  documentCode: string | null;
  documentUrl: string | null;
  notes: string | null;
}

interface Props {
  jobId: string;
  report: AreaComplementReport;
  revisions: AreaComplementRevision[];
  areas: AreaComplementArea[];
  substances: AreaComplementSubstance[];
  references: AreaComplementReference[];
}

// HEIC/HEIF (fotos de iPhone) são aceitos na seleção e convertidos para JPEG
// no navegador antes do upload (ver prepareImageForUpload). O file.type de HEIC
// costuma vir vazio, por isso incluímos as extensões além dos MIME types.
const COVER_IMAGE_ACCEPT =
  "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif";
const IMAGE_ACCEPT = `${COVER_IMAGE_ACCEPT},image/gif`;
const COVER_IMAGE_FORMATS = "JPEG, PNG, WebP ou HEIC";
const IMAGE_FORMATS = "JPEG, PNG, WebP, GIF ou HEIC";
const KONIS_RESPONSAVEL_TECNICO = "Francisco Flávio Melo Cavalcante";
const KONIS_CREA = "CREA SP – 5060562076";

function rejectedImageMessage(files: File[], formats: string): string {
  const prefix =
    files.length === 1
      ? `Arquivo recusado: ${files[0].name}.`
      : `${files.length} arquivos recusados.`;
  return `${prefix} Use ${formats}.`;
}

const STEP_LABELS = [
  "Dados Gerais",
  "Áreas e Fontes",
  "Substâncias e Referências",
  "Revisão",
] as const;

function extractProperties(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value && "resumo" in value) {
    return typeof (value as { resumo?: unknown }).resumo === "string"
      ? ((value as { resumo: string }).resumo)
      : "";
  }
  return "";
}

// ─── Helpers de UX (A.1 / A.4) ────────────────────────────────────

/** Normaliza um texto para comparação fuzzy (sem acentos, lowercase, alfanumérico). */
function normalizeForAreaMatch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

interface AreaImageMatch {
  file: File;
  areaId: string | null;
  areaName: string | null;
}

/**
 * Auto-match de arquivos de imagem para áreas pelo nome do arquivo.
 * Estratégia: extrai o "stem" (sem extensão e sem trailing -N) e procura
 * uma área cujo `normalizeForAreaMatch(areaName)` esteja contido no stem
 * ou vice-versa.
 */
function matchAreaImages(
  files: File[],
  areas: Array<{ id: string; areaName: string }>,
): AreaImageMatch[] {
  const normalizedAreas = areas.map((area) => ({
    id: area.id,
    areaName: area.areaName,
    normalized: normalizeForAreaMatch(area.areaName),
  }));

  return files.map((file) => {
    const stem = file.name
      .replace(/\.[^.]+$/, "")
      .replace(/[-_]\d+$/, "");
    const normalizedStem = normalizeForAreaMatch(stem);

    if (!normalizedStem) {
      return { file, areaId: null, areaName: null };
    }

    // Busca exata
    let match = normalizedAreas.find((a) => a.normalized === normalizedStem);
    // Busca por inclusão (stem contém ou está contido no nome da área)
    if (!match) {
      match = normalizedAreas.find(
        (a) =>
          a.normalized.length > 2 &&
          (normalizedStem.includes(a.normalized) || a.normalized.includes(normalizedStem)),
      );
    }

    if (match) {
      return { file, areaId: match.id, areaName: match.areaName };
    }
    return { file, areaId: null, areaName: null };
  });
}

type AreaValidationState = "complete" | "partial" | "empty";

function getAreaValidation(
  area: { description?: string | null; operationalNotes: string | null; ventilationPremises: string | null },
  photoCount: number,
): AreaValidationState {
  const filled = [
    (area.description ?? "").trim() !== "",
    (area.operationalNotes ?? "").trim() !== "",
    (area.ventilationPremises ?? "").trim() !== "",
    photoCount > 0,
  ];
  const filledCount = filled.filter(Boolean).length;
  if (filledCount === filled.length) return "complete";
  if (filledCount === 0) return "empty";
  return "partial";
}

function getSourceValidation(source: {
  grupo: string | null;
  classeTemperatura: string | null;
  epl: string | null;
}): AreaValidationState {
  const filled = [
    (source.grupo ?? "").trim() !== "",
    (source.classeTemperatura ?? "").trim() !== "",
    (source.epl ?? "").trim() !== "",
  ];
  const filledCount = filled.filter(Boolean).length;
  if (filledCount === filled.length) return "complete";
  if (filledCount === 0) return "empty";
  return "partial";
}

export function AreaComplementForm({
  jobId,
  report,
  areas: initialAreas,
  substances: initialSubstances,
  references: initialReferences,
}: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [coverImageUrl, setCoverImageUrl] = useState(report.coverImageUrl ?? null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverDropError, setCoverDropError] = useState<string | null>(null);
  const [areaDropError, setAreaDropError] = useState<{
    areaId: string;
    message: string;
  } | null>(null);
  const [artNumero, setArtNumero] = useState(report.artNumero ?? "");
  const [codigoDocumento, setCodigoDocumento] = useState(report.codigoDocumento ?? "");
  const [imagesByArea, setImagesByArea] = useState<Record<string, AreaComplementImage[]>>(() => {
    const map: Record<string, AreaComplementImage[]> = {};
    for (const area of initialAreas) {
      map[area.id] = area.photos ?? [];
    }
    return map;
  });
  const uploadingAreaRef = useRef<Set<string>>(new Set());
  const [uploadingAreas, setUploadingAreas] = useState<Set<string>>(new Set());
  const [areas, setAreas] = useState(initialAreas);
  const [substances, setSubstances] = useState(
    initialSubstances.map((item) => ({
      ...item,
      propertiesText: extractProperties(item.propertiesJson),
    })),
  );
  const [references, setReferences] = useState<AreaComplementReference[]>(initialReferences);

  const {
    register,
    getValues,
    trigger,
    formState: { errors },
  } = useForm<ReportFormValues>({
    defaultValues: {
      razaoSocial: report.razaoSocial ?? "",
      site: report.site ?? "",
      localVistoriado: report.localVistoriado ?? "",
      dataAvaliacao: report.dataAvaliacao
        ? report.dataAvaliacao.slice(0, 10)
        : new Date().toISOString().slice(0, 10),
      contrato: report.contrato ?? "",
      observacoesGerais: report.observacoesGerais ?? "",
      tipoUnidade: report.tipoUnidade ?? "",
    },
  });

  const totalSources = useMemo(
    () => areas.reduce((sum, area) => sum + area.sources.length, 0),
    [areas],
  );

  async function saveAll() {
    setSaving(true);
    setApiError(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/complement`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          report: {
            ...getValues(),
            artNumero,
            codigoDocumento,
            responsavel: KONIS_RESPONSAVEL_TECNICO,
            registroProfissional: KONIS_CREA,
          },
          areas: areas.map((area) => ({
            id: area.id,
            description: area.description ?? "",
            operationalNotes: area.operationalNotes ?? "",
            ventilationPremises: area.ventilationPremises ?? "",
          })),
          sources: areas.flatMap((area) =>
            area.sources.map((source) => ({
              id: source.id,
              notes: source.notes ?? "",
              grupo: source.grupo ?? "",
              classeTemperatura: source.classeTemperatura ?? "",
              epl: source.epl ?? "",
            })),
          ),
          substances: substances.map((item) => ({
            substanceName: item.substanceName,
            grupo: item.grupo ?? "",
            classeTemperatura: item.classeTemperatura ?? "",
            epl: item.epl ?? "",
            notes: item.notes ?? "",
            propertiesJson: item.propertiesText ? { resumo: item.propertiesText } : null,
            tipo: item.tipo ?? "",
            pontoFulgor: item.pontoFulgor ?? "",
            lii: item.lii ?? "",
            densidadeRelativa: item.densidadeRelativa ?? "",
            tai: item.tai ?? "",
            cme: item.cme ?? "",
            mit: item.mit ?? "",
            sitCamada: item.sitCamada ?? "",
            tmax: item.tmax ?? "",
            st: item.st ?? "",
            legendNotes: item.legendNotes ?? [],
          })),
          references: references.filter((reference) => reference.title.trim() !== ""),
        }),
      });
      const json: ApiResponse<{ updated: boolean }> = await res.json();
      if (json.error) {
        setApiError(json.error.message);
        return false;
      }
      return true;
    } catch {
      setApiError("Erro ao salvar complementação.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function nextStep() {
    if (step === 0) {
      const valid = await trigger();
      if (!valid) return;
    }
    const saved = await saveAll();
    if (saved) setStep((current) => Math.min(current + 1, STEP_LABELS.length - 1));
  }

  function goBack() {
    setStep((current) => Math.max(current - 1, 0));
  }

  async function startProcessing() {
    setSubmitting(true);
    const saved = await saveAll();
    if (!saved) {
      setSubmitting(false);
      return;
    }
    const res = await fetch(`/api/jobs/${jobId}/start-processing`, { method: "POST" });
    const json: ApiResponse<{ status: string }> = await res.json();
    if (json.error) {
      setApiError(json.error.message);
      setSubmitting(false);
      return;
    }
    router.push(`/jobs/${jobId}`);
  }

  async function uploadCover(file: File) {
    setCoverDropError(null);
    setUploadingCover(true);
    try {
      const ready = await prepareImageForUpload(file);
      const form = new FormData();
      form.append("file", ready);
      const res = await fetch(`/api/jobs/${jobId}/cover-image`, { method: "POST", body: form });
      const json: ApiResponse<{ coverImageUrl: string }> = await res.json();
      if (json.error) {
        setApiError(json.error.message);
        return;
      }
      setCoverImageUrl(json.data.coverImageUrl);
    } catch (err) {
      setCoverDropError(
        err instanceof Error
          ? err.message
          : "Falha ao fazer upload da imagem de capa.",
      );
    } finally {
      setUploadingCover(false);
    }
  }

  async function deleteCover() {
    try {
      const res = await fetch(`/api/jobs/${jobId}/cover-image`, { method: "DELETE" });
      const json: ApiResponse<{ deleted: boolean }> = await res.json();
      if (json.error) {
        setApiError(json.error.message);
        return;
      }
      setCoverImageUrl(null);
    } catch {
      setApiError("Falha ao remover imagem de capa.");
    }
  }

  function updateArea<K extends keyof AreaComplementArea>(
    index: number,
    field: K,
    value: AreaComplementArea[K],
  ) {
    setAreas((current) =>
      current.map((area, i) => (i === index ? { ...area, [field]: value } : area)),
    );
  }

  function updateSource<K extends keyof AreaComplementSource>(
    areaIndex: number,
    sourceIndex: number,
    field: K,
    value: AreaComplementSource[K],
  ) {
    setAreas((current) =>
      current.map((area, i) =>
        i !== areaIndex
          ? area
          : {
            ...area,
            sources: area.sources.map((source, j) =>
              j === sourceIndex ? { ...source, [field]: value } : source,
            ),
          },
      ),
    );
  }

  type SubstanceState = AreaComplementSubstance & { propertiesText: string };

  function updateSubstance<K extends keyof SubstanceState>(
    index: number,
    field: K,
    value: SubstanceState[K],
  ) {
    setSubstances((current) =>
      current.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  }

  function updateReference<K extends keyof AreaComplementReference>(
    index: number,
    field: K,
    value: AreaComplementReference[K],
  ) {
    setReferences((current) =>
      current.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  }

  // ── Image upload / delete (per-area) ──────────────
  async function handleAreaImageUpload(areaId: string, file: File) {
    setAreaDropError((current) => (current?.areaId === areaId ? null : current));
    uploadingAreaRef.current.add(areaId);
    setUploadingAreas(new Set(uploadingAreaRef.current));
    try {
      const ready = await prepareImageForUpload(file);
      const form = new FormData();
      form.append("file", ready);
      form.append("areaId", areaId);
      const res = await fetch("/api/images/upload", { method: "POST", body: form });
      const json: ApiResponse<AreaComplementImage> = await res.json();
      if (json.error) {
        setApiError(json.error.message);
        return;
      }
      const newImage = json.data!;
      setImagesByArea((prev) => ({
        ...prev,
        [areaId]: [...(prev[areaId] ?? []), newImage],
      }));
    } catch (err) {
      setAreaDropError({
        areaId,
        message:
          err instanceof Error
            ? err.message
            : "Falha ao fazer upload da imagem da área.",
      });
    } finally {
      uploadingAreaRef.current.delete(areaId);
      setUploadingAreas(new Set(uploadingAreaRef.current));
    }
  }

  async function handleAreaImageDelete(areaId: string, imageId: string) {
    try {
      const res = await fetch(`/api/images/${imageId}`, { method: "DELETE" });
      const json: ApiResponse<{ deleted: boolean }> = await res.json();
      if (json.error) {
        setApiError(json.error.message);
        return;
      }
      setImagesByArea((prev) => ({
        ...prev,
        [areaId]: (prev[areaId] ?? []).filter((img) => img.id !== imageId),
      }));
    } catch {
      setApiError("Falha ao remover imagem da área.");
    }
  }

  // ── Batch upload com auto-match por nome (A.1) ───────────────────
  const [batchPreview, setBatchPreview] = useState<AreaImageMatch[]>([]);
  const [batchUploading, setBatchUploading] = useState(false);
  const [batchDropError, setBatchDropError] = useState<string | null>(null);

  function handleBatchSelect(files: File[]) {
    setBatchDropError(null);
    if (files.length === 0) {
      setBatchPreview([]);
      return;
    }
    const matches = matchAreaImages(files, areas);
    setBatchPreview(matches);
  }

  function assignBatchItem(index: number, areaId: string) {
    setBatchPreview((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
            ...item,
            areaId: areaId || null,
            areaName: areaId
              ? areas.find((a) => a.id === areaId)?.areaName ?? null
              : null,
          }
          : item,
      ),
    );
  }

  async function executeBatchUpload() {
    const toUpload = batchPreview.filter((item) => item.areaId !== null);
    if (toUpload.length === 0) return;
    setBatchUploading(true);
    try {
      for (const item of toUpload) {
        if (!item.areaId) continue;
        // eslint-disable-next-line no-await-in-loop
        await handleAreaImageUpload(item.areaId, item.file);
      }
      setBatchPreview([]);
    } finally {
      setBatchUploading(false);
    }
  }

  return (
    <div className={css.page}>
      <div className={css.header}>
        <h1 className={css.title}>Complementação — Classificação de Áreas</h1>
        <p className={css.subtitle}>
          Etapa {step + 1} de {STEP_LABELS.length} ·{" "}
          <span className={acss.headerSummary}>
            {areas.length} áreas · {totalSources} fontes · {substances.length} substâncias
          </span>
        </p>
        <div className={css.steps}>
          {STEP_LABELS.map((label, index) => (
            <div
              key={label}
              className={[
                css.stepPill,
                index === step ? css.active : "",
                index < step ? css.completed : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {index + 1}. {label}
            </div>
          ))}
        </div>
      </div>

      {apiError && <div className={css.alert}>{apiError}</div>}

      <div className={css.stageArea}>
        <Card>
          <CardHeader>
            <strong>{STEP_LABELS[step]}</strong>
          </CardHeader>
          <CardBody className={css.scrollInner}>
            {step === 0 && (
              <>
                <div className={css.fieldGrid}>
                  <Field
                    label="Razão Social"
                    error={errors.razaoSocial?.message}
                    full
                  >
                    <input
                      className={`${css.input} ${errors.razaoSocial ? css.inputError : ""}`}
                      {...register("razaoSocial", { required: "Razão Social é obrigatória" })}
                    />
                  </Field>
                  <Field label="Unidade">
                    <input className={css.input} {...register("site")} />
                  </Field>
                  <Field label="Local Vistoriado">
                    <input className={css.input} {...register("localVistoriado")} />
                  </Field>
                  <Field label="Data da Avaliação">
                    <input type="date" className={css.input} {...register("dataAvaliacao")} />
                  </Field>
                  <Field label="Contrato">
                    <input className={css.input} {...register("contrato")} />
                  </Field>
                  <Field label="Código do Documento">
                    <input
                      className={css.input}
                      value={codigoDocumento}
                      onChange={(e) => setCodigoDocumento(e.target.value)}
                    />
                  </Field>
                  <Field label="Tipo de Unidade">
                    <input
                      className={css.input}
                      placeholder="Ex: SFS, FCC, URE"
                      {...register("tipoUnidade")}
                    />
                  </Field>
                  <Field label="ART">
                    <input
                      className={css.input}
                      value={artNumero}
                      onChange={(e) => setArtNumero(e.target.value)}
                    />
                  </Field>
                  <div className={css.fieldFull}>
                    <div className={css.staticBlock}>
                      <span className={css.staticBlockTitle}>Elaboração</span>
                      <p className={css.staticBlockText}>
                        Konis Ex do Brasil Ltda.
                      </p>
                      <p className={css.staticBlockText}>
                        Responsável Técnico: {KONIS_RESPONSAVEL_TECNICO}
                      </p>
                      <p className={css.staticBlockText}>{KONIS_CREA}</p>
                    </div>
                  </div>
                  <Field label="Observações Gerais" full>
                    <textarea
                      className={css.textarea}
                      rows={5}
                      {...register("observacoesGerais")}
                    />
                  </Field>
                </div>

                <div className={css.coverSection}>
                  <strong className={css.label}>Imagem de Capa</strong>
                  <DropZone
                    className={`${css.dropzone} ${css.coverDropzone}`}
                    activeClassName={css.dragActive}
                    accept={COVER_IMAGE_ACCEPT}
                    disabled={uploadingCover}
                    onRejectedFiles={(files) =>
                      setCoverDropError(
                        rejectedImageMessage(files, COVER_IMAGE_FORMATS),
                      )
                    }
                    onFiles={(files) => {
                      const file = files[0];
                      if (file) void uploadCover(file);
                    }}
                  >
                    <span className={css.dropzoneIcon}>📷</span>
                    <span className={css.dropzoneText}>
                      {uploadingCover ? "Enviando..." : "Clique ou arraste a imagem de capa"}
                    </span>
                    <span className={css.dropzoneHint}>JPG, PNG ou WEBP</span>
                  </DropZone>
                  {coverDropError && (
                    <span className={css.dropzoneError}>{coverDropError}</span>
                  )}
                  {coverImageUrl && (
                    <div className={css.coverPreview}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={coverImageUrl} alt="Capa" className={css.coverImg} />
                      <button
                        type="button"
                        className={css.coverRemoveBtn}
                        onClick={() => void deleteCover()}
                      >
                        Remover
                      </button>
                    </div>
                  )}
                </div>

              </>
            )}

            {step === 1 && (
              <>
                {areas.length === 0 && (
                  <p className={css.fieldHint}>Nenhuma área detectada na planilha.</p>
                )}

                {/* ─── Upload em lote com auto-match (A.1) ──────────── */}
                {areas.length > 0 && (
                  <div style={{ marginBottom: "1rem" }}>
                    <div className={acss.sectionHeader}>
                      <h3 className={acss.sectionTitle}>Upload de imagens em lote</h3>
                      <span className={acss.headerSummary}>
                        Auto-vincula pelo nome do arquivo
                      </span>
                    </div>
                    <DropZone
                      className={acss.batchDropzone}
                      activeClassName={acss.batchDragActive}
                      accept={IMAGE_ACCEPT}
                      multiple
                      onRejectedFiles={(files) =>
                        setBatchDropError(
                          rejectedImageMessage(files, IMAGE_FORMATS),
                        )
                      }
                      onFiles={handleBatchSelect}
                    >
                      <span style={{ fontSize: "1.5rem" }}>📦</span>
                      <strong>Clique para selecionar ou arraste várias imagens aqui</strong>
                      <span className={css.fieldHint}>
                        Formatos aceitos: JPEG (.jpg / .jpeg), PNG (.png), WebP (.webp), GIF (.gif) — máx. 10MB por arquivo — múltiplos arquivos simultâneos.{" "}
                        Use o nome da área no arquivo (ex.: <code>SiloBaiaNorte-0.jpg</code>).{" "}
                        Não-matched podem ser atribuídos manualmente abaixo.
                      </span>
                    </DropZone>
                    {batchDropError && (
                      <span className={css.dropzoneError}>{batchDropError}</span>
                    )}
                    {batchPreview.length > 0 && (
                      <>
                        <div className={acss.batchList}>
                          {batchPreview.map((item, idx) => (
                            <div
                              key={`${item.file.name}-${idx}`}
                              className={`${acss.batchItem} ${item.areaId ? acss.batchItemMatched : acss.batchItemUnmatched
                                }`}
                            >
                              <span>{item.areaId ? "✓" : "⚠"}</span>
                              <span className={acss.batchItemName}>{item.file.name}</span>
                              <select
                                className={css.inputSmall}
                                value={item.areaId ?? ""}
                                onChange={(e) => assignBatchItem(idx, e.target.value)}
                              >
                                <option value="">— sem área —</option>
                                {areas.map((a) => (
                                  <option key={a.id} value={a.id}>
                                    {a.areaName}
                                  </option>
                                ))}
                              </select>
                            </div>
                          ))}
                        </div>
                        <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.5rem" }}>
                          <Button
                            type="button"
                            onClick={() => void executeBatchUpload()}
                            disabled={
                              batchUploading ||
                              batchPreview.filter((b) => b.areaId).length === 0
                            }
                          >
                            {batchUploading
                              ? "Enviando..."
                              : `Enviar ${batchPreview.filter((b) => b.areaId).length} imagem(ns)`}
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setBatchPreview([])}
                            disabled={batchUploading}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* ─── Acordeão por área (A.2) ─────────────────────── */}
                {areas.map((area, areaIndex) => {
                  const photos = imagesByArea[area.id] ?? [];
                  const areaState = getAreaValidation(area, photos.length);
                  const completeSources = area.sources.filter(
                    (s) => getSourceValidation(s) === "complete",
                  ).length;
                  return (
                    <details
                      key={area.id}
                      className={acss.accordion}
                      open={areaIndex === 0}
                    >
                      <summary className={acss.accordionSummary}>
                        <span className={acss.areaIndex}>{area.orderIndex}</span>
                        <div className={acss.accordionFlex}>
                          <span className={acss.accordionTitle}>{area.areaName}</span>
                          {area.description && (
                            <span className={acss.accordionSub}>— {area.description}</span>
                          )}
                        </div>
                        <span className={acss.accordionSub}>
                          {area.sources.length} fonte{area.sources.length === 1 ? "" : "s"} ·{" "}
                          {photos.length} foto{photos.length === 1 ? "" : "s"}
                        </span>
                        <span
                          className={`${acss.badge} ${areaState === "complete"
                            ? acss.badgeOk
                            : areaState === "empty"
                              ? acss.badgeWarn
                              : acss.badgeInfo
                            }`}
                          title="Dados gerais da área (descrição, notas, ventilação, fotos)"
                        >
                          {areaState === "complete"
                            ? "✓ Completa"
                            : areaState === "empty"
                              ? "⚠ Pendente"
                              : "● Parcial"}
                        </span>
                        <span
                          className={`${acss.badge} ${completeSources === area.sources.length && area.sources.length > 0
                            ? acss.badgeOk
                            : acss.badgeInfo
                            }`}
                          title="Fontes com Grupo/Classe T/EPL preenchidos"
                        >
                          {completeSources}/{area.sources.length} fontes
                        </span>
                      </summary>
                      <div className={acss.accordionBody}>
                        <div className={css.fieldGrid}>
                          <Field label="Descrição da Área" full>
                            <textarea
                              className={css.textarea}
                              rows={3}
                              placeholder="Caracterização operacional, processos e referências da área…"
                              value={area.description ?? ""}
                              onChange={(e) =>
                                updateArea(areaIndex, "description", e.target.value)
                              }
                            />
                          </Field>
                          <Field label="Notas Operacionais" full>
                            <textarea
                              className={css.textarea}
                              rows={3}
                              value={area.operationalNotes ?? ""}
                              onChange={(e) =>
                                updateArea(areaIndex, "operationalNotes", e.target.value)
                              }
                            />
                          </Field>
                          <Field label="Premissas de Ventilação" full>
                            <textarea
                              className={css.textarea}
                              rows={3}
                              value={area.ventilationPremises ?? ""}
                              onChange={(e) =>
                                updateArea(areaIndex, "ventilationPremises", e.target.value)
                              }
                            />
                          </Field>
                        </div>

                        {/* Imagens da área */}
                        <div className={css.imageSection}>
                          <span className={css.label}>Imagens ({photos.length})</span>
                          <div className={css.imageGrid}>
                            {photos.map((img) => (
                              <div key={img.id} className={css.imageThumb}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={img.secureUrl} alt="Área" />
                                <button
                                  type="button"
                                  className={css.imageDelete}
                                  title="Remover imagem"
                                  onClick={() => void handleAreaImageDelete(area.id, img.id)}
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                            <DropZone
                              className={`${css.uploadBtn} ${uploadingAreas.has(area.id) ? css.uploading : ""}`}
                              activeClassName={css.uploadBtnActive}
                              accept={IMAGE_ACCEPT}
                              disabled={uploadingAreas.has(area.id)}
                              onRejectedFiles={(files) =>
                                setAreaDropError({
                                  areaId: area.id,
                                  message: rejectedImageMessage(
                                    files,
                                    IMAGE_FORMATS,
                                  ),
                                })
                              }
                              onFiles={(files) => {
                                const file = files[0];
                                if (file) void handleAreaImageUpload(area.id, file);
                              }}
                            >
                              {uploadingAreas.has(area.id) ? "…" : "+"}
                            </DropZone>
                          </div>
                          {areaDropError?.areaId === area.id && (
                            <span className={css.dropzoneError}>
                              {areaDropError.message}
                            </span>
                          )}
                        </div>

                        {/* ─── Sub-acordeão por fonte (A.3) ──────── */}
                        {area.sources.map((source, sourceIndex) => {
                          const sourceState = getSourceValidation(source);
                          return (
                            <details
                              key={source.id}
                              className={acss.accordionNested}
                            >
                              <summary className={acss.accordionSummary}>
                                <div className={acss.accordionFlex}>
                                  <span className={acss.accordionTitle}>
                                    Fonte {source.orderIndex}: {source.sourceName}
                                  </span>
                                  <span className={acss.accordionSub}>
                                    Zona {source.zone} · Ext. {source.extension}
                                    {source.tagReferencia && ` · Tag ${source.tagReferencia}`}
                                    {source.substanceName && ` · ${source.substanceName}`}
                                  </span>
                                </div>
                                <span
                                  className={`${acss.badge} ${sourceState === "complete"
                                    ? acss.badgeOk
                                    : sourceState === "empty"
                                      ? acss.badgeWarn
                                      : acss.badgeInfo
                                    }`}
                                  title="Grupo / Classe T / EPL"
                                >
                                  {sourceState === "complete"
                                    ? "✓"
                                    : sourceState === "empty"
                                      ? "⚠"
                                      : "●"}
                                </span>
                              </summary>
                              <div className={acss.accordionBody}>
                                <div className={css.fieldGrid}>
                                  <Field label="Grupo">
                                    <input
                                      className={css.input}
                                      value={source.grupo ?? ""}
                                      onChange={(e) =>
                                        updateSource(
                                          areaIndex,
                                          sourceIndex,
                                          "grupo",
                                          e.target.value,
                                        )
                                      }
                                    />
                                  </Field>
                                  <Field label="Classe de Temperatura">
                                    <input
                                      className={css.input}
                                      value={source.classeTemperatura ?? ""}
                                      onChange={(e) =>
                                        updateSource(
                                          areaIndex,
                                          sourceIndex,
                                          "classeTemperatura",
                                          e.target.value,
                                        )
                                      }
                                    />
                                  </Field>
                                  <Field label="EPL">
                                    <input
                                      className={css.input}
                                      value={source.epl ?? ""}
                                      onChange={(e) =>
                                        updateSource(
                                          areaIndex,
                                          sourceIndex,
                                          "epl",
                                          e.target.value,
                                        )
                                      }
                                    />
                                  </Field>
                                  <Field label="Observações da Fonte" full>
                                    <textarea
                                      className={css.textarea}
                                      rows={2}
                                      value={source.notes ?? ""}
                                      onChange={(e) =>
                                        updateSource(
                                          areaIndex,
                                          sourceIndex,
                                          "notes",
                                          e.target.value,
                                        )
                                      }
                                    />
                                  </Field>
                                </div>
                              </div>
                            </details>
                          );
                        })}
                      </div>
                    </details>
                  );
                })}
              </>
            )}

            {step === 2 && (
              <>
                <div className={acss.sectionHeader}>
                  <h3 className={acss.sectionTitle}>Substâncias</h3>
                </div>
                {substances.length === 0 && (
                  <p className={css.fieldHint}>Nenhuma substância detectada.</p>
                )}
                {substances.map((item, index) => (
                  <div key={`${item.substanceName}-${index}`} className={acss.subCard}>
                    <div className={acss.subCardHeader}>
                      <span>{item.substanceName}</span>
                    </div>
                    <div className={css.fieldGrid}>
                      <Field label="Tipo">
                        <select
                          className={css.input}
                          value={item.tipo ?? ""}
                          onChange={(e) => updateSubstance(index, "tipo", e.target.value)}
                        >
                          <option value="">—</option>
                          <option value="gas_vapor">Gás/Vapor</option>
                          <option value="poeira_fibra">Poeira/Fibra</option>
                        </select>
                      </Field>
                      <Field label="Grupo">
                        <input
                          className={css.input}
                          value={item.grupo ?? ""}
                          onChange={(e) => updateSubstance(index, "grupo", e.target.value)}
                        />
                      </Field>
                      <Field label="Classe de Temperatura">
                        <input
                          className={css.input}
                          value={item.classeTemperatura ?? ""}
                          onChange={(e) =>
                            updateSubstance(index, "classeTemperatura", e.target.value)
                          }
                        />
                      </Field>
                      <Field label="EPL">
                        <input
                          className={css.input}
                          value={item.epl ?? ""}
                          onChange={(e) => updateSubstance(index, "epl", e.target.value)}
                        />
                      </Field>
                      <Field label="Ponto de Fulgor">
                        <input
                          className={css.input}
                          value={item.pontoFulgor ?? ""}
                          onChange={(e) =>
                            updateSubstance(index, "pontoFulgor", e.target.value)
                          }
                        />
                      </Field>
                      <Field label="LII">
                        <input
                          className={css.input}
                          value={item.lii ?? ""}
                          onChange={(e) => updateSubstance(index, "lii", e.target.value)}
                        />
                      </Field>
                      <Field label="Densidade Relativa">
                        <input
                          className={css.input}
                          value={item.densidadeRelativa ?? ""}
                          onChange={(e) =>
                            updateSubstance(index, "densidadeRelativa", e.target.value)
                          }
                        />
                      </Field>
                      <Field label="TAI">
                        <input
                          className={css.input}
                          value={item.tai ?? ""}
                          onChange={(e) => updateSubstance(index, "tai", e.target.value)}
                        />
                      </Field>
                      <Field label="CME">
                        <input
                          className={css.input}
                          value={item.cme ?? ""}
                          onChange={(e) => updateSubstance(index, "cme", e.target.value)}
                        />
                      </Field>
                      <Field label="MIT">
                        <input
                          className={css.input}
                          value={item.mit ?? ""}
                          onChange={(e) => updateSubstance(index, "mit", e.target.value)}
                        />
                      </Field>
                      <Field label="Sit. Camada">
                        <input
                          className={css.input}
                          value={item.sitCamada ?? ""}
                          onChange={(e) =>
                            updateSubstance(index, "sitCamada", e.target.value)
                          }
                        />
                      </Field>
                      <Field label="T.máx">
                        <input
                          className={css.input}
                          value={item.tmax ?? ""}
                          onChange={(e) => updateSubstance(index, "tmax", e.target.value)}
                        />
                      </Field>
                      <Field label="ST">
                        <input
                          className={css.input}
                          value={item.st ?? ""}
                          onChange={(e) => updateSubstance(index, "st", e.target.value)}
                        />
                      </Field>
                      <Field label="Propriedades Complementares" full>
                        <textarea
                          className={css.textarea}
                          rows={3}
                          value={item.propertiesText}
                          onChange={(e) =>
                            updateSubstance(index, "propertiesText", e.target.value)
                          }
                        />
                      </Field>
                      <Field label="Notas (legenda Tabela 1)" full>
                        <textarea
                          className={css.textarea}
                          rows={2}
                          value={(item.legendNotes ?? []).join("\n")}
                          onChange={(e) =>
                            updateSubstance(
                              index,
                              "legendNotes",
                              e.target.value
                                .split(/\n+/)
                                .map((line) => line.trim())
                                .filter(Boolean),
                            )
                          }
                        />
                      </Field>
                      <Field label="Notas" full>
                        <textarea
                          className={css.textarea}
                          rows={2}
                          value={item.notes ?? ""}
                          onChange={(e) => updateSubstance(index, "notes", e.target.value)}
                        />
                      </Field>
                    </div>
                  </div>
                ))}

                <div className={acss.sectionHeader} style={{ marginTop: "1.5rem" }}>
                  <h3 className={acss.sectionTitle}>Documentos de Referência</h3>
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() =>
                      setReferences((current) => [
                        ...current,
                        { title: "", documentCode: "", documentUrl: "", notes: "" },
                      ])
                    }
                  >
                    + Adicionar documento
                  </Button>
                </div>
                {references.map((reference, index) => (
                  <div key={`ref-${index}`} className={acss.subCard}>
                    <div className={css.fieldGrid}>
                      <Field label="Título" full>
                        <input
                          className={css.input}
                          value={reference.title}
                          onChange={(e) => updateReference(index, "title", e.target.value)}
                        />
                      </Field>
                      <Field label="Código">
                        <input
                          className={css.input}
                          value={reference.documentCode ?? ""}
                          onChange={(e) =>
                            updateReference(index, "documentCode", e.target.value)
                          }
                        />
                      </Field>
                      <Field label="URL">
                        <input
                          className={css.input}
                          value={reference.documentUrl ?? ""}
                          onChange={(e) =>
                            updateReference(index, "documentUrl", e.target.value)
                          }
                        />
                      </Field>
                      <Field label="Notas" full>
                        <textarea
                          className={css.textarea}
                          rows={2}
                          value={reference.notes ?? ""}
                          onChange={(e) => updateReference(index, "notes", e.target.value)}
                        />
                      </Field>
                    </div>
                  </div>
                ))}
              </>
            )}

            {step === 3 && (
              <div className={css.reviewSection}>
                <h3 className={css.reviewTitle}>Resumo</h3>
                <div className={css.reviewGrid}>
                  <span className={css.reviewLabel}>Razão Social</span>
                  <span className={css.reviewValue}>{getValues("razaoSocial") || "—"}</span>
                  <span className={css.reviewLabel}>Unidade</span>
                  <span className={css.reviewValue}>{getValues("site") || "—"}</span>
                  <span className={css.reviewLabel}>Local Vistoriado</span>
                  <span className={css.reviewValue}>{getValues("localVistoriado") || "—"}</span>
                  <span className={css.reviewLabel}>Áreas</span>
                  <span className={css.reviewValue}>{areas.length}</span>
                  <span className={css.reviewLabel}>Fontes de Liberação</span>
                  <span className={css.reviewValue}>{totalSources}</span>
                  <span className={css.reviewLabel}>Substâncias</span>
                  <span className={css.reviewValue}>{substances.length}</span>
                  <span className={css.reviewLabel}>Documentos de Referência</span>
                  <span className={css.reviewValue}>
                    {references.filter((item) => item.title.trim() !== "").length}
                  </span>
                </div>
                <div
                  className={css.staticBlock}
                  style={{ marginTop: "var(--space-3)" }}
                >
                  <span className={css.staticBlockTitle}>Elaboração</span>
                  <p className={css.staticBlockText}>
                    Konis Ex do Brasil Ltda.
                  </p>
                  <p className={css.staticBlockText}>
                    Responsável Técnico: {KONIS_RESPONSAVEL_TECNICO}
                  </p>
                  <p className={css.staticBlockText}>{KONIS_CREA}</p>
                </div>
              </div>
            )}
          </CardBody>
          <CardFooter>
            <div className={css.nav}>
              <Button variant="secondary" onClick={goBack} disabled={step === 0} type="button">
                ← Voltar
              </Button>
              <div className={css.navRight}>
                {step < STEP_LABELS.length - 1 ? (
                  <Button onClick={nextStep} disabled={saving} type="button">
                    {saving ? "Salvando..." : "Próximo →"}
                  </Button>
                ) : (
                  <Button onClick={startProcessing} disabled={submitting} type="button">
                    {submitting ? "Processando..." : "Gerar Relatório"}
                  </Button>
                )}
              </div>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  children,
  full,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  const cls = [css.field, full ? css.fieldFull : ""].filter(Boolean).join(" ");
  return (
    <label className={cls}>
      <span className={css.label}>{label}</span>
      {children}
      {error && <span className={css.errorText}>{error}</span>}
    </label>
  );
}
