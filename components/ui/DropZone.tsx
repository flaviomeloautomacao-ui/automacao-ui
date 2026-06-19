"use client";

/**
 * DropZone — wrapper reutilizável para inputs `<input type="file" />`
 * que adiciona suporte a drag-and-drop sem dependências externas.
 *
 * Renderiza como `<label>`, então o clique já abre o seletor nativo
 * (comportamento que os formulários do projeto já usavam). O componente
 * adiciona apenas:
 *  - handlers `onDragEnter/Over/Leave/Drop`
 *  - estado `dragActive` (aplica `activeClassName` quando o usuário
 *    está arrastando sobre a área)
 *  - filtragem por `accept` no drop (extensões `.xlsx` ou MIME `image/png`,
 *    `image/*`)
 *  - reset automático do `<input>` após cada seleção (mesmo arquivo
 *    pode ser re-selecionado)
 *
 * Mantém compatível com o uso atual: o handler recebe `File[]`
 * (sempre array, mesmo para `multiple=false`).
 */

import {
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type ReactNode,
} from "react";

interface DropZoneProps {
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  inputName?: string;
  onFiles: (files: File[]) => void;
  onRejectedFiles?: (files: File[]) => void;
  className?: string;
  activeClassName?: string;
  children: ReactNode;
}

const MIME_EXTENSION_FALLBACKS: Record<string, string[]> = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "image/gif": [".gif"],
  // HEIC/HEIF: o navegador frequentemente reporta file.type vazio, então o
  // casamento por extensão é essencial.
  "image/heic": [".heic"],
  "image/heif": [".heif"],
};

function matchesAccept(file: File, accept: string): boolean {
  const tokens = accept
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  if (tokens.length === 0) return true;
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return tokens.some((token) => {
    if (token.startsWith(".")) return name.endsWith(token);
    if (token.endsWith("/*")) {
      const prefix = token.slice(0, -1);
      return (
        type.startsWith(prefix) ||
        Object.entries(MIME_EXTENSION_FALLBACKS).some(
          ([mimeType, extensions]) =>
            mimeType.startsWith(prefix) &&
            extensions.some((extension) => name.endsWith(extension)),
        )
      );
    }
    return (
      type === token ||
      (MIME_EXTENSION_FALLBACKS[token]?.some((extension) =>
        name.endsWith(extension),
      ) ??
        false)
    );
  });
}

export function DropZone({
  accept,
  multiple = false,
  disabled = false,
  inputName,
  onFiles,
  onRejectedFiles,
  className,
  activeClassName,
  children,
}: DropZoneProps) {
  const [dragActive, setDragActive] = useState(false);
  const dragDepth = useRef(0);

  const resetDrag = () => {
    dragDepth.current = 0;
    setDragActive(false);
  };

  const emitFiles = (files: File[]) => {
    if (files.length === 0) return;

    const accepted = accept
      ? files.filter((file) => matchesAccept(file, accept))
      : files;
    const rejected = accept
      ? files.filter((file) => !matchesAccept(file, accept))
      : [];

    if (accepted.length > 0) {
      onFiles(multiple ? accepted : [accepted[0]]);
    }

    if (rejected.length > 0) {
      onRejectedFiles?.(rejected);
    }
  };

  const handleDragEnter = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    dragDepth.current += 1;
    setDragActive(true);
  };

  const handleDragOver = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = disabled ? "none" : "copy";
  };

  const handleDragLeave = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) {
      setDragActive(false);
    }
  };

  const handleDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    resetDrag();
    if (disabled) return;
    const dropped = Array.from(e.dataTransfer.files ?? []);
    emitFiles(dropped);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    emitFiles(picked);
    e.target.value = "";
  };

  const composedClassName = [className, dragActive && activeClassName]
    .filter(Boolean)
    .join(" ");

  return (
    <label
      className={composedClassName}
      aria-disabled={disabled}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {children}
      <input
        name={inputName}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        hidden
        onChange={handleChange}
      />
    </label>
  );
}
