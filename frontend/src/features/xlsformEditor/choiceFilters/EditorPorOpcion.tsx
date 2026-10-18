// Editor del filtro «por opción» (C27, 2026-10-17): cada opción de la pregunta la habilita una pregunta anterior
// distinta, con las respuestas que cuentan. Reemplaza el método a mano del hostigamiento (una columna filter_* por
// pregunta y una fila repetida por respuesta en choices): aquí se elige en una tabla y `porOpcion.ts` arma las columnas,
// las filas y la expresión.

import { useMemo, useState, type ReactNode } from "react";
import type { XlsformEditorWorkbook } from "../../../api/multiIntegrado";
import type { BuilderNode, BuilderStructure, CatalogSummary } from "../types";
import { PanelCard, SelectorPregunta, type OpcionPregunta } from "../kit";
import { tituloPlano } from "../kit/CuerpoPanelMarca";
import { stripMarkdown } from "../helpers/markdown";
import {
  aplicarPorOpcion,
  asignacionesPorOpcion,
  expresionPorOpcion,
  leerPorOpcion,
  opcionesDeLista,
  type AsignacionOpcion,
} from "./porOpcion";
import { quitarCascada } from "./cascada";
import "./editorFiltro.css";

type Props = {
  workbook: XlsformEditorWorkbook;
  structure: BuilderStructure | null;
  catalogs: CatalogSummary[];
  /** Fila de la pregunta a editar; sin ella, filtro nuevo. */
  filaInicial?: number | null;
  onGuardar: (wb: XlsformEditorWorkbook, pregunta: string) => void;
  onCancelar: () => void;
  /** Cambiar al editor de cascada simple (sólo al crear). */
  alternar?: ReactNode;
};

const SIEMPRE = "__siempre__";
const NUNCA = "__nunca__";
const esSeleccion = (n: BuilderNode) => n.kind === "question" && !!n.typeInfo.listName && /^select_(one|multiple)$/.test(n.typeInfo.base);
const texto = (n: BuilderNode) => tituloPlano(n.label || n.name);
const opcion = (n: BuilderNode, valor: string): OpcionPregunta => ({ valor, numero: n.paperNumber || n.name, texto: texto(n), baseType: n.typeInfo.base });

