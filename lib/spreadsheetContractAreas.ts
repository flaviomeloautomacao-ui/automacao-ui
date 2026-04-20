/**
 * Contrato da Planilha de Classificação de Áreas (IEC 60079-10-1/10-2)
 *
 * Define colunas, tipos esperados e validações para a planilha de
 * classificação de áreas com atmosferas explosivas.
 *
 * A planilha usa formato .xlsx com cabeçalho multi-row (linhas 1-5)
 * e dados a partir da linha 6. Diferente da planilha DHA (CSV),
 * esta é processada via openpyxl no backend Python.
 *
 * ─── Layout do cabeçalho ──────────────────────────────────────────
 *
 * Row 1: A1="TABELA ANEXO A" | C1=título
 * Row 2: A2="EQUIPAMENTO DE PROCESSO" | D2="Substância Combustível"
 *         F2="Dados de Processo" | I2="Grau de Ventilação"
 *         L2="Fonte de Liberação"
 *         N2="Grupo e Classe de Temperatura (Grupo-T)"
 *         O2="Limite da Zona Distância Horizontal/Vertical (m)"
 * Row 3: Sub-headers de Dados de Processo
 * Row 5: Nomes finais das colunas (A-U)
 * Row 6+: Dados
 *
 * ─── Colunas (21 = A até U) ──────────────────────────────────────
 *
 * A  = Identificação (tag do equipamento)
 * B  = Descrição do equipamento
 * C  = Locação (área/setor da planta)
 * D  = Substância Combustível (merged D:E)
 * E  = (merged com D — ignorar)
 * F  = Temperatura de processo (°C)
 * G  = Pressão de processo (kPa)
 * H  = Volume do equipamento (m³)
 * I  = Tipo de ventilação
 * J  = Grau de ventilação
 * K  = Disponibilidade da ventilação
 * L  = Fonte de liberação — descrição
 * M  = Fonte de liberação — grau
 * N  = Grupo e Classe de Temperatura (campo composto)
 * O  = Zona 0 — extensão
 * P  = Zona 1 (m)
 * Q  = Zona 2 (m)
 * R  = Zona 2 adicional (m) — texto livre
 * S  = Zona 20 — extensão
 * T  = Zona 21 (m)
 * U  = Zona 22 (m)
 */

// ─── Tipos ────────────────────────────────────────────────

export type ColumnType = "string" | "number" | "enum";

export interface AreaColumnDef {
  /** Nome do cabeçalho (comparado case-insensitive, trimmed) */
  name: string;
  /** Letra da coluna no Excel (A-U) */
  excelColumn: string;
  /** Índice 0-based da coluna */
  index: number;
  /** Tipo esperado do dado */
  type: ColumnType;
  /** A coluna é obrigatória (não pode estar vazia)? */
  required: boolean;
  /** Valores válidos quando type === 'enum' */
  enumValues?: string[];
  /** Descrição legível para mensagens de erro */
  label?: string;
  /** Se a coluna é parte de um merge (ex: E merged com D) */
  merged?: boolean;
}

export interface AreaRowValidationError {
  row: number;
  column: string;
  message: string;
}

export interface AreaValidationResult {
  valid: boolean;
  errors: AreaRowValidationError[];
  warnings: AreaRowValidationError[];
  rowCount: number;
}

// ─── Colunas Esperadas ────────────────────────────────────

