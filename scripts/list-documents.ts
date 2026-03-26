/**
 * Lista todos os documentos distintos armazenados na tabela konis_db.
 *
 * Uso:
 *   npx tsx scripts/list-documents.ts
 *
 * Requer a variável de ambiente DATABASE_URL no .env
 */

import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });

  const { rows } = await pool.query<{ document: string; chunks: string }>(`
    SELECT
      metadata->>'title' AS document,
      COUNT(*)::int       AS chunks
    FROM konis_db
    GROUP BY metadata->>'title'
    ORDER BY document;
  `);

  await pool.end();

  if (rows.length === 0) {
    console.log("Nenhum documento encontrado na tabela konis_db.");
    return;
  }

  console.log(`\n${"─".repeat(60)}`);
  console.log(` Documentos em konis_db (${rows.length} arquivo(s) indexado(s))`);
  console.log(`${"─".repeat(60)}`);

  rows.forEach((row, i) => {
    const doc = row.document ?? "(sem título)";
    console.log(` ${String(i + 1).padStart(2, "0")}. ${doc.padEnd(45)} ${row.chunks} chunks`);
  });

  console.log(`${"─".repeat(60)}\n`);
}

main().catch((err) => {
  console.error("Erro ao conectar ao banco:", err.message);
  process.exit(1);
});
