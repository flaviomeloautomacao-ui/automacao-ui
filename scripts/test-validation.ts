/**
 * Script de teste — Verifica se a planilha de exemplo passa na validação.
 *
 * Uso: npx tsx scripts/test-validation.ts
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseSpreadsheet } from "../lib/spreadsheetParser";
import { validateSpreadsheet } from "../lib/spreadsheetContract";

const filePath = join(
  __dirname,
  "..",
  "docs",
  "sheets_example",
  "PLanilha DHA  SFS REV 1_CHATGPT.xlsx",
);

console.log("📄 Lendo arquivo:", filePath);
const buffer = readFileSync(filePath);
console.log(`   Tamanho: ${(buffer.length / 1024).toFixed(1)} KB\n`);

console.log("🔍 Parseando XLSX...");
const rawRows = parseSpreadsheet(
  buffer,
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "planilha.xlsx",
);
console.log(`   Linhas parseadas: ${rawRows.length}\n`);

console.log("✅ Validando contra o contrato...");
const result = validateSpreadsheet(rawRows);

console.log(`   Válida: ${result.valid}`);
console.log(`   Linhas de dados: ${result.rowCount}`);
console.log(`   Metadados:`, result.metadata);

if (result.errors.length > 0) {
  console.log(`\n❌ ${result.errors.length} erro(s) encontrado(s):\n`);
  for (const err of result.errors) {
    console.log(`   Linha ${err.row} | ${err.column} | ${err.message}`);
  }
} else {
  console.log("\n🎉 Planilha válida! Nenhum erro encontrado.");
}

// Mostra amostra das primeiras 3 linhas normalizadas
if (result.rows.length > 0) {
  console.log(`\n📊 Amostra (primeiras 3 linhas):`);
  for (let i = 0; i < Math.min(3, result.rows.length); i++) {
    const row = result.rows[i];
    console.log(`   [${i + 1}] Equipamento: "${row["Equipamento"]}"`);
    const desc = row["Descrição do equipamento"] ?? "";
    console.log(`       Descrição: "${desc.substring(0, 80)}${desc.length > 80 ? "..." : ""}"`);
    console.log(`       Severidade: "${row["Categoria da Severidade"]}"`);
    console.log(`       Risco: "${row["Categoria do Risco"]}"`);
    console.log(`       Colunas: ${Object.keys(row).length}`);
  }
}
