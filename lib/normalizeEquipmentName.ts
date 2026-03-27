/**
 * Equipment Image Naming — Geração, Validação e Matching
 *
 * Formato obrigatório: NomeEquipamentoContrato_ContratoId-Index
 *
 * Regras:
 *  - NomeEquipamentoContrato: PascalCase, sem espaços/hífens/caracteres especiais.
 *    Pode conter números (ex: SiloBaiaNorte2).
 *  - ContratoId: identificador do contrato, após o separador `_`
 *  - Index: obrigatório, começa em 0, incremental, separado por `-`
 *
 * Exemplos válidos:
 *  - MoegaFerroviaria1720_123412341234-0
 *  - SiloBaiaNorte2_12341234-0
 *
 * Exemplos inválidos:
 *  - moegaferroviaria1720_123412341234-0  (não é PascalCase)
 *  - MoegaFerroviaria1720_123412341234    (sem índice)
 *  - MoegaRodoviaria-1720_12341234-2     (caractere inválido no nome)
 */

// ─── Regex central de validação ────────────────────────────

/**
 * Regex que valida o padrão completo do nome de imagem de equipamento.
 *
 * Estrutura: `^[A-Z][a-zA-Z0-9]*_[a-zA-Z0-9]+-\d+$`
 *  - `^[A-Z]`          → Começa com letra maiúscula (garante PascalCase)
 *  - `[a-zA-Z0-9]*`    → Restante do nome: letras e números (sem espaços/hífens/especiais)
 *  - `_`                → Separador fixo entre nome e contrato
 *  - `[a-zA-Z0-9]+`    → ContratoId (alfanumérico, não vazio)
 *  - `-`                → Separador fixo entre contrato e índice
 *  - `\d+$`             → Índice numérico (0, 1, 2, ...)
 */
export const EQUIPMENT_IMAGE_NAME_REGEX = /^[A-Z][a-zA-Z0-9]*_[a-zA-Z0-9]+-\d+$/;

// ─── Tipos ─────────────────────────────────────────────────

export interface ImageNameValidationError {
  code:
    | "EMPTY_NAME"
    | "MISSING_UNDERSCORE"
    | "MISSING_INDEX"
    | "INVALID_INDEX"
    | "NOT_PASCAL_CASE"
    | "INVALID_CHARACTERS"
    | "EMPTY_CONTRATO"
    | "EMPTY_EQUIPMENT_NAME"
    | "REGEX_MISMATCH";
  message: string;
}

export interface ImageNameValidationResult {
  valid: boolean;
  errors: ImageNameValidationError[];
  /** Partes parseadas (disponíveis mesmo se inválido, quando possível) */
  parsed?: {
    equipmentName: string;
    contratoId: string;
    index: number;
  };
}

export interface ImageMatchResult {
  /** Nome original do arquivo */
  filename: string;
  /** File object */
  file: File;
  /** Equipment ID se houve match, null caso contrário */
  equipmentId: string | null;
  /** Nome do equipamento matchado */
  equipmentName: string | null;
  /** Índice extraído do nome do arquivo */
  imageIndex: number | null;
  /** Se foi vinculado automaticamente */
  matched: boolean;
  /** Erros de validação do nome (se houver) */
  validationErrors: ImageNameValidationError[];
}

// ─── Normalização legada (para compatibilidade) ────────────

/**
 * Normaliza o nome de um equipamento para lowercase sem acentos/especiais.
 * Mantida para backward-compatibility com arquivos antigos.
 *
 * @deprecated Usar `toPascalCase` para novos nomes.
 */
export function normalizeEquipmentName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[()]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

// ─── Conversão para PascalCase ─────────────────────────────

/**
 * Converte um nome de equipamento para PascalCase sem espaços/hífens/especiais.
 * Remove acentos, parênteses e caracteres não alfanuméricos.
 * Cada "palavra" (separada por espaço, hífen ou underscore) começa com maiúscula.
 *
 * Exemplos:
 *  - "Moega 1720 (rodoviária)" → "MoegaRodoviaria1720"
 *    Nota: números no final das palavras são preservados na posição original
 *  - "silo baía norte 2" → "SiloBaiaNorte2"
 *  - "MOEGA FERROVIARIA 1720" → "MoegaFerroviaria1720"
 */
