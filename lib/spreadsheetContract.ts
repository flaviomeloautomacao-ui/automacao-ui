/**
 * Contrato da Planilha DHA (Análise de Riscos)
 *
 * Define colunas obrigatórias, tipos esperados e validações por linha.
 * Para ajustar o contrato, edite COLUMNS e ROW_VALIDATORS abaixo.
 *
 * O parser ignora automaticamente as primeiras linhas de metadados
 * (Projeto, Data, Revisão) e localiza a linha de cabeçalho pela
 * presença de TODAS as colunas obrigatórias.
 */

// ─── Tipos ────────────────────────────────────────────────

export type ColumnType = "string" | "number" | "enum";

export interface ColumnDef {
  /** Nome exato do cabeçalho (case-insensitive, trim aplicado) */
  name: string;
  /** Tipo esperado do dado */
  type: ColumnType;
  /** A coluna é obrigatória (não pode estar vazia)? */
  required: boolean;
  /** Valores válidos quando type === 'enum' */
  enumValues?: string[];
  /** Descrição legível para mensagens de erro */
  label?: string;
}

export interface RowValidationError {
  row: number;
  column: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: RowValidationError[];
  /** Linhas de dados normalizadas (sem metadados do cabeçalho) */
  rows: Record<string, string>[];
  /** Número total de linhas de dados encontradas */
  rowCount: number;
}

// ─── Colunas Obrigatórias ─────────────────────────────────

/**
 * Lista de colunas esperadas na planilha DHA.
 *
 * 🔧 PARA AJUSTAR: adicione/remova entradas aqui.
 * Os nomes são comparados em lowercase/trim com o cabeçalho real.
 */
export const COLUMNS: ColumnDef[] = [
  {
    name: "Equipamento",
    type: "string",
    required: true,
    label: "Equipamento",
  },
  {
    name: "Riscos",
    type: "string",
    required: true,
    label: "Riscos identificados",
  },
  {
    name: "Perigo",
    type: "string",
    required: true,
    label: "Perigo",
  },
  {
    name: "Causas Possíveis",
    type: "string",
    required: true,
    label: "Causas possíveis",
  },
  {
    name: "Consequências",
    type: "string",
    required: true,
    label: "Consequências",
  },
  {
    name: "Categoria da Severidade",
    type: "enum",
    required: true,
    enumValues: ["baixa", "média", "alta", "muito alta"],
    label: "Categoria da Severidade",
  },
  {
    name: "Categoria do Risco",
    type: "enum",
    required: true,
    enumValues: ["baixo", "médio", "alto", "muito alto"],
    label: "Categoria do Risco",
  },
  {
    name: "Medidas Preventivas Existentes",
    type: "string",
    required: false,
    label: "Medidas Preventivas Existentes",
  },
  {
    name: "Medidas Preventivas a Implementar",
    type: "string",
    required: false,
    label: "Medidas Preventivas a Implementar",
  },
  {
    name: "Observações",
    type: "string",
    required: false,
    label: "Observações",
  },
];

/** Nomes normalizados (lowercase + trim) das colunas obrigatórias */
export const REQUIRED_COLUMN_NAMES = COLUMNS
  .filter((c) => c.required)
  .map((c) => c.name.toLowerCase().trim());

/** Todos os nomes normalizados */
export const ALL_COLUMN_NAMES = COLUMNS.map((c) => c.name.toLowerCase().trim());

// ─── Constantes do Contrato ───────────────────────────────

/** Número máximo de linhas de dados aceitas (segurança) */
export const MAX_ROWS = 5_000;

/** Número máximo de linhas de metadados antes do cabeçalho */
export const MAX_HEADER_SEARCH_ROWS = 20;

/** Separador CSV (planilhas brasileiras usam ponto-e-vírgula) */
export const CSV_DELIMITER = ";";

// ─── Motor de Validação ───────────────────────────────────

/**
 * Localiza a linha de cabeçalho no array de linhas parseadas.
 * Retorna o índice ou -1 se não encontrado.
 */
export function findHeaderRowIndex(
  rows: string[][],
): number {
  for (let i = 0; i < Math.min(rows.length, MAX_HEADER_SEARCH_ROWS); i++) {
    const normalizedCells = rows[i].map((c) => c.toLowerCase().trim());
    const allFound = REQUIRED_COLUMN_NAMES.every((req) =>
      normalizedCells.some((cell) => cell === req),
    );
    if (allFound) return i;
  }
  return -1;
}

/**
 * Mapeia os índices de cada coluna definida no contrato.
 * Retorna um mapa coluna-nome → índice-na-linha.
 */
export function buildColumnIndexMap(
  headerRow: string[],
): Map<string, number> {
  const map = new Map<string, number>();
  const normalizedHeader = headerRow.map((h) => h.toLowerCase().trim());

  for (const col of COLUMNS) {
    const idx = normalizedHeader.findIndex(
      (h) => h === col.name.toLowerCase().trim(),
    );
    if (idx !== -1) {
      map.set(col.name, idx);
    }
  }
  return map;
}

/**
 * Valida todas as linhas de dados contra o contrato.
 *
 * @param rawRows — array de arrays de strings (já parseado pelo CSV/XLSX parser)
 * @returns ValidationResult
 */
