/**
 * Prisma Client Singleton
 *
 * Evita múltiplas instâncias do PrismaClient durante hot-reload em dev.
 * Este módulo deve ser importado APENAS em contexto server-side:
 *   - Server Components
 *   - Route Handlers (/app/api)
 *   - Server Actions
 *
 * NUNCA importe este arquivo em Client Components.
 */

import { PrismaClient } from "@/lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL!;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
