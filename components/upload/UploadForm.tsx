"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardBody, CardFooter } from "@/components/ui/Card";
import { ProfileSelect } from "@/components/upload/ProfileSelect";
import type { ApiResponse, Job } from "@/lib/types";

interface FieldErrors {
  profile?: string;
  filename?: string;
}

export function UploadForm() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setApiError(null);

    const form = new FormData(e.currentTarget);
    const filename = (form.get("filename") as string).trim();
    const profile = (form.get("profile") as string).trim();

    // ── Client‑side validation ──────────────────────────
    const errors: FieldErrors = {};
    if (!profile) errors.profile = "Selecione um perfil de risco.";
    if (!filename) errors.filename = "Informe o nome do arquivo.";

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setLoading(true);

    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename, profile }),
      });

      const json: ApiResponse<Job> = await res.json();

      if (json.error) {
        setApiError(json.error.message);
        return;
      }

      router.push(`/jobs/${json.data.id}`);
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

            {/* Filename input (temporário — será substituído por upload real) */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
              }}
            >
              <label
                htmlFor="filename"
                style={{ fontSize: "0.875rem", fontWeight: 600 }}
              >
                Nome do Arquivo
              </label>
              <input
                id="filename"
                name="filename"
                type="text"
                placeholder="ex: planilha_dha.csv"
                disabled={loading}
                style={{
                  padding: "0.5rem 0.75rem",
                  borderRadius: "0.375rem",
                  border: fieldErrors.filename
                    ? "1px solid #ef4444"
                    : "1px solid #d1d5db",
                  fontSize: "0.875rem",
                  backgroundColor: "var(--background)",
                  color: "var(--foreground)",
                }}
              />
              {fieldErrors.filename && (
                <span style={{ fontSize: "0.75rem", color: "#ef4444" }}>
                  {fieldErrors.filename}
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
                {apiError}
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
