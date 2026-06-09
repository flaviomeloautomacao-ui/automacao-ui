/**
 * Script de inspeção do contrato de Classificação de Áreas.
 *
 * Uso:
 *   npx tsx scripts/inspect-areas-xlsx.ts [caminho-do-xlsx]
 *
 * Sem argumentos, usa o template oficial em docs/sheets_example/.
 */

import { readFileSync } from "node:fs";
import { join, basename } from "node:path";
import { parseSpreadsheet } from "../lib/spreadsheetParser";
import { validateAreaSpreadsheet } from "../lib/spreadsheetContractAreas";

const DEFAULT_PATH = join(
  __dirname,
  "..",
  "docs",
  "sheets_example",
  "Tabela_de_classificacao_Rev_Final.xlsx",
);

const xlsxPath = process.argv[2] ?? DEFAULT_PATH;

console.log("📄 Lendo:", xlsxPath);
const buffer = readFileSync(xlsxPath);
console.log(`   Tamanho: ${(buffer.length / 1024).toFixed(1)} KB\n`);

const rawRows = parseSpreadsheet(
  buffer,
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  basename(xlsxPath),
);
console.log(`🔢 Linhas no XLSX: ${rawRows.length}\n`);

const result = validateAreaSpreadsheet(rawRows);

console.log("=== METADADOS ===");
console.log(result.metadata);
console.log();
console.log(`✅ valid: ${result.valid}`);
console.log(`📊 linhas normalizadas: ${result.rowCount}`);
console.log(`⚠️  warnings: ${result.warnings.length}`);
console.log(`❌ errors:   ${result.errors.length}`);
console.log();

if (result.errors.length > 0) {
  console.log("=== ERROS (primeiros 20) ===");
  for (const e of result.errors.slice(0, 20)) {
    console.log(`  [linha ${e.row}] ${e.column}: ${e.message}`);
  }
  console.log();
}

if (result.warnings.length > 0) {
  console.log("=== WARNINGS (primeiros 10) ===");
  for (const w of result.warnings.slice(0, 10)) {
    console.log(`  [linha ${w.row}] ${w.column}: ${w.message}`);
  }
  console.log();
}

console.log("=== AMOSTRA DE LINHAS NORMALIZADAS (primeiras 5) ===");
for (const row of result.rows.slice(0, 5)) {
  console.log(JSON.stringify(row, null, 2));
}