export function toPascalCase(name: string): string {
  return (
    name
      // Decompõe acentos e remove combining marks
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      // Remove parênteses
      .replace(/[()]/g, "")
      // Divide em "palavras" por espaços, hífens, underscores ou transição letra→número→letra
      .split(/[\s\-_]+/)
      .filter((w) => w.length > 0)
      .map((word) => {
        // Remove qualquer caractere que não seja letra ou número
        const clean = word.replace(/[^a-zA-Z0-9]/g, "");
        if (clean.length === 0) return "";
        // Primeira letra maiúscula, resto minúsculo
        return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
      })
      .join("")
  );
}

// ─── Sanitização de ContratoId ─────────────────────────────

/**
 * Sanitiza o ID do contrato removendo caracteres não alfanuméricos.
 */
export function sanitizeContratoId(contrato: string): string {
  return contrato.replace(/[^a-zA-Z0-9]/g, "");
}

// ─── Geração de nome válido ────────────────────────────────

/**
 * Gera um nome de imagem válido no formato:
 * `NomeEquipamentoContrato_ContratoId-Index`
 *
 * @param equipmentName - Nome original do equipamento (ex: "Moega 1720 (rodoviária)")
 * @param contratoId    - Identificador do contrato (ex: "123412341234")
 * @param index         - Índice da imagem para este equipamento (0, 1, 2, ...)
 * @returns Nome de imagem formatado (sem extensão)
 *
 * @example
 * generateImageName("Moega Ferroviária 1720", "123412341234", 0)
 * // → "MoegaFerroviaria1720_123412341234-0"
 *
 * generateImageName("Silo Baía Norte 2", "12341234", 0)
 * // → "SiloBaiaNorte2_12341234-0"
 */
export function generateImageName(
  equipmentName: string,
  contratoId: string,
  index: number,
): string {
  const pascal = toPascalCase(equipmentName);
  const sanitizedContrato = sanitizeContratoId(contratoId);
  const safeIndex = Math.max(0, Math.floor(index));
  return `${pascal}_${sanitizedContrato}-${safeIndex}`;
}

/**
 * Gera nome completo do arquivo incluindo extensão.
 *
 * @param equipmentName - Nome original do equipamento
 * @param contratoId    - Identificador do contrato
 * @param index         - Índice da imagem
 * @param extension     - Extensão do arquivo (ex: "jpg", "png"). Sem o ponto.
 */
export function generateImageFileName(
  equipmentName: string,
  contratoId: string,
  index: number,
  extension: string,
): string {
  const name = generateImageName(equipmentName, contratoId, index);
  const ext = extension.replace(/^\./, "").toLowerCase();
  return `${name}.${ext}`;
}

// ─── Validação robusta ─────────────────────────────────────

/**
 * Valida um nome de imagem contra o padrão obrigatório.
 * Retorna erros específicos e descritivos para cada regra violada.
 *
 * @param imageName - Nome da imagem SEM extensão
 *
 * @example
 * validateImageName("MoegaFerroviaria1720_123412341234-0")
 * // → { valid: true, errors: [], parsed: { ... } }
 *
 * validateImageName("moegaferroviaria1720_123412341234-0")
 * // → { valid: false, errors: [{ code: "NOT_PASCAL_CASE", ... }] }
 */