export function validateSpreadsheet(rawRows: string[][]): ValidationResult {
  const errors: RowValidationError[] = [];

  // 1. Encontrar cabeçalho
  const headerIdx = findHeaderRowIndex(rawRows);
  if (headerIdx === -1) {
    return {
      valid: false,
      errors: [
        {
          row: 0,
          column: "*",
          message: `Cabeçalho não encontrado. Colunas obrigatórias esperadas: ${COLUMNS.filter((c) => c.required).map((c) => c.name).join(", ")}`,
        },
      ],
      rows: [],
      rowCount: 0,
    };
  }

  const headerRow = rawRows[headerIdx];
  const colMap = buildColumnIndexMap(headerRow);

  // 2. Verificar colunas obrigatórias presentes
  for (const col of COLUMNS.filter((c) => c.required)) {
    if (!colMap.has(col.name)) {
      errors.push({
        row: headerIdx + 1,
        column: col.name,
        message: `Coluna obrigatória "${col.name}" não encontrada no cabeçalho.`,
      });
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors, rows: [], rowCount: 0 };
  }

  // 3. Extrair linhas de dados (após cabeçalho)
  const dataRows = rawRows.slice(headerIdx + 1);

  // 4. Remover linhas completamente vazias
  const nonEmptyRows = dataRows.filter((row) =>
    row.some((cell) => cell.trim() !== ""),
  );

  if (nonEmptyRows.length === 0) {
    return {
      valid: false,
      errors: [
        {
          row: headerIdx + 2,
          column: "*",
          message: "A planilha não contém linhas de dados após o cabeçalho.",
        },
      ],
      rows: [],
      rowCount: 0,
    };
  }

  if (nonEmptyRows.length > MAX_ROWS) {
    return {
      valid: false,
      errors: [
        {
          row: 0,
          column: "*",
          message: `Planilha excede o limite de ${MAX_ROWS} linhas de dados (encontradas: ${nonEmptyRows.length}).`,
        },
      ],
      rows: [],
      rowCount: nonEmptyRows.length,
    };
  }

  // 5. Validar cada linha
  const normalizedRows: Record<string, string>[] = [];
  const seenEquipamentos = new Set<string>();

  for (let i = 0; i < nonEmptyRows.length; i++) {
    const row = nonEmptyRows[i];
    const rowNumber = headerIdx + 2 + i; // 1-based, offset pelo cabeçalho
    const normalizedRow: Record<string, string> = {};

    for (const col of COLUMNS) {
      const idx = colMap.get(col.name);
      if (idx === undefined) continue;

      const rawValue = (row[idx] ?? "").trim();
      normalizedRow[col.name] = rawValue;

      // 5a. Campo obrigatório vazio
      if (col.required && rawValue === "") {
        errors.push({
          row: rowNumber,
          column: col.name,
          message: `Campo obrigatório "${col.label ?? col.name}" está vazio.`,
        });
        continue;
      }

      // 5b. Validação de enum
      if (col.type === "enum" && col.enumValues && rawValue !== "") {
        const normalizedValue = rawValue.toLowerCase().trim();
        const validValues = col.enumValues.map((v) => v.toLowerCase());
        if (!validValues.includes(normalizedValue)) {
          errors.push({
            row: rowNumber,
            column: col.name,
            message: `Valor "${rawValue}" inválido para "${col.label ?? col.name}". Valores aceitos: ${col.enumValues.join(", ")}`,
          });
        }
      }

      // 5c. Validação de number
      if (col.type === "number" && rawValue !== "") {
        if (isNaN(Number(rawValue.replace(",", ".")))) {
          errors.push({
            row: rowNumber,
            column: col.name,
            message: `Valor "${rawValue}" não é numérico para "${col.label ?? col.name}".`,
          });
        }
      }
    }

    // 5d. Detectar equipamentos duplicados (mesma string exata)
    const equipamento = normalizedRow["Equipamento"] ?? "";
    if (equipamento && seenEquipamentos.has(equipamento.toLowerCase())) {
      // Duplicatas de equipamento são PERMITIDAS na planilha DHA
      // (mesmo equipamento pode ter múltiplos riscos).
      // Descomente abaixo para proibir:
      // errors.push({
      //   row: rowNumber,
      //   column: "Equipamento",
      //   message: `Equipamento "${equipamento}" duplicado (já apareceu anteriormente).`,
      // });
    }
    seenEquipamentos.add(equipamento.toLowerCase());

    normalizedRows.push(normalizedRow);
  }

  // Limitar erros retornados para evitar payloads enormes
  const MAX_ERRORS = 50;
  const truncatedErrors = errors.slice(0, MAX_ERRORS);
  if (errors.length > MAX_ERRORS) {
    truncatedErrors.push({
      row: 0,
      column: "*",
      message: `… e mais ${errors.length - MAX_ERRORS} erro(s). Corrija os primeiros e reenvie.`,
    });
  }

  return {
    valid: truncatedErrors.length === 0,
    errors: truncatedErrors,
    rows: normalizedRows,
    rowCount: normalizedRows.length,
  };
}
