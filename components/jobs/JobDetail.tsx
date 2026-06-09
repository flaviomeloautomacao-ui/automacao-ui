"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Card, CardHeader, CardBody, CardFooter, Progress, Button, Stepper } from "@/components/ui";
import { JobStatusBadge } from "@/components/jobs/JobStatusBadge";
import { CostSummaryCard } from "@/components/jobs/CostSummaryCard";
import type { ApiResponse, Job, JobStep, JobDetailResponse } from "@/lib/types";
import { getDocumentTypeLabel, getJobDocumentType } from "@/lib/documents";
import { POLL_INTERVAL_MS, MAX_POLL_CYCLES, TERMINAL_STATUSES } from "@/lib/constants";
import Link from "next/link";
import styles from "./JobDetail.module.css";

interface DownloadResponse {
  url: string;
}

interface JobDetailProps {
  initialJob: Job;
  initialSteps: JobStep[] | null;
}

async function fetchJobDetail(id: string): Promise<JobDetailResponse | null> {
  try {
    const res = await fetch(`/api/jobs/${id}`);
    if (!res.ok) return null;

    const json: ApiResponse<JobDetailResponse> = await res.json();
    return json.error ? null : json.data;
  } catch {
    return null;
  }
}

function formatDate(date: string | Date): string {
  return new Date(date).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function JobDetail({ initialJob, initialSteps }: JobDetailProps) {
  const [job, setJob] = useState<Job>(initialJob);
  const [steps, setSteps] = useState<JobStep[] | null>(initialSteps);
  const [polling, setPolling] = useState(
    !TERMINAL_STATUSES.has(initialJob.status),
  );
  const [downloading, setDownloading] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const pollCount = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /** Detecta job "travado" — sem atualização há mais de 5 minutos */
  const STALE_THRESHOLD_MS = 5 * 60 * 1000;
  const isStale =
    !TERMINAL_STATUSES.has(job.status) &&
    !polling &&
    !timedOut &&
    Date.now() - new Date(job.updatedAt).getTime() > STALE_THRESHOLD_MS;

  const stopPolling = useCallback(() => {
    setPolling(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    // Não iniciar polling se já está num status final
    if (TERMINAL_STATUSES.has(job.status)) {
      stopPolling();
      return;
    }

    intervalRef.current = setInterval(async () => {
      pollCount.current += 1;

      if (pollCount.current >= MAX_POLL_CYCLES) {
        setTimedOut(true);
        stopPolling();
        return;
      }

      const result = await fetchJobDetail(job.id);
      if (!result) return; // silence network errors, keep previous state

      setJob(result.job);
      setSteps(result.steps);

      if (TERMINAL_STATUSES.has(result.job.status)) {
        stopPolling();
      }
    }, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [job.id, job.status, stopPolling]);

  const handleDownload = useCallback(async () => {
    setDownloading(true);
    try {
      const res = await fetch(`/api/jobs/${job.id}/download`);
      const json: ApiResponse<DownloadResponse> = await res.json();

      if (json.error) {
        alert(json.error.message);
        return;
      }

      window.open(json.data.url, "_blank");
    } catch {
      alert("Falha ao baixar o PDF. Tente novamente.");
    } finally {
      setDownloading(false);
    }
  }, [job.id]);

  const handleRetry = useCallback(async () => {
    setRetrying(true);
    try {
      const res = await fetch(`/api/jobs/${job.id}/retry`, { method: "POST" });
      const json: ApiResponse<{ status: string }> = await res.json();

      if (json.error) {
        alert(json.error.message);
        return;
      }

      // Optimistically update local state so the UI immediately
      // shows "processing" and the polling useEffect starts.
      setJob((prev) => ({
        ...prev,
        status: "processing",
        progress: 10,
        currentStep: "Reiniciando processamento…",
        errorCode: null,
        errorMessage: null,
        startedAt: new Date(),
        finishedAt: null,
        pdfPath: null,
      } as Job));

      // Reset all steps to queued
      setSteps((prev) =>
        prev
          ? prev.map((s) => ({
            ...s,
            status: s.name === "upload_storage" ? "done" : "queued",
            startedAt: s.name === "upload_storage" ? s.startedAt : null,
            completedAt: s.name === "upload_storage" ? s.completedAt : null,
            errorMessage: null,
          }))
          : prev,
      );

      // Reset polling to track the new processing
      setTimedOut(false);
      pollCount.current = 0;
      setPolling(true);
    } catch {
      alert("Falha ao tentar novamente. Verifique o serviço.");
    } finally {
      setRetrying(false);
    }
  }, [job.id]);

  const progressColor =
    job.status === "error" ? "red" : job.status === "done" ? "green" : "blue";

  return (
    <Card>
      <CardHeader>
        <div className={styles.header}>
          <h1 className={styles.title}>
            Job: {job.filename ?? job.id.slice(0, 8)}
          </h1>
          <JobStatusBadge status={job.status} />
        </div>
        {polling && (
          <p className={styles.pollingHint}>
            Atualizando automaticamente a cada {POLL_INTERVAL_MS / 1000}s...
          </p>
        )}
      </CardHeader>

      <CardBody>
        <div className={styles.body}>
          {/* Progress */}
          <Progress
            value={job.progress ?? 0}
            showValue
            label="Progresso"
            color={progressColor}
          />

          {/* Current Step Label */}
          {job.currentStep && !TERMINAL_STATUSES.has(job.status) && (
            <p className={styles.currentStep}>{job.currentStep}</p>
          )}

          {/* Pipeline Steps */}
          {steps && steps.length > 0 && (
            <section>
              <h2 className={styles.sectionTitle}>Etapas do Pipeline</h2>
              <Stepper steps={steps} />
            </section>
          )}

          {/* Awaiting Complement Banner */}
          {job.status === "awaiting_complement" && (
            <div className={styles.bannerWarning}>
              <p className={styles.bannerTitle}>
                Relatório aguardando complementação.
              </p>
              <p className={styles.bannerText}>
                Preencha os dados complementares para gerar o relatório.
              </p>
              <div className={styles.bannerAction}>
                <Link href={`/jobs/${job.id}/complement`}>
                  <Button variant="primary" size="sm">
                    Completar dados
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {/* Done Banner */}
          {job.status === "done" && (
            <div className={styles.bannerSuccess}>
              <p className={styles.bannerTitle}>
                Laudo concluído com sucesso!
              </p>
              <p className={styles.bannerText}>
                O PDF está pronto para download.
              </p>
            </div>
          )}

          {/* Timeout / Stale Banner */}
          {(timedOut || isStale) && !TERMINAL_STATUSES.has(job.status) && (
            <div className={styles.bannerWarning}>
              <p className={styles.bannerTitle}>
                {timedOut
                  ? "Tempo de acompanhamento excedido"
                  : "Job sem atualização há mais de 5 minutos"}
              </p>
              <p className={styles.bannerText}>
                O processamento pode ter falhado no servidor. Verifique os logs
                do serviço Python ou tente reenviar o arquivo.
              </p>
              <button
                onClick={() => {
                  setTimedOut(false);
                  pollCount.current = 0;
                  setPolling(true);
                }}
                className={styles.bannerRetryBtn}
              >
                Tentar novamente
              </button>
            </div>
          )}

          {/* Error Banner */}
          {job.status === "error" && (
            <div className={styles.bannerError}>
              <p className={styles.bannerTitle}>
                Ocorreu um erro no processamento
              </p>
              {job.errorCode && (
                <p className={styles.bannerText}>Código: {job.errorCode}</p>
              )}
              {job.errorMessage && (
                <p className={styles.bannerText}>{job.errorMessage}</p>
              )}
              {!job.errorMessage && !job.errorCode && (
                <p className={styles.bannerText}>
                  Erro desconhecido. Entre em contato com o suporte.
                </p>
              )}
              <div className={styles.bannerAction}>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleRetry}
                  disabled={retrying}
                >
                  {retrying ? "Reenviando…" : "Tentar Novamente"}
                </Button>
              </div>
            </div>
          )}

          {/* Metadata */}
          <dl className={styles.metadata}>
            <dt className={styles.metaLabel}>ID</dt>
            <dd className={styles.metaValueMono}>{job.id}</dd>

            <dt className={styles.metaLabel}>Perfil</dt>
            <dd className={styles.metaValue}>{getDocumentTypeLabel(getJobDocumentType(job))}</dd>

            {job.rowCount != null && (
              <>
                <dt className={styles.metaLabel}>Linhas</dt>
                <dd className={styles.metaValue}>{job.rowCount}</dd>
              </>
            )}

            <dt className={styles.metaLabel}>Criado em</dt>
            <dd className={styles.metaValue}>{formatDate(job.createdAt)}</dd>

            <dt className={styles.metaLabel}>Atualizado em</dt>
            <dd className={styles.metaValue}>{formatDate(job.updatedAt)}</dd>

            {job.finishedAt && (
              <>
                <dt className={styles.metaLabel}>Finalizado em</dt>
                <dd className={styles.metaValue}>{formatDate(job.finishedAt)}</dd>
              </>
            )}
          </dl>

          {/* LLM Cost Summary */}
          {TERMINAL_STATUSES.has(job.status) && (
            <CostSummaryCard
              jobId={job.id}
              llmCostUsd={(job as Record<string, unknown>).llmCostUsd as number | null}
              llmTotalTokens={(job as Record<string, unknown>).llmTotalTokens as number | null}
              llmCallCount={(job as Record<string, unknown>).llmCallCount as number | null}
            />
          )}
        </div>
      </CardBody>

      <CardFooter>
        <div className={styles.footerActions}>
          <Link href="/jobs">
            <Button variant="secondary">Voltar à lista</Button>
          </Link>
          {job.status === "awaiting_complement" && (
            <Link href={`/jobs/${job.id}/complement`}>
              <Button variant="primary">Completar dados</Button>
            </Link>
          )}
          {job.status === "error" && (
            <Button
              variant="primary"
              onClick={handleRetry}
              disabled={retrying}
            >
              {retrying ? "Reenviando…" : "Tentar Novamente"}
            </Button>
          )}
          {job.status === "done" && (
            <Button
              variant="primary"
              onClick={handleDownload}
              disabled={downloading}
            >
              {downloading ? "Baixando..." : "Baixar PDF"}
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
