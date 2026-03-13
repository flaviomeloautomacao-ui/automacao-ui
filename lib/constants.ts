/** Tamanho máximo de upload em megabytes */
export const MAX_UPLOAD_MB = 20;

/** Extensões de arquivo permitidas para upload */
export const ALLOWED_EXTENSIONS = [".xlsx", ".csv"] as const;

/** URL base do Python Service (FastAPI) */
export const PYTHON_SERVICE_URL =
  process.env.PYTHON_SERVICE_URL ?? "http://localhost:8001";

/** Intervalo de polling em milissegundos */
export const POLL_INTERVAL_MS = 3_000;

/** Máximo de ciclos de polling (~10 min) */
export const MAX_POLL_CYCLES = 200;

/**
 * Etapas do pipeline de processamento.
 * Criadas automaticamente ao iniciar um job.
 */
export const PIPELINE_STEPS = [
  { name: "upload_storage", label: "Upload e Armazenamento", order: 1 },
  { name: "data_processing", label: "Processamento dos Dados", order: 2 },
  { name: "llm_analysis", label: "Análise e Recomendações via IA", order: 3 },
  { name: "pdf_rendering", label: "Geração do PDF", order: 4 },
  { name: "report_storage", label: "Armazenamento do Relatório", order: 5 },
] as const;

/** Status considerados finais (não requerem polling) */
export const TERMINAL_STATUSES = new Set(["done", "error", "awaiting_complement"]);
