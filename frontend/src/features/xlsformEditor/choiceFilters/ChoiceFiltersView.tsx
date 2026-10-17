// =============================================================================
// choiceFilters/ChoiceFiltersView.tsx — pestaña «Filtros de opciones»
// =============================================================================
// Vista hermana del Mapa de lógica (spec §4): explica, en lenguaje humano, qué
// respuesta previa habilita qué opción posterior. Su propósito es GESTIONAR
// (ítem 50): a la izquierda la lista de preguntas con filtro, a la derecha el
// detalle de la elegida: su tabla «Si la persona reportó… → puede elegir». Un clic
// selecciona y muestra; nada navega. La única
// salida al Constructor es «Editar en Constructor», al pie del detalle. La
// pregunta elegida es el `foco` de la dirección.
//
// Registra `data-audit-ready` cuando las fichas terminaron de componerse, para
// que el QA visual la capture de forma estable (spec §10).
// =============================================================================

import { useMemo, useState } from "react";
import { Pencil, Plus, SlidersHorizontal } from "../../../vendor/lucide-react";
import type { XlsformEditorWorkbook } from "../../../api/multiIntegrado";
import type { BuilderStructure, CatalogSummary } from "../types";
import { EditorFiltro } from "./EditorFiltro";
import { TypeIcon } from "../kit";
import { leerExpresionCascada } from "./cascada";
import { EditarEnConstructor } from "../shell/EditarEnConstructor";
import { buildChoiceFilterModel } from "./buildChoiceFilterModel";
import { ChoiceFilterCard } from "./ChoiceFilterCard";
import { filtroElegido } from "./seleccionFiltro";
import "../styles/xf-choice-filters.css";

const ID_DETALLE = "xf-xcf-detalle";

export type ChoiceFiltersViewProps = {
  open: boolean;
  structure: BuilderStructure | null;
  /** Columnas crudas de la hoja `choices` (incluye las `filter_*`). */
  choicesColumns: string[];
  /** Filas crudas de la hoja `choices`. */
  choicesRows: string[][];
  /** `name` de la pregunta elegida (el `foco` de la dirección); sin elegir, la primera. */
  seleccionada: string | null;
  onSeleccionar: (name: string) => void;
  /** La única salida al Constructor: «Editar en Constructor» del detalle. */
  onEditar?: (rowIndex: number) => void;
  /** F2 (2026-10-16): con el workbook la pestaña crea y edita filtros en cascada, no sólo los explica. */
  workbook?: XlsformEditorWorkbook | null;
  catalogs?: CatalogSummary[];
  onWorkbookChange?: (next: XlsformEditorWorkbook) => void;
};

