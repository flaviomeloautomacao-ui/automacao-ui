/**
 * Contrato oficial da planilha de Classificação de Áreas.
 *
 * Suporta dois formatos de entrada:
 *
 * 1. **Modelo oficial** (`docs/sheets_example/Tabela_de_classificacao_Rev_Final.xlsx`)
 *    — cabeçalho hierárquico em até 5 linhas, células mescladas, layout posicional
 *    de 21 colunas. Cada fonte de liberação ocupa uma linha e possui colunas
 *    separadas para Zona 0/1/2/2-adic./20/21/22; o parser explode cada fonte em
 *    uma linha normalizada por zona ativa.
 *
 * 2. **Formato flat (legado)** — cabeçalho snake_case na primeira linha
 *    (`area_local`, `substancia`, `fonte_liberacao`, …) com uma linha por
 *    combinação fonte+zona.
 *
 * O detector escolhe o formato automaticamente. Em ambos os casos, o resultado
 * normalizado segue o mesmo schema (`AREA_COLUMNS`) consumido pelos modelos
 * Prisma `AreaSpreadsheetRow` / `AreaReportSource`.
 */

export type AreaColumnType = "string";

export interface AreaColumnDef {
  name: string;
  key: string;
  required: boolean;
  label: string;
  type: AreaColumnType;
}

export interface AreaRowValidationError {
  row: number;
  column: string;
  message: string;
}

export interface AreaSpreadsheetValidationResult {
  valid: boolean;
  errors: AreaRowValidationError[];
  warnings: AreaRowValidationError[];
  rows: Record<string, string>[];
  rowCount: number;
  metadata: Record<string, string>;
}

export const AREA_COLUMNS: AreaColumnDef[] = [
  { name: "area_local", key: "area_local", required: true, label: "Área / Local", type: "string" },
  { name: "area_descricao", key: "area_descricao", required: false, label: "Descrição do Equipamento", type: "string" },
  { name: "tag_referencia", key: "tag_referencia", required: false, label: "Tag de Referência", type: "string" },
  { name: "substancia", key: "substancia", required: true, label: "Substância", type: "string" },
  { name: "fonte_liberacao", key: "fonte_liberacao", required: true, label: "Fonte de Liberação", type: "string" },
  { name: "grau_liberacao", key: "grau_liberacao", required: true, label: "Grau de Liberação", type: "string" },
  { name: "ventilacao_tipo", key: "ventilacao_tipo", required: true, label: "Tipo de Ventilação", type: "string" },
  { name: "grau_ventilacao", key: "grau_ventilacao", required: true, label: "Grau de Ventilação", type: "string" },
  { name: "disponibilidade_ventilacao", key: "disponibilidade_ventilacao", required: true, label: "Disponibilidade da Ventilação", type: "string" },
  { name: "zona", key: "zona", required: true, label: "Zona", type: "string" },
  { name: "extensao", key: "extensao", required: true, label: "Extensão", type: "string" },
  { name: "grupo", key: "grupo", required: false, label: "Grupo", type: "string" },
  { name: "classe_temperatura", key: "classe_temperatura", required: false, label: "Classe de Temperatura", type: "string" },
  { name: "epl", key: "epl", required: false, label: "EPL", type: "string" },
  { name: "observacoes", key: "observacoes", required: false, label: "Observações", type: "string" },
];

const AREA_HEADER_INDEX = new Map(
  AREA_COLUMNS.map((column) => [column.name.toLowerCase(), column]),
);

const VALID_ZONES = new Set(["0", "1", "2", "2a", "20", "21", "22"]);
const VALID_GRAUS_LIBERACAO = new Set([
  "continua",
  "contínua",
  "continuo",
  "contínuo",
  "primaria",
  "primária",
  "primario",
  "primário",
  "secundaria",
  "secundária",
  "secundario",
  "secundário",
]);

function normalizeCell(value: string | null | undefined): string {
  return (value ?? "").toString().trim();
}

function normalizeKey(value: string | null | undefined): string {
  return normalizeCell(value).toLowerCase();
}

function isEmptyRow(row: string[]): boolean {
  return row.every((cell) => normalizeCell(cell) === "");
}