export const AREA_COLUMNS: AreaColumnDef[] = [
  {
    name: "Identificação",
    excelColumn: "A",
    index: 0,
    type: "string",
    required: true,
    label: "Tag/Código do equipamento",
  },
  {
    name: "Descrição",
    excelColumn: "B",
    index: 1,
    type: "string",
    required: true,
    label: "Descrição do equipamento",
  },
  {
    name: "Locação",
    excelColumn: "C",
    index: 2,
    type: "string",
    required: false,
    label: "Área/setor da planta",
  },
  {
    name: "Substância Combustível",
    excelColumn: "D",
    index: 3,
    type: "string",
    required: true,
    label: "Substância combustível presente",
  },
  {
    name: "Substância Combustível (merged)",
    excelColumn: "E",
    index: 4,
    type: "string",
    required: false,
    label: "Coluna merged com D — ignorar",
    merged: true,
  },
  {
    name: "Temperatura (°C)",
    excelColumn: "F",
    index: 5,
    type: "number",
    required: false,
    label: "Temperatura de processo em °C",
  },
  {
    name: "Pressão (kPa)",
    excelColumn: "G",
    index: 6,
    type: "string",
    required: false,
    label: "Pressão de processo em kPa",
  },
  {
    name: "Volume (m³)",
    excelColumn: "H",
    index: 7,
    type: "string",
    required: false,
    label: "Volume do equipamento em m³",
  },
  {
    name: "Tipo",
    excelColumn: "I",
    index: 8,
    type: "enum",
    required: true,
    enumValues: ["natural", "forçada", "forcada", "mista"],
    label: "Tipo de ventilação",
  },
  {
    name: "Grau",
    excelColumn: "J",
    index: 9,
    type: "enum",
    required: true,
    enumValues: [
      "baixo", "baixa",
      "medio", "média", "media", "médio",
      "alto", "alta",
    ],
    label: "Grau de ventilação",
  },
  {
    name: "Disponibilidade",
    excelColumn: "K",
    index: 10,
    type: "enum",
    required: true,
    enumValues: ["pobre", "satisfatoria", "satisfatória", "boa"],
    label: "Disponibilidade da ventilação",
  },
  {
    name: "Descrição",
    excelColumn: "L",
    index: 11,
    type: "enum",
    required: true,
    enumValues: [
      "interno", "escotilha", "flanges", "selo",
      "respiro", "pvrv", "operação", "operacao",
    ],
    label: "Fonte de liberação — descrição",
  },
  {
    name: "Grau",
    excelColumn: "M",
    index: 12,
    type: "enum",
    required: true,
    enumValues: [
      "continua", "contínua",
      "primaria", "primária",
      "secundaria", "secundária", "secundario",
    ],
    label: "Fonte de liberação — grau",
  },
  {
    name: "Grupo e Classe de Temperatura",
    excelColumn: "N",
    index: 13,
    type: "string",
    required: false,
    label: "Grupo e Classe de Temperatura (ex: T 2 (II A))",
  },
  {
    name: "Zona 0",
    excelColumn: "O",
    index: 14,
    type: "string",
    required: false,
    label: "Zona 0 — extensão ou NA/interno",
  },
  {
    name: "Zona 1(m)",
    excelColumn: "P",
    index: 15,
    type: "string",
    required: false,
    label: "Zona 1 — extensão em metros",
  },
  {
    name: "Zona 2(m)",
    excelColumn: "Q",
    index: 16,
    type: "string",
    required: false,
    label: "Zona 2 — extensão em metros",
  },
  {
    name: "Zona 2 adicional(m)",
    excelColumn: "R",
    index: 17,
    type: "string",
    required: false,
    label: "Zona 2 adicional — texto livre/extensão",
  },
  {
    name: "Zona 20",
    excelColumn: "S",
    index: 18,
    type: "string",
    required: false,
    label: "Zona 20 — extensão ou NA/Interno",
  },
  {
    name: "Zona 21(m)",
    excelColumn: "T",
    index: 19,
    type: "string",
    required: false,
    label: "Zona 21 — extensão em metros",
  },
  {
    name: "Zona 22(m)",
    excelColumn: "U",
    index: 20,
    type: "string",
    required: false,
    label: "Zona 22 — extensão em metros",
  },
];

// ─── Normalização de Chaves para Python ───────────────────

/**
 * Mapeia letra da coluna Excel → chave snake_case usada no backend Python.
 * Compatível com COLUMN_INDEX_MAP em area_context_builder.py.
 */
export const AREA_COLUMN_NORMALIZE_MAP: Record<string, string> = {
  "Identificação": "identificacao",
  "Descrição": "descricao",
  "Locação": "locacao",
  "Substância Combustível": "substancia",
  "Temperatura (°C)": "temperatura_celsius",
  "Pressão (kPa)": "pressao_kpa",
  "Volume (m³)": "volume_m3",
  "Tipo": "ventilacao_tipo",
  "Grau": "ventilacao_grau",       // col J (ventilação)
  "Disponibilidade": "ventilacao_disponibilidade",
  // "Descrição": "fonte_liberacao_descricao", // col L — conflito de nome com col B
  // "Grau": "fonte_liberacao_grau",           // col M — conflito de nome com col J
  "Grupo e Classe de Temperatura": "grupo_classe_temp_raw",
  "Zona 0": "zona_0",
  "Zona 1(m)": "zona_1_m",
  "Zona 2(m)": "zona_2_m",
  "Zona 2 adicional(m)": "zona_2_adicional",
  "Zona 20": "zona_20",
  "Zona 21(m)": "zona_21_m",
  "Zona 22(m)": "zona_22_m",
};

