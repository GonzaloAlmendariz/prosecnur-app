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

import { useMemo, useState, type ReactNode } from "react";
import { Pencil, Plus, SlidersHorizontal } from "../../../vendor/lucide-react";
import type { XlsformEditorWorkbook } from "../../../api/multiIntegrado";
import type { BuilderStructure, CatalogSummary } from "../types";
import { EditorFiltro } from "./EditorFiltro";
import { EditorPorOpcion } from "./EditorPorOpcion";
import { EditorExpresionFiltro } from "./EditorExpresionFiltro";
import { leerPorOpcion } from "./porOpcion";
import { Segmented, TypeIcon } from "../kit";
import { TituloLegible, tituloPlano } from "../kit/CuerpoPanelMarca";
import { leerExpresionCascada } from "./cascada";
import { EditarEnConstructor } from "../shell/EditarEnConstructor";
import { buildChoiceFilterModel, type ChoiceFilterCard as Ficha } from "./buildChoiceFilterModel";
import { ChoiceFilterCard } from "./ChoiceFilterCard";
import { filtroElegido } from "./seleccionFiltro";
import "../styles/xf-choice-filters.css";
import "./filtros.css";

/** Qué editor abre «Editar filtro»: la cascada simple, el filtro por opción (C27) o la expresión directa (S15). */
type ModoEditor = "cascada" | "opcion" | "expresion";
const modoDe = (expr: string): ModoEditor => (leerExpresionCascada(expr) ? "cascada" : leerPorOpcion(expr) ? "opcion" : "expresion");

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
  // null: viendo; fila null: filtro nuevo; número: fila de la pregunta cuyo filtro se edita.
  const [editando, setEditando] = useState<null | { fila: number | null; modo: ModoEditor }>(null);
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
  const focoPerdido = Boolean(seleccionada && actual && actual.questionCode !== seleccionada);
  // Todo filtro tiene «Editar filtro»: cascada, por opción o, si combina condiciones, su expresión (S15: REF16 no lo tenía).
  const pie = actual ? (
    <span className="pulso-xcf-pie">
      {puedeEditar ? (
        <button type="button" className="pulso-xcf-nuevo" onClick={() => setEditando({ fila: actual.rowIndex, modo: modoDe(actual.rawExpression) })}>
          <Pencil size={13} aria-hidden="true" /> Editar filtro
        </button>
      ) : null}
      {onEditar ? <EditarEnConstructor onEditar={() => onEditar(actual.rowIndex)} /> : null}
    </span>
  ) : null;
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
              {cards.length === 1 ? "pregunta filtra sus opciones" : "preguntas filtran sus opciones"}
            </span>
          </div>
        </div>
        {puedeEditar && editando === null ? (
          <button type="button" className="pulso-xcf-nuevo" onClick={() => setEditando({ fila: null, modo: "cascada" })}>
            <Plus size={14} aria-hidden="true" /> Nuevo filtro
          </button>
        ) : null}
      </header>

      <div className="pulso-xcf-body" data-qa-scroll-owner="filtros">
        {editando !== null && workbook && onWorkbookChange ? (
          <EditorDeFiltro
            editando={editando}
            onModo={(modo) => setEditando({ fila: null, modo })}
            workbook={workbook}
            structure={structure}
            catalogs={catalogs}
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
              <button type="button" className="pulso-xcf-nuevo is-primario" onClick={() => setEditando({ fila: null, modo: "cascada" })}>
                <Plus size={14} aria-hidden="true" /> Crear el primer filtro
              </button>
            ) : null}
          </div>
        ) : (
          <div className="pulso-xcf-intro">
            <p>
              Algunas preguntas no muestran toda su lista: unas según lo que la persona respondió antes y
              otras porque usan siempre la misma parte de la lista. Elige una para ver, sin fórmulas, qué opciones ofrece.
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
                      <span className="pulso-xcf-fila-texto" title={tituloPlano(card.questionLabel)}><TituloLegible texto={card.questionLabel} /></span>
                      <span className="pulso-xcf-fila-meta">{card.meta}</span>
                    </button>
                  </li>
                );
              })}
              </ul>
            </nav>
            <div id={ID_DETALLE} className="pulso-xcf-detalle" role="region" aria-label={`Filtro de ${actual.questionCode}`} data-qa-scroll-owner="filtros-detalle"
              data-qa-geometry-member="">
              {focoPerdido ? <p className="pulso-xcf-aviso" role="status">No hay un filtro en <code>{seleccionada}</code>: se muestra el primero de la lista.</p> : null}
              {actual.clase === "fijo" || actual.clase === "rota" ? (
                <DetalleSinRespuestas card={actual} pie={pie} />
              ) : <ChoiceFilterCard
                key={actual.rowIndex}
                card={actual}
                onElegirAntecedente={elegirFila}
                esElegible={esElegible}
                pie={pie}
              />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Detalle de un filtro que no mira respuestas: un subconjunto fijo de la lista o una fila rota. No tiene «respuestas
 * previas» que listar, así que no usa la ficha de antecedentes (que diría «Depende de las respuestas a:» vacía).
 */
function DetalleSinRespuestas({ card, pie }: { card: Ficha; pie: ReactNode }) {
  return (
    <article className="pulso-xcf-card">
      <header className="pulso-xcf-card-head">
        {card.sectionLabel ? <span className="pulso-xcf-eyebrow">{card.sectionLabel}</span> : null}
        <h3 className="pulso-xcf-title">
          <span className="pulso-xcf-title-text"><TituloLegible texto={card.questionLabel} /></span>
          {card.questionCode ? <span className="pulso-xcf-code" aria-hidden="true">{card.questionCode}</span> : null}
        </h3>
        <p className="pulso-xcf-explanation">{card.explanation}</p>
        {card.aviso ? <p className="pulso-xcf-explanation" role="note">{card.aviso}</p> : null}
      </header>
      <div className="pulso-xcf-rule">
        <div className="pulso-xcf-rule-body">
          <code className="pulso-xcf-rule-code">{card.rawExpression}</code>
          <span className="pulso-xcf-rule-meta">lista de opciones: <code>{card.listName || "—"}</code></span>
        </div>
      </div>
      {pie}
    </article>
  );
}

/** El editor que toca: al crear se elige la forma (una pregunta madre o cada opción por su pregunta). */
function EditorDeFiltro({ editando, onModo, workbook, structure, catalogs, onCancelar, onGuardar }: {
  editando: { fila: number | null; modo: ModoEditor };
  onModo: (modo: ModoEditor) => void;
  workbook: XlsformEditorWorkbook;
  structure: BuilderStructure | null;
  catalogs: CatalogSummary[];
  onCancelar: () => void;
  onGuardar: (wb: XlsformEditorWorkbook, pregunta: string) => void;
}) {
  const alternar = editando.fila === null ? (
    <Segmented
      aria-label="Forma del filtro"
      size="sm"
      value={editando.modo === "opcion" ? "opcion" : "cascada"}
      onChange={(v) => onModo(v)}
      options={[
        { value: "cascada", label: "Según una pregunta anterior" },
        { value: "opcion", label: "Cada opción según su pregunta" },
      ]}
    />
  ) : null;
  if (editando.modo === "opcion") {
    return <EditorPorOpcion workbook={workbook} structure={structure} catalogs={catalogs} filaInicial={editando.fila} alternar={alternar} onCancelar={onCancelar} onGuardar={onGuardar} />;
  }
  if (editando.modo === "expresion" && editando.fila !== null) {
    const nodo = structure?.byRow.get(editando.fila);
    return <EditorExpresionFiltro workbook={workbook} fila={editando.fila} nombre={nodo?.name ?? ""} inicial={nodo?.choiceFilter ?? ""} onCancelar={onCancelar} onGuardar={onGuardar} />;
  }
  return <EditorFiltro workbook={workbook} structure={structure} catalogs={catalogs} filaInicial={editando.fila} alternar={alternar} onCancelar={onCancelar} onGuardar={onGuardar} />;
}
