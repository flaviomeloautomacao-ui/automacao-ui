"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState, useRef, useCallback, type DragEvent } from "react";

import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardFooter } from "@/components/ui/Card";
import type { ApiResponse, CreateJobResponse } from "@/lib/types";
import { MAX_UPLOAD_MB, ALLOWED_EXTENSIONS } from "@/lib/constants";
import type { DocumentType } from "@/lib/documents";
import css from "./UploadForm.module.css";

const DOCUMENT_OPTIONS = [
  {
    value: "dha",
    label: "DHA",
    desc: "Dust Hazard Analysis",
    icon: "",
    cssClass: "dust",
  },
  {
    value: "areas",
    label: "Classificação de Áreas",
    desc: "IEC 60079-10-1 / 10-2",
    icon: "",
    cssClass: "areas",
  },
] as const;

interface FieldErrors {
  documentType?: string;
  file?: string;
}

export function UploadForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [validationDetails, setValidationDetails] = useState<unknown[] | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedDocumentType, setSelectedDocumentType] = useState<DocumentType | "">("");
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setSelectedFile(file);
      setFieldErrors((prev) => ({ ...prev, file: undefined }));
    }
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    if (file) setFieldErrors((prev) => ({ ...prev, file: undefined }));
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setApiError(null);
    setValidationDetails(null);

    const errors: FieldErrors = {};
    if (!selectedDocumentType) errors.documentType = "Selecione um tipo de documento.";

    if (!selectedFile || selectedFile.size === 0) {
      errors.file = "Selecione um arquivo .xlsx ou .csv.";
    } else {
      const ext = selectedFile.name.toLowerCase().split(".").pop();
      if (!ext || !ALLOWED_EXTENSIONS.includes(`.${ext}` as (typeof ALLOWED_EXTENSIONS)[number])) {
        errors.file = `Extensão .${ext} não permitida. Use: ${ALLOWED_EXTENSIONS.join(", ")}`;
      }
      if (selectedFile.size > MAX_UPLOAD_MB * 1024 * 1024) {
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
      body.append("file", selectedFile!);
      body.append("documentType", selectedDocumentType);

      const res = await fetch("/api/jobs", { method: "POST", body });
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

  const dropzoneClasses = [
    css.dropzone,
    dragActive ? css.active : "",
    selectedFile ? css.hasFile : "",
    fieldErrors.file ? css.hasError : "",
  ].filter(Boolean).join(" ");

  return (
    <form onSubmit={handleSubmit} noValidate className={css.form}>
      <Card>
        <CardBody>
          {/* Profile Selection */}
          <div className={css.profileSection}>
            <span className={css.profileLabel}>Tipo de Documento</span>
            <div className={css.profileCards}>
              {DOCUMENT_OPTIONS.map((p) => {
                const comingSoon =
                  "comingSoon" in p && Boolean((p as { comingSoon?: boolean }).comingSoon);
                const isDisabled = loading || comingSoon;
                return (
                  <button
                    key={p.value}
                    type="button"
                    className={`${css.profileCard} ${selectedDocumentType === p.value ? css.selected : ""} ${comingSoon ? css.comingSoon : ""}`}
                    onClick={() => {
                      if (comingSoon) return;
                      setSelectedDocumentType(p.value);
                      setFieldErrors((prev) => ({ ...prev, documentType: undefined }));
                    }}
                    disabled={isDisabled}
                  >
                    {comingSoon && (
                      <span className={css.comingSoonBadge}>Em breve</span>
                    )}
                    {/* <div className={`${css.profileIcon} ${css[p.cssClass]}`}>{p.icon}</div> */}
                    <span className={css.profileName}>{p.label}</span>
                    <span className={css.profileDesc}>{p.desc}</span>
                  </button>
                );
              })}
            </div>
            {fieldErrors.documentType && (
              <span className={css.profileError}>{fieldErrors.documentType}</span>
            )}
          </div>

          <input type="hidden" name="documentType" value={selectedDocumentType} />

          {/* Dropzone */}
          <div
            className={dropzoneClasses}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
            }}
          >
            <div className={css.dropzoneIcon}>
              {selectedFile ? (
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </div>

            {selectedFile ? (
              <div className={css.fileInfo}>
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                </svg>
                {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
              </div>
            ) : (
              <>
                <span className={css.dropzoneTitle}>
                  Arraste o arquivo aqui ou <strong>clique para selecionar</strong>
                </span>
                <span className={css.dropzoneSub}>
                  Formatos aceitos: .xlsx, .csv — Máximo {MAX_UPLOAD_MB}MB
                </span>
              </>
            )}

            {fieldErrors.file && (
              <span className={css.dropzoneError}>{fieldErrors.file}</span>
            )}

            <input
              ref={fileInputRef}
              name="file"
              type="file"
              accept=".xlsx,.csv"
              disabled={loading}
              onChange={handleFileChange}
              hidden
            />
          </div>

          {/* API Error Banner */}
          {apiError && (
            <div className={css.errorBanner} role="alert">
              <p>{apiError}</p>
              {validationDetails && validationDetails.length > 0 && (
                <ul className={css.errorList}>
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
        </CardBody>

        <CardFooter>
          <div className={css.actions}>
            <Button type="submit" variant="primary" size="lg" disabled={loading}>
              {loading ? "Criando…" : "Criar Laudo"}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </form>
  );
}
