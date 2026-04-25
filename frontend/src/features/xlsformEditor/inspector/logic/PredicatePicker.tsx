// =============================================================================
// inspector/logic/PredicatePicker.tsx — selector de operador según tipo
// =============================================================================
// Dropdown compacto que ofrece los predicados válidos para el tipo de la
// variable seleccionada. Al cambiar de variable, el caller pasa otra lista
// de predicados (vía `predicatesForType`); este componente solo renderiza
// la opción actual y deja que el usuario cambie.
// =============================================================================

import type { PredicateKind } from "../../logic";
import { predicateKey } from "../../logic";

export type PredicatePickerProps = {
  /** Predicados disponibles para el tipo actual. */
  options: PredicateKind[];
  /** Predicado seleccionado. */
  value: PredicateKind;
  onChange: (next: PredicateKind) => void;
  disabled?: boolean;
};

export function PredicatePicker({
  options,
  value,
  onChange,
  disabled,
}: PredicatePickerProps) {
  const currentKey = predicateKey(value);
  return (
    <select
      className="pulso-logic-predicate"
      value={currentKey}
      onChange={(event) => {
        const next = options.find((p) => predicateKey(p) === event.target.value);
        if (next) onChange(next);
      }}
      disabled={disabled}
      aria-label="Operador de la condición"
    >
      {options.map((p) => (
        <option key={predicateKey(p)} value={predicateKey(p)}>
          {p.label}
        </option>
      ))}
    </select>
  );
}
