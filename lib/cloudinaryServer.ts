/**
 * Cloudinary Server — upload server-side (signed).
 *
 * Usa o SDK oficial `cloudinary` com `upload_stream` para uploads
 * em memória (Buffer) sem gravar arquivo em disco.
 *
 * Variáveis de ambiente necessárias:
 *   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME — Cloud name do projeto
 *   CLOUDINARY_API_KEY                — API Key
 *   CLOUDINARY_API_SECRET             — API Secret
 *
 * NUNCA exponha API_KEY / API_SECRET ao client.
 */

import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";

/* ---------- Configuração (lazy, uma única vez) ---------- */

let configured = false;

function ensureConfigured(): void {
  if (configured) return;

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName) {
    throw new Error(
      "Variável de ambiente NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME não definida.",
    );
  }
  if (!apiKey) {
    throw new Error(
      "Variável de ambiente CLOUDINARY_API_KEY não definida.",
    );
  }
  if (!apiSecret) {
    throw new Error(
      "Variável de ambiente CLOUDINARY_API_SECRET não definida.",
    );
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });

  configured = true;
}

/* ---------- Tipos ---------- */

export interface CloudinaryServerUploadResult {
  secure_url: string;
  public_id: string;
  width: number;
  height: number;
}

/* ---------- Upload ---------- */

/**
 * Faz upload de um Buffer para o Cloudinary usando `upload_stream`.
 *
 * @param buffer  - Conteúdo do arquivo em memória.
 * @param options - Opções extras (folder, public_id, etc.).
 * @returns Objeto com `secure_url`, `public_id`, `width` e `height`.
 */
export async function uploadImageServer(
  buffer: Buffer,
  options?: {
    folder?: string;
    publicId?: string;
    resourceType?: "image" | "video" | "raw" | "auto";
  },
): Promise<CloudinaryServerUploadResult> {
  ensureConfigured();

  const result = await new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: options?.resourceType ?? "image",
        folder: options?.folder,
        public_id: options?.publicId,
      },
      (error, result) => {
        if (error || !result) {
          return reject(
            error ?? new Error("Cloudinary upload_stream retornou resultado vazio."),
          );
        }
        resolve(result);
      },
    );

    stream.end(buffer);
  });

  return {
    secure_url: result.secure_url,
    public_id: result.public_id,
    width: result.width,
    height: result.height,
  };
}

/* ---------- Delete ---------- */

/**
 * Remove uma imagem do Cloudinary pelo `public_id`.
 *
 * @param publicId - O public_id retornado no upload.
 * @returns `true` se a imagem foi deletada (ou já não existia).
 */
export async function deleteImageServer(publicId: string): Promise<boolean> {
  ensureConfigured();

  const result = await cloudinary.uploader.destroy(publicId);
  // result.result === "ok" | "not found"
  return result.result === "ok" || result.result === "not found";
}
