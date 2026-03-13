/**
 * Cloudinary — upload client-side (unsigned).
 *
 * Usa o endpoint público de unsigned upload do Cloudinary.
 * Variáveis de ambiente necessárias (públicas, prefixo NEXT_PUBLIC):
 *   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME   — Cloud name do projeto
 *   NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET — Upload preset (unsigned)
 */

export interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
}

/**
 * Faz upload de uma imagem via unsigned upload preset do Cloudinary.
 *
 * @param file - Arquivo (File) a ser enviado.
 * @returns Objeto com `secure_url` e `public_id` da imagem hospedada.
 * @throws Error se variáveis de ambiente estiverem ausentes ou se o upload falhar.
 */
export async function uploadImage(
  file: File,
): Promise<CloudinaryUploadResult> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName) {
    throw new Error(
      "Variável de ambiente NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME não definida.",
    );
  }

  if (!uploadPreset) {
    throw new Error(
      "Variável de ambiente NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET não definida.",
    );
  }

  const url = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);

  const response = await fetch(url, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Cloudinary upload falhou (${response.status}): ${errorBody}`,
    );
  }

  const data = await response.json();

  return {
    secure_url: data.secure_url as string,
    public_id: data.public_id as string,
  };
}
