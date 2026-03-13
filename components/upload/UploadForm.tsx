"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState, useRef } from "react";

import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardBody, CardFooter } from "@/components/ui/Card";
import { ProfileSelect } from "@/components/upload/ProfileSelect";
import type { ApiResponse, CreateJobResponse } from "@/lib/types";
import { MAX_UPLOAD_MB, ALLOWED_EXTENSIONS } from "@/lib/constants";

interface FieldErrors {
  profile?: string;
  file?: string;
}

export function UploadForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [validationDetails, setValidationDetails] = useState<unknown[] | null>(
    null,
  );
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setApiError(null);
    setValidationDetails(null);

    const form = new FormData(e.currentTarget);
    const profile = (form.get("profile") as string)?.trim();
    const file = form.get("file") as File | null;

    // ── Client‑side validation ──────────────────────────
    const errors: FieldErrors = {};
    if (!profile) errors.profile = "Selecione um perfil de risco.";

    if (!file || file.size === 0) {
      errors.file = "Selecione um arquivo .xlsx ou .csv.";
    } else {
      const ext = file.name.toLowerCase().split(".").pop();
      if (
        !ext ||
        !ALLOWED_EXTENSIONS.includes(
          `.${ext}` as (typeof ALLOWED_EXTENSIONS)[number],
        )
      ) {
        errors.file = `Extensão .${ext} não permitida. Use: ${ALLOWED_EXTENSIONS.join(", ")}`;
      }
      if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
        errors.file = `Arquivo excede o limite de ${MAX_UPLOAD_MB}MB.`;
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setLoading(true);

    try {
      const body = new FormData();
      body.append("file", file!);
      body.append("profile", profile!);

      const res = await fetch("/api/jobs", {
        method: "POST",
        body,
      });

      const json: ApiResponse<CreateJobResponse> = await res.json();

      if (json.error) {
        setApiError(json.error.message);
        if ("details" in json.error && Array.isArray(json.error.details)) {
          setValidationDetails(json.error.details);
        }
        return;
      }

      router.push(json.data.redirectTo || `/jobs/${json.data.jobId}/complement`);
    } catch {
      setApiError("Erro inesperado ao criar o job. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Card>
        <CardHeader>Novo Laudo Técnico</CardHeader>

        <CardBody>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
            }}
          >
            {/* Profile select */}
            <ProfileSelect
              error={fieldErrors.profile}
              required
              disabled={loading}
            />

            {/* File upload */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
              }}
            >
              <label
                htmlFor="file"
                style={{ fontSize: "0.875rem", fontWeight: 600 }}
              >
                Planilha (.xlsx ou .csv)
              </label>
              <input
                ref={fileInputRef}
                id="file"
                name="file"
                type="file"
                accept=".xlsx,.csv"
                disabled={loading}
                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                style={{
                  padding: "0.5rem 0.75rem",
                  borderRadius: "0.375rem",
                  border: fieldErrors.file
                    ? "1px solid #ef4444"
                    : "1px solid #d1d5db",
                  fontSize: "0.875rem",
                  backgroundColor: "var(--background)",
                  color: "var(--foreground)",
                }}
              />
              {selectedFile && (
                <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                  {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                </span>
              )}
              {fieldErrors.file && (
                <span style={{ fontSize: "0.75rem", color: "#ef4444" }}>
                  {fieldErrors.file}
                </span>
              )}
            </div>

            {/* API error banner */}
            {apiError && (
              <div
                role="alert"
                style={{
                  padding: "0.75rem 1rem",
                  borderRadius: "0.375rem",
                  backgroundColor: "#fef2f2",
                  color: "#b91c1c",
                  fontSize: "0.875rem",
                  border: "1px solid #fecaca",
                }}
              >
                <p style={{ fontWeight: 600, marginBottom: "0.25rem" }}>
                  {apiError}
                </p>
                {validationDetails && validationDetails.length > 0 && (
                  <ul
                    style={{
                      listStyle: "disc",
                      paddingLeft: "1.25rem",
                      marginTop: "0.5rem",
                      fontSize: "0.8rem",
                      maxHeight: "12rem",
                      overflowY: "auto",
                    }}
                  >
                    {validationDetails.slice(0, 20).map((detail, i) => {
                      const d = detail as Record<string, string>;
                      return (
                        <li key={i}>
                          {d.column ? <><strong>{d.column}</strong>{" | "}</> : null}
                          {d.row ? <>Linha {d.row}{" | "}</> : null}
                          {d.message ?? JSON.stringify(d)}
                        </li>
                      );
                    })}
                    {validationDetails.length > 20 && (
                      <li>… e mais {validationDetails.length - 20} erro(s)</li>
                    )}
                  </ul>
                )}
              </div>
            )}
          </div>
        </CardBody>

        <CardFooter>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "0.5rem",
            }}
          >
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? "Criando…" : "Criar Job"}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </form>
  );
}
