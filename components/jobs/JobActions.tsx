"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui";
import type { ApiResponse } from "@/lib/types";

interface JobActionsProps {
  jobId: string;
  status: string;
}

export function JobActions({ jobId, status }: JobActionsProps) {
  const [downloading, setDownloading] = useState(false);

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

  return (
    <div style={{ display: "flex", gap: "0.5rem" }}>
      <Link href={`/jobs/${jobId}`}>
        <Button variant="secondary" size="sm">
          Detalhes
        </Button>
      </Link>

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
