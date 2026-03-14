"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardBody, CardFooter } from "@/components/ui/Card";
import type { ApiResponse } from "@/lib/types";

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
}

/* ================================================================== */
/*  Zod schemas                                                       */
/* ================================================================== */

const reportSchema = z.object({
  razaoSocial: z.string().min(1, "Razão Social é obrigatória"),
  cnpj: z.string().min(1, "CNPJ é obrigatório"),
  site: z.string(),
  endereco: z.string(),
  localVistoriado: z.string(),
  dataAvaliacao: z.string(),
  contrato: z.string(),
  elaboracao: z.string(),
  responsavel: z.string().min(1, "Responsável é obrigatório"),
  registroProfissional: z.string(),
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
}

/* ================================================================== */
/*  Step labels                                                        */
/* ================================================================== */

const STEP_LABELS = [
  "Dados do Relatório",
  "Equipamentos",
  "Revisão",
] as const;

/* ================================================================== */
/*  Component                                                          */
/* ================================================================== */

export function ComplementForm({
  jobId,
  report,
  equipments: initialEquipments,
}: ComplementFormProps) {
  const router = useRouter();
  // step 0 = report, step 1 = equipments (one-by-one), step 2 = review
  const [step, setStep] = useState(0);
  // Which equipment is currently being edited (0-based)
  const [eqStep, setEqStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Track images per equipment (keyed by equipment id)
  const [imagesByEq, setImagesByEq] = useState<
    Record<string, ComplementImage[]>
  >(() => {
    const map: Record<string, ComplementImage[]> = {};
    for (const eq of initialEquipments) {
      map[eq.id] = eq.images ?? [];
    }
    return map;
  });

  // ── Form setup ─────────────────────────────────────────
  const {
    register,
    handleSubmit,
    trigger,
    getValues,
    formState: { errors },
    control,
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      report: {
        razaoSocial: report.razaoSocial ?? "",
        cnpj: report.cnpj ?? "",
        site: report.site ?? "",
        endereco: report.endereco ?? "",
        localVistoriado: report.localVistoriado ?? "",
        dataAvaliacao: report.dataAvaliacao
          ? report.dataAvaliacao.slice(0, 10)
          : new Date().toISOString().slice(0, 10),
        contrato: report.contrato ?? "",
        elaboracao: report.elaboracao ?? "",
        responsavel: report.responsavel ?? "",
        registroProfissional: report.registroProfissional ?? "",
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

  // ── Save progress (PATCH) — can save just the report, just one equipment, or both ──
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
          },
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
  }, [getValues, jobId]);

  const saveEquipment = useCallback(
    async (eqIndex: number) => {
      const eq = getValues(`equipments.${eqIndex}`);
      if (!eq) return true; // nothing to save
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
      setEqStep(0);
      return;
    }

    if (step === 1) {
      // Save current equipment first
      const saved = await saveEquipment(eqStep);
      if (!saved) return;

      // If there are more equipments, advance to next
      if (eqStep < eqFields.length - 1) {
        setEqStep((s) => s + 1);
        return;
      }
      // All equipments done, go to review
      setStep(2);
      return;
    }
  }

  function goBack() {
    if (step === 1 && eqStep > 0) {
      setEqStep((s) => s - 1);
      return;
    }
    if (step === 1 && eqStep === 0) {
      setStep(0);
      return;
    }
    if (step === 2) {
      setStep(1);
      setEqStep(eqFields.length - 1);
      return;
    }
  }

  async function skipToReview() {
    // Save current equipment before skipping
    const saved = await saveEquipment(eqStep);
    if (!saved) return;
    setStep(2);
  }

  // ── Submit (start processing) ──────────────────────────
  async function onSubmit() {
    setSubmitting(true);
    setApiError(null);

    // Save current equipment one last time (user might be on step 1)
    // Then save report too, just to be safe
    try {
      // Save the last equipment if we came from step 1
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

  // ── Image upload / delete ──────────────────────────────
  const uploadingRef = useRef<Set<string>>(new Set());
  const [uploadingEqs, setUploadingEqs] = useState<Set<string>>(new Set());

  async function handleImageUpload(equipmentId: string, file: File) {
    uploadingRef.current.add(equipmentId);
    setUploadingEqs(new Set(uploadingRef.current));

    try {
      // Upload via server API (handles Cloudinary + DB persistence)
      const form = new FormData();
      form.append("file", file);
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
    } catch {
      alert("Falha ao fazer upload da imagem.");
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

  // ── Render helpers ─────────────────────────────────────
  const values = getValues();

  return (
    <div className={css.page}>
      <h1 className={css.title}>Complementação do Relatório</h1>
      <p className={css.subtitle}>Job {jobId}</p>

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

      {/* ─── Step 0: Report metadata ─────────────────────── */}
      {step === 0 && (
        <Card>
          <CardHeader>Dados Gerais do Relatório</CardHeader>
          <CardBody>
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

              <Field label="CNPJ *" error={errors.report?.cnpj?.message}>
                <input
                  className={`${css.input} ${errors.report?.cnpj ? css.inputError : ""}`}
                  {...register("report.cnpj")}
                />
              </Field>

              <Field label="Site / Unidade">
                <input className={css.input} {...register("report.site")} />
              </Field>

              <Field label="Endereço">
                <input
                  className={css.input}
                  {...register("report.endereco")}
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

              <Field label="Elaboração">
                <input
                  className={css.input}
                  {...register("report.elaboracao")}
                />
              </Field>

              <Field
                label="Responsável Técnico *"
                error={errors.report?.responsavel?.message}
              >
                <input
                  className={`${css.input} ${errors.report?.responsavel ? css.inputError : ""}`}
                  {...register("report.responsavel")}
                />
              </Field>

              <Field label="Registro Profissional">
                <input
                  className={css.input}
                  {...register("report.registroProfissional")}
                />
              </Field>

              <div className={css.fieldFull}>
                <Field label="Observações Gerais">
                  <textarea
                    className={css.textarea}
                    rows={3}
                    {...register("report.observacoesGerais")}
                  />
                </Field>
              </div>
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

      {/* ─── Step 1: Equipments (one at a time) ────────────── */}
      {step === 1 && eqFields[eqStep] && (() => {
        const eqField = eqFields[eqStep];
        const idx = eqStep;
        // eqField.id is auto-generated by react-hook-form, NOT the DB UUID.
        // The real DB ID is stored in the form values.
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
                    style={{ width: `${((eqStep + 1) / eqFields.length) * 100}%` }}
                  />
                </div>
              </div>
            </CardHeader>
            <CardBody>
              <div className={css.eqHeader}>
                <span className={css.eqIndex}>{idx + 1}</span>
                <span className={css.eqName}>{eqField.equipmentName}</span>
                {eqField.equipmentDescription && (
                  <span className={css.eqDesc}>
                    — {eqField.equipmentDescription}
                  </span>
                )}
              </div>

              <div className={css.eqFields}>
                <Field label="Local de Instalação">
                  <input
                    className={css.input}
                    {...register(`equipments.${idx}.localInstalacao`)}
                  />
                </Field>
                <Field label="Função Operacional">
                  <input
                    className={css.input}
                    {...register(`equipments.${idx}.funcaoOperacional`)}
                  />
                </Field>
              </div>

              <Field label="Observações Extras">
                <textarea
                  className={css.textarea}
                  rows={2}
                  {...register(`equipments.${idx}.observacoesExtras`)}
                />
              </Field>

              {/* Image uploader */}
              <div className={css.imageSection}>
                <span className={css.label}>
                  Imagens ({currentImgs.length})
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

                  {/* Upload button */}
                  <label
                    className={`${css.uploadBtn} ${isUploading ? css.uploading : ""}`}
                  >
                    {isUploading ? "…" : "+"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      hidden
                      disabled={isUploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleImageUpload(dbId, file);
                          e.target.value = "";
                        }
                      }}
                    />
                  </label>
                </div>
              </div>
            </CardBody>
            <CardFooter>
              <div className={css.nav}>
                <Button variant="secondary" onClick={goBack} disabled={saving}>
                  ← {eqStep === 0 ? "Voltar" : "Anterior"}
                </Button>
                <div className={css.navRight}>
                  {eqFields.length > 1 && eqStep < eqFields.length - 1 && (
                    <Button
                      variant="secondary"
                      onClick={skipToReview}
                      disabled={saving || isUploading}
                    >
                      Pular para Revisão ⏭
                    </Button>
                  )}
                  <Button onClick={goNext} disabled={saving || isUploading}>
                    {saving
                      ? "Salvando…"
                      : eqStep < eqFields.length - 1
                        ? "Próximo Equipamento →"
                        : "Revisão →"}
                  </Button>
                </div>
              </div>
            </CardFooter>
          </Card>
        );
      })()}

      {/* ─── Step 2: Review ──────────────────────────────── */}
      {step === 2 && (
        <Card>
          <CardHeader>Revisão Final</CardHeader>
          <CardBody>
            {/* Report summary */}
            <div className={css.reviewSection}>
              <div className={css.reviewTitle}>Dados do Relatório</div>
              <div className={css.reviewGrid}>
                <ReviewRow label="Razão Social" value={values.report.razaoSocial} />
                <ReviewRow label="CNPJ" value={values.report.cnpj} />
                <ReviewRow label="Site" value={values.report.site} />
                <ReviewRow label="Endereço" value={values.report.endereco} />
                <ReviewRow
                  label="Local Vistoriado"
                  value={values.report.localVistoriado}
                />
                <ReviewRow
                  label="Data da Avaliação"
                  value={values.report.dataAvaliacao}
                />
                <ReviewRow label="Contrato" value={values.report.contrato} />
                <ReviewRow label="Elaboração" value={values.report.elaboracao} />
                <ReviewRow
                  label="Responsável"
                  value={values.report.responsavel}
                />
                <ReviewRow
                  label="Reg. Profissional"
                  value={values.report.registroProfissional}
                />
                <ReviewRow
                  label="Observações"
                  value={values.report.observacoesGerais}
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
                return (
                  <div
                    key={eq.id}
                    className={css.reviewEqItem}
                  >
                    <div className={css.reviewEqName}>
                      {idx + 1}. {eq.equipmentName}
                    </div>
                    <div className={css.reviewGrid}>
                      <ReviewRow
                        label="Local Instalação"
                        value={v?.localInstalacao}
                      />
                      <ReviewRow
                        label="Função Operacional"
                        value={v?.funcaoOperacional}
                      />
                      <ReviewRow
                        label="Observações"
                        value={v?.observacoesExtras}
                      />
                      <span className={css.reviewLabel}>Imagens</span>
                      <span className={css.reviewValue}>
                        {imgs.length > 0
                          ? `${imgs.length} imagem(ns)`
                          : "Nenhuma"}
                      </span>
                    </div>
                  </div>
                );
              })}
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
