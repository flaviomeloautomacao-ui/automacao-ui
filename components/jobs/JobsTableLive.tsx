"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { JobsTable } from "@/components/jobs/JobsTable";
import type { ApiResponse, Job } from "@/lib/types";
import styles from "./JobsTable.module.css";

/** Intervalo de auto-refresh em ms */
const REFRESH_INTERVAL_MS = 3_000;

/** Máximo de ciclos de refresh para evitar loop infinito */
const MAX_REFRESH_CYCLES = 600; // ~30 min

const ACTIVE_STATUSES = new Set(["queued", "processing", "awaiting_complement"]);

type FetchJobsResult =
  | { jobs: Job[]; error: null }
  | { jobs: null; error: string };

function hasActiveJobs(jobs: Job[]): boolean {
  return jobs.some((j) => ACTIVE_STATUSES.has(j.status));
}

async function fetchJobs(): Promise<FetchJobsResult> {
  try {
    const res = await fetch("/api/jobs?limit=50");
    const json = (await res.json().catch(() => null)) as ApiResponse<Job[]> | null;

    if (!res.ok || !json || json.error) {
      return {
        jobs: null,
        error: json?.error?.message ?? "Nao foi possivel atualizar o historico de jobs agora.",
      };
    }

    return { jobs: json.data, error: null };
  } catch {
    return {
      jobs: null,
      error: "Nao foi possivel atualizar o historico de jobs agora.",
    };
  }
}

interface JobsTableLiveProps {
  initialJobs: Job[];
  initialError?: string | null;
}

export function JobsTableLive({ initialJobs, initialError = null }: JobsTableLiveProps) {
  const [jobs, setJobs] = useState<Job[]>(initialJobs);
  const [refreshing, setRefreshing] = useState(hasActiveJobs(initialJobs));
  const [errorMessage, setErrorMessage] = useState<string | null>(initialError);
  const cycleCount = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopRefresh = useCallback(() => {
    setRefreshing(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!refreshing || !hasActiveJobs(jobs)) {
      return;
    }

    intervalRef.current = setInterval(async () => {
      cycleCount.current += 1;

      if (cycleCount.current >= MAX_REFRESH_CYCLES) {
        stopRefresh();
        return;
      }

      const result = await fetchJobs();
      if (result.jobs === null) {
        setErrorMessage(result.error);
        return;
      }

      setJobs(result.jobs);
      setErrorMessage(null);

      if (!hasActiveJobs(result.jobs)) {
        stopRefresh();
      }
    }, REFRESH_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [jobs, refreshing, stopRefresh]);

  return (
    <div>
      {errorMessage && (
        <div className={styles.notice} role="status">
          <strong>Banco de dados indisponivel.</strong>
          <span>{errorMessage}</span>
        </div>
      )}
      {refreshing && (
        <p
          style={{
            fontSize: "var(--text-sm)",
            color: "var(--text-muted)",
            marginBottom: "var(--space-2)",
          }}
        >
          ⟳ Atualizando automaticamente...
        </p>
      )}
      <JobsTable jobs={jobs} />
    </div>
  );
}
