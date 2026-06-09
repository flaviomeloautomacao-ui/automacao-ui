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

import { useState, type DragEvent, type ReactNode } from "react";

interface DropZoneProps {
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
  className?: string;
  activeClassName?: string;
  children: ReactNode;
}

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
    if (token.endsWith("/*")) return type.startsWith(token.slice(0, -1));
    return type === token;
  });
}

export function DropZone({
  accept,
  multiple = false,
  disabled = false,
  onFiles,
  className,
  activeClassName,
  children,
}: DropZoneProps) {
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (disabled) return;
    const dropped = Array.from(e.dataTransfer.files ?? []);
    if (dropped.length === 0) return;
    const accepted = accept ? dropped.filter((f) => matchesAccept(f, accept)) : dropped;
    if (accepted.length === 0) return;
    onFiles(multiple ? accepted : [accepted[0]]);
  };

  const composedClassName = [className, dragActive && activeClassName]
    .filter(Boolean)
    .join(" ");

  return (
    <label
      className={composedClassName}
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
    >
      {children}
      <input
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        hidden
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? []);
          if (picked.length === 0) return;
          onFiles(multiple ? picked : [picked[0]]);
          e.target.value = "";
        }}
      />
    </label>
  );
}
