/**
 * Seed de usuário — cria um usuário com email e senha no banco.
 *
 * Uso:
 *   npx tsx scripts/seed-user.ts <email> <senha> [nome]
 *
 * Exemplo:
 *   npx tsx scripts/seed-user.ts admin@konis.com.br senha123 "Administrador"
 */

import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

const [, , email, password, name] = process.argv;

if (!email || !password) {
  console.error("Uso: npx tsx scripts/seed-user.ts <email> <senha> [nome]");
  process.exit(1);
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const hash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: { password: hash, name: name || undefined },
    create: { email, password: hash, name: name || null },
  });

  console.log(`✅ Usuário criado/atualizado: ${user.email} (id: ${user.id})`);

  await prisma.$disconnect();
  await pool.end();
}

main().catch((err) => {
  console.error("Erro ao criar usuário:", err);
  process.exit(1);
});
