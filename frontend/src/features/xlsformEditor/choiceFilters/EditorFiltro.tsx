// Editor guiado de un filtro de opciones en cascada (F2, 2026-10-16). Tres pasos: la pregunta cuyas opciones se
// filtran, la pregunta anterior de la que depende y, por cada opción, qué respuesta la habilita, eligiendo por
// etiqueta (nunca por código). Escribe la forma estándar de XLSForm con `cascada.ts`.

import { useMemo, useState } from "react";
import type { XlsformEditorWorkbook } from "../../../api/multiIntegrado";
import type { BuilderNode, BuilderStructure, CatalogSummary } from "../types";
import { PanelCard, QuestionToken } from "../kit";
import { aplicarCascada, asignacionesActuales, columnaSugerida, leerExpresionCascada, quitarCascada } from "./cascada";
import "./editorFiltro.css";

type Props = {
  workbook: XlsformEditorWorkbook;
  structure: BuilderStructure | null;
  catalogs: CatalogSummary[];
  /** Fila de la pregunta a editar; sin ella, filtro nuevo. */
  filaInicial?: number | null;
  onGuardar: (wb: XlsformEditorWorkbook, preguntaHija: string) => void;
  onCancelar: () => void;
};

const esSeleccion = (n: BuilderNode) => n.kind === "question" && !!n.typeInfo.listName && /^select_(one|multiple)$/.test(n.typeInfo.base);
const rotulo = (n: BuilderNode) => `${n.paperNumber || n.name}  ${n.label || ""}`.trim();

export function EditorFiltro({ workbook, structure, catalogs, filaInicial = null, onGuardar, onCancelar }: Props) {
  const seleccion = useMemo(() => (structure?.outline ?? []).filter(esSeleccion), [structure]);
  const inicial = filaInicial !== null ? seleccion.find((n) => n.rowIndex === filaInicial) ?? null : null;
  const previa = inicial ? leerExpresionCascada(inicial.choiceFilter) : null;
  const [filaHija, setFilaHija] = useState<number | null>(inicial?.rowIndex ?? null);
  const [madre, setMadre] = useState<string>(previa?.madre ?? "");
  const hija = seleccion.find((n) => n.rowIndex === filaHija) ?? null;
  const columna = previa && inicial?.rowIndex === filaHija ? previa.columna : madre ? columnaSugerida(workbook.choices, madre) : "";
  const [asignaciones, setAsignaciones] = useState<Record<string, string>>(() =>
    inicial && previa ? asignacionesActuales(workbook.choices, inicial.typeInfo.listName, previa.columna) : {});

  const opcionesDe = (lista: string) => catalogs.find((c) => c.listName === lista)?.items ?? [];
  const candidatasMadre = hija ? seleccion.filter((n) => n.rowIndex < hija.rowIndex) : [];
  const nodoMadre = candidatasMadre.find((n) => n.name === madre) ?? null;
  const hijas = hija ? opcionesDe(hija.typeInfo.listName) : [];
  const respuestasMadre = nodoMadre ? opcionesDe(nodoMadre.typeInfo.listName) : [];
  const asignadas = hijas.filter((o) => asignaciones[o.name]).length;
  const listo = !!hija && !!nodoMadre && asignadas > 0;

  const guardar = () => {
    if (!hija || !nodoMadre) return;
    const todas = Object.fromEntries(hijas.map((o) => [o.name, asignaciones[o.name] ?? ""]));
    onGuardar(aplicarCascada(workbook, hija.rowIndex, hija.typeInfo.listName, { madre: nodoMadre.name, columna, asignaciones: todas }), hija.name);
  };

  return (
    <div className="xff" data-qa-geometry-group="xlsform/filtro-editor" data-qa-geometry-contract="intrinsic">
      <PanelCard title={inicial ? "Editar filtro de opciones" : "Nuevo filtro de opciones"}
        meta={<span className="xff-paso">Las opciones de una pregunta dependen de la respuesta a otra anterior</span>}>
        <div className="xff-pasos">
          <label className="xff-campo">
            <span className="xff-n">1</span>
            <span className="xff-campo__rot">Pregunta cuyas opciones se filtran</span>
            <select value={filaHija ?? ""} disabled={!!inicial}
              onChange={(e) => { setFilaHija(e.target.value ? Number(e.target.value) : null); setMadre(""); setAsignaciones({}); }}>
              <option value="">Elige una pregunta de selección</option>
              {seleccion.map((n) => <option key={n.rowIndex} value={n.rowIndex}>{rotulo(n)}</option>)}
            </select>
          </label>
          <label className="xff-campo">
            <span className="xff-n">2</span>
            <span className="xff-campo__rot">Depende de la respuesta a</span>
            <select value={madre} disabled={!hija} onChange={(e) => { setMadre(e.target.value); setAsignaciones({}); }}>
              <option value="">{hija ? (candidatasMadre.length ? "Elige una pregunta anterior" : "No hay preguntas de selección antes") : "Primero elige la pregunta"}</option>
              {candidatasMadre.map((n) => <option key={n.rowIndex} value={n.name}>{rotulo(n)}</option>)}
            </select>
          </label>
        </div>
        {hija && nodoMadre ? (
          <div className="xff-mapa">
            <div className="xff-mapa__cab">
              <span className="xff-n">3</span>
              <span className="xff-campo__rot">Qué respuesta habilita cada opción</span>
              <span className="xff-mapa__cuenta">{asignadas} de {hijas.length} asignadas</span>
            </div>
            <div className="xff-mapa__quienes">
              <QuestionToken baseType={hija.typeInfo.base} label={hija.paperNumber || hija.name} hint={hija.label} variable={hija.name} />
              <span aria-hidden="true">depende de</span>
              <QuestionToken baseType={nodoMadre.typeInfo.base} label={nodoMadre.paperNumber || nodoMadre.name} hint={nodoMadre.label} variable={nodoMadre.name} />
            </div>
            <div className="xff-tabla" role="group" aria-label="Opción y respuesta que la habilita">
              <div className="xff-fila is-cab" aria-hidden="true"><span>Opción de {hija.paperNumber || hija.name}</span><span>Aparece cuando respondió</span></div>
              {hijas.map((o) => (
                <div key={o.rowIndex} className="xff-fila">
                  <span className="xff-fila__op">{o.label || o.name}</span>
                  <select aria-label={`Respuesta que habilita ${o.label || o.name}`} value={asignaciones[o.name] ?? ""}
                    onChange={(e) => setAsignaciones((a) => ({ ...a, [o.name]: e.target.value }))}>
                    <option value="">Siempre visible</option>
                    {respuestasMadre.map((r) => <option key={r.rowIndex} value={r.name}>{r.label || r.name}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        <div className="xff-pie">
          {inicial ? (
            <button type="button" className="xff-btn is-peligro" onClick={() => onGuardar(quitarCascada(workbook, inicial.rowIndex), inicial.name)}>Quitar filtro</button>
          ) : null}
          <span className="xff-pie__esp" />
          <button type="button" className="xff-btn" onClick={onCancelar}>Cancelar</button>
          <button type="button" className="xff-btn is-primario" disabled={!listo} onClick={guardar}>Guardar filtro</button>
        </div>
      </PanelCard>
    </div>
  );
}
