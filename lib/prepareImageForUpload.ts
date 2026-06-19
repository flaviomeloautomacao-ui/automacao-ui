"use client";

/**
 * prepareImageForUpload — pré-processamento de imagens no NAVEGADOR antes do
 * upload, para contornar dois tetos do nosso stack:
 *
 *   1. Vercel — corpo da requisição serverless limitado a ~4,5 MB.
 *   2. Cloudinary (plano Free) — máx. 10 MB por imagem.
 *
 * Em vez de subir o original (fotos de celular/câmera passam fácil de 15 MB),
 * convertemos e comprimimos no cliente:
 *
 *   - HEIC/HEIF (iPhone) → JPEG via `heic2any` (browsers não decodificam HEIC
 *     no <canvas> nativamente, por isso a lib é necessária).
 *   - Redimensiona para no máx. `maxDimension` px no maior lado e reencoda
 *     em JPEG com qualidade controlada, garantindo arquivo pequeno.
 *
 * O resultado entra folgado nos dois tetos e mantém o bucket enxuto.
 *
 * Uso (somente client components):
 *   const ready = await prepareImageForUpload(file);
 *   formData.append("file", ready);
 */

const HEIC_EXT_RE = /\.(heic|heif)$/i;
const HEIC_MIME_RE = /^image\/hei(c|f)/i;

export interface PrepareImageOptions {
  /** Maior dimensão (px) permitida; acima disso a imagem é reduzida. */
  maxDimension?: number;
  /** Qualidade JPEG inicial (0–1). */
  quality?: number;
  /** Teto de bytes do resultado; se exceder, reduz qualidade/dimensão. */
  maxBytes?: number;
}

const DEFAULTS: Required<PrepareImageOptions> = {
  maxDimension: 2500,
  // Margem segura abaixo do limite de body da Vercel (~4,5 MB).
  maxBytes: 4 * 1024 * 1024,
  quality: 0.82,
};

export function isHeic(file: File): boolean {
  return HEIC_EXT_RE.test(file.name) || HEIC_MIME_RE.test(file.type);
}

/**
 * Converte/comprime uma imagem para um `File` pronto para upload.
 * Lança erro com mensagem amigável (pt-BR) se não conseguir processar.
 */
export async function prepareImageForUpload(
  file: File,
  options: PrepareImageOptions = {},
): Promise<File> {
  const opts = { ...DEFAULTS, ...options };

  let working = file;

  // 1. HEIC/HEIF → JPEG
  if (isHeic(file)) {
    working = await convertHeicToJpeg(file);
  }

  // 2. Redimensiona + recomprime via canvas.
  try {
    const processed = await resizeAndCompress(working, opts);
    if (processed) working = processed;
  } catch {
    // Se o canvas não conseguir decodificar (formato exótico), mantém o
    // arquivo atual. O limite do servidor ainda funciona como rede de
    // segurança; o erro vira mensagem do backend, se for o caso.
  }

  return working;
}

async function convertHeicToJpeg(file: File): Promise<File> {
  let heic2any: typeof import("heic2any").default;
  try {
    heic2any = (await import("heic2any")).default;
  } catch {
    throw new Error(
      "Não foi possível carregar o conversor de HEIC. Recarregue a página e tente novamente.",
    );
  }

  let result: Blob | Blob[];
  try {
    result = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
  } catch {
    throw new Error(
      `Falha ao converter "${file.name}" (HEIC). Exporte a foto como JPEG e tente novamente.`,
    );
  }

  const blob = Array.isArray(result) ? result[0] : result;
  const name = file.name.replace(HEIC_EXT_RE, ".jpg");
  return new File([blob], name, { type: "image/jpeg" });
}

async function resizeAndCompress(
  file: File,
  opts: Required<PrepareImageOptions>,
): Promise<File | null> {
  const bitmap = await createImageBitmap(file);
  try {
    const { width, height } = bitmap;
    const longest = Math.max(width, height);

    // Já pequena o bastante e dentro do teto de bytes → não reencoda
    // (evita perda de qualidade desnecessária).
    if (longest <= opts.maxDimension && file.size <= opts.maxBytes) {
      return null;
    }

    let scale = Math.min(1, opts.maxDimension / longest);
    let quality = opts.quality;

    // Até 4 tentativas: reduz qualidade e, por fim, dimensão até caber.
    for (let attempt = 0; attempt < 4; attempt++) {
      const blob = await drawToBlob(bitmap, width, height, scale, quality);
      if (!blob) return null;
      if (blob.size <= opts.maxBytes || attempt === 3) {
        const name = renameToJpeg(file.name);
        return new File([blob], name, { type: "image/jpeg" });
      }
      // Próxima tentativa: baixa qualidade e encolhe um pouco mais.
      quality = Math.max(0.5, quality - 0.15);
      scale *= 0.8;
    }
    return null;
  } finally {
    bitmap.close?.();
  }
}

async function drawToBlob(
  bitmap: ImageBitmap,
  width: number,
  height: number,
  scale: number,
  quality: number,
): Promise<Blob | null> {
  const targetW = Math.max(1, Math.round(width * scale));
  const targetH = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Fundo branco: fotos de relatório não usam transparência, e JPEG não
  // suporta canal alfa (transparência viraria preto sem isso).
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, targetW, targetH);
  ctx.drawImage(bitmap, 0, 0, targetW, targetH);

  return new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality),
  );
}

function renameToJpeg(name: string): string {
  return name.replace(/\.[^.]+$/, "") + ".jpg";
}
