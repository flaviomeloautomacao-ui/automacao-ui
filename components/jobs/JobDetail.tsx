"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Card, CardHeader, CardBody, CardFooter, Progress, Button, Stepper } from "@/components/ui";
import { JobStatusBadge } from "@/components/jobs/JobStatusBadge";
import type { ApiResponse, Job, JobStep, JobDetailResponse } from "@/lib/types";
import { POLL_INTERVAL_MS, MAX_POLL_CYCLES, TERMINAL_STATUSES } from "@/lib/constants";
import Link from "next/link";

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

  const progressColor =
    job.status === "error" ? "red" : job.status === "done" ? "green" : "blue";

  return (
    <Card>
      <CardHeader>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>
            Job: {job.filename ?? job.id.slice(0, 8)}
          </h1>
          <JobStatusBadge status={job.status} />
        </div>
        {polling && (
          <p
            style={{
              color: "#6b7280",
              fontSize: "0.8125rem",
              marginTop: "0.25rem",
            }}
          >
            Atualizando automaticamente a cada {POLL_INTERVAL_MS / 1000}s...
          </p>
        )}
      </CardHeader>

      <CardBody>
        <div style={{ display: "grid", gap: "1.25rem" }}>
          {/* Progress */}
          <Progress
            value={job.progress ?? 0}
            showValue
            label="Progresso"
            color={progressColor}
          />

          {/* Current Step Label */}
          {job.currentStep && !TERMINAL_STATUSES.has(job.status) && (
            <p
              style={{
                fontSize: "0.875rem",
                color: "#4b5563",
                fontStyle: "italic",
                marginTop: "-0.5rem",
              }}
            >
              {job.currentStep}
            </p>
          )}

          {/* Pipeline Steps */}
          {steps && steps.length > 0 && (
            <section>
              <h2
                style={{
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: "#374151",
                  marginBottom: "0.75rem",
                }}
              >
                Etapas do Pipeline
              </h2>
              <Stepper steps={steps} />
            </section>
          )}

          {/* Done Banner */}
          {job.status === "done" && (
            <div
              style={{
                padding: "0.875rem 1rem",
                borderRadius: "0.5rem",
                backgroundColor: "#f0fdf4",
                border: "1px solid #bbf7d0",
              }}
            >
              <p
                style={{
                  fontWeight: 600,
                  color: "#166534",
                  fontSize: "0.875rem",
                  marginBottom: "0.25rem",
                }}
              >
                Laudo concluído com sucesso!
              </p>
              <p style={{ fontSize: "0.8125rem", color: "#15803d" }}>
                O PDF está pronto para download.
              </p>
            </div>
          )}

          {/* Timeout / Stale Banner */}
          {(timedOut || isStale) && !TERMINAL_STATUSES.has(job.status) && (
            <div
              style={{
                padding: "0.875rem 1rem",
                borderRadius: "0.5rem",
                backgroundColor: "#fffbeb",
                border: "1px solid #fde68a",
              }}
            >
              <p
                style={{
                  fontWeight: 600,
                  color: "#92400e",
                  fontSize: "0.875rem",
                  marginBottom: "0.25rem",
                }}
              >
                {timedOut
                  ? "Tempo de acompanhamento excedido"
                  : "Job sem atualização há mais de 5 minutos"}
              </p>
              <p style={{ fontSize: "0.8125rem", color: "#a16207" }}>
                O processamento pode ter falhado no servidor. Verifique os logs
                do serviço Python ou tente reenviar o arquivo.
              </p>
              <button
                onClick={() => {
                  setTimedOut(false);
                  pollCount.current = 0;
                  setPolling(true);
                }}
                style={{
                  marginTop: "0.5rem",
                  padding: "0.375rem 0.75rem",
                  fontSize: "0.8125rem",
                  fontWeight: 500,
                  color: "#92400e",
                  backgroundColor: "#fef3c7",
                  border: "1px solid #fde68a",
                  borderRadius: "0.375rem",
                  cursor: "pointer",
                }}
              >
                Tentar novamente
              </button>
            </div>
          )}

          {/* Error Banner */}
          {job.status === "error" && (
            <div
              style={{
                padding: "0.875rem 1rem",
                borderRadius: "0.5rem",
                backgroundColor: "#fef2f2",
                border: "1px solid #fecaca",
              }}
            >
              <p
                style={{
                  fontWeight: 600,
                  color: "#991b1b",
                  fontSize: "0.875rem",
                  marginBottom: "0.25rem",
                }}
              >
                Ocorreu um erro no processamento
              </p>
              {job.errorCode && (
                <p style={{ fontSize: "0.8125rem", color: "#b91c1c" }}>
                  Código: {job.errorCode}
                </p>
              )}
              {job.errorMessage && (
                <p style={{ fontSize: "0.8125rem", color: "#b91c1c" }}>
                  {job.errorMessage}
                </p>
              )}
              {!job.errorMessage && !job.errorCode && (
                <p style={{ fontSize: "0.8125rem", color: "#b91c1c" }}>
                  Erro desconhecido. Entre em contato com o suporte.
                </p>
              )}
            </div>
          )}

          {/* Metadata */}
          <dl
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              gap: "0.5rem 1.5rem",
              fontSize: "0.875rem",
            }}
          >
            <dt style={{ fontWeight: 600, color: "#6b7280" }}>ID</dt>
            <dd style={{ fontFamily: "var(--font-geist-mono, monospace)", fontSize: "0.8125rem" }}>
              {job.id}
            </dd>

            <dt style={{ fontWeight: 600, color: "#6b7280" }}>Perfil</dt>
            <dd>{job.profile}</dd>

            {job.rowCount != null && (
              <>
                <dt style={{ fontWeight: 600, color: "#6b7280" }}>Linhas</dt>
                <dd>{job.rowCount}</dd>
              </>
            )}

            <dt style={{ fontWeight: 600, color: "#6b7280" }}>Criado em</dt>
            <dd>{formatDate(job.createdAt)}</dd>

            <dt style={{ fontWeight: 600, color: "#6b7280" }}>Atualizado em</dt>
            <dd>{formatDate(job.updatedAt)}</dd>

            {job.finishedAt && (
              <>
                <dt style={{ fontWeight: 600, color: "#6b7280" }}>Finalizado em</dt>
                <dd>{formatDate(job.finishedAt)}</dd>
              </>
            )}
          </dl>
        </div>
      </CardBody>

      <CardFooter>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <Link href="/jobs">
            <Button variant="secondary">Voltar à lista</Button>
          </Link>
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
