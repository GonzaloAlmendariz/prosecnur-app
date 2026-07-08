// =============================================================================
// inspector/NameField.tsx — input para `name` con borrador y confirmación
// =============================================================================
// XLSForm exige que `name` cumpla `^[a-zA-Z_][a-zA-Z0-9_]*$` (sin espacios,
// sin diacríticos, sin empezar con número). Este componente:
//   - Edita sobre un BORRADOR local: escribir no toca el workbook.
//   - Aplica el cambio solo con confirmación explícita (botón "Aplicar" o
//     Enter); Esc o el botón de descartar lo revierten.
//   - Pinta de ámbar el borde si el borrador no es válido y sugiere cómo
//     arreglarlo (ej. "no puede empezar con número").
//
// La confirmación explícita existe porque aplicar un rename propaga las
// referencias `${old}` → `${new}` en todo el survey (ver updateSurveyField
// en XlsformEditorPage): hacerlo por tecleo generaba una cascada de renames
// intermedios y un toast por carácter.
// =============================================================================

import { useEffect, useState } from "react";
import { AlertCircle, Check, Undo2 } from "lucide-react";

const NAME_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export type NameFieldProps = {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  /** Si true, el input está deshabilitado (ej. cuando es una sección root). */
  disabled?: boolean;
};

export function NameField({ value, onChange, placeholder, disabled }: NameFieldProps) {
  const committed = value ?? "";
  const [draft, setDraft] = useState(committed);

  // Si el valor aplicado cambia desde fuera (selección de otra fila, asistente
  // de nombres, undo), el borrador se realinea. Mientras se tipea, `value` no
  // cambia porque ya no aplicamos por tecla.
  useEffect(() => {
    setDraft(committed);
  }, [committed]);

  const trimmed = draft.trim();
  const isEmpty = !trimmed;
  const isValid = isEmpty || NAME_REGEX.test(trimmed);
  const dirty = trimmed !== committed.trim();
  const canApply = dirty && !isEmpty && isValid;
  const reason = !isValid ? diagnoseNameProblem(trimmed) : null;

  function apply() {
    if (canApply) onChange(trimmed);
  }

  function revert() {
    setDraft(committed);
  }

  return (
    <div className="pulso-xfi-namefield">
      <div className="pulso-xfi-namefield-row">
        <input
          type="text"
          className={`pulso-xfi-mono${isValid ? "" : " is-invalid"}`}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              apply();
            } else if (event.key === "Escape" && dirty) {
              event.preventDefault();
              event.stopPropagation();
              revert();
            }
          }}
          placeholder={placeholder ?? "ej. p1_edad"}
          disabled={disabled}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
        />
        {dirty && (
          <div className="pulso-xfi-namefield-actions">
            <button
              type="button"
              className="pulso-xfi-namefield-apply"
              onClick={apply}
              disabled={!canApply}
              title="Aplicar el nuevo nombre y actualizar sus referencias (Enter)"
            >
              <Check size={12} /> Aplicar
            </button>
            <button
              type="button"
              className="pulso-xfi-namefield-revert"
              onClick={revert}
              title="Descartar el cambio (Esc)"
              aria-label="Descartar el cambio de nombre"
            >
              <Undo2 size={12} />
            </button>
          </div>
        )}
      </div>
      {dirty && canApply && committed.trim() && (
        <span className="pulso-xfi-namefield-pending">
          Al aplicar, las reglas que usan{" "}
          <code>{"${" + committed.trim() + "}"}</code> pasan a{" "}
          <code>{"${" + trimmed + "}"}</code>.
        </span>
      )}
      {!isValid && reason && (
        <span className="pulso-xfi-namefield-warn">
          <AlertCircle size={12} /> {reason}
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