function validateZone(
  value: string,
  rowNumber: number,
  errors: AreaRowValidationError[],
) {
  if (!VALID_ZONES.has(value)) {
    errors.push({
      row: rowNumber,
      column: "zona",
      message: `Zona inválida "${value}". Use: 0, 1, 2, 2a, 20, 21 ou 22.`,
    });
  }
}

function validateLiberationDegree(
  value: string,
  rowNumber: number,
  errors: AreaRowValidationError[],
) {
  if (!VALID_GRAUS_LIBERACAO.has(value.toLowerCase())) {
    errors.push({
      row: rowNumber,
      column: "grau_liberacao",
      message:
        `Grau de liberação inválido "${value}". Use Contínua, Primária ou Secundária.`,
    });
  }
}

// =====================================================================
// Detector de formato + parsers
// =====================================================================

type AreaSpreadsheetFormat = "official" | "flat";

/** Remove acentos e colapsa espaços/quebras de linha para comparação. */
function normalizeForMatch(value: string | null | undefined): string {
  return normalizeCell(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Retorna o índice da linha que contém "Identificação" + "Locação" (header oficial). */
function findOfficialHeaderRow(rawRows: string[][]): number {
  const limit = Math.min(rawRows.length, 10);
  for (let i = 0; i < limit; i += 1) {
    const cells = (rawRows[i] ?? []).map((c) => normalizeForMatch(c));
    const hasIdentificacao = cells.some((c) => c === "identificacao");
    const hasLocacao = cells.some((c) => c === "locacao");
    if (hasIdentificacao && hasLocacao) return i;
  }
  return -1;
}

/** Detecta se as primeiras linhas batem com o formato flat (snake_case). */
function isFlatFormat(rawRows: string[][]): boolean {
  const header = rawRows[0]?.map((v) => normalizeKey(v)) ?? [];
  return header.some((h) => AREA_HEADER_INDEX.has(h));
}

function detectFormat(rawRows: string[][]): AreaSpreadsheetFormat | null {
  if (findOfficialHeaderRow(rawRows) >= 0) return "official";
  if (isFlatFormat(rawRows)) return "flat";
  return null;
}

/**
 * Extrai metadados pré-header como "Projeto:", "Cliente:", "Tipo de Unidade:",
 * "Data:" e "Revisão:". Procura padrão `<label>:` em uma célula e captura a
 * próxima célula não-vazia da mesma linha.
 */
function extractAreaPreHeaderMetadata(
  rawRows: string[][],
  headerRowIndex: number,
): Record<string, string> {
  const metadata: Record<string, string> = {};
  const limit = Math.max(0, headerRowIndex);

  const labelMap: Array<{ aliases: string[]; key: string }> = [
    { aliases: ["projeto", "obra", "empreendimento"], key: "projeto" },
    { aliases: ["cliente", "razão social", "razao social"], key: "cliente" },
    {
      aliases: [
        "tipo de unidade",
        "unidade",
        "área / unidade",
        "area / unidade",
        "planta",
      ],
      key: "tipo_unidade",
    },
    { aliases: ["data", "data da avaliação", "data da avaliacao"], key: "data" },
    { aliases: ["revisão", "revisao", "rev"], key: "revisao" },
    { aliases: ["art", "art nº", "art no"], key: "art" },
    { aliases: ["contrato"], key: "contrato" },
    { aliases: ["local vistoriado", "local"], key: "local_vistoriado" },
  ];

  for (let i = 0; i < limit; i += 1) {
    const row = rawRows[i] ?? [];
    for (let j = 0; j < row.length - 1; j += 1) {
      const rawCell = normalizeCell(row[j]).replace(/[:º°]+\s*$/u, "").trim();
      if (!rawCell) continue;
      const cell = normalizeForMatch(rawCell);

      // Tenta identificar o próximo valor não-vazio na mesma linha.
      let next = "";
      for (let k = j + 1; k < row.length; k += 1) {
        const v = normalizeCell(row[k]);
        if (v) {
          next = v;
          break;
        }
      }
      if (!next) continue;

      for (const entry of labelMap) {
        if (entry.aliases.some((alias) => cell === normalizeForMatch(alias))) {
          if (!metadata[entry.key]) {
            metadata[entry.key] = next;
          }
        }
      }
    }
  }

  return metadata;
}

// ---- Parser do modelo OFICIAL ---------------------------------------

/** Mapa posicional de colunas no template oficial (índices baseados na linha "Identificação"). */
const OFFICIAL_COLUMN_INDEX = {
  tag: 0,
  descricao: 1,
  area_local: 2,
  substancia: 3,
  temperatura: 5,
  pressao: 6,
  volume: 7,
  ventilacao_tipo: 8,
  grau_ventilacao: 9,
  disponibilidade_ventilacao: 10,
  fonte_liberacao: 11,
  grau_liberacao: 12,
  grupo_classe: 13,
  zona0: 14,
  zona1: 15,
  zona2: 16,
  zona2_adicional: 17,
  zona20: 18,
  zona21: 19,
  zona22: 20,
} as const;

/** Pares (zona, índice da coluna de extensão) na ordem de aparição na planilha. */
const ZONE_EXTENSION_COLUMNS: { zona: string; index: number; label: string }[] = [
  { zona: "0", index: OFFICIAL_COLUMN_INDEX.zona0, label: "Zona 0" },
  { zona: "1", index: OFFICIAL_COLUMN_INDEX.zona1, label: "Zona 1" },
  { zona: "2", index: OFFICIAL_COLUMN_INDEX.zona2, label: "Zona 2" },
  { zona: "2a", index: OFFICIAL_COLUMN_INDEX.zona2_adicional, label: "Zona 2 (adicional)" },
  { zona: "20", index: OFFICIAL_COLUMN_INDEX.zona20, label: "Zona 20" },
  { zona: "21", index: OFFICIAL_COLUMN_INDEX.zona21, label: "Zona 21" },
  { zona: "22", index: OFFICIAL_COLUMN_INDEX.zona22, label: "Zona 22" },
];

/** Considera "vazio" valores como "", "NA", "N/A", "-". */
function isEmptyExtension(value: string): boolean {
  const v = value.trim().toUpperCase();
  return v === "" || v === "NA" || v === "N/A" || v === "-" || v === "—";
}

/** Faz o parse de "T200 (III B)" → { classe: "T200", grupo: "III B" }. */
function parseGrupoClasse(raw: string): { classe: string; grupo: string } {
  const match = raw.match(/^\s*([^()]+?)\s*\(([^)]+)\)\s*$/);
  if (match) {
    return { classe: match[1].trim(), grupo: match[2].trim() };
  }
  return { classe: raw.trim(), grupo: "" };
}

function buildOfficialObservations(parts: {
  temperatura: string;
  pressao: string;
  volume: string;
}): string {
  const segments: string[] = [];
  if (parts.temperatura) segments.push(`Temp.: ${parts.temperatura} °C`);
  if (parts.pressao) segments.push(`Pressão: ${parts.pressao} kPa`);
  if (parts.volume) segments.push(`Volume: ${parts.volume} m³`);
  return segments.join(" | ");
}

function validateOfficialSpreadsheet(
  rawRows: string[][],
  headerRowIndex: number,
): AreaSpreadsheetValidationResult {
  const errors: AreaRowValidationError[] = [];
  const warnings: AreaRowValidationError[] = [];
  const metadata: Record<string, string> = {
    modelo: "areas_v2_oficial",
    template: "Tabela_de_classificacao_Rev_Final",
    header_row: String(headerRowIndex + 1),
    ...extractAreaPreHeaderMetadata(rawRows, headerRowIndex),
  };
  const normalizedRows: Record<string, string>[] = [];

  for (let index = headerRowIndex + 1; index < rawRows.length; index += 1) {
    const rawRow = rawRows[index] ?? [];
    if (isEmptyRow(rawRow)) continue;

    const rowNumber = index + 1;
    const get = (i: number) => normalizeCell(rawRow[i]);

    const tag = get(OFFICIAL_COLUMN_INDEX.tag);
    const descricao = get(OFFICIAL_COLUMN_INDEX.descricao);
    const areaLocal = get(OFFICIAL_COLUMN_INDEX.area_local);
    const substancia = get(OFFICIAL_COLUMN_INDEX.substancia);
    const fonteLiberacao = get(OFFICIAL_COLUMN_INDEX.fonte_liberacao);
    const grauLiberacao = get(OFFICIAL_COLUMN_INDEX.grau_liberacao);
    const ventilacaoTipo = get(OFFICIAL_COLUMN_INDEX.ventilacao_tipo);
    const grauVentilacao = get(OFFICIAL_COLUMN_INDEX.grau_ventilacao);
    const disponibilidade = get(OFFICIAL_COLUMN_INDEX.disponibilidade_ventilacao);
    const grupoClasseRaw = get(OFFICIAL_COLUMN_INDEX.grupo_classe);
    const temperaturaProcesso = get(OFFICIAL_COLUMN_INDEX.temperatura);
    const pressaoProcesso = get(OFFICIAL_COLUMN_INDEX.pressao);
    const volumeProcesso = get(OFFICIAL_COLUMN_INDEX.volume);
    const observacoes = buildOfficialObservations({
      temperatura: temperaturaProcesso,
      pressao: pressaoProcesso,
      volume: volumeProcesso,
    });

    // Linha de dados deve ter ao menos área_local OU fonte_liberacao para ser considerada
    if (!areaLocal && !fonteLiberacao && !substancia) continue;

    const requiredChecks: { value: string; key: string; label: string }[] = [
      { value: areaLocal, key: "area_local", label: "Locação / Área" },
      { value: substancia, key: "substancia", label: "Substância" },
      { value: fonteLiberacao, key: "fonte_liberacao", label: "Fonte de Liberação" },
      { value: grauLiberacao, key: "grau_liberacao", label: "Grau de Liberação" },
      { value: ventilacaoTipo, key: "ventilacao_tipo", label: "Tipo de Ventilação" },
      { value: grauVentilacao, key: "grau_ventilacao", label: "Grau de Ventilação" },
      { value: disponibilidade, key: "disponibilidade_ventilacao", label: "Disponibilidade da Ventilação" },
    ];

    for (const check of requiredChecks) {
      if (!check.value) {
        errors.push({
          row: rowNumber,
          column: check.key,
          message: `Campo obrigatório "${check.label}" está vazio.`,
        });
      }
    }

    if (grauLiberacao) validateLiberationDegree(grauLiberacao, rowNumber, errors);

    const { classe, grupo } = parseGrupoClasse(grupoClasseRaw);

    // Explode em uma linha por zona ativa
    const zonesPresent = ZONE_EXTENSION_COLUMNS.filter((zc) => !isEmptyExtension(get(zc.index)));

    if (zonesPresent.length === 0) {
      warnings.push({
        row: rowNumber,
        column: "zona",
        message: "Nenhuma zona classificada (todas as colunas Zona 0-22 estão vazias ou \"NA\").",
      });
      continue;
    }

    for (const zc of zonesPresent) {
      const extensaoRaw = get(zc.index)
        .replace(/\r?\n/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      validateZone(zc.zona, rowNumber, errors);

      normalizedRows.push({
        area_local: areaLocal,
        area_descricao: descricao,
        tag_referencia: tag,
        substancia,
        fonte_liberacao: fonteLiberacao,
        grau_liberacao: grauLiberacao,
        ventilacao_tipo: ventilacaoTipo,
        grau_ventilacao: grauVentilacao,
        disponibilidade_ventilacao: disponibilidade,
        zona: zc.zona,
        extensao: extensaoRaw,
        grupo,
        classe_temperatura: classe,
        epl: "",
        temperatura_processo: temperaturaProcesso,
        pressao_processo: pressaoProcesso,
        volume_processo: volumeProcesso,
        observacoes: observacoes
          ? `${observacoes} | ${zc.label}`
          : zc.label,
      });
    }
  }

  if (normalizedRows.length === 0 && errors.length === 0) {
    errors.push({
      row: headerRowIndex + 2,
      column: "*",
      message: "Nenhuma linha de dados válida foi encontrada após o cabeçalho.",
    });
  }

  metadata.total_fontes = String(normalizedRows.length);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    rows: normalizedRows,
    rowCount: normalizedRows.length,
    metadata,
  };
}

// ---- Parser FLAT (legado) -------------------------------------------

function validateFlatSpreadsheet(
  rawRows: string[][],
): AreaSpreadsheetValidationResult {
  const errors: AreaRowValidationError[] = [];
  const warnings: AreaRowValidationError[] = [];
  const metadata: Record<string, string> = { modelo: "areas_v2_flat" };

  const header = rawRows[0]?.map((value) => normalizeKey(value)) ?? [];
  const columnIndexByKey = new Map<string, number>();

  header.forEach((headerName, index) => {
    const column = AREA_HEADER_INDEX.get(headerName);
    if (column) {
      columnIndexByKey.set(column.key, index);
    }
  });

  for (const column of AREA_COLUMNS) {
    if (column.required && !columnIndexByKey.has(column.key)) {
      errors.push({
        row: 1,
        column: column.name,
        message: `Coluna obrigatória ausente: ${column.name}`,
      });
    }
  }

  if (errors.length > 0) {
    return {
      valid: false,
      errors,
      warnings,
      rows: [],
      rowCount: 0,
      metadata,
    };
  }

  const normalizedRows: Record<string, string>[] = [];

  for (let index = 1; index < rawRows.length; index += 1) {
    const rowNumber = index + 1;
    const rawRow = rawRows[index] ?? [];

    if (isEmptyRow(rawRow)) {
      continue;
    }

    const row: Record<string, string> = {};

    for (const column of AREA_COLUMNS) {
      const columnIndex = columnIndexByKey.get(column.key);
      row[column.key] = columnIndex === undefined
        ? ""
        : normalizeCell(rawRow[columnIndex]);
    }

    for (const column of AREA_COLUMNS) {
      if (column.required && !row[column.key]) {
        errors.push({
          row: rowNumber,
          column: column.key,
          message: `Campo obrigatório "${column.label}" está vazio.`,
        });
      }
    }

    if (row.zona) {
      validateZone(row.zona, rowNumber, errors);
    }

    if (row.grau_liberacao) {
      validateLiberationDegree(row.grau_liberacao, rowNumber, errors);
    }

    normalizedRows.push(row);
  }

  if (normalizedRows.length === 0) {
    errors.push({
      row: 2,
      column: "*",
      message: "Nenhuma linha de dados válida foi encontrada.",
    });
  }

  metadata.modelo = "areas_v2";
  metadata.total_fontes = String(normalizedRows.length);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    rows: normalizedRows,
    rowCount: normalizedRows.length,
    metadata,
  };
}

