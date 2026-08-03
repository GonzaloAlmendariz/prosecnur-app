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
  const currentMeta = predicateMeta(current);
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
      const estimatedHeight = Math.min(360, options.length * 50 + 18);
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
        title={currentMeta.hint}
      >
        {/* El trigger muestra SOLO la etiqueta del criterio. La explicación
            vive en el popover: compartir el ancho entre etiqueta y pista
            dejaba a las dos truncadas —"no incl…" sobre "La opci…"— en los
            53 px que le tocan a la columna. */}
        <span className="pulso-logic-predicate-current">
          <span className="pulso-logic-predicate-mark" aria-hidden="true">
            {currentMeta.mark}
          </span>
          <span className="pulso-logic-predicate-copy">
            <strong>{current.label}</strong>
          </span>
        </span>
        <ChevronDown size={12} aria-hidden="true" />
      </button>

      {open && (
        <div className={`pulso-logic-predicate-pop is-${side}`} role="listbox">
          {options.map((p) => {
            const key = predicateKey(p);
            const active = key === currentKey;
            const meta = predicateMeta(p);
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
                <span className="pulso-logic-predicate-option-main">
                  <span className="pulso-logic-predicate-mark" aria-hidden="true">
                    {meta.mark}
                  </span>
                  <span className="pulso-logic-predicate-option-copy">
                    <span>{p.label}</span>
                    <small>{meta.hint}</small>
                  </span>
                </span>
                {active && (
                  <span className="pulso-logic-predicate-check" aria-hidden="true">
                    <Check size={12} />
                  </span>
                )}
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

function predicateMeta(predicate: PredicateKind): { mark: string; hint: string } {
  if (predicate.kind === "selected") {
    return { mark: "sel", hint: "La opción está marcada." };
  }
  if (predicate.kind === "not_selected") {
    return { mark: "no", hint: "La opción no está marcada." };
  }
  if (predicate.kind === "presence") {
    return predicate.mode === "answered"
      ? { mark: "ok", hint: "Hay cualquier respuesta." }
      : { mark: "vacio", hint: "No se respondió todavía." };
  }

  switch (predicate.op) {
    case "=":
      return { mark: "=", hint: "Coincide con un valor exacto." };
    case "!=":
      return { mark: "!=", hint: "Acepta cualquier valor diferente." };
    case ">":
      return { mark: ">", hint: "El valor debe ser mayor." };
    case ">=":
      return { mark: ">=", hint: "Mayor o exactamente igual." };
    case "<":
      return { mark: "<", hint: "El valor debe ser menor." };
    case "<=":
      return { mark: "<=", hint: "Menor o exactamente igual." };
    default:
      return { mark: "=", hint: "Compara con el valor indicado." };
  }
}
