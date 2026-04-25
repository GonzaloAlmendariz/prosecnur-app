// =============================================================================
// canvas-graph/ConnectionConditionPicker.tsx — popover post drag-arrow
// =============================================================================
// Cuando el usuario suelta una flecha entre dos nodos, este popover le
// pregunta qué condición exacta debe disparar la visibilidad. Antes
// escribíamos `${source} != ''` directo (cómodo pero pobre); ahora el
// usuario decide entre:
//
//   * "Tiene un valor"       → ${X} != ''
//   * "No tiene valor"        → ${X} = ''
//   * "Es igual a..." + valor → ${X} = '<valor>'
//   * "Es distinto de..." + v → ${X} != '<valor>'
//
// Si el source es select_one o select_multiple, en lugar del input de
// texto mostramos un dropdown con sus opciones (como hace el inspector
// con el ValueInput).
//
// Animación: el popover entra con `pulso-stagger-in` (140ms ease) y se
// posiciona en (screenX, screenY) del drop. Click fuera o Esc cierra.
// =============================================================================

import { useEffect, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import type { CatalogContext, GraphNode } from "./buildGraph";

type Operator = "exists" | "missing" | "equals" | "not_equals";

export type ConnectionConditionPickerProps = {
  source: GraphNode;
  target: GraphNode;
  /** Posición de pantalla del cursor al soltar — anclaje del popover. */
  screenX: number;
  screenY: number;
  /** Catálogo del source si es select_one/multiple — para dropdown. */
  sourceCatalog?: CatalogContext;
  /** Llamado con la expresión final ODK (ej. `${X} = '70'`). */
  onConfirm: (expression: string) => void;
  onCancel: () => void;
};

export function ConnectionConditionPicker({
  source,
  target,
  screenX,
  screenY,
  sourceCatalog,
  onConfirm,
  onCancel,
}: ConnectionConditionPickerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [op, setOp] = useState<Operator>("exists");
  const [value, setValue] = useState("");

  // Click fuera + Escape cierran.
  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) onCancel();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
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
  }, [onCancel]);

  const needsValue = op === "equals" || op === "not_equals";
  const canConfirm = !needsValue || value.trim() !== "";

  const handleConfirm = () => {
    if (!canConfirm) return;
    const safeValue = value.replace(/'/g, "\\'");
    let expression: string;
    switch (op) {
      case "exists":
        expression = `\${${source.name}} != ''`;
        break;
      case "missing":
        expression = `\${${source.name}} = ''`;
        break;
      case "equals":
        expression = `\${${source.name}} = '${safeValue}'`;
        break;
      case "not_equals":
        expression = `\${${source.name}} != '${safeValue}'`;
        break;
    }
    onConfirm(expression);
  };

  return (
    <div
      ref={containerRef}
      className="pulso-graph-condpicker"
      style={{ left: screenX, top: screenY }}
      role="dialog"
      aria-label="Definir condición de la conexión"
    >
      <header>
        <div className="pulso-graph-condpicker-pair">
          <code>{source.name}</code>
          <span aria-hidden="true">→</span>
          <code>{target.name}</code>
        </div>
        <button
          type="button"
          className="pulso-graph-condpicker-close"
          onClick={onCancel}
          aria-label="Cancelar"
        >
          <X size={12} />
        </button>
      </header>

      <p className="pulso-graph-condpicker-prompt">
        ¿Cuándo debe aparecer <code>{target.name}</code>?
      </p>

      <div className="pulso-graph-condpicker-options">
        <label
          className={`pulso-graph-condpicker-option ${op === "exists" ? "is-on" : ""}`}
        >
          <input
            type="radio"
            name="cond-op"
            checked={op === "exists"}
            onChange={() => setOp("exists")}
          />
          <span>Cuando <code>{source.name}</code> tiene un valor</span>
        </label>
        <label
          className={`pulso-graph-condpicker-option ${op === "missing" ? "is-on" : ""}`}
        >
          <input
            type="radio"
            name="cond-op"
            checked={op === "missing"}
            onChange={() => setOp("missing")}
          />
          <span>Cuando <code>{source.name}</code> está vacío</span>
        </label>
        <label
          className={`pulso-graph-condpicker-option ${op === "equals" ? "is-on" : ""}`}
        >
          <input
            type="radio"
            name="cond-op"
            checked={op === "equals"}
            onChange={() => setOp("equals")}
          />
          <span>Cuando <code>{source.name}</code> es igual a…</span>
        </label>
        <label
          className={`pulso-graph-condpicker-option ${op === "not_equals" ? "is-on" : ""}`}
        >
          <input
            type="radio"
            name="cond-op"
            checked={op === "not_equals"}
            onChange={() => setOp("not_equals")}
          />
          <span>Cuando <code>{source.name}</code> es distinto de…</span>
        </label>
      </div>

      {needsValue && (
        <div className="pulso-graph-condpicker-value">
          {sourceCatalog ? (
            <select
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
            >
              <option value="">Elige una opción…</option>
              {sourceCatalog.preview.map((it) => (
                <option key={it.rowIndex} value={it.name}>
                  {it.label || it.name}
                </option>
              ))}
              {sourceCatalog.itemCount > sourceCatalog.preview.length && (
                <option disabled>
                  + {sourceCatalog.itemCount - sourceCatalog.preview.length}{" "}
                  opciones más (refina en el inspector)
                </option>
              )}
            </select>
          ) : (
            <input
              autoFocus
              type="text"
              placeholder="ej. 70"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canConfirm) handleConfirm();
              }}
              spellCheck={false}
            />
          )}
        </div>
      )}

      <footer className="pulso-graph-condpicker-actions">
        <button type="button" onClick={onCancel}>
          Cancelar
        </button>
        <button
          type="button"
          className="pulso-primary"
          onClick={handleConfirm}
          disabled={!canConfirm}
        >
          <Check size={12} /> Crear conexión
        </button>
      </footer>
    </div>
  );
}