// =====================================================================
// Dispatcher público
// =====================================================================

/**
 * Valida uma planilha de Classificação de Áreas em qualquer um dos formatos
 * suportados (modelo oficial com cabeçalho hierárquico ou flat snake_case).
 *
 * O modelo oficial é detectado pela presença das células "Identificação" e
 * "Locação" nas primeiras 10 linhas. Caso nenhum formato seja reconhecido,
 * a validação falha com erro descritivo apontando o cabeçalho esperado.
 */
export function validateAreaSpreadsheet(
  rawRows: string[][],
): AreaSpreadsheetValidationResult {
  if (rawRows.length < 2) {
    return {
      valid: false,
      errors: [
        {
          row: 1,
          column: "*",
          message: "A planilha deve conter cabeçalho e ao menos uma linha de dados.",
        },
      ],
      warnings: [],
      rows: [],
      rowCount: 0,
      metadata: {},
    };
  }

  const format = detectFormat(rawRows);

  if (format === "official") {
    const headerRow = findOfficialHeaderRow(rawRows);
    return validateOfficialSpreadsheet(rawRows, headerRow);
  }

  if (format === "flat") {
    return validateFlatSpreadsheet(rawRows);
  }

  return {
    valid: false,
    errors: [
      {
        row: 1,
        column: "*",
        message:
          "Formato de planilha não reconhecido. Use o template oficial " +
          "(\"Tabela de Classificação Rev Final\") com cabeçalhos " +
          "Identificação/Locação, ou um cabeçalho flat com nomes em snake_case " +
          "(area_local, substancia, fonte_liberacao, …).",
      },
    ],
    warnings: [],
    rows: [],
    rowCount: 0,
    metadata: {},
  };
}