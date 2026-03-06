/**
 * Parser de Planilhas — server-only.
 *
 * Suporta .xlsx (via xlsx/SheetJS) e .csv (via csv-parse).
 * Retorna um array de arrays de strings normalizado, pronto
 * para ser validado pelo spreadsheetContract.
 */

import * as XLSX from "xlsx";
import { parse as csvParse } from "csv-parse/sync";
import { CSV_DELIMITER } from "@/lib/spreadsheetContract";

/**
 * Parseia um Buffer de planilha (.xlsx ou .csv) em linhas de strings.
 *
 * @param buffer — conteúdo do arquivo em memória
 * @param mimeType — tipo MIME do arquivo
 * @param filename — nome original (usado para detectar extensão)
 * @returns string[][] — array de linhas, cada linha é array de células
 */
export function parseSpreadsheet(
  buffer: Buffer,
  mimeType: string,
  filename: string,
): string[][] {
  const ext = filename.toLowerCase().split(".").pop();

  if (ext === "xlsx" || mimeType.includes("spreadsheetml")) {
    return parseXlsx(buffer);
  }

  if (ext === "csv" || mimeType.includes("csv") || mimeType.includes("text/plain")) {
    return parseCsv(buffer);
  }

  throw new Error(`Tipo de arquivo não suportado: ${ext} (${mimeType})`);
}

function parseXlsx(buffer: Buffer): string[][] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

  if (!firstSheet) {
    throw new Error("O arquivo .xlsx não contém nenhuma aba.");
  }

  // Converte para array de arrays, todas as células como string
  const rows: string[][] = XLSX.utils.sheet_to_json(firstSheet, {
    header: 1,
    defval: "",
    raw: false,
  });

  return rows.map((row) =>
    (row as unknown[]).map((cell) => String(cell ?? "")),
  );
}

function parseCsv(buffer: Buffer): string[][] {
  // Tenta detectar encoding (UTF-8 com BOM ou Latin-1)
  let content = buffer.toString("utf-8");

  // Remove BOM se presente
  if (content.charCodeAt(0) === 0xfeff) {
    content = content.slice(1);
  }

  const records: string[][] = csvParse(content, {
    delimiter: CSV_DELIMITER,
    relax_column_count: true,
    skip_empty_lines: false,
    relax_quotes: true,
    trim: false,
  });

  return records;
}
