// =============================================================================
// choiceFilters/ChoiceFiltersView.tsx — overlay «Filtros de opciones»
// =============================================================================
// Vista hermana e independiente del Mapa de lógica (spec §4): explica, en
// lenguaje humano y de solo lectura, qué respuesta previa habilita qué opción
// posterior. Se monta como overlay a pantalla completa portaleado a body,
// igual que LogicCanvas, y se oculta con `open`.
//
// Registra `data-audit-ready` cuando las fichas terminaron de componerse, para
// que el QA visual la capture de forma estable (spec §10).
// =============================================================================

import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, SlidersHorizontal, X } from "../../../vendor/lucide-react";
import type { BuilderStructure } from "../types";
import { buildChoiceFilterModel } from "./buildChoiceFilterModel";
import { ChoiceFilterCard } from "./ChoiceFilterCard";
import "../styles/xf-choice-filters.css";

export type ChoiceFiltersViewProps = {
  open: boolean;
  onClose: () => void;
  structure: BuilderStructure | null;
  /** Columnas crudas de la hoja `choices` (incluye las `filter_*`). */
  choicesColumns: string[];
  /** Filas crudas de la hoja `choices`. */
  choicesRows: string[][];
  /** Deep-link a una pregunta en el editor (spec §8). */
  onSelectRow?: (rowIndex: number) => void;
  title?: string;
  backLabel?: string;
};

export function ChoiceFiltersView({
  open,
  onClose,
  structure,
  choicesColumns,
  choicesRows,
  onSelectRow,
  title = "Filtros de opciones",
  backLabel = "Volver al editor",
}: ChoiceFiltersViewProps) {
  // El modelo puede ser caro en formularios grandes; solo se calcula cuando el
  // overlay está abierto (mismo patrón que LogicCanvas con su grafo).
  const model = useMemo(() => {
    if (!open) return null;
    return buildChoiceFilterModel({ structure, choicesColumns, choicesRows });
  }, [open, structure, choicesColumns, choicesRows]);

  // Esc cierra el overlay.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const cards = model?.cards ?? [];
  const ready = model !== null;

  const jumpTo = onSelectRow
    ? (rowIndex: number) => {
        onSelectRow(rowIndex);
        onClose();
      }
    : undefined;

  const overlay = (
    <div
      className="pulso-xcf-overlay"
      role="dialog"
      aria-label="Filtros de opciones del formulario"
      data-audit-ready={ready ? "true" : undefined}
    >
      <header className="pulso-xcf-header">
        <div className="pulso-xcf-header-left">
          <button type="button" className="pulso-xcf-back" onClick={onClose}>
            <ChevronLeft size={14} /> {backLabel}
          </button>
          <div className="pulso-xcf-header-title">
            <strong>{title}</strong>
            <span>
              {cards.length}{" "}
              {cards.length === 1 ? "pregunta condiciona sus opciones" : "preguntas condicionan sus opciones"}
            </span>
          </div>
        </div>
        <button
          type="button"
          className="pulso-xcf-close"
          onClick={onClose}
          title="Cerrar (Esc)"
          aria-label="Cerrar"
        >
          <X size={14} />
        </button>
      </header>

      <div className="pulso-xcf-body">
        {cards.length === 0 ? (
          <div className="pulso-xcf-empty">
            <span className="pulso-xcf-empty-icon" aria-hidden="true">
              <SlidersHorizontal size={30} />
            </span>
            <strong>Este instrumento no condiciona opciones según respuestas previas.</strong>
            <p>
              Cuando una pregunta ofrezca solo algunas opciones según lo que la persona respondió
              antes, aparecerá aquí explicada en lenguaje simple.
            </p>
          </div>
        ) : (
          <div className="pulso-xcf-intro">
            <p>
              Algunas preguntas ofrecen solo las opciones que la persona habilitó con sus respuestas
              anteriores. Aquí se explica cada una sin fórmulas: qué respuesta previa habilita qué
              opción.
            </p>
          </div>
        )}

        <div className="pulso-xcf-stack">
          {cards.map((card) => (
            <ChoiceFilterCard key={card.rowIndex} card={card} onJumpToRow={jumpTo} />
          ))}
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
