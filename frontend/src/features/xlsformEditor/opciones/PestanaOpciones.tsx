// Pestaña «Listas de opciones» (2026-10-16). Pedido de Gonzalo: «el catálogo de opciones no tiene su subtab propio
// como debería sino un sideover que aún le falta mucho para verse profesional». Reúne lo que vivía en dos paneles —el
// editor de listas (sideover) y «Listas de opciones» (diálogo de escalas repetidas)— en el mismo marco que
// Restricciones y Cálculos: las listas a la izquierda, sus opciones al centro y, al lado, dónde se usa y si se repite.
// La lista elegida vive en `?foco=` (su código): enlazable.

import { useCallback, useMemo, useState } from "react";
import { ListChecks, Plus } from "../../../vendor/lucide-react";
import type { XlsformEditorWorkbook } from "../../../api/multiIntegrado";
import type { BuilderStructure, CatalogSummary } from "../types";
import { PanelCard, QuestionToken } from "../kit";
import { TituloLegible } from "../kit/CuerpoPanelMarca";
import { PestanaReglas } from "../pestanas/PestanaReglas";
import { EditorLista } from "./EditorLista";
import { useListasOpciones } from "../listas/useListasOpciones";
import { gruposDeListas, nombreDeOrigen, nombreLegible, origenDeLista, usosDeLista, usosPorLista } from "./opcionesModel";
import { agregarOpcion, crearLista, moverOpcion, nombreUnificadoCorto, totalListas } from "./edicionOpciones";
import { UnificarListas } from "./UnificarListas";
import { useAnchoCompacto } from "./useAnchoCompacto";
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
  const origenActual = actual && actual.items.length === 0 ? origenDeLista(actual.listName, p.structure) : null;
  const usos = actual ? usosDeLista(p.structure, actual.listName) : [];
  const grupo = actual ? repetidas.find((g) => g.listas.includes(actual.listName)) ?? null : null;
  // Fila que debe tomar el foco tras agregar, crear o mover, y la frase que anuncia el movimiento.
  const [enfocar, setEnfocar] = useState<{ rowIndex: number; campo: "etiqueta" | "asa" } | null>(null);
  const [anuncio, setAnuncio] = useState("");
  const enfocado = useCallback(() => setEnfocar(null), []);
  const { workbook, onWorkbookChange, onSeleccionar } = p;
  const compacto = useAnchoCompacto();

  // La opción nueva nace sin texto y con un código libre; el foco va a su texto (E2). Lo mismo con una lista nueva,
  // que además queda elegida: el riel la trae a la vista.
  const agregar = (listName: string) => {
    const r = agregarOpcion(workbook, listName);
    onWorkbookChange(r.workbook);
    setEnfocar({ rowIndex: r.rowIndex, campo: "etiqueta" });
  };
  const crear = () => {
    const r = crearLista(workbook, p.catalogs.map((c) => c.listName));
    onWorkbookChange(r.workbook);
    onSeleccionar(r.listName);
    setEnfocar({ rowIndex: r.rowIndex, campo: "etiqueta" });
  };
  const mover = (desde: number, hacia: number, conFoco: boolean) => {
    onWorkbookChange(moverOpcion(workbook, desde, hacia));
    if (conFoco) setEnfocar({ rowIndex: hacia, campo: "asa" });
  };
  const moverTecla = (rowIndex: number, delta: -1 | 1) => {
    if (!actual) return;
    const i = actual.items.findIndex((it) => it.rowIndex === rowIndex);
    const vecina = actual.items[i + delta];
    if (i < 0 || !vecina) { setAnuncio(delta < 0 ? "Ya es la primera opción." : "Ya es la última opción."); return; }
    mover(rowIndex, vecina.rowIndex, true);
    const texto = actual.items[i]!.label.trim() || actual.items[i]!.name;
    setAnuncio(`«${texto}» pasó a la posición ${i + delta + 1} de ${actual.items.length}.`);
  };

  const lateral = actual ? (
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
              <UnificarListas grupo={grupo} actual={actual.listName} propuesto={nombreUnificadoCorto(grupo, usosLista)} onUnificar={control.unificar} />
            ) : null}
            {control.aviso ? <p className="xfo-nota" role="status" aria-live="polite">{control.aviso}</p> : null}
          </div>
        ) : undefined;

  const nueva = (
    <button type="button" className="xfo-nueva" onClick={crear}>
      <Plus size={14} aria-hidden="true" /> Nueva lista
    </button>
  );

  return (
    <div className="xfo" data-audit-ready="xlsform-opciones">
      <PestanaReglas
        titulo="Listas de opciones"
        total={totalListas(p.catalogs)}
        grupos={grupos}
        seleccionada={actual?.listName ?? null}
        onSeleccionar={p.onSeleccionar}
        pie={nueva}
        vacio={<div className="xfo-vacio"><ListChecks size={18} aria-hidden="true" /><p>Este formulario todavía no tiene listas.</p>{nueva}</div>}
        vacioDetalle={<div className="xfo-vacio"><p>Crea la primera lista para las preguntas de selección.</p></div>}
        lateral={compacto ? undefined : lateral}
      >
        {actual ? (
          // Una lista dinámica es una nota y su código: la tarjeta se ajusta a eso y el resto del alto queda en la
          // columna (M1). Una lista de choices llena la columna, que es donde crecen sus opciones.
          // El título es la lista (su código) y el subtítulo, lo que contiene.
          <PanelCard fill={!origenActual} title={
            <span className="xfo-titulo">
              <code title={actual.listName}>{origenActual?.tipo === "repeticion" ? origenActual.variable : actual.listName}</code>
              <span className="xfo-titulo__sub" title={(origenActual ? nombreDeOrigen(origenActual) : nombreLegible(actual.items, 6)).replace(/\$\{\s*([^}\s]+)\s*\}/g, "$1")}>
                <TituloLegible texto={origenActual ? nombreDeOrigen(origenActual) : nombreLegible(actual.items, 3)} />
              </span>
            </span>
          }>
            <EditorLista
              lista={actual}
              origen={origenActual}
              usos={usosLista[actual.listName] ?? 0}
              onRename={p.onRename}
              onAgregar={agregar}
              onCambio={p.onChoiceChange}
              onQuitar={p.onChoiceRemove}
              onMover={(_l, desde, hacia) => mover(desde, hacia, false)}
              onMoverTecla={moverTecla}
              enfocar={enfocar}
              onEnfocado={enfocado}
              anuncio={anuncio}
              onBorrarLista={p.onDeleteCatalog}
            />
          </PanelCard>
        ) : null}
        {compacto ? lateral : null}
      </PestanaReglas>
    </div>
  );
}
