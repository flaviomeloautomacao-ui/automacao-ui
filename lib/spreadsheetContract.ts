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
 * Linha 6 (cabeçalho — V3, 14 colunas):
 *   Equipamento;Descrição do equipamento;Perigo;Riscos;
 *   Causas Possíveis;Consequências;
 *   Medidas Preventivas Existentes;
 *   Categoria da Severidade;Categoria da Probabilidade;
 *   Classificação do Risco;
 *   Medidas Preventivas a Implementar;
 *   Categoria da Severidade 2;Categoria da Probabilidade 2;
 *   Classificação do Risco 2
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
  /** Avisos que não impedem o processamento (ex.: inconsistências na matriz de cruzamento) */
  warnings: RowValidationError[];
  /** Linhas de dados normalizadas (sem metadados do cabeçalho) */
  rows: Record<string, string>[];
  /** Número total de linhas de dados encontradas */
  rowCount: number;
  /** Metadados extraídos do topo da planilha */
  metadata: SpreadsheetMetadata;
}

// ─── Matriz de Cruzamento Severidade × Probabilidade → Classificação do Risco ──

/**
 * Matriz de cruzamento padrão (5×4) para validação não-bloqueante.
 * Chave: "severidade|probabilidade" (lowercase). Valor: classificação esperada (lowercase).
 */
const RISK_MATRIX: Record<string, string> = {
  // Severidade Baixa
  "baixa|baixo": "baixo",
  "baixa|médio": "baixo",
  "baixa|alto": "médio",
  "baixa|muito alto": "médio",
  // Severidade Média
  "média|baixo": "baixo",
  "média|médio": "médio",
  "média|alto": "alto",
  "média|muito alto": "alto",
  // Severidade Média para Alta
  "média para alta|baixo": "médio",
  "média para alta|médio": "alto",
  "média para alta|alto": "alto",
  "média para alta|muito alto": "muito alto",
  // Severidade Alta
  "alta|baixo": "médio",
  "alta|médio": "alto",
  "alta|alto": "alto",
  "alta|muito alto": "muito alto",
  // Severidade Muito Alta
  "muito alta|baixo": "alto",
  "muito alta|médio": "alto",
  "muito alta|alto": "muito alto",
  "muito alta|muito alto": "muito alto",
};

/** Normaliza gênero (masculino/feminino) para a forma feminina (severidade) */
function _toFeminine(v: string): string {
  const map: Record<string, string> = {
    "baixo": "baixa", "baixa": "baixa",
    "médio": "média", "média": "média",
    "alto": "alta", "alta": "alta",
    "muito alto": "muito alta", "muito alta": "muito alta",
    "média para alta": "média para alta",
  };
  return map[v] ?? v;
}

/** Normaliza gênero para a forma masculina (probabilidade / classificação) */
function _toMasculine(v: string): string {
  const map: Record<string, string> = {
    "baixa": "baixo", "baixo": "baixo",
    "média": "médio", "médio": "médio",
    "alta": "alto", "alto": "alto",
    "muito alta": "muito alto", "muito alto": "muito alto",
  };
  return map[v] ?? v;
}

// ─── Colunas Esperadas ────────────────────────────────────

/**
 * Lista de colunas esperadas na planilha DHA.
 *
 * 🔧 PARA AJUSTAR: adicione/remova entradas aqui.
 * Os nomes são comparados em lowercase/trim com o cabeçalho real.
 *
 * Valores reais observados na planilha-modelo:
 *   Categoria da Severidade      → Baixa, Média, Alta, Muito Alta, Média para Alta
 *   Categoria da Probabilidade    → Baixo, Médio, Alto, Muito Alto
 *   Classificação do Risco        → Baixo, Médio, Alto, Muito Alto
 *   Categoria da Severidade 2     → (mesmos valores, pós-implementação)
 *   Categoria da Probabilidade 2  → (mesmos valores, pós-implementação)
 *   Classificação do Risco 2      → (mesmos valores, pós-implementação)
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
      "baixa", "baixo",
      "média", "médio",
      "alta", "alto",
      "muito alta", "muito alto",
      "média para alta",
    ],
    label: "Categoria da Severidade",
  },
  {
    name: "Categoria da Probabilidade",
    type: "enum",
    required: true,
    enumValues: [
      "baixo", "baixa",
      "médio", "média",
      "alto", "alta",
      "muito alto", "muito alta",
    ],
    label: "Categoria da Probabilidade",
  },
  {
    name: "Classificação do Risco",
    type: "enum",
    required: true,
    enumValues: [
      "baixo", "baixa",
      "médio", "média",
      "alto", "alta",
      "muito alto", "muito alta",
    ],
    label: "Classificação do Risco",
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
  {
    name: "Categoria da Severidade 2",
    type: "enum",
    required: false,
    enumValues: [
      "baixa", "baixo",
      "média", "médio",
      "alta", "alto",
      "muito alta", "muito alto",
      "média para alta",
    ],
    label: "Categoria da Severidade (pós-implementação)",
  },
  {
    name: "Categoria da Probabilidade 2",
    type: "enum",
    required: false,
    enumValues: [
      "baixo", "baixa",
      "médio", "média",
      "alto", "alta",
      "muito alto", "muito alta",
    ],
    label: "Categoria da Probabilidade (pós-implementação)",
  },
  {
    name: "Classificação do Risco 2",
    type: "enum",
    required: false,
    enumValues: [
      "baixo", "baixa",
      "médio", "média",
      "alto", "alta",
      "muito alto", "muito alta",
    ],
    label: "Classificação do Risco (pós-implementação)",
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
  "Categoria da Probabilidade": "categoria_probabilidade",
  "Classificação do Risco": "classificacao_risco",
  "Medidas Preventivas Existentes": "medidas_existentes",
  "Medidas Preventivas a Implementar": "medidas_implementar",
  "Observações": "observacoes",
  "Categoria da Severidade 2": "categoria_severidade_2",
  "Categoria da Probabilidade 2": "categoria_probabilidade_2",
  "Classificação do Risco 2": "classificacao_risco_2",
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
    const normalizedCells = rows[i].map((c) => _normalizeHeaderCell(c));
    const allFound = REQUIRED_COLUMN_NAMES.every((req) => {
      const target = _normalizeHeaderCell(req);
      return normalizedCells.some((cell) => cell === target);
    });
    if (allFound) return i;
  }
  return -1;
}

/**
 * Normaliza whitespace em texto de cabeçalho:
 * - Substitui NBSP (\u00a0), tabs e quebras de linha por espaço regular
 * - Colapsa múltiplos espaços em um só
 * - Trim final
 */
