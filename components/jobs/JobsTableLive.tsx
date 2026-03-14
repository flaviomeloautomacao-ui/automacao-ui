"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { JobsTable } from "@/components/jobs/JobsTable";
import type { ApiResponse, Job } from "@/lib/types";

/** Intervalo de auto-refresh em ms */
const REFRESH_INTERVAL_MS = 3_000;

/** Máximo de ciclos de refresh para evitar loop infinito */
const MAX_REFRESH_CYCLES = 600; // ~30 min

const ACTIVE_STATUSES = new Set(["queued", "processing", "awaiting_complement"]);

function hasActiveJobs(jobs: Job[]): boolean {
  return jobs.some((j) => ACTIVE_STATUSES.has(j.status));
}

async function fetchJobs(): Promise<Job[] | null> {
  try {
    const res = await fetch("/api/jobs?limit=50");
    if (!res.ok) return null;
    const json: ApiResponse<Job[]> = await res.json();
    return json.error ? null : json.data;
  } catch {
    return null;
  }
}

interface JobsTableLiveProps {
  initialJobs: Job[];
}

export function JobsTableLive({ initialJobs }: JobsTableLiveProps) {
  const [jobs, setJobs] = useState<Job[]>(initialJobs);
  const [refreshing, setRefreshing] = useState(hasActiveJobs(initialJobs));
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
    if (!hasActiveJobs(jobs)) {
      stopRefresh();
      return;
    }

    intervalRef.current = setInterval(async () => {
      cycleCount.current += 1;

      if (cycleCount.current >= MAX_REFRESH_CYCLES) {
        stopRefresh();
        return;
      }

      const updated = await fetchJobs();
      if (!updated) return;

      setJobs(updated);

      if (!hasActiveJobs(updated)) {
        stopRefresh();
      }
    }, REFRESH_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [jobs, stopRefresh]);

  return (
    <div>
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
