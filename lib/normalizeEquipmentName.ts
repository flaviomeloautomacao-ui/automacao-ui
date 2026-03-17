/**
 * normalizeEquipmentName
 *
 * Normaliza o nome de um equipamento para fazer match com nomes de arquivos de imagem.
 * Regras (Seção 10 do spec):
 *  1. remover espaços
 *  2. remover acentos
 *  3. remover parênteses
 *  4. remover caracteres especiais
 *  5. converter para lowercase
 *
 * Exemplo: "Moega 1720 (rodoviária)" → "moega1720rodoviaria"
 */
export function normalizeEquipmentName(name: string): string {
  return name
    // NFD decompõe acentos; remove combining diacritical marks
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    // remove parênteses
    .replace(/[()]/g, "")
    // remove tudo que não seja letra ou número
    .replace(/[^a-zA-Z0-9]/g, "")
    // lowercase
    .toLowerCase();
}

/**
 * Dado um nome de arquivo de imagem e o código do contrato,
 * extrai o nome normalizado do equipamento.
 *
 * Padrão esperado: <codigocontrato><nomeequipamentonormalizado>.<extensão>
 * Exemplo: "4103754226moega1720rodoviaria.jpg" → "moega1720rodoviaria"
 */
export function extractEquipmentNameFromFilename(
  filename: string,
  contrato: string,
): string | null {
  // Remove extensão
  const withoutExt = filename.replace(/\.[^.]+$/, "");
  // Normaliza o nome do arquivo (remove acentos, chars especiais)
  const normalized = normalizeEquipmentName(withoutExt);
  // Normaliza o contrato
  const normalizedContrato = normalizeEquipmentName(contrato);

  if (!normalizedContrato) return normalized || null;

  // Se começa com o código do contrato, remove-o
  if (normalized.startsWith(normalizedContrato)) {
    const equipName = normalized.slice(normalizedContrato.length);
    return equipName || null;
  }

  // Se não tem o contrato no nome, retorna o nome inteiro
  return normalized || null;
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
  /** Se foi vinculado automaticamente */
  matched: boolean;
}

/**
 * Tenta vincular uma lista de arquivos de imagem aos equipamentos
 * usando normalização de nomes.
 */
export function matchImagesToEquipments(
  files: File[],
  equipments: Array<{ id: string; equipmentName: string }>,
  contrato: string,
): ImageMatchResult[] {
  // Pre-compute normalized equipment names
  const eqMap = equipments.map((eq) => ({
    ...eq,
    normalized: normalizeEquipmentName(eq.equipmentName),
  }));

  return files.map((file) => {
    const extractedName = extractEquipmentNameFromFilename(file.name, contrato);

    if (!extractedName) {
      return {
        filename: file.name,
        file,
        equipmentId: null,
        equipmentName: null,
        matched: false,
      };
    }

    // Find matching equipment
    const match = eqMap.find((eq) => eq.normalized === extractedName);

    return {
      filename: file.name,
      file,
      equipmentId: match?.id ?? null,
      equipmentName: match?.equipmentName ?? null,
      matched: !!match,
    };
  });
}
