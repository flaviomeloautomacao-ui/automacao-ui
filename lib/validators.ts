/**
 * Validadores Zod para payloads da API.
 *
 * Cada schema valida a entrada do usuário e produz tipos TypeScript
 * inferidos automaticamente. Use `schema.parse(data)` nos route handlers.
 */

import { z } from "zod";

// ─── Criação de Job ───────────────────────────────────────
export const createJobSchema = z.object({
  filename: z
    .string({ error: "filename is required" })
    .min(1, "filename must not be empty"),
  documentType: z.enum(["dha", "areas"], {
    error: "documentType is required",
  }),
});

export type CreateJobInput = z.infer<typeof createJobSchema>;

// ─── Atualização de Job (PATCH) ───────────────────────────
export const updateJobSchema = z
  .object({
    status: z.enum(["queued", "processing", "done", "error"]).optional(),
    progress: z
      .number()
      .int("progress must be an integer")
      .min(0, "progress must be >= 0")
      .max(100, "progress must be <= 100")
      .optional(),
    currentStep: z.string().optional(),
    errorCode: z.string().optional(),
    errorMessage: z.string().optional(),
    pdfPath: z.string().optional(),
    startedAt: z.string().datetime().optional(),
    finishedAt: z.string().datetime().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdateJobInput = z.infer<typeof updateJobSchema>;

// ─── Atualização de Step (PATCH) ──────────────────────────
export const updateStepSchema = z
  .object({
    status: z.enum(["queued", "processing", "done", "error"]).optional(),
    startedAt: z.string().datetime().optional(),
    completedAt: z.string().datetime().optional(),
    errorMessage: z.string().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdateStepInput = z.infer<typeof updateStepSchema>;

// ─── Query params para listagem ───────────────────────────
export const listJobsQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1, "limit must be >= 1")
    .max(100, "limit must be <= 100")
    .default(20),
  offset: z.coerce
    .number()
    .int()
    .min(0, "offset must be >= 0")
    .default(0),
});

export type ListJobsQuery = z.infer<typeof listJobsQuerySchema>;
