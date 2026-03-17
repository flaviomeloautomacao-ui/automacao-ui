"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui";
import type { ApiResponse } from "@/lib/types";
import styles from "./JobActions.module.css";

interface JobActionsProps {
  jobId: string;
  status: string;
}

export function JobActions({ jobId, status }: JobActionsProps) {
  const [downloading, setDownloading] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const handleDownload = useCallback(async () => {
    setDownloading(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/download`);
      const json: ApiResponse<{ url: string }> = await res.json();

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
  }, [jobId]);

  const handleRetry = useCallback(async () => {
    setRetrying(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/retry`, { method: "POST" });
      const json: ApiResponse<{ status: string }> = await res.json();

      if (json.error) {
        alert(json.error.message);
        return;
      }

      window.location.href = `/jobs/${jobId}`;
    } catch {
      alert("Falha ao tentar novamente. Verifique o serviço.");
    } finally {
      setRetrying(false);
    }
  }, [jobId]);

  return (
    <div className={styles.actions}>
      <Link href={`/jobs/${jobId}`}>
        <Button variant="secondary" size="sm">
          Detalhes
        </Button>
      </Link>

      {status === "awaiting_complement" && (
        <Link href={`/jobs/${jobId}/complement`}>
          <Button variant="primary" size="sm">
            Completar dados
          </Button>
        </Link>
      )}

      {status === "error" && (
        <Button
          variant="primary"
          size="sm"
          onClick={handleRetry}
          disabled={retrying}
        >
          {retrying ? "Reenviando..." : "Tentar Novamente"}
        </Button>
      )}

      {status === "done" && (
        <Button
          variant="primary"
          size="sm"
          onClick={handleDownload}
          disabled={downloading}
        >
          {downloading ? "Baixando..." : "Baixar PDF"}
        </Button>
      )}
    </div>
  );
}
