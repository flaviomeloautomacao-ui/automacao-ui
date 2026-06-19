"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardBody, CardFooter } from "@/components/ui/Card";
import { DropZone } from "@/components/ui/DropZone";
import type { ApiResponse } from "@/lib/types";
import {
  matchImagesToEquipments,
  type ImageMatchResult,
} from "@/lib/normalizeEquipmentName";
import { prepareImageForUpload } from "@/lib/prepareImageForUpload";

import css from "./ComplementForm.module.css";

/* ================================================================== */
/*  Types coming from the GET /api/jobs/:id/complement response       */
/* ================================================================== */

export interface ComplementImage {
  id: string;
  publicId: string;
  secureUrl: string;
  width: number | null;
  height: number | null;
  createdAt: string;
}

export interface ComplementEquipment {
  id: string;
  equipmentName: string;
  equipmentDescription: string | null;
  orderIndex: number;
  localInstalacao: string | null;
  funcaoOperacional: string | null;
  observacoesExtras: string | null;
  images: ComplementImage[];
}

export interface ComplementRevision {
  id?: string;
  version: string;
  date: string;
  author: string;
  description: string;
}

export interface ComplementReport {
  id: string;
  jobId: string;
  razaoSocial: string | null;
  cnpj: string | null;
  site: string | null;
  endereco: string | null;
  localVistoriado: string | null;
  dataAvaliacao: string | null;
  contrato: string | null;
  elaboracao: string | null;
  responsavel: string | null;
  registroProfissional: string | null;
  observacoesGerais: string | null;
  coverImageUrl: string | null;
  coverImagePublicId: string | null;
  artNumero: string | null;
  codigoDocumento: string | null;
}

/* ================================================================== */
/*  Zod schemas                                                       */
/* ================================================================== */

const reportSchema = z.object({
  razaoSocial: z.string().min(1, "Razão Social é obrigatória"),
  site: z.string(),
  localVistoriado: z.string(),
  dataAvaliacao: z.string(),
  contrato: z.string(),
  observacoesGerais: z.string(),
});

const equipmentSchema = z.object({
  id: z.string(),
  equipmentName: z.string(),
  equipmentDescription: z.string().nullable(),
  localInstalacao: z.string(),
  funcaoOperacional: z.string(),
  observacoesExtras: z.string(),
});

const formSchema = z.object({
  report: reportSchema,
  equipments: z.array(equipmentSchema),
});

type FormValues = z.infer<typeof formSchema>;

/* ================================================================== */
/*  Props                                                             */
/* ================================================================== */

interface ComplementFormProps {
  jobId: string;
  report: ComplementReport;
  equipments: ComplementEquipment[];
  revisions: ComplementRevision[];
}

/* ================================================================== */
/*  Step labels — new flow per spec sections 2, 8, 12, 18            */
/* ================================================================== */

const STEP_LABELS = [
  "Dados Gerais",
  "Upload de Imagens",
  "Equipamentos",
  "Revisão",
] as const;

/* ================================================================== */
/*  Component                                                          */
/* ================================================================== */

const DEFAULT_AUTHOR = "Eng. Francisco Flávio Melo Cavalcante";
const KONIS_RESPONSAVEL_TECNICO = "Francisco Flávio Melo Cavalcante";
const KONIS_CREA = "CREA SP – 5060562076";
// HEIC/HEIF (fotos de iPhone) são aceitos na seleção e convertidos para JPEG
// no navegador antes do upload (ver prepareImageForUpload). O file.type de HEIC
// costuma vir vazio, por isso incluímos as extensões além dos MIME types.
const COVER_IMAGE_ACCEPT =
  "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif";
const IMAGE_ACCEPT = `${COVER_IMAGE_ACCEPT},image/gif`;
const COVER_IMAGE_FORMATS = "JPEG, PNG, WebP ou HEIC";
const IMAGE_FORMATS = "JPEG, PNG, WebP, GIF ou HEIC";

function rejectedImageMessage(files: File[], formats: string): string {
  const prefix =
    files.length === 1
      ? `Arquivo recusado: ${files[0].name}.`
      : `${files.length} arquivos recusados.`;
  return `${prefix} Use ${formats}.`;
}

function formatDateBR(d: Date = new Date()): string {
  return d.toLocaleDateString("pt-BR");
}

