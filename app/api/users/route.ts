/**
 * Route Handler — /api/users
 *
 * POST → Cria novo usuário (requer autenticação via middleware)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import type { ApiResponse } from "@/lib/types";

// ─── Helpers ──────────────────────────────────────────────

function success<T>(data: T, status = 200) {
  return NextResponse.json<ApiResponse<T>>(
    { data, error: null },
    { status },
  );
}

function error(
  code: string,
  message: string,
  status = 400,
  details?: unknown[],
) {
  return NextResponse.json(
    { data: null, error: { code, message, ...(details ? { details } : {}) } },
    { status },
  );
}

// ─── Validation ───────────────────────────────────────────

const createUserSchema = z.object({
  name: z.string().optional(),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
});

// ─── POST /api/users ──────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createUserSchema.safeParse(body);

    if (!parsed.success) {
      return error(
        "VALIDATION_ERROR",
        parsed.error.issues.map((i) => i.message).join("; "),
        400,
      );
    }

    const { name, email, password } = parsed.data;

    // Check duplicate email
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return error("DUPLICATE_EMAIL", "Já existe um usuário com este email", 409);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        name: name || null,
        email,
        password: hashedPassword,
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    });

    return success(user, 201);
  } catch (err) {
    console.error("[POST /api/users]", err);
    return error("INTERNAL_ERROR", "Erro ao criar usuário", 500);
  }
}