export function ChoiceFiltersView({
  open,
  structure,
  choicesColumns,
  choicesRows,
  seleccionada,
  onSeleccionar,
  onEditar,
  workbook = null,
  catalogs = [],
  onWorkbookChange,
}: ChoiceFiltersViewProps) {
  // null: viendo; "nuevo": filtro nuevo; número: fila de la pregunta cuyo filtro se edita.
  const [editando, setEditando] = useState<null | "nuevo" | number>(null);
  const puedeEditar = !!workbook && !!onWorkbookChange;
  // El modelo puede ser caro en formularios grandes; solo se calcula cuando la
  // pestaña está abierta (mismo patrón que LogicCanvas con su grafo).
  const model = useMemo(() => {
    if (!open) return null;
    return buildChoiceFilterModel({ structure, choicesColumns, choicesRows });
  }, [open, structure, choicesColumns, choicesRows]);

  if (!open) return null;

  const cards = model?.cards ?? [];
  const ready = model !== null;
  const actual = filtroElegido(cards, seleccionada);
  const filasConFiltro = new Set(cards.map((c) => c.rowIndex));
  const esElegible = (rowIndex: number) => filasConFiltro.has(rowIndex);
  const elegirFila = (rowIndex: number) => {
    const card = cards.find((c) => c.rowIndex === rowIndex);
    if (card) onSeleccionar(card.questionCode);
  };

  return (
    <div
      className="pulso-xcf-overlay is-embebido"
      role="region"
      aria-label="Filtros de opciones del formulario"
      data-audit-ready={ready ? "true" : "false"}
    >
      <header className="pulso-xcf-header">
        <div className="pulso-xcf-header-left">
          <div className="pulso-xcf-header-title">
            <strong>Filtros de opciones</strong>
            <span>
              {cards.length}{" "}
              {cards.length === 1 ? "pregunta condiciona sus opciones" : "preguntas condicionan sus opciones"}
            </span>
          </div>
        </div>
        {puedeEditar && editando === null ? (
          <button type="button" className="pulso-xcf-nuevo" onClick={() => setEditando("nuevo")}>
            <Plus size={14} aria-hidden="true" /> Nuevo filtro
          </button>
        ) : null}
      </header>

      <div className="pulso-xcf-body" data-qa-scroll-owner="filtros">
        {editando !== null && workbook && onWorkbookChange ? (
          <EditorFiltro
            workbook={workbook}
            structure={structure}
            catalogs={catalogs}
            filaInicial={editando === "nuevo" ? null : editando}
            onCancelar={() => setEditando(null)}
            onGuardar={(wb, hija) => { onWorkbookChange(wb); setEditando(null); onSeleccionar(hija); }}
          />
        ) : cards.length === 0 ? (
          <div className="pulso-xcf-empty">
            <span className="pulso-xcf-empty-icon" aria-hidden="true">
              <SlidersHorizontal size={30} />
            </span>
            <strong>Este instrumento no condiciona opciones según respuestas previas.</strong>
            <p>
              Cuando una pregunta ofrezca solo algunas opciones según lo que la persona respondió
              antes, aparecerá aquí explicada en lenguaje simple.
            </p>
            {puedeEditar ? (
              <button type="button" className="pulso-xcf-nuevo is-primario" onClick={() => setEditando("nuevo")}>
                <Plus size={14} aria-hidden="true" /> Crear el primer filtro
              </button>
            ) : null}
          </div>
        ) : (
          <div className="pulso-xcf-intro">
            <p>
              Algunas preguntas ofrecen solo las opciones que la persona habilitó con sus respuestas
              anteriores. Elige una para ver, sin fórmulas, qué respuesta previa habilita qué opción.
            </p>
          </div>
        )}

        {actual && editando === null && (
          <div className="pulso-xcf-gestion" data-qa-geometry-group="xlsform/filtros-gestion" data-qa-geometry-contract="intrinsic">
            <nav className="pulso-xcf-lista" aria-labelledby="xf-xcf-lista-titulo" data-qa-geometry-member="">
              <h3 id="xf-xcf-lista-titulo" className="pulso-xcf-lista-titulo">
                Preguntas con filtro <span>{cards.length}</span>
              </h3>
              <ul>
              {cards.map((card) => {
                const elegida = card.rowIndex === actual.rowIndex;
                return (
                  <li key={card.rowIndex}>
                    <button
                      type="button"
                      className={`pulso-xcf-fila pulso-xf-seleccionable${elegida ? " is-seleccionada" : ""}`}
                      aria-current={elegida ? "true" : undefined}
                      aria-controls={ID_DETALLE}
                      onClick={() => onSeleccionar(card.questionCode)}
                    >
                      <TypeIcon baseType={structure?.byRow.get(card.rowIndex)?.typeInfo.base ?? "select_one"} size={13} />
                      <code className="pulso-xcf-fila-codigo">{card.questionCode}</code>
                      <span className="pulso-xcf-fila-texto" title={card.questionLabel}>{card.questionLabel}</span>
                      <span className="pulso-xcf-fila-meta">
                        {card.antecedents.length}{" "}
                        {card.antecedents.length === 1 ? "respuesta previa" : "respuestas previas"}
                      </span>
                    </button>
                  </li>
                );
              })}
              </ul>
            </nav>
            <div id={ID_DETALLE} className="pulso-xcf-detalle" role="region" aria-label={`Filtro de ${actual.questionCode}`}
              data-qa-geometry-member="">
              <ChoiceFilterCard
                key={actual.rowIndex}
                card={actual}
                onElegirAntecedente={elegirFila}
                esElegible={esElegible}
                pie={(
                  <span className="pulso-xcf-pie">
                    {puedeEditar && leerExpresionCascada(actual.rawExpression) ? (
                      <button type="button" className="pulso-xcf-nuevo" onClick={() => setEditando(actual.rowIndex)}>
                        <Pencil size={13} aria-hidden="true" /> Editar filtro
                      </button>
                    ) : null}
                    {onEditar ? <EditarEnConstructor onEditar={() => onEditar(actual.rowIndex)} /> : null}
                  </span>
                )}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
