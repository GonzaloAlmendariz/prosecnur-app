// =============================================================================
// inspector/NameField.tsx — input para `name` con validación regex en vivo
// =============================================================================
// XLSForm exige que `name` cumpla `^[a-zA-Z_][a-zA-Z0-9_]*$` (sin espacios,
// sin diacríticos, sin empezar con número). Este componente:
//   - Muestra un input controlado normal.
//   - Pinta de ámbar el borde si el valor no es válido.
//   - Sugiere debajo cómo arreglarlo (ej. "no puede empezar con número").
//   - Permite igualmente que el usuario escriba — la validación es advertencia,
//     no bloqueo. El export final lo bloqueará el endpoint /validate (Sub-PR 9).
// =============================================================================

import { AlertCircle } from "lucide-react";

const NAME_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export type NameFieldProps = {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  /** Si true, el input está deshabilitado (ej. cuando es una sección root). */
  disabled?: boolean;
};

export function NameField({ value, onChange, placeholder, disabled }: NameFieldProps) {
  const trimmed = (value ?? "").trim();
  const isEmpty = !trimmed;
  const isValid = isEmpty || NAME_REGEX.test(trimmed);
  const reason = !isValid ? diagnoseNameProblem(trimmed) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder ?? "ej. p1_edad"}
        disabled={disabled}
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        style={{
          fontFamily: "ui-monospace, monospace",
          fontSize: 13,
          ...(isValid
            ? {}
            : {
                borderColor: "var(--pulso-warn-fg)",
                background: "var(--pulso-warn-bg)",
              }),
        }}
      />
      {!isValid && reason && (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11,
            color: "var(--pulso-warn-fg)",
          }}
        >
          <AlertCircle size={12} /> {reason}
        </span>
      )}
      {isValid && !isEmpty && (
        <span
          style={{
            fontSize: 11,
            color: "var(--pulso-text-soft)",
          }}
        >
          Identificador interno · se usa en lógica y exports.
        </span>
      )}
    </div>
  );
}

function diagnoseNameProblem(value: string): string {
  if (/^\d/.test(value)) return "No puede empezar con número. Usa una letra o guion bajo.";
  if (/\s/.test(value)) return "No puede contener espacios. Usa guion bajo (ej. p1_edad).";
  if (/[^a-zA-Z0-9_]/.test(value)) {
    return "Solo letras (sin tilde), números y guion bajo.";
  }
  return "Formato inválido. Usa solo letras, números y guion bajo.";
}