export function EditorPorOpcion({ workbook, structure, catalogs, filaInicial = null, onGuardar, onCancelar, alternar }: Props) {
  const seleccion = useMemo(() => (structure?.outline ?? []).filter(esSeleccion), [structure]);
  const inicial = filaInicial !== null ? seleccion.find((n) => n.rowIndex === filaInicial) ?? null : null;
  const previa = inicial ? leerPorOpcion(inicial.choiceFilter) : null;
  const [fila, setFila] = useState<number | null>(inicial?.rowIndex ?? null);
  const pregunta = seleccion.find((n) => n.rowIndex === fila) ?? null;
  const lista = pregunta?.typeInfo.listName ?? "";
  const [asignaciones, setAsignaciones] = useState<Record<string, AsignacionOpcion>>(() =>
    inicial && previa ? asignacionesPorOpcion(workbook.choices, inicial.typeInfo.listName, previa) : {});

  const opcionesDe = (l: string) => catalogs.find((c) => c.listName === l)?.items ?? [];
  const orden = lista ? opcionesDeLista(workbook.choices, lista) : [];
  const etiquetaOpcion = (codigo: string) => stripMarkdown(opcionesDe(lista).find((o) => o.name === codigo)?.label || codigo);
  const candidatas = pregunta ? seleccion.filter((n) => n.rowIndex < pregunta.rowIndex) : [];
  const porNombre = (name: string) => candidatas.find((n) => n.name === name) ?? null;
  const asignadas = orden.filter((c) => asignaciones[c]?.pregunta && asignaciones[c].valores.length).length;
  const expresion = expresionPorOpcion(orden, asignaciones, previa);
  const filasResultantes = orden.reduce((acc, c) => acc + Math.max(1, asignaciones[c]?.pregunta ? asignaciones[c].valores.length : 1), 0);
  const listo = !!pregunta && asignadas > 0;

  const fijar = (codigo: string, a: AsignacionOpcion) => setAsignaciones((prev) => ({ ...prev, [codigo]: a }));
  const elegirQuien = (codigo: string, valor: string) => {
    if (valor === SIEMPRE) fijar(codigo, { pregunta: "", valores: [] });
    else if (valor === NUNCA) fijar(codigo, { pregunta: "", valores: [], oculta: true });
    else {
      const previaValores = asignaciones[codigo]?.pregunta === valor ? asignaciones[codigo].valores : [];
      fijar(codigo, { pregunta: valor, valores: previaValores });
    }
  };
  const alternarValor = (codigo: string, v: string) => {
    const a = asignaciones[codigo];
    if (!a?.pregunta) return;
    fijar(codigo, { ...a, valores: a.valores.includes(v) ? a.valores.filter((x) => x !== v) : [...a.valores, v] });
  };
  /** Copia las respuestas elegidas a las demás opciones cuya pregunta usa la misma lista (P14…P20 comparten escala). */
  const copiarALasDemas = (codigo: string) => {
    const a = asignaciones[codigo];
    const listaOrigen = porNombre(a?.pregunta ?? "")?.typeInfo.listName;
    if (!a?.pregunta || !listaOrigen) return;
    setAsignaciones((prev) => {
      const next = { ...prev };
      for (const c of orden) {
        const b = next[c];
        if (c !== codigo && b?.pregunta && porNombre(b.pregunta)?.typeInfo.listName === listaOrigen) next[c] = { ...b, valores: [...a.valores] };
      }
      return next;
    });
  };

  const guardar = () => {
    if (!pregunta) return;
    onGuardar(aplicarPorOpcion(workbook, pregunta.rowIndex, lista, asignaciones, previa), pregunta.name);
  };

  return (
    <div className="xff" data-qa-geometry-group="xlsform/filtro-editor" data-qa-geometry-contract="intrinsic">
      <PanelCard title={inicial ? "Editar filtro por opción" : "Nuevo filtro por opción"}
        meta={<span className="xff-paso">Cada opción aparece según la respuesta a una pregunta anterior</span>}>
        {alternar}
        <div className="xff-campo">
          <span className="xff-n">1</span>
          <span className="xff-campo__rot">Pregunta cuyas opciones se filtran</span>
          <SelectorPregunta etiqueta="Pregunta cuyas opciones se filtran" placeholder="Elige una pregunta de selección"
            opciones={seleccion.map((n) => opcion(n, String(n.rowIndex)))} valor={fila === null ? "" : String(fila)} deshabilitado={!!inicial}
            onCambio={(v) => { setFila(v ? Number(v) : null); setAsignaciones({}); }} />
        </div>
        {pregunta ? (
          <div className="xff-mapa">
            <div className="xff-mapa__cab">
              <span className="xff-n">2</span>
              <span className="xff-campo__rot">Qué pregunta habilita cada opción, y con qué respuestas</span>
              <span className="xff-mapa__cuenta">{asignadas} de {orden.length} con pregunta</span>
            </div>
            <table className="xfo-tabla">
              <colgroup>
                <col className="xfo-col-op" />
                <col className="xfo-col-quien" />
                <col />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">Opción</th>
                  <th scope="col">La habilita</th>
                  <th scope="col">Cuando responde</th>
                </tr>
              </thead>
              <tbody>
                {orden.map((codigo) => {
                  const a = asignaciones[codigo];
                  const quien = a?.pregunta || (a?.oculta ? NUNCA : SIEMPRE);
                  const madre = a?.pregunta ? porNombre(a.pregunta) : null;
                  const respuestas = madre ? opcionesDe(madre.typeInfo.listName) : [];
                  const nombre = etiquetaOpcion(codigo);
                  return (
                    <tr key={codigo}>
                      <th scope="row" className="xfo-op">{nombre}</th>
                      <td>
                        <select aria-label={`Pregunta que habilita ${nombre}`} value={quien} onChange={(e) => elegirQuien(codigo, e.target.value)}>
                          <option value={SIEMPRE}>Siempre visible</option>
                          <option value={NUNCA}>No se muestra</option>
                          {/* El código va delante: en el hostigamiento las siete preguntas empiezan igual («En 2025, ¿alguien…»). */}
                          {candidatas.map((n) => <option key={n.rowIndex} value={n.name}>{n.paperNumber || n.name} · {texto(n).slice(0, 90)}</option>)}
                          {a?.pregunta && !madre ? <option value={a.pregunta}>{a.pregunta} (no está antes de esta pregunta)</option> : null}
                        </select>
                      </td>
                      <td>
                        {madre ? (
                          <div className="xfo-resp" role="group" aria-label={`Respuestas que habilitan ${nombre}`}>
                            {respuestas.map((r) => (
                              <label key={r.rowIndex} className={a?.valores.includes(r.name) ? "xfo-chip is-on" : "xfo-chip"}>
                                <input type="checkbox" checked={a?.valores.includes(r.name) ?? false} onChange={() => alternarValor(codigo, r.name)} />
                                {stripMarkdown(r.label || r.name)}
                              </label>
                            ))}
                            {a && a.valores.length ? (
                              <button type="button" className="xfo-copiar" onClick={() => copiarALasDemas(codigo)}>Usar estas respuestas en las demás</button>
                            ) : null}
                          </div>
                        ) : (
                          <span className="xfo-nota">{quien === NUNCA ? "Queda oculta" : "Se ofrece siempre"}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <details className="xfo-xls">
              <summary>Lo que se escribe en el XLSForm</summary>
              <p>
                <code>{expresion || "(sin filtro)"}</code>
              </p>
              <p className="xfo-nota">
                {filasResultantes} filas en la lista <code>{lista}</code>
                {filasResultantes > orden.length ? ": una opción se repite por cada respuesta que la habilita, y se activa allow_choice_duplicates en settings." : "."}
              </p>
            </details>
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
