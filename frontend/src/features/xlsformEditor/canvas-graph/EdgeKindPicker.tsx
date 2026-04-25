// =============================================================================
// canvas-graph/EdgeKindPicker.tsx — popover para declarar tipo de relación
// =============================================================================
// Cuando el usuario suelta un drag de edge sobre un nodo válido, se abre
// este popover. Ofrece las 4 relaciones que el editor sabe escribir como
// expresión ODK:
//
//   1. "Aparece si X tiene valor"          → relevant = "${X} != ''"
//   2. "Valida usando X"                   → constraint = ". = ${X}"  (placeholder)
//   3. "Se calcula con X"                  → calculation = "${X}"
//   4. "Filtra opciones según X"           → choice_filter = "..."
//
// Cada opción solo aparece cuando es semánticamente válida:
//   - "Calcula" requiere que el destino sea kind=calculate.
//   - "Filtra" requiere destino select_one/multiple.
//   - Las otras dos siempre aplican.
//
// Si la fila destino YA tiene una expresión en ese campo, el popover lo
// indica con "(reemplaza)" — no la mezclamos AND silenciosamente; es
// mejor que el usuario sepa.
// =============================================================================

import { useEffect, useRef } from "react";
import { Calculator, Filter, GitBranch, Shield, X } from "lucide-react";
import type { GraphNode } from "./buildGraph";

export type EdgeKindOption = {
  key: "relevant" | "constraint" | "calculation" | "choice_filter";
  label: string;
  hint: string;
  icon: typeof GitBranch;
  /** Si la fila destino ya tiene una expresión en este campo. */
  willReplace: boolean;
};

export type EdgeKindPickerProps = {
  /** Posición pixel donde anclar el popover (cursor del usuario al soltar). */
  x: number;
  y: number;
  source: GraphNode;
  target: GraphNode;
  /** Estado actual del destino — para marcar "(reemplaza)". */
  targetCurrent: {
    relevant: string;
    constraint: string;
    calculation: string;
    choiceFilter: string;
  };
  onPick: (option: EdgeKindOption) => void;
  onClose: () => void;
};

export function EdgeKindPicker({
  x,
  y,
  source,
  target,
  targetCurrent,
  onPick,
  onClose,
}: EdgeKindPickerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
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
  }, [onClose]);

  const isCalculate = target.kind === "question" && target.baseType === "calculate";
  const isSelect =
    target.kind === "question" &&
    (target.baseType === "select_one" || target.baseType === "select_multiple");
  const isQuestionOrSection =
    target.kind === "question" || target.kind === "section";

  const options: EdgeKindOption[] = [];
  if (isQuestionOrSection) {
    options.push({
      key: "relevant",
      label: "Aparece si tiene valor",
      hint: `${target.subtitle} se mostrará solo si ${source.subtitle} ya fue respondida.`,
      icon: GitBranch,
      willReplace: !!targetCurrent.relevant,
    });
  }
  if (target.kind === "question" && !isCalculate) {
    options.push({
      key: "constraint",
      label: "Valida usando",
      hint: `La respuesta de ${target.subtitle} se acepta solo si coincide con ${source.subtitle}.`,
      icon: Shield,
      willReplace: !!targetCurrent.constraint,
    });
  }
  if (isCalculate) {
    options.push({
      key: "calculation",
      label: "Se calcula con",
      hint: `${target.subtitle} se completará con el valor de ${source.subtitle}.`,
      icon: Calculator,
      willReplace: !!targetCurrent.calculation,
    });
  }
  if (isSelect) {
    options.push({
      key: "choice_filter",
      label: "Filtra opciones según",
      hint: `Las opciones de ${target.subtitle} se filtrarán según ${source.subtitle}.`,
      icon: Filter,
      willReplace: !!targetCurrent.choiceFilter,
    });
  }

  return (
    <div
      ref={containerRef}
      className="pulso-graph-edgepicker"
      style={{ left: x, top: y }}
      role="menu"
    >
      <header className="pulso-graph-edgepicker-header">
        <div>
          <strong>Conectar:</strong>
          <span>
            <code>${source.subtitle}</code> →{" "}
            <code>${target.subtitle}</code>
          </span>
        </div>
        <button
          type="button"
          className="pulso-graph-edgepicker-close"
          onClick={onClose}
          title="Cancelar"
          aria-label="Cancelar"
        >
          <X size={12} />
        </button>
      </header>
      {options.length === 0 ? (
        <div className="pulso-graph-edgepicker-empty">
          No hay relación válida posible entre estos nodos.
        </div>
      ) : (
        <ul className="pulso-graph-edgepicker-list">
          {options.map((option) => {
            const Icon = option.icon;
            return (
              <li key={option.key}>
                <button
                  type="button"
                  className="pulso-graph-edgepicker-item"
                  onClick={() => onPick(option)}
                >
                  <span className="pulso-graph-edgepicker-icon">
                    <Icon size={14} />
                  </span>
                  <span className="pulso-graph-edgepicker-meta">
                    <strong>
                      {option.label}
                      {option.willReplace && (
                        <em className="pulso-graph-edgepicker-replace">
                          {" "}
                          · reemplaza
                        </em>
                      )}
                    </strong>
                    <span>{option.hint}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