/**
 * Mapeamento posicional (index 0-based) → chave Python.
 * Usado para resolver conflitos de nomes duplicados entre colunas.
 *
 *   Col B (index 1) = "descricao" (equipamento)
 *   Col J (index 9) = "ventilacao_grau"
 *   Col L (index 11) = "fonte_liberacao_descricao"
 *   Col M (index 12) = "fonte_liberacao_grau"
 */
export const AREA_COLUMN_INDEX_TO_KEY: Record<number, string> = {
  0: "identificacao",
  1: "descricao",
  2: "locacao",
  3: "substancia",
  // 4: merged — ignorar
  5: "temperatura_celsius",
  6: "pressao_kpa",
  7: "volume_m3",
  8: "ventilacao_tipo",
  9: "ventilacao_grau",
  10: "ventilacao_disponibilidade",
  11: "fonte_liberacao_descricao",
  12: "fonte_liberacao_grau",
  13: "grupo_classe_temp_raw",
  14: "zona_0",
  15: "zona_1_m",
  16: "zona_2_m",
  17: "zona_2_adicional",
  18: "zona_20",
  19: "zona_21_m",
  20: "zona_22_m",
};

/** Nomes das colunas obrigatórias (lowercase + trimmed) */
export const AREA_REQUIRED_COLUMN_NAMES = AREA_COLUMNS
  .filter((c) => c.required && !c.merged)
  .map((c) => c.name.toLowerCase().trim());

/** Número de colunas de dados (excluindo merged col E) */
export const AREA_DATA_COLUMN_COUNT = 20;

/** Número total de colunas na planilha (A-U = 21) */
export const AREA_TOTAL_COLUMNS = 21;

/** Linha onde começam os dados (1-based) */
export const AREA_DATA_START_ROW = 6;

/** Número máximo de linhas de dados (segurança) */
export const AREA_MAX_ROWS = 2_000;

// ─── Validação Básica ─────────────────────────────────────

/**
 * Valida uma linha de dados contra o contrato de colunas.
 * Usado pelo frontend para validação rápida antes do envio ao backend.
 *
 * @param row Objeto com valores indexados por chave Python (via AREA_COLUMN_INDEX_TO_KEY)
 * @param rowNumber Número da linha na planilha (para mensagens de erro)
 */
export function validateAreaRow(
  row: Record<string, string>,
  rowNumber: number,
): AreaRowValidationError[] {
  const errors: AreaRowValidationError[] = [];

  for (const col of AREA_COLUMNS) {
    if (col.merged) continue;

    const key = AREA_COLUMN_INDEX_TO_KEY[col.index];
    if (!key) continue;

    const value = (row[key] ?? "").trim();

    // Verificação de obrigatório
    if (col.required && !value) {
      errors.push({
        row: rowNumber,
        column: col.label ?? col.name,
        message: `Campo obrigatório "${col.label ?? col.name}" está vazio`,
      });
      continue;
    }

    // Verificação de enum (caso-insensitivo)
    if (col.type === "enum" && value && col.enumValues) {
      const normalized = value.toLowerCase().trim();
      if (!col.enumValues.includes(normalized)) {
        errors.push({
          row: rowNumber,
          column: col.label ?? col.name,
          message: `Valor "${value}" inválido para "${col.label ?? col.name}". Valores aceitos: ${col.enumValues.join(", ")}`,
        });
      }
    }

    // Verificação de número
    if (col.type === "number" && value) {
      const num = parseFloat(value.replace(",", "."));
      if (isNaN(num)) {
        errors.push({
          row: rowNumber,
          column: col.label ?? col.name,
          message: `Valor "${value}" não é um número válido para "${col.label ?? col.name}"`,
        });
      }
    }
  }

  return errors;
}
