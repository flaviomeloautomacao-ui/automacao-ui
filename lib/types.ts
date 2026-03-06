/**
 * Tipos compartilhados da aplicação.
 *
 * Todos os tipos de API devem seguir o envelope padrão:
 *   Sucesso → { data: T,    error: null }
 *   Erro    → { data: null, error: { code: string, message: string, details?: unknown[] } }
 */

import type { JobModel } from "@/lib/generated/prisma/models/Job";
import type { JobStepModel } from "@/lib/generated/prisma/models/JobStep";

// ─── Re‑export do modelo Prisma como DTO ──────────────────
export type Job = JobModel;
export type JobStep = JobStepModel;

// ─── Resposta detalhada de um Job (GET /api/jobs/:id) ─────
export interface JobDetailResponse {
  job: Job;
  steps: JobStep[] | null;
}

// ─── Envelope de resposta da API ──────────────────────────
export interface ApiError {
  code: string;
  message: string;
  details?: unknown[];
}

export interface ApiSuccessResponse<T> {
  data: T;
  error: null;
}

export interface ApiErrorResponse {
  data: null;
  error: ApiError;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// ─── Payloads de entrada ──────────────────────────────────
export interface CreateJobPayload {
  file: File;
  profile: string;
}

export interface UpdateJobPayload {
  status?: "queued" | "processing" | "done" | "error";
  progress?: number;
  errorCode?: string;
  errorMessage?: string;
}

// ─── Payloads de saída (POST /api/jobs) ───────────────────
export interface CreateJobResponse {
  jobId: string;
  status: string;
  warning?: string;
}
