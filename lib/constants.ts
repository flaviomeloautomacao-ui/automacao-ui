/** Tamanho máximo de upload em megabytes */
export const MAX_UPLOAD_MB = 20;

/** Extensões de arquivo permitidas para upload */
export const ALLOWED_EXTENSIONS = [".xlsx", ".csv"] as const;

/** URL base do Python Service (FastAPI) */
export const PYTHON_SERVICE_URL =
  process.env.PYTHON_SERVICE_URL ?? "http://localhost:8001";
