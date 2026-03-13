/**
 * Contrato da Planilha DHA (Análise de Riscos)
 *
 * Define colunas obrigatórias, tipos esperados e validações por linha.
 * Para ajustar o contrato, edite COLUMNS abaixo.
 *
 * O parser ignora automaticamente as primeiras linhas de metadados
 * (Projeto, Data, Revisão) e localiza a linha de cabeçalho pela
 * presença de TODAS as colunas obrigatórias.
 *
 * ─── Padrão da planilha ───────────────────────────────────────────
 *
 * Linhas 1-5 (metadados):
 *   ;;;;;;;;;;
 *   ;;Projeto:;Nome do Projeto;;;;;;;
 *   ;;Data:;DD/MM/YYYY;;;;;;;
 *   ;;Revisão:;000;;;;;;;
 *   ;;;;;;;;;;
 *
 * Linha 6 (cabeçalho):
 *   Equipamento;Descrição do equipamento;Riscos;Perigo;
 *   Causas Possíveis;Consequências;
 *   Categoria da Severidade;Categoria do Risco;
 *   Medidas Preventivas Existentes;Medidas Preventivas a Implementar;
 *   Observações;Coluna1
 *
 * Linha 7+ (dados):
 *   Campos multiline são delimitados por aspas duplas.
 *   Separador: ponto-e-vírgula (;)
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

/** Metadados extraídos do cabeçalho da planilha (Projeto, Data, Revisão) */
export interface SpreadsheetMetadata {
  projeto?: string;
  data?: string;
  revisao?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: RowValidationError[];
  /** Linhas de dados normalizadas (sem metadados do cabeçalho) */
  rows: Record<string, string>[];
  /** Número total de linhas de dados encontradas */
  rowCount: number;
  /** Metadados extraídos do topo da planilha */
  metadata: SpreadsheetMetadata;
}

// ─── Colunas Esperadas ────────────────────────────────────

/**
 * Lista de colunas esperadas na planilha DHA.
 *
 * 🔧 PARA AJUSTAR: adicione/remova entradas aqui.
 * Os nomes são comparados em lowercase/trim com o cabeçalho real.
 *
 * Valores reais observados na planilha-modelo:
 *   Categoria da Severidade → Baixa, Média, Alta, Muito Alta, Média para Alta
 *   Categoria do Risco      → Baixo, Médio, Alto, Muito Alto
 */
export const COLUMNS: ColumnDef[] = [
  {
    name: "Equipamento",
    type: "string",
    required: true,
    label: "Equipamento",
  },
  {
    name: "Descrição do equipamento",
    type: "string",
    required: true,
    label: "Descrição do equipamento",
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
    enumValues: [
      "baixa",
      "média",
      "alta",
      "muito alta",
      "média para alta",
    ],
    label: "Categoria da Severidade",
  },
  {
    name: "Categoria do Risco",
    type: "enum",
    required: true,
    enumValues: [
      "baixo",
      "médio",
      "alto",
      "muito alto",
    ],
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

// ─── Normalização de Chaves para Python ───────────────────

/**
 * Mapeia os nomes originais das colunas em português (como aparecem na planilha)
 * para chaves snake_case sem acentos, compatíveis com o backend Python.
 */
export const COLUMN_NORMALIZE_MAP: Record<string, string> = {
  "Equipamento": "equipamento",
  "Descrição do equipamento": "descricao_equipamento",
  "Riscos": "riscos",
  "Perigo": "perigo",
  "Causas Possíveis": "causas",
  "Consequências": "consequencias",
  "Categoria da Severidade": "categoria_severidade",
  "Categoria do Risco": "categoria_risco",
  "Medidas Preventivas Existentes": "medidas_existentes",
  "Medidas Preventivas a Implementar": "medidas_implementar",
  "Observações": "observacoes",
};

/**
 * Normaliza um row da planilha: converte chaves em português para snake_case.
 * Chaves não mapeadas são mantidas como estão.
 */
export function normalizeRow(row: Record<string, string>): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) {
    const normalizedKey = COLUMN_NORMALIZE_MAP[key] || key;
    normalized[normalizedKey] = value;
  }
  return normalized;
}

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

// ─── Extração de Metadados ────────────────────────────────

/**
 * Extrai metadados (Projeto, Data, Revisão) das linhas antes do cabeçalho.
 *
 * Formato esperado:
 *   ;;Projeto:;Bunge SFS ;;;;;;;
 *   ;;Data:;11/11/2025;;;;;;;
 *   ;;Revisão:;000;;;;;;;
 */
export function extractMetadata(
  rows: string[][],
  headerIdx: number,
): SpreadsheetMetadata {
  const metadata: SpreadsheetMetadata = {};

  for (let i = 0; i < headerIdx; i++) {
    const row = rows[i];
    // Busca um padrão "Label:" em qualquer célula, e pega o valor da célula seguinte
    for (let j = 0; j < row.length - 1; j++) {
      const cell = row[j]?.trim().toLowerCase() ?? "";
      const nextValue = row[j + 1]?.trim() ?? "";
      if (!nextValue) continue;

      if (cell === "projeto:" || cell === "projeto") {
        metadata.projeto = nextValue;
      } else if (cell === "data:" || cell === "data") {
        metadata.data = nextValue;
      } else if (
        cell === "revisão:" ||
        cell === "revisão" ||
        cell === "revisao:" ||
        cell === "revisao"
      ) {
        metadata.revisao = nextValue;
      }
    }
  }

  return metadata;
}

// ─── Motor de Validação ───────────────────────────────────

/**
 * Localiza a linha de cabeçalho no array de linhas parseadas.
 * Retorna o índice ou -1 se não encontrado.
 *
 * A detecção é feita verificando se TODAS as colunas obrigatórias
 * estão presentes (case-insensitive, trim).
 */
export function findHeaderRowIndex(rows: string[][]): number {
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
 * Verifica se uma linha é "vazia" — todas as células em branco ou whitespace.
 */
function isEmptyRow(row: string[]): boolean {
  return row.every((cell) => cell.trim() === "");
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
      metadata: {},
    };
  }

  // 2. Extrair metadados do topo
  const metadata = extractMetadata(rawRows, headerIdx);

  const headerRow = rawRows[headerIdx];
  const colMap = buildColumnIndexMap(headerRow);

  // 3. Verificar colunas obrigatórias presentes
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
    return { valid: false, errors, rows: [], rowCount: 0, metadata };
  }

  // 4. Extrair linhas de dados (após cabeçalho), filtrar vazias
  const dataRows = rawRows.slice(headerIdx + 1);
  const nonEmptyRows = dataRows.filter((row) => !isEmptyRow(row));

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
      metadata,
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
      metadata,
    };
  }

  // 5. Validar cada linha
  const normalizedRows: Record<string, string>[] = [];

  for (let i = 0; i < nonEmptyRows.length; i++) {
    const row = nonEmptyRows[i];
    const rowNumber = headerIdx + 2 + i; // 1-based para o usuário
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

      // 5b. Validação de enum (case-insensitive)
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

      // 5c. Validação de number (aceita vírgula decimal brasileira)
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
    metadata,
  };
}
