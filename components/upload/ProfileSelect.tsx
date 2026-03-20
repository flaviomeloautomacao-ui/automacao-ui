import { type SelectHTMLAttributes } from "react";

/** Perfis de risco disponíveis para seleção */
const PROFILES = [
  { value: "dust", label: "Poeira (Dust)" },
  { value: "gas", label: "Gás/Vapores (Gas/Vapors) — Em breve", disabled: true },
] as const;

interface ProfileSelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  /** Mostrar label acima do select */
  label?: string;
  /** Mensagem de erro de validação */
  error?: string;
}

export function ProfileSelect({
  label = "Perfil de Risco",
  error,
  id = "profile",
  ...rest
}: ProfileSelectProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
      {label && (
        <label
          htmlFor={id}
          style={{ fontSize: "0.875rem", fontWeight: 600 }}
        >
          {label}
        </label>
      )}

      <select
        id={id}
        name="profile"
        defaultValue=""
        style={{
          padding: "0.5rem 0.75rem",
          borderRadius: "0.375rem",
          border: error ? "1px solid #ef4444" : "1px solid #d1d5db",
          fontSize: "0.875rem",
          backgroundColor: "var(--background)",
          color: "var(--foreground)",
        }}
        {...rest}
      >
        <option value="" disabled>
          Selecione um perfil…
        </option>
        {PROFILES.map((p) => (
          <option
            key={p.value}
            value={p.value}
            disabled={"disabled" in p && !!p.disabled}
            style={"disabled" in p && p.disabled ? { color: "#9ca3af" } : undefined}
          >
            {p.label}
          </option>
        ))}
      </select>

      {error && (
        <span style={{ fontSize: "0.75rem", color: "#ef4444" }}>{error}</span>
      )}
    </div>
  );
}