export function ComplementForm({
  jobId,
  report,
  equipments: initialEquipments,
  revisions: initialRevisions,
}: ComplementFormProps) {
  const router = useRouter();

  // ── Step management ─────────────────────────────────────
  // 0 = dados gerais, 1 = upload imagens, 2 = equipamentos, 3 = revisão
  const [step, setStep] = useState(0);
  const [eqStep, setEqStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // ── Cover image state (Feature 1) ──────────────────────
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(
    report.coverImageUrl ?? null,
  );
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverDropError, setCoverDropError] = useState<string | null>(null);

  // ── Revisions state (Feature 2) ────────────────────────
  const [revisions, setRevisions] = useState<ComplementRevision[]>(
    initialRevisions.length > 0
      ? initialRevisions
      : [
        {
          version: "00",
          date: formatDateBR(),
          author: DEFAULT_AUTHOR,
          description: "Emissão inicial",
        },
      ],
  );

  // ── Document fields state (Feature 5) ──────────────────
  const [artNumero, setArtNumero] = useState(report.artNumero ?? "");
  const [codigoDocumento, setCodigoDocumento] = useState(
    report.codigoDocumento ?? "",
  );

  // ── Image state ──────────────────────────────────────────
  const [imagesByEq, setImagesByEq] = useState<
    Record<string, ComplementImage[]>
  >(() => {
    const map: Record<string, ComplementImage[]> = {};
    for (const eq of initialEquipments) {
      map[eq.id] = eq.images ?? [];
    }
    return map;
  });

  // Batch upload state (step 1)
  const [batchResults, setBatchResults] = useState<ImageMatchResult[]>([]);
  const [batchUploading, setBatchUploading] = useState(false);
  const [batchDropError, setBatchDropError] = useState<string | null>(null);
  const [equipmentDropError, setEquipmentDropError] = useState<string | null>(
    null,
  );
  const [batchProgress, setBatchProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);

  // ── Form setup ─────────────────────────────────────────
  const {
    register,
    trigger,
    getValues,
    formState: { errors },
    control,
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      report: {
        razaoSocial: report.razaoSocial ?? "",
        site: report.site ?? "",
        localVistoriado: report.localVistoriado ?? "",
        dataAvaliacao: report.dataAvaliacao
          ? report.dataAvaliacao.slice(0, 10)
          : new Date().toISOString().slice(0, 10),
        contrato: report.contrato ?? "",
        observacoesGerais: report.observacoesGerais ?? "",
      },
      equipments: initialEquipments.map((eq) => ({
        id: eq.id,
        equipmentName: eq.equipmentName,
        equipmentDescription: eq.equipmentDescription,
        localInstalacao: eq.localInstalacao ?? "",
        funcaoOperacional: eq.funcaoOperacional ?? "",
        observacoesExtras: eq.observacoesExtras ?? "",
      })),
    },
  });

  const { fields: eqFields } = useFieldArray({
    control,
    name: "equipments",
  });

  // ── Cover image handlers ──────────────────────────────
  async function handleCoverUpload(file: File) {
    setCoverDropError(null);
    setUploadingCover(true);
    try {
      const ready = await prepareImageForUpload(file);
      const form = new FormData();
      form.append("file", ready);
      const res = await fetch(`/api/jobs/${jobId}/cover-image`, {
        method: "POST",
        body: form,
      });
      const json: ApiResponse<{
        coverImageUrl: string;
        coverImagePublicId: string;
      }> = await res.json();
      if (json.error) {
        alert(json.error.message);
        return;
      }
      setCoverImageUrl(json.data!.coverImageUrl);
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

  async function handleCoverDelete() {
    try {
      const res = await fetch(`/api/jobs/${jobId}/cover-image`, {
        method: "DELETE",
      });
      const json: ApiResponse<{ deleted: boolean }> = await res.json();
      if (json.error) {
        alert(json.error.message);
        return;
      }
      setCoverImageUrl(null);
    } catch {
      alert("Falha ao remover imagem de capa.");
    }
  }

  // ── Revision helpers ──────────────────────────────────
  function addRevision() {
    const nextVersion = String(revisions.length).padStart(2, "0");
    setRevisions((prev) => [
      ...prev,
      {
        version: nextVersion,
        date: formatDateBR(),
        author: DEFAULT_AUTHOR,
        description: "",
      },
    ]);
  }

  function removeRevision(index: number) {
    if (revisions.length <= 1) return;
    setRevisions((prev) => prev.filter((_, i) => i !== index));
  }

  function updateRevision(
    index: number,
    field: keyof ComplementRevision,
    value: string,
  ) {
    setRevisions((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)),
    );
  }

  // ── Save progress ──────────────────────────────────────
  const saveReport = useCallback(async () => {
    const values = getValues();
    setSaving(true);
    setApiError(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/complement`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          report: {
            ...values.report,
            dataAvaliacao: values.report.dataAvaliacao || undefined,
            artNumero,
            codigoDocumento,
            responsavel: KONIS_RESPONSAVEL_TECNICO,
            registroProfissional: KONIS_CREA,
          },
          revisions,
        }),
      });
      const json: ApiResponse<{ updated: boolean }> = await res.json();
      if (json.error) {
        setApiError(json.error.message);
        return false;
      }
      return true;
    } catch {
      setApiError("Erro ao salvar dados. Tente novamente.");
      return false;
    } finally {
      setSaving(false);
    }
  }, [getValues, jobId, artNumero, codigoDocumento, revisions]);

  const saveEquipment = useCallback(
    async (eqIndex: number) => {
      const eq = getValues(`equipments.${eqIndex}`);
      if (!eq) return true;
      setSaving(true);
      setApiError(null);
      try {
        const res = await fetch(`/api/jobs/${jobId}/complement`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            equipments: [
              {
                id: eq.id,
                localInstalacao: eq.localInstalacao,
                funcaoOperacional: eq.funcaoOperacional,
                observacoesExtras: eq.observacoesExtras,
              },
            ],
          }),
        });
        const json: ApiResponse<{ updated: boolean }> = await res.json();
        if (json.error) {
          setApiError(json.error.message);
          return false;
        }
        return true;
      } catch {
        setApiError("Erro ao salvar equipamento. Tente novamente.");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [getValues, jobId],
  );

  // ── Navigation ─────────────────────────────────────────
  async function goNext() {
    if (step === 0) {
      const valid = await trigger("report");
      if (!valid) return;
      const saved = await saveReport();
      if (!saved) return;
      setStep(1);
      return;
    }

    if (step === 1) {
      setStep(2);
      setEqStep(0);
      return;
    }

    if (step === 2) {
      const saved = await saveEquipment(eqStep);
      if (!saved) return;

      if (eqStep < eqFields.length - 1) {
        setEqStep((s) => s + 1);
        return;
      }
      setStep(3);
      return;
    }
  }

  function goBack() {
    if (step === 2 && eqStep > 0) {
      setEqStep((s) => s - 1);
      return;
    }
    if (step === 2 && eqStep === 0) {
      setStep(1);
      return;
    }
    if (step === 3) {
      setStep(2);
      setEqStep(eqFields.length - 1);
      return;
    }
    if (step > 0) {
      setStep((s) => s - 1);
      return;
    }
  }

  async function skipToNextWithoutImage() {
    const saved = await saveEquipment(eqStep);
    if (!saved) return;

    const vals = getValues();
    for (let i = eqStep + 1; i < eqFields.length; i++) {
      const eqId = vals.equipments[i]?.id;
      const imgs = eqId ? (imagesByEq[eqId] ?? []) : [];
      if (imgs.length === 0) {
        setEqStep(i);
        return;
      }
    }
    setStep(3);
  }

  async function skipToReview() {
    const saved = await saveEquipment(eqStep);
    if (!saved) return;
    setStep(3);
  }

  // ── Submit (start processing) ──────────────────────────
  async function onSubmit() {
    setSubmitting(true);
    setApiError(null);

    try {
      if (eqFields.length > 0) {
        const saved = await saveEquipment(eqStep);
        if (!saved) {
          setSubmitting(false);
          return;
        }
      }

      const res = await fetch(`/api/jobs/${jobId}/start-processing`, {
        method: "POST",
      });
      const json: ApiResponse<{ status: string }> = await res.json();
      if (json.error) {
        setApiError(json.error.message);
        setSubmitting(false);
        return;
      }
      router.push(`/jobs/${jobId}`);
    } catch {
      setApiError("Erro ao iniciar processamento.");
      setSubmitting(false);
    }
  }

  // ── Image upload / delete (per-equipment) ──────────────
  const uploadingRef = useRef<Set<string>>(new Set());
  const [uploadingEqs, setUploadingEqs] = useState<Set<string>>(new Set());

  async function handleImageUpload(equipmentId: string, file: File) {
    setEquipmentDropError(null);
    uploadingRef.current.add(equipmentId);
    setUploadingEqs(new Set(uploadingRef.current));

    try {
      const ready = await prepareImageForUpload(file);
      const form = new FormData();
      form.append("file", ready);
      form.append("equipmentId", equipmentId);

      const res = await fetch("/api/images/upload", {
        method: "POST",
        body: form,
      });
      const json: ApiResponse<{
        id: string;
        secureUrl: string;
        publicId: string;
        width: number;
        height: number;
      }> = await res.json();

      if (json.error) {
        alert(json.error.message);
        return;
      }

      const newImage: ComplementImage = {
        id: json.data!.id,
        publicId: json.data!.publicId,
        secureUrl: json.data!.secureUrl,
        width: json.data!.width,
        height: json.data!.height,
        createdAt: new Date().toISOString(),
      };

      setImagesByEq((prev) => ({
        ...prev,
        [equipmentId]: [...(prev[equipmentId] ?? []), newImage],
      }));
    } catch (err) {
      setEquipmentDropError(
        err instanceof Error ? err.message : "Falha ao fazer upload da imagem.",
      );
    } finally {
      uploadingRef.current.delete(equipmentId);
      setUploadingEqs(new Set(uploadingRef.current));
    }
  }

  async function handleImageDelete(equipmentId: string, imageId: string) {
    try {
      const res = await fetch(`/api/images/${imageId}`, { method: "DELETE" });
      const json: ApiResponse<{ deleted: boolean }> = await res.json();
      if (json.error) {
        alert(json.error.message);
        return;
      }
      setImagesByEq((prev) => ({
        ...prev,
        [equipmentId]: (prev[equipmentId] ?? []).filter(
          (img) => img.id !== imageId,
        ),
      }));
    } catch {
      alert("Falha ao deletar imagem.");
    }
  }

  // ── Batch image upload (step 1) ─────────────────────────
  function handleBatchFilesSelected(files: File[]) {
    setBatchDropError(null);
    if (files.length === 0) {
      setBatchResults([]);
      return;
    }
    const contrato = getValues("report.contrato") || "";
    const eqs = eqFields.map((eq, idx) => ({
      id: getValues(`equipments.${idx}.id`) ?? eq.id,
      equipmentName: eq.equipmentName,
    }));
    const results = matchImagesToEquipments(files, eqs, contrato);
    setBatchResults(results);
  }

  async function executeBatchUpload() {
    const matched = batchResults.filter((r) => r.matched && r.equipmentId);
    if (matched.length === 0) return;

    setBatchUploading(true);
    setBatchDropError(null);
    setBatchProgress({ current: 0, total: matched.length });

    const failedNames: string[] = [];

    for (let i = 0; i < matched.length; i++) {
      const item = matched[i];
      setBatchProgress({ current: i + 1, total: matched.length });

      try {
        const ready = await prepareImageForUpload(item.file);
        const form = new FormData();
        form.append("file", ready);
        form.append("equipmentId", item.equipmentId!);

        const res = await fetch("/api/images/upload", {
          method: "POST",
          body: form,
        });
        const json: ApiResponse<{
          id: string;
          secureUrl: string;
          publicId: string;
          width: number;
          height: number;
        }> = await res.json();

        if (!json.error && json.data) {
          const newImage: ComplementImage = {
            id: json.data.id,
            publicId: json.data.publicId,
            secureUrl: json.data.secureUrl,
            width: json.data.width,
            height: json.data.height,
            createdAt: new Date().toISOString(),
          };
          setImagesByEq((prev) => ({
            ...prev,
            [item.equipmentId!]: [
              ...(prev[item.equipmentId!] ?? []),
              newImage,
            ],
          }));
        } else if (json.error) {
          failedNames.push(item.file.name);
        }
      } catch {
        // Continue uploading remaining images on error
        failedNames.push(item.file.name);
      }
    }

    setBatchUploading(false);
    setBatchProgress(null);
    setBatchResults((prev) => prev.filter((r) => !r.matched));
    if (failedNames.length > 0) {
      setBatchDropError(
        `Falha ao enviar ${failedNames.length} imagem(ns): ${failedNames.join(", ")}.`,
      );
    }

    // Auto-advance to next step after batch upload completes
    goNext();
  }

  // ── Pendency computation for review (spec sections 18-19) ──
  const pendencies = useMemo(() => {
    const vals = getValues();
    const noImage: string[] = [];
    const noObs: string[] = [];
    for (let i = 0; i < eqFields.length; i++) {
      const v = vals.equipments[i];
      const eqId = v?.id ?? eqFields[i].id;
      const imgs = imagesByEq[eqId] ?? [];
      if (imgs.length === 0) noImage.push(eqFields[i].equipmentName);
      if (!v?.observacoesExtras?.trim()) noObs.push(eqFields[i].equipmentName);
    }
    return { noImage, noObs };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, imagesByEq, eqFields]);

  // ── Render ─────────────────────────────────────────────
  const values = getValues();

  return (
    <div className={css.page}>
      <header className={css.header}>
        <h1 className={css.title}>Complementação do Relatório</h1>
        <p className={css.subtitle}>Job {jobId}</p>
      </header>

      {/* Step indicator */}
      <div className={css.steps}>
        {STEP_LABELS.map((label, idx) => (
          <div
            key={idx}
            className={`${css.stepPill} ${idx === step ? css.active : ""} ${idx < step ? css.completed : ""}`}
          >
            {idx + 1}. {label}
          </div>
        ))}
      </div>

      {apiError && <div className={css.alert}>{apiError}</div>}

      <div className={css.stageArea}>
        {/* ─── Step 0: Dados Gerais ─────────────────────────── */}
        {step === 0 && (
          <Card>
            <CardHeader>Dados Gerais do Relatório</CardHeader>
            <CardBody>
              <div className={css.scrollInner}>
                <div className={css.fieldGrid}>
                  <Field
                    label="Razão Social *"
                    error={errors.report?.razaoSocial?.message}
                  >
                    <input
                      className={`${css.input} ${errors.report?.razaoSocial ? css.inputError : ""}`}
                      {...register("report.razaoSocial")}
                    />
                  </Field>

                  <Field label="Unidade">
                    <input
                      className={css.input}
                      placeholder="Nome da unidade"
                      {...register("report.site")}
                    />
                  </Field>

                  <Field label="Local Vistoriado">
                    <input
                      className={css.input}
                      {...register("report.localVistoriado")}
                    />
                  </Field>

                  <Field label="Data da Avaliação">
                    <input
                      type="date"
                      className={css.input}
                      {...register("report.dataAvaliacao")}
                    />
                  </Field>

                  <Field label="Contrato">
                    <input
                      className={css.input}
                      {...register("report.contrato")}
                    />
                  </Field>

                  <div />

                  {/* Bloco estático de elaboração (Seção 5) */}
                  <div className={css.fieldFull}>
                    <div className={css.staticBlock}>
                      <span className={css.staticBlockTitle}>Elaboração</span>
                      <p className={css.staticBlockText}>
                        Konis Ex do Brasil Ltda.
                      </p>
                      <p className={css.staticBlockText}>
                        Responsável Técnico: Francisco Flávio Melo Cavalcante
                      </p>
                      <p className={css.staticBlockText}>
                        CREA SP – 5060562076
                      </p>
                    </div>
                  </div>

                  <div className={css.fieldFull}>
                    <Field label="Observações gerais (contexto para IA)">
                      <p className={css.fieldHint}>
                        Estas observações serão consideradas na geração
                        automática do documento.
                      </p>
                      <textarea
                        className={css.textarea}
                        rows={3}
                        placeholder="Ex: prioridades da vistoria, condições da planta, foco em riscos específicos…"
                        {...register("report.observacoesGerais")}
                      />
                    </Field>
                  </div>
                </div>

                {/* ─── Imagem de Capa (Feature 1) ────────────── */}
                <div className={css.coverSection}>
                  <span className={css.label}>Imagem de Capa (opcional)</span>
                  {coverImageUrl && (
                    <div className={css.coverPreview}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={coverImageUrl}
                        alt="Capa do relatório"
                        className={css.coverImg}
                      />
                      <button
                        type="button"
                        className={css.coverRemoveBtn}
                        onClick={handleCoverDelete}
                      >
                        ✕ Remover
                      </button>
                    </div>
                  )}
                  <DropZone
                    className={`${css.dropzone} ${css.coverDropzone} ${uploadingCover ? css.uploading : ""}`}
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
                      if (file) handleCoverUpload(file);
                    }}
                  >
                    <span className={css.dropzoneIcon}>🖼️</span>
                    <span className={css.dropzoneText}>
                      {uploadingCover
                        ? "Enviando…"
                        : coverImageUrl
                          ? "Clique ou arraste para substituir a imagem de capa"
                          : "Clique ou arraste a imagem de capa"}
                    </span>
                    <span className={css.dropzoneHint}>
                      JPEG, PNG, WebP ou HEIC — fotos grandes são otimizadas automaticamente
                    </span>
                  </DropZone>
                  {coverDropError && (
                    <span className={css.dropzoneError}>{coverDropError}</span>
                  )}
                </div>

                {/* ─── Nome do Documento (Feature 5) ── */}
                <div className={css.fieldGrid}>
                  <Field label="Nome do Documento">
                    <input
                      className={css.input}
                      placeholder="Ex: DHA - Diagnóstico de Segurança"
                      value={codigoDocumento}
                      onChange={(e) => setCodigoDocumento(e.target.value)}
                    />
                  </Field>

                  <Field label="Número da ART">
                    <input
                      className={css.input}
                      placeholder="Ex: 1234567890"
                      value={artNumero}
                      onChange={(e) => setArtNumero(e.target.value)}
                    />
                  </Field>



                  {/* Campo ART oculto por enquanto
                  <Field label="Número da ART">
                    <input
                      className={css.input}
                      placeholder="Ex: 1234567890"
                      value={artNumero}
                      onChange={(e) => setArtNumero(e.target.value)}
                    />
                  </Field>
                  */}
                </div>

                {/* <div className={css.revisionSection}>
                  <div className={css.revisionHeader}>
                    <span className={css.label}>Controle de Revisão</span>
                    <Button
                      variant="secondary"
                      onClick={addRevision}
                      type="button"
                    >
                      + Adicionar Revisão
                    </Button>
                  </div>
                  <div className={css.revisionTableWrap}>
                    <table className={css.revisionTable}>
                      <thead>
                        <tr>
                          <th style={{ width: "10%" }}>Versão</th>
                          <th style={{ width: "18%" }}>Data</th>
                          <th style={{ width: "30%" }}>Responsável</th>
                          <th style={{ width: "35%" }}>Descrição</th>
                          <th style={{ width: "7%" }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {revisions.map((rev, idx) => (
                          <tr key={idx}>
                            <td>
                              <input
                                className={css.inputSmall}
                                value={rev.version}
                                onChange={(e) =>
                                  updateRevision(idx, "version", e.target.value)
                                }
                              />
                            </td>
                            <td>
                              <input
                                className={css.inputSmall}
                                value={rev.date}
                                onChange={(e) =>
                                  updateRevision(idx, "date", e.target.value)
                                }
                              />
                            </td>
                            <td>
                              <input
                                className={css.inputSmall}
                                value={rev.author}
                                onChange={(e) =>
                                  updateRevision(idx, "author", e.target.value)
                                }
                              />
                            </td>
                            <td>
                              <input
                                className={css.inputSmall}
                                value={rev.description}
                                onChange={(e) =>
                                  updateRevision(
                                    idx,
                                    "description",
                                    e.target.value,
                                  )
                                }
                              />
                            </td>
                            <td>
                              {revisions.length > 1 && (
                                <button
                                  type="button"
                                  className={css.revisionRemoveBtn}
                                  onClick={() => removeRevision(idx)}
                                  title="Remover revisão"
                                >
                                  ✖
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div> */}

                {/* ─── Tabela de Revisões (Feature 2) — oculta por enquanto, revisão será preenchida após gerar PDF
                <div className={css.revisionSection}>
                  <div className={css.revisionHeader}>
                    <span className={css.label}>Controle de Revisão</span>
                    <Button
                      variant="secondary"
                      onClick={addRevision}
                      type="button"
                    >
                      + Adicionar Revisão
                    </Button>
                  </div>
                  <div className={css.revisionTableWrap}>
                    <table className={css.revisionTable}>
                      <thead>
                        <tr>
                          <th style={{ width: "10%" }}>Versão</th>
                          <th style={{ width: "18%" }}>Data</th>
                          <th style={{ width: "30%" }}>Responsável</th>
                          <th style={{ width: "35%" }}>Descrição</th>
                          <th style={{ width: "7%" }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {revisions.map((rev, idx) => (
                          <tr key={idx}>
                            <td>
                              <input
                                className={css.inputSmall}
                                value={rev.version}
                                onChange={(e) =>
                                  updateRevision(idx, "version", e.target.value)
                                }
                              />
                            </td>
                            <td>
                              <input
                                className={css.inputSmall}
                                value={rev.date}
                                onChange={(e) =>
                                  updateRevision(idx, "date", e.target.value)
                                }
                              />
                            </td>
                            <td>
                              <input
                                className={css.inputSmall}
                                value={rev.author}
                                onChange={(e) =>
                                  updateRevision(idx, "author", e.target.value)
                                }
                              />
                            </td>
                            <td>
                              <input
                                className={css.inputSmall}
                                value={rev.description}
                                onChange={(e) =>
                                  updateRevision(
                                    idx,
                                    "description",
                                    e.target.value,
                                  )
                                }
                              />
                            </td>
                            <td>
                              {revisions.length > 1 && (
                                <button
                                  type="button"
                                  className={css.revisionRemoveBtn}
                                  onClick={() => removeRevision(idx)}
                                  title="Remover revisão"
                                >
                                  ✖
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                ─────────── */}
              </div>
            </CardBody>
            <CardFooter>
              <div className={css.nav}>
                <div />
                <Button onClick={goNext} disabled={saving}>
                  {saving ? "Salvando…" : "Próximo →"}
                </Button>
              </div>
            </CardFooter>
          </Card>
        )}

        {/* ─── Step 1: Upload de Imagens em Lote (Seções 8-11) ── */}
        {step === 1 && (
          <Card>
            <CardHeader>Upload de Imagens em Lote</CardHeader>
            <CardBody>
              <div className={css.scrollInner}>
                <p className={css.batchInstructions}>
                  Selecione múltiplas imagens para vincular automaticamente aos
                  equipamentos. O nome do arquivo deve seguir o padrão:{" "}
                  <strong>
                    NomeEquipamento_{getValues("report.contrato") || "<ContratoId>"}-0.jpg
                  </strong>
                  <br />
                  <span style={{ fontSize: "0.85em", opacity: 0.8 }}>
                    Exemplo: MoegaFerroviaria1720_{getValues("report.contrato") || "1234"}-0.jpg
                    — Nome em PascalCase, contrato após _, índice após -
                  </span>
                </p>

                {/* Dropzone */}
                <DropZone
                  className={css.dropzone}
                  activeClassName={css.dragActive}
                  accept={IMAGE_ACCEPT}
                  multiple
                  onRejectedFiles={(files) =>
                    setBatchDropError(
                      rejectedImageMessage(files, IMAGE_FORMATS),
                    )
                  }
                  onFiles={handleBatchFilesSelected}
                >
                  <span className={css.dropzoneIcon}>📁</span>
                  <span className={css.dropzoneText}>
                    Clique para selecionar ou arraste imagens aqui
                  </span>
                  <span className={css.dropzoneHint}>
                    Formatos aceitos: JPEG, PNG, WebP, GIF e HEIC (iPhone) — fotos grandes são otimizadas automaticamente no envio — múltiplos arquivos simultâneos
                  </span>
                </DropZone>
                {batchDropError && (
                  <span className={css.dropzoneError}>{batchDropError}</span>
                )}

                {/* Match results */}
                {batchResults.length > 0 && (
                  <div className={css.batchResults}>
                    <div className={css.batchSummary}>
                      <span className={css.batchMatched}>
                        ✓ {batchResults.filter((r) => r.matched).length}{" "}
                        vinculadas
                      </span>
                      <span className={css.batchUnmatched}>
                        ✗ {batchResults.filter((r) => !r.matched).length} não
                        vinculadas
                      </span>
                    </div>

                    <div className={css.batchList}>
                      {batchResults.map((r, idx) => (
                        <div
                          key={idx}
                          className={`${css.batchItem} ${r.matched ? css.batchItemOk : css.batchItemFail}`}
                        >
                          <span className={css.batchFilename}>
                            {r.filename}
                          </span>
                          <span className={css.batchTarget}>
                            {r.matched
                              ? `→ ${r.equipmentName}${r.imageIndex != null ? ` (índice ${r.imageIndex})` : ""}`
                              : r.validationErrors.length > 0
                                ? r.validationErrors.map((e) => e.message).join("; ")
                                : "Sem correspondência"}
                          </span>
                        </div>
                      ))}
                    </div>

                    {batchResults.some((r) => r.matched) && batchUploading && batchProgress && (
                      <div className={css.uploadSummary}>
                        Enviando {batchProgress.current}/{batchProgress.total}…
                      </div>
                    )}
                  </div>
                )}

                {/* Already uploaded summary */}
                {(() => {
                  const totalImages = Object.values(imagesByEq).reduce(
                    (sum, imgs) => sum + imgs.length,
                    0,
                  );
                  const eqsWithImages = Object.values(imagesByEq).filter(
                    (imgs) => imgs.length > 0,
                  ).length;
                  if (totalImages === 0) return null;
                  return (
                    <div className={css.uploadSummary}>
                      <strong>{totalImages}</strong> imagem(ns) vinculadas a{" "}
                      <strong>{eqsWithImages}</strong> de{" "}
                      <strong>{eqFields.length}</strong> equipamentos
                    </div>
                  );
                })()}
              </div>
            </CardBody>
            <CardFooter>
              <div className={css.nav}>
                <Button variant="secondary" onClick={goBack}>
                  ← Voltar
                </Button>
                <div className={css.navRight}>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setStep(3);
                    }}
                  >
                    Pular para Revisão ⏭
                  </Button>
                  {batchResults.some((r) => r.matched) ? (
                    <Button onClick={executeBatchUpload} disabled={batchUploading}>
                      {batchUploading && batchProgress
                        ? `Enviando ${batchProgress.current}/${batchProgress.total}…`
                        : `Enviar ${batchResults.filter((r) => r.matched).length} imagens vinculadas →`}
                    </Button>
                  ) : (
                    <Button onClick={goNext} disabled={batchUploading}>
                      Próximo →
                    </Button>
                  )}
                </div>
              </div>
            </CardFooter>
          </Card>
        )}

        {/* ─── Step 2: Equipamentos (simplificado — Seção 12) ── */}
        {step === 2 &&
          eqFields[eqStep] &&
          (() => {
            const eqField = eqFields[eqStep];
            const idx = eqStep;
            const dbId = values.equipments[idx]?.id ?? eqField.id;
            const currentImgs = imagesByEq[dbId] ?? [];
            const isUploading = uploadingEqs.has(dbId);

            return (
              <Card>
                <CardHeader>
                  <div className={css.eqWizardHeader}>
                    <span>
                      Equipamento {eqStep + 1} de {eqFields.length}
                    </span>
                    <div className={css.eqProgress}>
                      <div
                        className={css.eqProgressBar}
                        style={{
                          width: `${((eqStep + 1) / eqFields.length) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardBody>
                  <div className={css.scrollInner}>
                    <div className={css.eqHeader}>
                      <span className={css.eqIndex}>{idx + 1}</span>
                      <span className={css.eqName}>
                        {eqField.equipmentName}
                      </span>
                      {eqField.equipmentDescription && (
                        <span className={css.eqDesc}>
                          — {eqField.equipmentDescription}
                        </span>
                      )}
                    </div>

                    <Field label="Local de Instalação">
                      <input
                        className={css.input}
                        type="text"
                        placeholder="Ex: Moega rodoviária, sala de filtros..."
                        {...register(`equipments.${idx}.localInstalacao`)}
                      />
                    </Field>

                    <Field label="Função Operacional">
                      <textarea
                        className={css.textarea}
                        rows={3}
                        placeholder="Ex: Transporte de produto, captação de pó, moagem..."
                        {...register(`equipments.${idx}.funcaoOperacional`)}
                      />
                    </Field>

                    <Field label="Observações extras (contexto para IA)">
                      <p className={css.fieldHint}>
                        Observações específicas deste equipamento para a
                        geração do relatório.
                      </p>
                      <textarea
                        className={css.textarea}
                        rows={3}
                        placeholder="Ex: condição visual, restrições operacionais…"
                        {...register(`equipments.${idx}.observacoesExtras`)}
                      />
                    </Field>

                    {/* Image section (Seção 13) */}
                    <div className={css.imageSection}>
                      <span className={css.label}>
                        Imagem ({currentImgs.length})
                      </span>
                      <div className={css.imageGrid}>
                        {currentImgs.map((img) => (
                          <div key={img.id} className={css.imageThumb}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={img.secureUrl} alt="Equipment" />
                            <button
                              type="button"
                              className={css.imageDelete}
                              title="Remover imagem"
                              onClick={() => handleImageDelete(dbId, img.id)}
                            >
                              ✕
                            </button>
                          </div>
                        ))}

                        <DropZone
                          className={`${css.uploadBtn} ${isUploading ? css.uploading : ""}`}
                          activeClassName={css.uploadBtnActive}
                          accept={IMAGE_ACCEPT}
                          disabled={isUploading}
                          onRejectedFiles={(files) =>
                            setEquipmentDropError(
                              rejectedImageMessage(files, IMAGE_FORMATS),
                            )
                          }
                          onFiles={(files) => {
                            const file = files[0];
                            if (file) handleImageUpload(dbId, file);
                          }}
                        >
                          {isUploading ? "…" : "+"}
                        </DropZone>
                      </div>
                      {equipmentDropError && (
                        <span className={css.dropzoneError}>
                          {equipmentDropError}
                        </span>
                      )}
                    </div>
                  </div>
                </CardBody>
                <CardFooter>
                  <div className={css.nav}>
                    <Button
                      variant="secondary"
                      onClick={goBack}
                      disabled={saving}
                    >
                      ← {eqStep === 0 ? "Voltar" : "Anterior"}
                    </Button>
                    <div className={css.navRight}>
                      {/* Seção 13: "Pular para o próximo sem imagem" */}
                      <Button
                        variant="secondary"
                        onClick={skipToNextWithoutImage}
                        disabled={saving || isUploading}
                      >
                        Próximo sem Imagem ⏭
                      </Button>
                      {eqFields.length > 1 &&
                        eqStep < eqFields.length - 1 && (
                          <Button
                            variant="secondary"
                            onClick={skipToReview}
                            disabled={saving || isUploading}
                          >
                            Ir para Revisão
                          </Button>
                        )}
                      <Button
                        onClick={goNext}
                        disabled={saving || isUploading}
                      >
                        {saving
                          ? "Salvando…"
                          : eqStep < eqFields.length - 1
                            ? "Próximo →"
                            : "Revisão →"}
                      </Button>
                    </div>
                  </div>
                </CardFooter>
              </Card>
            );
          })()}

        {/* ─── Step 3: Revisão Final (Seções 18-19) ──────────── */}
        {step === 3 && (
          <Card>
            <CardHeader>Revisão Final</CardHeader>
            <CardBody>
              <div className={css.reviewScroll}>
                {/* Pendencies / alerts (Seção 19) */}
                {(pendencies.noImage.length > 0 ||
                  pendencies.noObs.length > 0) && (
                    <div className={css.pendencyBox}>
                      <div className={css.pendencyTitle}>
                        ⚠ Alertas de Pendência
                      </div>
                      {pendencies.noImage.length > 0 && (
                        <div className={css.pendencyItem}>
                          <strong>
                            {pendencies.noImage.length} equipamento(s) sem
                            imagem:
                          </strong>{" "}
                          {pendencies.noImage.join(", ")}
                        </div>
                      )}
                      {pendencies.noObs.length > 0 && (
                        <div className={css.pendencyItem}>
                          <strong>
                            {pendencies.noObs.length} equipamento(s) sem
                            observações:
                          </strong>{" "}
                          {pendencies.noObs.join(", ")}
                        </div>
                      )}
                      <p className={css.pendencyNote}>
                        Estes itens não impedem a geração do relatório.
                      </p>
                    </div>
                  )}

                {/* Report summary */}
                <div className={css.reviewSection}>
                  <div className={css.reviewTitle}>Dados do Relatório</div>
                  <div className={css.reviewGrid}>
                    <ReviewRow
                      label="Razão Social"
                      value={values.report.razaoSocial}
                    />
                    <ReviewRow label="Unidade" value={values.report.site} />
                    <ReviewRow
                      label="Local Vistoriado"
                      value={values.report.localVistoriado}
                    />
                    <ReviewRow
                      label="Data da Avaliação"
                      value={values.report.dataAvaliacao}
                    />
                    <ReviewRow
                      label="Contrato"
                      value={values.report.contrato}
                    />
                    <ReviewRow
                      label="Nome do Documento"
                      value={codigoDocumento || null}
                    />
                    {/* Campo ART oculto por enquanto
                    <ReviewRow
                      label="ART"
                      value={artNumero || null}
                    />
                    */}
                  </div>

                  {/* Cover image preview */}
                  {coverImageUrl && (
                    <div style={{ marginTop: "var(--space-3)" }}>
                      <span className={css.reviewLabel}>Imagem de Capa</span>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={coverImageUrl}
                        alt="Capa"
                        style={{
                          maxWidth: "120px",
                          maxHeight: "80px",
                          borderRadius: "var(--radius-md)",
                          marginTop: "var(--space-1)",
                          display: "block",
                        }}
                      />
                    </div>
                  )}

                  {/* Static elaboration */}
                  <div
                    className={css.staticBlock}
                    style={{ marginTop: "var(--space-3)" }}
                  >
                    <span className={css.staticBlockTitle}>Elaboração</span>
                    <p className={css.staticBlockText}>
                      Konis Ex do Brasil Ltda.
                    </p>
                    <p className={css.staticBlockText}>
                      Responsável Técnico: Francisco Flávio Melo Cavalcante
                    </p>
                    <p className={css.staticBlockText}>
                      CREA SP – 5060562076
                    </p>
                  </div>

                  {values.report.observacoesGerais && (
                    <div style={{ marginTop: "var(--space-3)" }}>
                      <div className={css.reviewGrid}>
                        <ReviewRow
                          label="Observações (IA)"
                          value={values.report.observacoesGerais}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Revisions summary — oculto por enquanto, revisão será preenchida após gerar PDF
                {revisions.length > 0 && (
                  <div className={css.reviewSection}>
                    <div className={css.reviewTitle}>
                      Controle de Revisão ({revisions.length})
                    </div>
                    <div className={css.revisionTableWrap}>
                      <table className={css.revisionTable}>
                        <thead>
                          <tr>
                            <th>Versão</th>
                            <th>Data</th>
                            <th>Responsável</th>
                            <th>Descrição</th>
                          </tr>
                        </thead>
                        <tbody>
                          {revisions.map((rev, idx) => (
                            <tr key={idx}>
                              <td>{rev.version}</td>
                              <td>{rev.date}</td>
                              <td>{rev.author}</td>
                              <td>{rev.description}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                */}

                {/* Images summary (Seção 18) */}
                <div className={css.reviewSection}>
                  <div className={css.reviewTitle}>Imagens Vinculadas</div>
                  <div className={css.reviewGrid}>
                    <ReviewRow
                      label="Total de imagens"
                      value={String(
                        Object.values(imagesByEq).reduce(
                          (sum, imgs) => sum + imgs.length,
                          0,
                        ),
                      )}
                    />
                    <ReviewRow
                      label="Equipamentos com imagem"
                      value={`${Object.values(imagesByEq).filter((imgs) => imgs.length > 0).length} de ${eqFields.length}`}
                    />
                  </div>
                </div>

                {/* Equipments summary */}
                <div className={css.reviewSection}>
                  <div className={css.reviewTitle}>
                    Equipamentos ({eqFields.length})
                  </div>
                  {eqFields.map((eq, idx) => {
                    const v = values.equipments[idx];
                    const imgs = imagesByEq[v?.id ?? eq.id] ?? [];
                    const hasObs = !!v?.observacoesExtras?.trim();
                    return (
                      <div key={eq.id} className={css.reviewEqItem}>
                        <div className={css.reviewEqName}>
                          <span>
                            {idx + 1}. {eq.equipmentName}
                          </span>
                          <span className={css.reviewEqBadges}>
                            {imgs.length > 0 ? (
                              <span className={css.badgeOk}>
                                {imgs.length} img
                              </span>
                            ) : (
                              <span className={css.badgeWarn}>Sem imagem</span>
                            )}
                            {!hasObs && (
                              <span className={css.badgeWarn}>Sem obs.</span>
                            )}
                          </span>
                        </div>
                        {(
                          v?.localInstalacao?.trim() ||
                          v?.funcaoOperacional?.trim() ||
                          v?.observacoesExtras?.trim() ||
                          imgs.length > 0
                        ) && (
                            <div className={css.reviewGrid}>
                              {v?.localInstalacao?.trim() && (
                                <ReviewRow
                                  label="Local de Instalação"
                                  value={v.localInstalacao}
                                />
                              )}
                              {v?.funcaoOperacional?.trim() && (
                                <ReviewRow
                                  label="Função Operacional"
                                  value={v.funcaoOperacional}
                                />
                              )}
                              {v?.observacoesExtras?.trim() && (
                                <ReviewRow
                                  label="Observações"
                                  value={v.observacoesExtras}
                                />
                              )}
                              {imgs.length > 0 && (
                                <>
                                  <span className={css.reviewLabel}>
                                    Imagens
                                  </span>
                                  <span className={css.reviewValue}>
                                    {imgs.length} imagem(ns)
                                  </span>
                                </>
                              )}
                            </div>
                          )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardBody>
            <CardFooter>
              <div className={css.nav}>
                <Button variant="secondary" onClick={goBack}>
                  ← Voltar
                </Button>
                <div className={css.navRight}>
                  <Button
                    variant="primary"
                    onClick={onSubmit}
                    disabled={submitting}
                  >
                    {submitting ? "Processando…" : "Gerar Relatório"}
                  </Button>
                </div>
              </div>
            </CardFooter>
          </Card>
        )}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Small helpers                                                      */
/* ================================================================== */

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={css.field}>
      <span className={css.label}>{label}</span>
      {children}
      {error && <span className={css.errorText}>{error}</span>}
    </div>
  );
}

function ReviewRow({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <>
      <span className={css.reviewLabel}>{label}</span>
      <span className={value ? css.reviewValue : css.reviewEmpty}>
        {value || "—"}
      </span>
    </>
  );
}
