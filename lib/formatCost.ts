/**
 * Utilitário para formatação de custos LLM.
 *
 * Fornece formatações consistentes para exibição de valores
 * monetários (USD), tokens e duração em toda a aplicação.
 */

/**
 * Formata um valor em USD para exibição.
 * Exemplo: 0.001234 → "$0.0012"
 */
export function formatCostUsd(value: number | null | undefined): string {
  if (value == null || value === 0) return "$0.00";
  if (value < 0.01) {
    return `$${value.toFixed(4)}`;
  }
  return `$${value.toFixed(2)}`;
}

/**
 * Formata quantidade de tokens para exibição legível.
 * Exemplo: 15432 → "15.4K"
 */
export function formatTokens(value: number | null | undefined): string {
  if (value == null || value === 0) return "0";
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toLocaleString("pt-BR");
}

/**
 * Formata duração em ms para exibição legível.
 * Exemplo: 3200 → "3.2s"
 */
export function formatDuration(ms: number | null | undefined): string {
  if (ms == null || ms === 0) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