export function validateImageName(imageName: string): ImageNameValidationResult {
  const errors: ImageNameValidationError[] = [];

  if (!imageName || imageName.trim().length === 0) {
    return {
      valid: false,
      errors: [{ code: "EMPTY_NAME", message: "Nome da imagem é obrigatório." }],
    };
  }

  const trimmed = imageName.trim();

  // Verificar separador underscore
  const underscoreIdx = trimmed.indexOf("_");
  if (underscoreIdx === -1) {
    errors.push({
      code: "MISSING_UNDERSCORE",
      message: `Nome deve conter '_' separando o nome do equipamento e o contrato. Padrão: NomeEquipamento_ContratoId-Index`,
    });
    return { valid: false, errors };
  }

  const equipmentPart = trimmed.slice(0, underscoreIdx);
  const rest = trimmed.slice(underscoreIdx + 1);

  // Verificar parte do equipamento
  if (equipmentPart.length === 0) {
    errors.push({
      code: "EMPTY_EQUIPMENT_NAME",
      message: "Nome do equipamento (antes de '_') não pode estar vazio.",
    });
  }

  // Verificar separador de índice
  const lastDashIdx = rest.lastIndexOf("-");
  if (lastDashIdx === -1) {
    errors.push({
      code: "MISSING_INDEX",
      message: `Nome deve conter índice após '-'. Padrão: NomeEquipamento_ContratoId-Index (ex: -0, -1)`,
    });
    return { valid: false, errors };
  }

  const contratoPart = rest.slice(0, lastDashIdx);
  const indexPart = rest.slice(lastDashIdx + 1);

  // Validar contrato
  if (contratoPart.length === 0) {
    errors.push({
      code: "EMPTY_CONTRATO",
      message: "ContratoId (entre '_' e '-') não pode estar vazio.",
    });
  }

  // Validar índice
  let parsedIndex = -1;
  if (indexPart.length === 0 || !/^\d+$/.test(indexPart)) {
    errors.push({
      code: "INVALID_INDEX",
      message: `Índice '${indexPart}' deve ser um número inteiro >= 0.`,
    });
  } else {
    parsedIndex = parseInt(indexPart, 10);
  }

  // Validar PascalCase no nome do equipamento
  if (equipmentPart.length > 0) {
    if (!/^[A-Z]/.test(equipmentPart)) {
      errors.push({
        code: "NOT_PASCAL_CASE",
        message: `Nome do equipamento '${equipmentPart}' deve começar com letra maiúscula (PascalCase).`,
      });
    }
    if (/[^a-zA-Z0-9]/.test(equipmentPart)) {
      errors.push({
        code: "INVALID_CHARACTERS",
        message: `Nome do equipamento '${equipmentPart}' contém caracteres inválidos. Use apenas letras e números (sem espaços, hífens ou especiais).`,
      });
    }
  }

  // Validar caracteres no contrato
  if (contratoPart.length > 0 && /[^a-zA-Z0-9]/.test(contratoPart)) {
    errors.push({
      code: "INVALID_CHARACTERS",
      message: `ContratoId '${contratoPart}' contém caracteres inválidos. Use apenas letras e números.`,
    });
  }

  // Verificação final com regex
  if (errors.length === 0 && !EQUIPMENT_IMAGE_NAME_REGEX.test(trimmed)) {
    errors.push({
      code: "REGEX_MISMATCH",
      message: `Nome '${trimmed}' não corresponde ao padrão obrigatório: NomeEquipamento_ContratoId-Index`,
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    parsed:
      equipmentPart.length > 0 && contratoPart.length > 0 && parsedIndex >= 0
        ? {
            equipmentName: equipmentPart,
            contratoId: contratoPart,
            index: parsedIndex,
          }
        : undefined,
  };
}

/**
 * Valida um nome de arquivo completo (com extensão).
 * Remove a extensão antes de validar.
 */
export function validateImageFileName(filename: string): ImageNameValidationResult {
  const withoutExt = filename.replace(/\.[^.]+$/, "");
  return validateImageName(withoutExt);
}

// ─── Parsing de nome de arquivo ────────────────────────────

interface ParsedImageFileName {
  equipmentName: string;
  contratoId: string;
  index: number;
  extension: string;
}

/**
 * Parseia um nome de arquivo de imagem no novo formato.
 * Retorna null se o nome não segue o padrão.
 *
 * @example
 * parseImageFileName("MoegaFerroviaria1720_123412341234-0.jpg")
 * // → { equipmentName: "MoegaFerroviaria1720", contratoId: "123412341234", index: 0, extension: "jpg" }
 */
export function parseImageFileName(filename: string): ParsedImageFileName | null {
  const extMatch = filename.match(/\.([^.]+)$/);
  const extension = extMatch ? extMatch[1].toLowerCase() : "";
  const withoutExt = filename.replace(/\.[^.]+$/, "");

  const validation = validateImageName(withoutExt);
  if (!validation.valid || !validation.parsed) return null;

  return {
    equipmentName: validation.parsed.equipmentName,
    contratoId: validation.parsed.contratoId,
    index: validation.parsed.index,
    extension,
  };
}

// ─── Extração legada (compatibilidade) ─────────────────────

/**
 * Extrai o nome normalizado antigo a partir de um arquivo no formato legado.
 * Padrão legado: `<codigocontrato><nomeequipamentonormalizado>.<extensão>`
 *
 * @deprecated Usar `parseImageFileName` para o novo formato.
 */
export function extractEquipmentNameFromFilename(
  filename: string,
  contrato: string,
): string | null {
  const withoutExt = filename.replace(/\.[^.]+$/, "");
  const normalized = normalizeEquipmentName(withoutExt);
  const normalizedContrato = normalizeEquipmentName(contrato);

  if (!normalizedContrato) return normalized || null;

  if (normalized.startsWith(normalizedContrato)) {
    const equipName = normalized.slice(normalizedContrato.length);
    return equipName || null;
  }

  return normalized || null;
}

// ─── Cálculo do próximo índice ─────────────────────────────

/**
 * Calcula o próximo índice disponível para imagens de um equipamento.
 * Analisa os public_ids ou nomes existentes para determinar o maior índice+1.
 *
 * @param existingImageNames - Lista de nomes de imagem já existentes (sem extensão ou public_ids)
 * @returns Próximo índice disponível
 *
 * @example
 * getNextImageIndex(["MoegaFerroviaria1720_1234-0", "MoegaFerroviaria1720_1234-1"])
 * // → 2
 *
 * getNextImageIndex([])
 * // → 0
 */
export function getNextImageIndex(existingImageNames: string[]): number {
  let maxIndex = -1;

  for (const name of existingImageNames) {
    // Tenta parsear no novo formato
    const baseName = name.replace(/\.[^.]+$/, ""); // remove extensão se houver
    const match = baseName.match(/-(\d+)$/);
    if (match) {
      const idx = parseInt(match[1], 10);
      if (idx > maxIndex) maxIndex = idx;
    }
  }

  return maxIndex + 1;
}

// ─── Matching de imagens com equipamentos (novo formato) ───

/**
 * Tenta vincular uma lista de arquivos de imagem aos equipamentos.
 *
 * Estratégia dual:
 * 1. Primeiro tenta parsear no NOVO formato (PascalCase_Contrato-Index)
 * 2. Se falhar, tenta fallback no formato LEGADO (contrato+nomenormalizado)
 *
 * Isso garante backward-compatibility durante a transição.
 */
export function matchImagesToEquipments(
  files: File[],
  equipments: Array<{ id: string; equipmentName: string }>,
  contrato: string,
): ImageMatchResult[] {
  // Pre-compute para ambos os formatos
  const eqMapNew = equipments.map((eq) => ({
    ...eq,
    pascal: toPascalCase(eq.equipmentName),
  }));

  const eqMapLegacy = equipments.map((eq) => ({
    ...eq,
    normalized: normalizeEquipmentName(eq.equipmentName),
  }));

  return files.map((file) => {
    // 1. Tentar novo formato
    const parsed = parseImageFileName(file.name);
    if (parsed) {
      const match = eqMapNew.find((eq) => eq.pascal === parsed.equipmentName);
      if (match) {
        return {
          filename: file.name,
          file,
          equipmentId: match.id,
          equipmentName: match.equipmentName,
          imageIndex: parsed.index,
          matched: true,
          validationErrors: [],
        };
      }
    }

    // 2. Verificar se parece ser o novo formato mas falhou na validação
    const withoutExt = file.name.replace(/\.[^.]+$/, "");
    const newFormatValidation = validateImageName(withoutExt);
    if (withoutExt.includes("_") && !newFormatValidation.valid) {
      // Parece tentar seguir o novo formato mas está inválido
      return {
        filename: file.name,
        file,
        equipmentId: null,
        equipmentName: null,
        imageIndex: null,
        matched: false,
        validationErrors: newFormatValidation.errors,
      };
    }

    // 3. Fallback para formato legado
    const extractedName = extractEquipmentNameFromFilename(file.name, contrato);
    if (extractedName) {
      const match = eqMapLegacy.find((eq) => eq.normalized === extractedName);
      if (match) {
        return {
          filename: file.name,
          file,
          equipmentId: match.id,
          equipmentName: match.equipmentName,
          imageIndex: null, // sem índice no formato legado
          matched: true,
          validationErrors: [],
        };
      }
    }

    // 4. Sem match
    return {
      filename: file.name,
      file,
      equipmentId: null,
      equipmentName: null,
      imageIndex: null,
      matched: false,
      validationErrors: [],
    };
  });
}
