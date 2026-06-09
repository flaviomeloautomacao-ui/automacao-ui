export function getDatabaseErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code)
      : "";

  if (
    code === "P1001" ||
    /can't reach database server/i.test(message) ||
    /connection.*(?:refused|timed out|terminated)/i.test(message)
  ) {
    return "Nao foi possivel conectar ao banco configurado em DATABASE_URL. Revise a rede/credenciais ou use a connection string do pooler do Supabase se o host direto nao estiver acessivel neste ambiente.";
  }

  return "Falha ao consultar o banco de dados.";
}
