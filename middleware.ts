/**
 * Middleware de proteção de rotas.
 *
 * Redireciona para /login quando não há sessão ativa.
 * Exceções: /login, /api/auth/*, /api/health, assets estáticos.
 *
 * Usa auth.config.ts (sem Prisma) para compatibilidade com Edge Runtime.
 */

import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  matcher: [
    /*
     * Protege tudo EXCETO:
     * - /login          (página de login)
     * - /api/auth/*     (rotas do NextAuth)
     * - /api/health     (healthcheck)
     * - /_next/*        (assets do Next.js)
     * - /favicon.ico    (ícone)
     * - arquivos estáticos (.svg, .png, .jpg, etc.)
     */
    "/((?!login|api/auth|api/health|_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
