/**
 * Helpers de data — server-only.
 *
 * Funções utilitárias para manipulação segura de datas,
 * sem dependência de libs externas (usa Date nativo).
 */

/**
 * Retorna uma nova Date com +N meses a partir de `from` (default: now).
 *
 * Trata overflow de dia (ex: 31 jan + 1 mês → 28 fev).
 * Meses são adicionados de forma segura usando setMonth.
 *
 * @param months — quantidade de meses a somar
 * @param from — data base (default: new Date())
 */
export function addMonths(months: number, from: Date = new Date()): Date {
  const result = new Date(from);
  const targetMonth = result.getMonth() + months;
  result.setMonth(targetMonth);

  // Se o dia mudou (ex: 31 → 3), significa overflow do mês.
  // Volta pro último dia do mês anterior.
  if (result.getDate() !== from.getDate()) {
    result.setDate(0); // último dia do mês anterior ao current
  }

  return result;
}

/** Duração padrão de expiração do arquivo no storage (meses) */
export const ARCHIVE_EXPIRATION_MONTHS = 6;

/**
 * Retorna a data de expiração do arquivo (agora + 6 meses).
 */
export function getArchiveExpirationDate(from?: Date): Date {
  return addMonths(ARCHIVE_EXPIRATION_MONTHS, from);
}

/**
 * Formata uma data como YYYY-MM-DD para uso em paths de storage.
 */
export function formatDatePath(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
