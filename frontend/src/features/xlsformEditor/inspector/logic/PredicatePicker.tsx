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
  const [side, setSide] = useState<"down" | "up">("down");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const currentKey = predicateKey(value);
  const current = options.find((p) => predicateKey(p) === currentKey) ?? value;
  const choosePredicate = (next: PredicateKind) => {
    onChange(next);
    setOpen(false);
  };
  const toggleOpen = () => {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect && containerRef.current) {
      const bounds = verticalClipBounds(containerRef.current);
      const estimatedHeight = Math.min(292, options.length * 32 + 16);
      const spaceBelow = bounds.bottom - rect.bottom;
      const spaceAbove = rect.top - bounds.top;
      setSide(spaceBelow < estimatedHeight && spaceAbove > spaceBelow ? "up" : "down");
    }
    setOpen(true);
  };

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
        onClick={toggleOpen}
        disabled={disabled}
        aria-label="Criterio de la condición"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{current.label}</span>
        <ChevronDown size={12} aria-hidden="true" />
      </button>

      {open && (
        <div className={`pulso-logic-predicate-pop is-${side}`} role="listbox">
          {options.map((p) => {
            const key = predicateKey(p);
            const active = key === currentKey;
            return (
              <button
                key={key}
                type="button"
                className={`pulso-logic-predicate-option${active ? " is-active" : ""}`}
                onMouseDown={(event) => {
                  event.preventDefault();
                  choosePredicate(p);
                }}
                onClick={() => {
                  choosePredicate(p);
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

function verticalClipBounds(element: HTMLElement): { top: number; bottom: number } {
  let top = 0;
  let bottom = window.innerHeight;
  let parent = element.parentElement;
  while (parent && parent !== document.body) {
    const style = window.getComputedStyle(parent);
    const overflow = `${style.overflow} ${style.overflowY}`;
    if (/(auto|scroll|hidden|clip)/.test(overflow)) {
      const rect = parent.getBoundingClientRect();
      top = Math.max(top, rect.top);
      bottom = Math.min(bottom, rect.bottom);
    }
    parent = parent.parentElement;
  }
  return { top, bottom };
}
