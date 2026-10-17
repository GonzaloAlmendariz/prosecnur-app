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
import { CatalogWorkspace } from "../catalogs/CatalogWorkspace";
import { useListasOpciones } from "../listas/useListasOpciones";
import { gruposDeListas, nombreLegible, usosDeLista } from "./opcionesModel";
import "./opciones.css";

export type PestanaOpcionesProps = {
  workbook: XlsformEditorWorkbook;
  onWorkbookChange: (next: XlsformEditorWorkbook) => void;
  structure: BuilderStructure | null;
  catalogs: CatalogSummary[];
  usageByCatalog: Record<string, number>;
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
  const grupos = useMemo(() => gruposDeListas(p.catalogs, p.usageByCatalog, repetidas, p.structure),
    [p.catalogs, p.usageByCatalog, repetidas, p.structure]);
  // Sin `foco` (o con uno que ya no existe), la primera lista según el orden de los grupos.
  const primera = grupos.flatMap((g) => g.items)[0]?.key ?? null;
  const actual = p.catalogs.find((c) => c.listName === p.seleccionada) ?? p.catalogs.find((c) => c.listName === primera) ?? null;
  const usos = actual ? usosDeLista(p.structure, actual.listName) : [];
  const grupo = actual ? repetidas.find((g) => g.listas.includes(actual.listName)) ?? null : null;
  const [motivo, setMotivo] = useState<string | null>(null);

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
          <div className="xfo-lateral">
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
                <p className="xfo-nota">Las mismas opciones están en {grupo.listas.length} listas. Unificarlas deja una sola, con un nombre claro, para las {grupo.preguntas.length} preguntas.</p>
                <ul className="xfo-gemelas">
                  {grupo.listas.map((l) => <li key={l} className={l === actual.listName ? "is-actual" : undefined}><code>{l}</code></li>)}
                </ul>
                <button type="button" className="xfo-unificar" onClick={() => setMotivo(control.unificar(grupo, grupo.sugerencia))}>
                  Unificar como {grupo.sugerencia}
                </button>
                {motivo ? <p className="xfo-nota is-aviso" role="status">{motivo}</p> : null}
              </PanelCard>
            ) : null}
            {control.aviso ? <p className="xfo-nota" role="status" aria-live="polite">{control.aviso}</p> : null}
          </div>
        ) : undefined}
      >
        {actual ? (
          <PanelCard title={nombreLegible(actual.items, 4)} meta={<code className="xfo-codigo">{actual.listName}</code>} fill>
            <CatalogWorkspace
              catalog={actual}
              usageCount={p.usageByCatalog[actual.listName] ?? 0}
              onRename={p.onRename}
              onAddChoice={p.onAddChoice}
              onChoiceChange={p.onChoiceChange}
              onChoiceRemove={p.onChoiceRemove}
              onChoiceMove={p.onChoiceMove}
              onDeleteCatalog={p.onDeleteCatalog}
            />
          </PanelCard>
        ) : null}
      </PestanaReglas>
    </div>
  );
}
