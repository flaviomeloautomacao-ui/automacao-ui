/**
 * Tipos compartilhados da aplicação.
 *
 * Todos os tipos de API devem seguir o envelope padrão:
 *   Sucesso → { data: T,    error: null }
 *   Erro    → { data: null, error: { code: string, message: string, details?: unknown[] } }
 */

import type { JobModel } from "@/lib/generated/prisma/models/Job";
import type { JobStepModel } from "@/lib/generated/prisma/models/JobStep";
import type { DocumentType } from "@/lib/documents";

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
  documentType: DocumentType;
}

export interface UpdateJobPayload {
  status?: "queued" | "processing" | "done" | "error";
  progress?: number;
  currentStep?: string;
  errorCode?: string;
  errorMessage?: string;
  pdfPath?: string;
  startedAt?: string;
  finishedAt?: string;
}

// ─── Payloads de saída (POST /api/jobs) ───────────────────
export interface CreateJobResponse {
  jobId: string;
  redirectTo: string;
}

// ─── Resposta do Python Service (POST /uploads) ───────
export interface PythonServiceData {
  upload_id: string;
  draft_id: string;
  report_id: string;
  pdf_url: string;
  pdf_path: string;
}

export type PythonServiceResponse = ApiResponse<PythonServiceData>;

// ─── Custos LLM ──────────────────────────────────────────

export interface CostSummary {
  totalCostUsd: number;
  totalTokens: number;
  callCount: number;
}

export interface CostAggregate {
  costUsd: number;
  tokens: number;
  calls: number;
}

export interface CostRecord {
  id: string;
  flow: string;
  step: string;
  provider: string;
  model: string;
  callType: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  tokensSource: string;
  estimatedCostUsd: number;
  durationMs: number;
  success: boolean;
  errorMessage: string | null;
  retryAttempt: number | null;
  equipmentName: string | null;
  promptChars: number;
  responseChars: number;
  createdAt: string;
}

export interface PipelineVersionInfo {
  id: string;
  llmModel: string;
  embeddingModel: string;
  ragStrategy: string;
  createdAt: string;
}

export interface CostBreakdownResponse {
  summary: CostSummary;
  byStep: Record<string, CostAggregate>;
  byEquipment: Record<string, CostAggregate>;
  pipelineVersion: PipelineVersionInfo | null;
  records: CostRecord[];
}
