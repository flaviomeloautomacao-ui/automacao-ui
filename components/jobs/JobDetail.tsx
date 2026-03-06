"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Card, CardHeader, CardBody, CardFooter, Progress, Button, Stepper } from "@/components/ui";
import { JobStatusBadge } from "@/components/jobs/JobStatusBadge";
import type { ApiResponse, Job, JobStep, JobDetailResponse } from "@/lib/types";
import Link from "next/link";

interface DownloadResponse {
  url: string;
}

/** Status considerados finais (não requerem polling) */
const TERMINAL_STATUSES = new Set(["done", "error"]);

/** Intervalo de polling em milissegundos */
const POLL_INTERVAL_MS = 3_000;

/** Máximo de ciclos de polling para evitar loop infinito */
const MAX_POLL_CYCLES = 200; // ~10 min

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
  const pollCount = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
