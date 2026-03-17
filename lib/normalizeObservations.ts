/**
 * Normalização das observações gerais para IA (Seção 7 do spec).
 *
 * Converte texto livre digitado pelo cliente em um "prompt simplificado"
 * que será injetado no contexto global da geração do relatório.
 *
 * Regras:
 * - Se o texto estiver vazio ou só whitespace → retorna null (NÃO chamar LLM).
 * - Caso contrário, limpa e estrutura o texto em formato de instrução.
 *
 * IMPORTANTE: Esta função NÃO usa LLM. É processamento de texto puro,
 * conforme Seção 20 do spec ("NÃO chamar LLM para observações gerais vazias").
 */

/**
 * Normaliza o texto livre das observações gerais em um prompt
 * simplificado pronto para inclusão no contexto do LLM.
 *
 * @param rawText - Texto original digitado pelo cliente
 * @returns Prompt simplificado ou null se vazio
 */
export function normalizeObservations(rawText: string | null | undefined): string | null {
  if (!rawText) return null;

  // 1. Trim e colapsar whitespace excessivo
  let text = rawText
    .trim()
    .replace(/\r\n/g, "\n")        // normaliza quebras de linha
    .replace(/\n{3,}/g, "\n\n")    // max 2 quebras consecutivas
    .replace(/[ \t]+/g, " ")       // colapsa espaços/tabs horizontais
    .replace(/ \n/g, "\n")         // remove espaço antes de \n
    .replace(/\n /g, "\n");        // remove espaço depois de \n

  // 2. Se ficou vazio após limpeza, retorna null
  if (!text) return null;

  // 3. Detectar se parece uma lista (linhas começam com - ou •  ou *)
  const lines = text.split("\n").filter((l) => l.trim());
  const listPattern = /^[\-\•\*\d+\.]\s*/;
  const isListLike = lines.length > 1 && lines.filter((l) => listPattern.test(l.trim())).length > lines.length * 0.5;

  // 4. Formatar como itens de contexto se for lista
  if (isListLike) {
    const items = lines.map((l) => l.trim().replace(listPattern, "").trim()).filter(Boolean);
    text = items.map((item) => `- ${item}`).join("\n");
  }

  // 5. Construir prompt simplificado com wrapper de instrução
  const prompt = [
    "Contexto adicional fornecido pelo cliente para consideração na geração do relatório:",
    "",
    text,
  ].join("\n");

  return prompt;
}