function _normalizeHeaderCell(text: string): string {
  return text
    .replace(/[\u00a0\t\n\r]/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

/**
 * Aliases alternativos para nomes de colunas.
 * Cobre variações encontradas em planilhas reais (V1-style names, etc.).
 */
const COLUMN_ALIASES: Record<string, string[]> = {
  "Categoria da Probabilidade": [
    "categoria do risco",         // V1 — era usado como probabilidade
  ],
  "Categoria da Probabilidade 2": [
    "categoria do risco 2",       // V1-style residual
    "categoria de probabilidade 2",
  ],
};

/**
 * Mapeia os índices de cada coluna definida no contrato.
 * Retorna um mapa coluna-nome → índice-na-linha.
 *
 * Usa normalização robusta de whitespace e fallback por aliases
 * para lidar com variações de formatação em planilhas reais.
 */
export function buildColumnIndexMap(
  headerRow: string[],
): Map<string, number> {
  const map = new Map<string, number>();
  const normalizedHeader = headerRow.map((h) => _normalizeHeaderCell(h));

  for (const col of COLUMNS) {
    const target = _normalizeHeaderCell(col.name);
    let idx = normalizedHeader.findIndex((h) => h === target);

    // Fallback: tentar aliases
    if (idx === -1 && COLUMN_ALIASES[col.name]) {
      for (const alias of COLUMN_ALIASES[col.name]) {
        idx = normalizedHeader.findIndex((h) => h === alias);
        if (idx !== -1) break;
      }
    }

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
      warnings: [],
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
    return { valid: false, errors, warnings: [], rows: [], rowCount: 0, metadata };
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
      warnings: [],
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
      warnings: [],
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

  // 6. Verificação da matriz de cruzamento (avisos não-bloqueantes)
  const warnings: RowValidationError[] = [];

  for (let i = 0; i < normalizedRows.length; i++) {
    const row = normalizedRows[i];
    const rowNumber = headerIdx + 2 + i;

    // Situação atual
    const sev = (row["Categoria da Severidade"] ?? "").toLowerCase().trim();
    const prob = (row["Categoria da Probabilidade"] ?? "").toLowerCase().trim();
    const classif = (row["Classificação do Risco"] ?? "").toLowerCase().trim();

    if (sev && prob && classif) {
      const matrixKey = `${_toFeminine(sev)}|${_toMasculine(prob)}`;
      const expected = RISK_MATRIX[matrixKey];
      if (expected && _toMasculine(classif) !== expected) {
        warnings.push({
          row: rowNumber,
          column: "Classificação do Risco",
          message: `Matriz de cruzamento: Severidade "${sev}" × Probabilidade "${prob}" deveria resultar em "${expected}", mas encontrou "${classif}".`,
        });
      }
    }

    // Situação residual (pós-implementação)
    const sev2 = (row["Categoria da Severidade 2"] ?? "").toLowerCase().trim();
    const prob2 = (row["Categoria da Probabilidade 2"] ?? "").toLowerCase().trim();
    const classif2 = (row["Classificação do Risco 2"] ?? "").toLowerCase().trim();

    if (sev2 && prob2 && classif2) {
      const matrixKey2 = `${_toFeminine(sev2)}|${_toMasculine(prob2)}`;
      const expected2 = RISK_MATRIX[matrixKey2];
      if (expected2 && _toMasculine(classif2) !== expected2) {
        warnings.push({
          row: rowNumber,
          column: "Classificação do Risco 2",
          message: `Matriz de cruzamento (pós-implementação): Severidade "${sev2}" × Probabilidade "${prob2}" deveria resultar em "${expected2}", mas encontrou "${classif2}".`,
        });
      }
    }
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
    warnings,
    rows: normalizedRows,
    rowCount: normalizedRows.length,
    metadata,
  };
}
