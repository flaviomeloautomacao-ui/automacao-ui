/**
 * Route Handler — /api/jobs/[id]/cover-image
 *
 * POST   → Upload imagem de capa → Cloudinary → salva URL no Report
 * DELETE → Remove imagem do Cloudinary → limpa campos no Report
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadImageServer, deleteImageServer } from "@/lib/cloudinaryServer";
import type { ApiResponse } from "@/lib/types";

// ─── Helpers ──────────────────────────────────────────────

function success<T>(data: T, status = 200) {
  return NextResponse.json<ApiResponse<T>>(
    { data, error: null },
    { status },
  );
}

function error(code: string, message: string, status = 400) {
  return NextResponse.json<ApiResponse<never>>(
    { data: null, error: { code, message } },
    { status },
  );
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

type RouteParams = { params: Promise<{ id: string }> };

// ─── POST /api/jobs/:id/cover-image ───────────────────────

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    if (!UUID_RE.test(id)) {
      return error("INVALID_ID", "Job ID must be a valid UUID");
    }

    // Validate job exists and is in complement phase
    const job = await prisma.job.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!job) {
      return error("NOT_FOUND", `Job ${id} not found`, 404);
    }

    if (job.status !== "awaiting_complement") {
      return error(
        "INVALID_STATUS",
        `Job is '${job.status}', expected 'awaiting_complement'`,
        409,
      );
    }

    // Get report
    const report = await prisma.report.findUnique({
      where: { jobId: id },
      select: { id: true, coverImagePublicId: true },
    });

    if (!report) {
      return error("REPORT_NOT_FOUND", `No report found for job ${id}`, 404);
    }

    // Parse FormData
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return error("INVALID_FORM", "Request must be multipart/form-data.");
    }

    const file = formData.get("file") as File | null;

    if (!file || !(file instanceof File) || file.size === 0) {
      return error("MISSING_FILE", "O campo 'file' é obrigatório.");
    }

    // Validate file type
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      return error(
        "INVALID_IMAGE_TYPE",
        `Tipo '${file.type}' não permitido. Use: JPEG, PNG ou WebP.`,
      );
    }

    // Validate size
    if (file.size > MAX_IMAGE_BYTES) {
      return error(
        "IMAGE_TOO_LARGE",
        `Imagem excede o limite de 10MB (${(file.size / (1024 * 1024)).toFixed(1)}MB).`,
      );
    }

    // If there's already a cover image, delete the old one from Cloudinary
    if (report.coverImagePublicId) {
      await deleteImageServer(report.coverImagePublicId);
    }

    // Upload to Cloudinary
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const cloudinaryResult = await uploadImageServer(buffer, {
      folder: `reports/${report.id}/cover`,
    });

    // Update report with the new cover image
    await prisma.report.update({
      where: { id: report.id },
      data: {
        coverImageUrl: cloudinaryResult.secure_url,
        coverImagePublicId: cloudinaryResult.public_id,
      },
    });

    return success(
      {
        coverImageUrl: cloudinaryResult.secure_url,
        coverImagePublicId: cloudinaryResult.public_id,
      },
      201,
    );
  } catch (err) {
    console.error("[POST /api/jobs/cover-image]", err);
    return error("INTERNAL_ERROR", "Failed to upload cover image", 500);
  }
}

// ─── DELETE /api/jobs/:id/cover-image ─────────────────────

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    if (!UUID_RE.test(id)) {
      return error("INVALID_ID", "Job ID must be a valid UUID");
    }

    // Get report
    const report = await prisma.report.findUnique({
      where: { jobId: id },
      select: { id: true, coverImageUrl: true, coverImagePublicId: true },
    });

    if (!report) {
      return error("REPORT_NOT_FOUND", `No report found for job ${id}`, 404);
    }

    // Delete from Cloudinary if exists
    if (report.coverImagePublicId) {
      await deleteImageServer(report.coverImagePublicId);
    }

    // Clear fields in DB
    await prisma.report.update({
      where: { id: report.id },
      data: {
        coverImageUrl: null,
        coverImagePublicId: null,
      },
    });

    return success({ deleted: true });
  } catch (err) {
    console.error("[DELETE /api/jobs/cover-image]", err);
    return error("INTERNAL_ERROR", "Failed to delete cover image", 500);
  }
}
