// =============================================================================
// inspector/logic/PredicatePicker.tsx — selector de operador según tipo
// =============================================================================
// Dropdown compacto que ofrece los predicados válidos para el tipo de la
// variable seleccionada. Al cambiar de variable, el caller pasa otra lista
// de predicados (vía `predicatesForType`); este componente solo renderiza
// la opción actual y deja que el usuario cambie.
// =============================================================================

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
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
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const currentKey = predicateKey(value);
  const current = options.find((p) => predicateKey(p) === currentKey) ?? value;

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const t = setTimeout(() => {
      document.addEventListener("mousedown", onMouseDown);
      document.addEventListener("keydown", onKey);
    }, 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="pulso-logic-predicate-picker">
      <button
        type="button"
        className="pulso-logic-predicate-trigger"
        onClick={() => setOpen((next) => !next)}
        disabled={disabled}
        aria-label="Criterio de la condición"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{current.label}</span>
        <ChevronDown size={12} aria-hidden="true" />
      </button>

      {open && (
        <div className="pulso-logic-predicate-pop" role="listbox">
          {options.map((p) => {
            const key = predicateKey(p);
            const active = key === currentKey;
            return (
              <button
                key={key}
                type="button"
                className={`pulso-logic-predicate-option${active ? " is-active" : ""}`}
                onClick={() => {
                  onChange(p);
                  setOpen(false);
                }}
                role="option"
                aria-selected={active}
              >
                <span>{p.label}</span>
                {active && <Check size={12} aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
