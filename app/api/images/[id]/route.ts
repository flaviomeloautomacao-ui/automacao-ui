/**
 * Route Handler — /api/images/[id]
 *
 * DELETE → Remove imagem do Cloudinary e do banco de dados.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deleteImageServer } from "@/lib/cloudinaryServer";
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

type RouteParams = { params: Promise<{ id: string }> };

// ─── DELETE /api/images/:id ───────────────────────────────

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    if (!UUID_RE.test(id)) {
      return error("INVALID_ID", "Image ID must be a valid UUID");
    }

    const dhaImage = await prisma.dhaEquipmentImage.findUnique({
      where: { id },
    });

    const areaImage = dhaImage
      ? null
      : await prisma.areaReportAreaImage.findUnique({
        where: { id },
      });

    const legacyImage = (dhaImage || areaImage)
      ? null
      : await prisma.equipmentImage.findUnique({
        where: { id },
      });

    const image = dhaImage ?? areaImage ?? legacyImage;

    if (!image) {
      return error("NOT_FOUND", `Image ${id} not found`, 404);
    }

    // Delete from Cloudinary
    await deleteImageServer(image.publicId);

    // Delete from database
    if (dhaImage) {
      await prisma.dhaEquipmentImage.delete({ where: { id } });
    } else if (areaImage) {
      await prisma.areaReportAreaImage.delete({ where: { id } });
    } else {
      await prisma.equipmentImage.delete({ where: { id } });
    }

    return success({ deleted: true });
  } catch (err) {
    console.error(`[DELETE /api/images/${(await params).id}]`, err);
    return error("INTERNAL_ERROR", "Failed to delete image", 500);
  }
}
