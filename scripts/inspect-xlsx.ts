/**
 * Script de inspeção — Mostra colunas e primeiras linhas do XLSX.
 *
 * Uso: npx tsx scripts/inspect-xlsx.ts
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseSpreadsheet } from "../lib/spreadsheetParser";

const xlsxPath = join(
  __dirname,
  "..",
  "docs",
  "sheets_example",
  "PLanilha DHA  SFS REV 1_CHATGPT.xlsx",
);

console.log("📄 Lendo arquivo:", xlsxPath);
const buffer = readFileSync(xlsxPath);
console.log(`   Tamanho: ${(buffer.length / 1024).toFixed(1)} KB\n`);

console.log("🔍 Parseando XLSX...");
const rawRows = parseSpreadsheet(
  buffer,
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "planilha.xlsx",
);
console.log(`   Linhas parseadas: ${rawRows.length}\n`);

// Show first 15 rows to see metadata + header
console.log("=== PRIMEIRAS 15 LINHAS (metadados + cabeçalho) ===\n");
for (let i = 0; i < Math.min(15, rawRows.length); i++) {
  console.log(`[ROW ${i}] (${rawRows[i].length} cells):`);
  rawRows[i].forEach((cell, j) => {
    if (cell.trim()) {
      console.log(`   [${j}] "${cell}"`);
    }
  });
  console.log();
}

// After finding header, show some data rows
console.log("=== AMOSTRA DE DADOS (linhas 6-10) ===\n");
for (let i = 6; i < Math.min(20, rawRows.length); i++) {
  console.log(`[ROW ${i}] (${rawRows[i].length} cells):`);
  rawRows[i].forEach((cell, j) => {
    if (cell.trim()) {
      const preview = cell.length > 80 ? cell.substring(0, 80) + "..." : cell;
      console.log(`   [${j}] "${preview}"`);
    }
  });
  console.log();
}

// Show all unique values for key columns (header row first)
// Find header
let headerIdx = -1;
for (let i = 0; i < Math.min(rawRows.length, 20); i++) {
  const cells = rawRows[i].map((c) => c.toLowerCase().trim());
  if (cells.some((c) => c.includes("equipamento")) && cells.some((c) => c.includes("risco"))) {
    headerIdx = i;
    break;
  }
}

if (headerIdx >= 0) {
  console.log(`=== CABEÇALHO ENCONTRADO NA LINHA ${headerIdx} ===`);
  console.log("Colunas:", rawRows[headerIdx].map((c, i) => `[${i}]="${c.trim()}"`).filter(c => !c.endsWith('=""')).join(", "));
  console.log();

  const dataRows = rawRows.slice(headerIdx + 1).filter((r) => r.some((c) => c.trim()));
  console.log(`Total linhas de dados (não-vazias): ${dataRows.length}\n`);

  // Enumerate unique values per column
  const header = rawRows[headerIdx];
  for (let col = 0; col < header.length; col++) {
    const colName = header[col]?.trim();
    if (!colName) continue;

    const values = new Set<string>();
    for (const row of dataRows) {
      const val = (row[col] ?? "").trim();
      if (val) values.add(val);
    }

    // Only show if few unique values (enums etc)
    if (values.size <= 15 && values.size > 0) {
      console.log(`📊 Coluna "${colName}" — ${values.size} valor(es) único(s):`);
      for (const v of [...values].sort()) {
        const preview = v.length > 60 ? v.substring(0, 60) + "..." : v;
        console.log(`   • "${preview}"`);
      }
      console.log();
    } else if (values.size > 0) {
      console.log(`📊 Coluna "${colName}" — ${values.size} valores únicos (muitos para exibir)`);
      // Show first 3
      const arr = [...values];
      for (let i = 0; i < 3; i++) {
        const preview = arr[i].length > 60 ? arr[i].substring(0, 60) + "..." : arr[i];
        console.log(`   • "${preview}"`);
      }
      console.log(`   … e mais ${values.size - 3}\n`);
    }
  }
}
