/**
 * Supabase Server Client — APENAS server-side.
 *
 * Usa a SERVICE_ROLE_KEY para operações privilegiadas (ex: Storage upload).
 * NUNCA exponha este módulo ao client (nada de NEXT_PUBLIC).
 *
 * Variáveis de ambiente necessárias:
 *   SUPABASE_URL         — URL do projeto Supabase
 *   SUPABASE_SERVICE_KEY  — Service Role Key (NÃO a anon key)
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const globalForSupabase = globalThis as unknown as {
  supabaseAdmin: SupabaseClient | undefined;
};

/**
 * Retorna o client Supabase com Service Role Key (lazy init).
 * Lança erro se as env vars não estiverem definidas.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (globalForSupabase.supabaseAdmin) {
    return globalForSupabase.supabaseAdmin;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL is not defined in environment variables.");
  }
  if (!supabaseServiceKey) {
    throw new Error(
      "SUPABASE_SERVICE_KEY is not defined in environment variables.",
    );
  }

  const client = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (process.env.NODE_ENV !== "production") {
    globalForSupabase.supabaseAdmin = client;
  }

  return client;
}

/** Nome do bucket no Supabase Storage para arquivos de planilha */
export const STORAGE_BUCKET = "spreadsheets-archive";

/** Nome do bucket no Supabase Storage para relatórios PDF gerados */
export const REPORTS_BUCKET = process.env.REPORTS_BUCKET || "reports";

/**
 * Garante que o bucket de storage existe, criando-o se necessário.
 * Chamado uma vez antes do primeiro upload.
 */
let bucketEnsured = false;

export async function ensureStorageBucket(): Promise<void> {
  if (bucketEnsured) return;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage.getBucket(STORAGE_BUCKET);

  if (error && !data) {
    // Bucket não existe — criar
    const { error: createError } = await supabase.storage.createBucket(
      STORAGE_BUCKET,
      {
        public: false,
        fileSizeLimit: 20 * 1024 * 1024, // 20MB
      },
    );

    if (createError) {
      throw new Error(
        `Falha ao criar bucket "${STORAGE_BUCKET}": ${createError.message}`,
      );
    }

    console.log(`[Supabase] Bucket "${STORAGE_BUCKET}" criado com sucesso.`);
  }

  bucketEnsured = true;
}
