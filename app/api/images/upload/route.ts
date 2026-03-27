/**
 * Route Handler — /api/images/upload
 *
 * POST → Recebe imagem via FormData, faz upload ao Cloudinary,
 *         persiste EquipmentImage e retorna dados.
 *
 * Naming convention (v2):
 *   public_id = reports/{reportId}/equipments/{NomeEquipamento}_{ContratoId}-{Index}
 *   Padrão obrigatório: NomeEquipamentoContrato_ContratoId-Index
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadImageServer } from "@/lib/cloudinaryServer";
import type { ApiResponse } from "@/lib/types";
import {
  generateImageName,
  toPascalCase,
  sanitizeContratoId,
  getNextImageIndex,
  validateImageFileName,
  EQUIPMENT_IMAGE_NAME_REGEX,
} from "@/lib/normalizeEquipmentName";

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
  "image/gif",
]);

// ─── POST /api/images/upload ──────────────────────────────

export async function POST(request: NextRequest) {
  try {
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return error("INVALID_FORM", "Request must be multipart/form-data.");
    }

    const file = formData.get("file") as File | null;
    const equipmentId = (formData.get("equipmentId") as string | null)?.trim();

    // Validate required fields
    if (!file || !(file instanceof File) || file.size === 0) {
      return error("MISSING_FILE", "O campo 'file' é obrigatório.");
    }

    if (!equipmentId) {
      return error("MISSING_EQUIPMENT_ID", "O campo 'equipmentId' é obrigatório.");
    }

    if (!UUID_RE.test(equipmentId)) {
      return error("INVALID_EQUIPMENT_ID", "equipmentId must be a valid UUID.");
    }

    // Validate file type
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      return error(
        "INVALID_IMAGE_TYPE",
        `Tipo '${file.type}' não permitido. Use: JPEG, PNG, WebP ou GIF.`,
      );
    }

    // Validate size
    if (file.size > MAX_IMAGE_BYTES) {
      return error(
        "IMAGE_TOO_LARGE",
        `Imagem excede o limite de 10MB (${(file.size / (1024 * 1024)).toFixed(1)}MB).`,
      );
    }

    // Verify equipment exists and get context for naming
    const equipment = await prisma.reportEquipment.findUnique({
      where: { id: equipmentId },
      select: {
        id: true,
        reportId: true,
        equipmentName: true,
        report: {
          select: { contrato: true },
        },
        images: {
          select: { publicId: true },
        },
      },
    });

    if (!equipment) {
      return error("EQUIPMENT_NOT_FOUND", `Equipment ${equipmentId} not found`, 404);
    }

    // ── Generate standardized public_id ───────────────────
    const contratoRaw = equipment.report?.contrato ?? "";
    const contrato = sanitizeContratoId(contratoRaw);
    const eqPascal = toPascalCase(equipment.equipmentName);

    // Calculate next available index from existing images
    const existingNames = equipment.images.map((img) => {
      // Extract basename from Cloudinary public_id (e.g., "reports/.../MoegaFerroviaria_1234-0")
      const parts = img.publicId.split("/");
      return parts[parts.length - 1];
    });
    const nextIndex = getNextImageIndex(existingNames);

    const imageName = generateImageName(equipment.equipmentName, contratoRaw, nextIndex);
    const folder = `reports/${equipment.reportId}/equipments`;

    // Upload to Cloudinary with standardized naming
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const cloudinaryResult = await uploadImageServer(buffer, {
      folder,
      publicId: imageName,
    });

    // Persist record
    const image = await prisma.equipmentImage.create({
      data: {
        equipmentId,
        publicId: cloudinaryResult.public_id,
        secureUrl: cloudinaryResult.secure_url,
        width: cloudinaryResult.width,
        height: cloudinaryResult.height,
      },
    });

    return success(
      {
        id: image.id,
        secureUrl: image.secureUrl,
        publicId: image.publicId,
        width: image.width,
        height: image.height,
      },
      201,
    );
  } catch (err) {
    console.error("[POST /api/images/upload]", err);
    return error("INTERNAL_ERROR", "Failed to upload image", 500);
  }
}
