// =============================================================================
// choiceFilters/ChoiceFiltersView.tsx — pestaña «Filtros de opciones»
// =============================================================================
// Variante A «Lista y detalle» (E5, 2026-10-20, aprobada por Gonzalo). A la izquierda la lista de filtros con su forma
// y su estado; a la derecha el detalle del elegido: diagnóstico, una matriz editable y «Qué ve el encuestado». El
// filtro elegido es el `foco` de la dirección y «Nuevo filtro» es el panel `nuevo-filtro`. Toda la lógica vive en
// modelos puros: modeloFiltros (diagnóstico y vista previa), escrituraFiltros y porOpcion (escritura), fraseFiltro
// (la frase del motor). Un clic nunca saca de la pestaña: la única salida es «Editar en Constructor».
//
// Registra `data-audit-ready` cuando el modelo terminó de componerse, para que el QA visual capture estable.
// =============================================================================

import { useMemo, useState } from "react";
import { SlidersHorizontal } from "../../../vendor/lucide-react";
import type { XlsformEditorWorkbook } from "../../../api/multiIntegrado";
import type { BuilderStructure, CatalogSummary } from "../types";
import { EditorIntencion } from "./EditorIntencion";
import { DetalleFiltro } from "./DetalleFiltro";
import { frasesDeFiltros } from "./fraseFiltro";
import { ListaFiltros } from "./ListaFiltros";
import { analizarTodos, esPreguntaDeSeleccion, mapaPorNombre, tituloDePregunta } from "./modeloFiltros";
import { NuevoFiltro } from "./NuevoFiltro";
import type { PreguntaDestino } from "./NuevoFiltroDialogo";
import type { PreguntaElegible } from "./SelectorPreguntaFiltro";
import "../kit/riel.css";
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
  /** Con el workbook la pestaña crea y edita filtros; sin él sólo los explica. */
  workbook?: XlsformEditorWorkbook | null;
  /** Se conserva por compatibilidad: las opciones salen de la hoja choices. */
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
  onWorkbookChange,
}: ChoiceFiltersViewProps) {
  const [editando, setEditando] = useState<number | null>(null);
  const puedeEditar = !!workbook && !!onWorkbookChange;
  // El modelo puede ser caro en formularios grandes: sólo se arma con la pestaña abierta.
  const model = useMemo(() => {
    if (!open) return null;
    const choices = { columns: choicesColumns, rows: choicesRows };
    const porNombre = mapaPorNombre(structure);
    const filtros = analizarTodos({ structure, choices });
    const conFiltro = new Map(filtros.map((f) => [f.pregunta, f.tipo]));
    const seleccion = (structure?.outline ?? []).filter(esPreguntaDeSeleccion);
    const elegible = (n: (typeof seleccion)[number]): PreguntaElegible => ({
      name: n.name, titulo: tituloDePregunta(n, porNombre), baseType: n.typeInfo.base, tieneFiltro: conFiltro.has(n.name),
    });
    const destinos: PreguntaDestino[] = seleccion.map((n) => ({ ...elegible(n), fila: n.rowIndex, lista: n.typeInfo.listName, tipoFiltro: conFiltro.get(n.name) ?? null }));
    const candidatasDe = (name: string): PreguntaElegible[] => {
      const fila = porNombre.get(name)?.rowIndex ?? Infinity;
      return seleccion.filter((n) => n.rowIndex < fila).map(elegible);
    };
    return { filtros, frases: frasesDeFiltros(structure, choicesColumns, choicesRows), porNombre, destinos, candidatasDe };
  }, [open, structure, choicesColumns, choicesRows]);

  if (!open) return null;

  const ready = model !== null;
  const filtros = model?.filtros ?? [];
  const actual = filtros.find((f) => f.pregunta === seleccionada) ?? filtros[0] ?? null;
  const focoPerdido = Boolean(seleccionada && actual && actual.pregunta !== seleccionada);
  const escribir = (wb: XlsformEditorWorkbook) => onWorkbookChange?.(wb);

  return (
    <div className="pulso-xcf-overlay is-embebido xcf" role="region" aria-label="Filtros de opciones del formulario" data-audit-ready={ready ? "true" : "false"}>
      <header className="pulso-xcf-header xcf-cab">
        <div className="xcf-cab__titulo">
          <strong>Filtros de opciones</strong>
          <span>{filtros.length === 1 ? "1 pregunta filtra sus opciones" : `${filtros.length} preguntas filtran sus opciones`}</span>
        </div>
        {puedeEditar && model && workbook ? (
          <NuevoFiltro preguntas={model.destinos} candidatasDe={model.candidatasDe} workbook={workbook} onAbrir={(n) => { setEditando(null); onSeleccionar(n); }}
            onCrear={(wb, n) => { escribir(wb); setEditando(null); onSeleccionar(n); }} />
        ) : null}
      </header>

      {!actual ? (
        <div className="xcf-vacio">
          <span className="xcf-vacio__icono" aria-hidden="true"><SlidersHorizontal size={26} /></span>
          <strong>Ninguna pregunta filtra sus opciones.</strong>
          {puedeEditar ? <p>Usa «Nuevo filtro» para crear el primero.</p> : null}
        </div>
      ) : (
        <div className="xcf-gestion" data-qa-geometry-group="xlsform/filtros-gestion" data-qa-geometry-contract="intrinsic">
          <ListaFiltros filtros={filtros} frases={model!.frases} actual={actual.fila} idDetalle={ID_DETALLE}
            onElegir={(n) => { setEditando(null); onSeleccionar(n); }} />
          <DetalleFiltro
            key={actual.fila}
            id={ID_DETALLE}
            a={actual}
            frase={model!.frases.get(actual.fila)}
            workbook={workbook}
            porNombre={model!.porNombre}
            candidatas={model!.candidatasDe(actual.pregunta)}
            onWorkbook={puedeEditar ? escribir : null}
            onEditarFiltro={puedeEditar && editando !== actual.fila ? () => setEditando(actual.fila) : null}
            onEditar={onEditar}
            aviso={focoPerdido ? <p className="xcf-aviso" role="status">No hay un filtro en <code>{seleccionada}</code>. Se muestra el primero de la lista.</p> : null}
            editor={editando === actual.fila && workbook ? (
              <EditorIntencion analisis={actual} workbook={workbook} candidatas={model!.candidatasDe(actual.pregunta)}
                onCancelar={() => setEditando(null)} onGuardar={(wb) => { escribir(wb); setEditando(null); }} />
            ) : null}
          />
        </div>
      )}
    </div>
  );
}
