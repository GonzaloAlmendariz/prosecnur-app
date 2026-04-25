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
type Combiner = "and" | "or";

export type ConnectionConditionPickerProps = {
  source: GraphNode;
  target: GraphNode;
  /** Posición de pantalla del cursor al soltar — anclaje del popover. */
  screenX: number;
  screenY: number;
  /** Catálogo del source si es select_one/multiple — para dropdown. */
  sourceCatalog?: CatalogContext;
  /** Si el target ya tiene un `relevant`, se pasa aquí — el picker
   *  añade un paso 2 que pregunta cómo combinar (Y / O). Si está
   *  vacío, no se muestra ese paso (la nueva expresión va directa). */
  existingExpression?: string;
  /** Llamado con la expresión final ODK (ej. `${X} = '70'`) y, si
   *  hay `existingExpression`, el combiner elegido. */
  onConfirm: (expression: string, combiner?: Combiner) => void;
  onCancel: () => void;
};

export function ConnectionConditionPicker({
  source,
  target,
  screenX,
  screenY,
  sourceCatalog,
  existingExpression,
  onConfirm,
  onCancel,
}: ConnectionConditionPickerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [op, setOp] = useState<Operator>("exists");
  const [value, setValue] = useState("");
  // Step 1: pick condition. Step 2 (solo si hay existing): pick
  // combiner Y/O. Si no hay existing, confirmamos directo.
  const [step, setStep] = useState<1 | 2>(1);
  const [combiner, setCombiner] = useState<Combiner>("or");
  const hasExisting = !!existingExpression && existingExpression.trim() !== "";

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

  const buildExpression = (): string => {
    const safeValue = value.replace(/'/g, "\\'");
    switch (op) {
      case "exists":
        return `\${${source.name}} != ''`;
      case "missing":
        return `\${${source.name}} = ''`;
      case "equals":
        return `\${${source.name}} = '${safeValue}'`;
      case "not_equals":
        return `\${${source.name}} != '${safeValue}'`;
    }
  };

  const handleConfirm = () => {
    if (!canConfirm) return;
    const expression = buildExpression();
    // Si hay condición existente, pasamos al paso 2 (Y/O) la primera
    // vez. Confirmar de nuevo en step 2 dispara onConfirm con combiner.
    if (hasExisting && step === 1) {
      setStep(2);
      return;
    }
    onConfirm(expression, hasExisting ? combiner : undefined);
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

      {step === 1 && (
        <>
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
        </>
      )}

      {/* Step 2: combiner Y/O. Solo aparece si target ya tenía relevant.
          Muestra la condición existente humanizada y pregunta si la
          nueva debe sumarse con Y (ambas requeridas) o con O (cualquiera). */}
      {step === 2 && (
        <>
          <p className="pulso-graph-condpicker-prompt">
            <code>{target.name}</code> ya depende de otra condición. ¿Cómo
            las combinamos?
          </p>
          <div className="pulso-graph-condpicker-existing">
            <span>Condición actual</span>
            <code>{humanize(existingExpression!)}</code>
          </div>
          <div className="pulso-graph-condpicker-existing">
            <span>Nueva condición</span>
            <code>{humanize(buildExpression())}</code>
          </div>
          <div className="pulso-graph-condpicker-options">
            <label
              className={`pulso-graph-condpicker-option ${combiner === "and" ? "is-on" : ""}`}
            >
              <input
                type="radio"
                name="cond-combiner"
                checked={combiner === "and"}
                onChange={() => setCombiner("and")}
              />
              <span>
                <strong>Y</strong> — deben cumplirse <em>las dos</em>{" "}
                condiciones (más estricto)
              </span>
            </label>
            <label
              className={`pulso-graph-condpicker-option ${combiner === "or" ? "is-on" : ""}`}
            >
              <input
                type="radio"
                name="cond-combiner"
                checked={combiner === "or"}
                onChange={() => setCombiner("or")}
              />
              <span>
                <strong>O</strong> — basta que se cumpla{" "}
                <em>cualquiera</em> (más permisivo)
              </span>
            </label>
          </div>
        </>
      )}

      <footer className="pulso-graph-condpicker-actions">
        {step === 2 ? (
          <button type="button" onClick={() => setStep(1)}>
            ← Atrás
          </button>
        ) : (
          <button type="button" onClick={onCancel}>
            Cancelar
          </button>
        )}
        <button
          type="button"
          className="pulso-primary"
          onClick={handleConfirm}
          disabled={!canConfirm}
        >
          <Check size={12} />{" "}
          {step === 2
            ? "Confirmar combinación"
            : hasExisting
              ? "Siguiente →"
              : "Crear conexión"}
        </button>
      </footer>
    </div>
  );
}

// Humanización mínima local — sustituye `${X}` por X y reemplaza
// algunos operadores básicos para que la preview en el step 2 sea
// legible sin importar la lógica completa del LogicCanvas.
function humanize(expr: string): string {
  return expr
    .replace(/\$\{([^}]+)\}/g, "$1")
    .replace(/\s*!=\s*''/g, " tiene valor")
    .replace(/\s*=\s*''/g, " está vacío")
    .replace(/\s+!=\s+/g, " ≠ ")
    .replace(/\s+\band\b\s+/g, " y ")
    .replace(/\s+\bor\b\s+/g, " o ");
}
