export const DOCUMENT_TYPES = ["dha", "areas"] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_SCHEMA_V2 = "v2";
export const DOCUMENT_SCHEMA_LEGACY = "legacy";

export function isDocumentType(value: string | null | undefined): value is DocumentType {
  return value === "dha" || value === "areas";
}

export function legacyProfileToDocumentType(
  profile: string | null | undefined,
): DocumentType | null {
  if (profile === "areas") return "areas";
  if (profile === "dust") return "dha";
  return null;
}

export function documentTypeToLegacyProfile(documentType: DocumentType): string {
  return documentType === "areas" ? "areas" : "dust";
}

export function getJobDocumentType(job: {
  documentType?: string | null;
  profile?: string | null;
}): DocumentType {
  if (isDocumentType(job.documentType)) {
    return job.documentType;
  }

  return legacyProfileToDocumentType(job.profile) ?? "dha";
}

export function getDocumentTypeLabel(documentType: DocumentType): string {
  return documentType === "areas" ? "Classificação de Áreas" : "DHA";
}
