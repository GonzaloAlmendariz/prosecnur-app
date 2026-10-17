// Pestaña «Listas de opciones» (2026-10-16). Pedido de Gonzalo: «el catálogo de opciones no tiene su subtab propio
// como debería sino un sideover que aún le falta mucho para verse profesional». Reúne lo que vivía en dos paneles —el
// editor de listas (sideover) y «Listas de opciones» (diálogo de escalas repetidas)— en el mismo marco que
// Restricciones y Cálculos: las listas a la izquierda, sus opciones al centro y, al lado, dónde se usa y si se repite.
// La lista elegida vive en `?foco=` (su código): enlazable.

import { useMemo, useState } from "react";
import { Copy, ListChecks, Plus } from "../../../vendor/lucide-react";
import type { XlsformEditorWorkbook } from "../../../api/multiIntegrado";
import type { BuilderStructure, CatalogSummary } from "../types";
import { PanelCard, QuestionToken } from "../kit";
import { PestanaReglas } from "../pestanas/PestanaReglas";
import { EditorLista } from "./EditorLista";
import { useListasOpciones } from "../listas/useListasOpciones";
import { gruposDeListas, nombreLegible, usosDeLista, usosPorLista } from "./opcionesModel";
import "./opciones.css";

export type PestanaOpcionesProps = {
  workbook: XlsformEditorWorkbook;
  onWorkbookChange: (next: XlsformEditorWorkbook) => void;
  structure: BuilderStructure | null;
  catalogs: CatalogSummary[];
  seleccionada: string | null;
  onSeleccionar: (listName: string) => void;
  onCrear: () => void;
  onRename: (currentListName: string, nextListName: string) => void;
  onAddChoice: (listName: string) => void;
  onChoiceChange: (rowIndex: number, next: { label: string; name: string }) => void;
  onChoiceRemove: (rowIndex: number) => void;
  onChoiceMove: (listName: string, fromRowIndex: number, toRowIndex: number) => void;
  onDeleteCatalog: (listName: string) => void;
  onIrAPregunta: (name: string) => void;
};

export function PestanaOpciones(p: PestanaOpcionesProps) {
  const control = useListasOpciones(p.workbook, p.onWorkbookChange);
  const repetidas = control.analisis.grupos;
  // Los usos salen de la estructura, no de `usageByCatalog`: así la lista y «Dónde se usa» dicen lo mismo.
  const usosLista = useMemo(() => usosPorLista(p.structure, p.catalogs), [p.structure, p.catalogs]);
  const grupos = useMemo(() => gruposDeListas(p.catalogs, usosLista, repetidas, p.structure),
    [p.catalogs, usosLista, repetidas, p.structure]);
  // Sin `foco` (o con uno que ya no existe), la primera lista según el orden de los grupos.
  const primera = grupos.flatMap((g) => g.items)[0]?.key ?? null;
  const actual = p.catalogs.find((c) => c.listName === p.seleccionada) ?? p.catalogs.find((c) => c.listName === primera) ?? null;
  const usos = actual ? usosDeLista(p.structure, actual.listName) : [];
  const grupo = actual ? repetidas.find((g) => g.listas.includes(actual.listName)) ?? null : null;
  const [motivo, setMotivo] = useState<string | null>(null);
  const [nombreUnificada, setNombreUnificada] = useState<Record<string, string>>({});

  const nueva = (
    <button type="button" className="xfo-nueva" onClick={p.onCrear}>
      <Plus size={14} aria-hidden="true" /> Nueva lista
    </button>
  );

  return (
    <div className="xfo" data-audit-ready="xlsform-opciones">
      <PestanaReglas
        titulo="Listas de opciones"
        total={`${p.catalogs.length} lista${p.catalogs.length === 1 ? "" : "s"}`}
        grupos={grupos}
        seleccionada={actual?.listName ?? null}
        onSeleccionar={p.onSeleccionar}
        pie={nueva}
        vacio={<div className="xfo-vacio"><ListChecks size={18} aria-hidden="true" /><p>Este formulario todavía no tiene listas.</p>{nueva}</div>}
        vacioDetalle={<div className="xfo-vacio"><p>Crea la primera lista para las preguntas de selección.</p></div>}
        lateral={actual ? (
          <div className="xfo-lateral" data-qa-geometry-group="xlsform/opciones-lateral" data-qa-geometry-contract="intrinsic">
            <PanelCard title="Dónde se usa" meta={usos.length ? String(usos.length) : undefined}>
              {usos.length ? (
                <ul className="xfo-usos">
                  {usos.map((n, i) => (
                    <li key={`${n.name}-${i}`}>
                      <button type="button" className="xfo-uso" onClick={() => p.onIrAPregunta(n.name)}>
                        <QuestionToken baseType={n.typeInfo.base} label={n.paperNumber || n.name} hint={n.label} variable={n.name} />
                      </button>
                      {n.choiceFilter ? <span className="xfo-uso-filtro">Con filtro de opciones</span> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="xfo-nota">Ninguna pregunta la usa. Puedes borrarla o elegirla en una pregunta de selección.</p>
              )}
            </PanelCard>
            {grupo ? (
              <PanelCard title="Se repite" icon={<Copy size={14} aria-hidden="true" />} meta={`${grupo.listas.length} listas`}>
                <p className="xfo-nota">Las mismas opciones están en {grupo.listas.length} listas. Unificarlas deja una sola, con un nombre claro, para todas las preguntas que las usan.</p>
                <ul className="xfo-gemelas">
                  {grupo.listas.map((l) => <li key={l} className={l === actual.listName ? "is-actual" : undefined}><code>{l}</code></li>)}
                </ul>
                <label className="xfo-unificada">
                  <span>Nombre de la lista unificada</span>
                  <input value={nombreUnificada[grupo.firma] ?? grupo.sugerencia} spellCheck={false}
                    onChange={(e) => setNombreUnificada((m) => ({ ...m, [grupo.firma]: e.target.value }))} />
                </label>
                <button type="button" className="xfo-unificar" onClick={() => setMotivo(control.unificar(grupo, nombreUnificada[grupo.firma] ?? grupo.sugerencia))}>
                  Unificar
                </button>
                {motivo ? <p className="xfo-nota is-aviso" role="status">{motivo}</p> : null}
              </PanelCard>
            ) : null}
            {control.aviso ? <p className="xfo-nota" role="status" aria-live="polite">{control.aviso}</p> : null}
          </div>
        ) : undefined}
      >
        {actual ? (
          <PanelCard title={nombreLegible(actual.items, 2)} fill>
            <EditorLista
              lista={actual}
              usos={usosLista[actual.listName] ?? 0}
              onRename={p.onRename}
              onAgregar={p.onAddChoice}
              onCambio={p.onChoiceChange}
              onQuitar={p.onChoiceRemove}
              onMover={p.onChoiceMove}
              onBorrarLista={p.onDeleteCatalog}
            />
          </PanelCard>
        ) : null}
      </PestanaReglas>
    </div>
  );
}
