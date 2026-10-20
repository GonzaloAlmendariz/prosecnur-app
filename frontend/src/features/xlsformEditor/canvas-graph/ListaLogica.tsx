import { useEffect, useMemo, useRef, useState } from "react";
import type { BuilderStructure } from "../types";
import { enriquecerAlcance, type LogicScope } from "../logic";
import { stripMarkdown } from "../helpers/markdown";
import { lecturaPlana, textoPreguntaPlano, type LectorReferencias } from "../helpers/markdownPregunta";
import { Segmented, TypeIcon } from "../kit";
import { describeExpression, leerColumna } from "../canvas/reglasHumanas";
import { dividirPorLogica, focoEnLista, listaLogica, type TipoRegla } from "./listaLogicaModel";
import "./listaLogica.css";

// Lista de la lógica junto al mapa (revamp 2026-10-16). Cada sección es un contenedor: arriba la regla que
// vale para toda la sección (la heredan sus preguntas, unidas por una línea) y debajo las preguntas con regla
// propia. Elegir una fila la enfoca en el mapa (`foco` = nombre de la variable): no sale de la pestaña.

type Filtro = "todas" | "seccion" | "pregunta";

const TIPO: Record<TipoRegla, { titulo: string; d: string }> = {
  aparece: { titulo: "Cuándo aparece", d: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" },
  opciones: { titulo: "Opciones visibles", d: "M3 5h18l-7 8v6l-4 2v-8z" },
};

export function IconoRegla({ tipo }: { tipo: TipoRegla }) {
  return (
    <span className={`xfl-regla xfl-regla--${tipo}`} title={TIPO[tipo].titulo}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d={TIPO[tipo].d} /></svg>
    </span>
  );
}

export type ListaLogicaProps = {
  structure: BuilderStructure | null;
  scope: LogicScope;
  seleccionada: string | null;
  onSeleccionar: (foco: string | null) => void;
};

export function ListaLogica({ structure, scope: scopeBase, seleccionada, onSeleccionar }: ListaLogicaProps) {
  // Con la estructura, el motor cita grupos por su etiqueta; cada fila se lee con leerRegla en su propia columna.
  const scope = useMemo(() => enriquecerAlcance(scopeBase, structure), [scopeBase, structure]);
  const lista = useMemo(() => listaLogica(structure), [structure]);
  const lector = useMemo<LectorReferencias>(() => {
    const etiquetas = new Map((structure?.outline ?? []).map((n) => [n.name, n.label] as const));
    return { etiquetaDe: (n) => etiquetas.get(n) };
  }, [structure]);
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const verSeccion = filtro !== "pregunta";
  const verPregunta = filtro !== "seccion";
  // M2: las secciones sin ninguna regla no ocupan una tarjeta cada una; van juntas y compactas al final.
  const { conLogica, sinLogica } = useMemo(() => dividirPorLogica(lista.secciones), [lista.secciones]);
  const secciones = conLogica.filter((s) => (filtro === "seccion" ? Boolean(s.regla) : filtro === "pregunta" ? s.items.length > 0 : true));
  const [verSinLogica, setVerSinLogica] = useState(false);
  const total = lista.deSeccion + lista.dePregunta;
  const focoDesconocido = !focoEnLista(lista, seleccionada);
  // Un `foco` que llega de otra pestaña trae su fila a la vista (S11: antes la lista quedaba arriba, a 22.000 px).
  const cuerpo = useRef<HTMLDivElement | null>(null);
  const enSinLogica = Boolean(seleccionada?.startsWith("seccion:") && sinLogica.some((s) => `seccion:${s.rowIndex}` === seleccionada));
  useEffect(() => {
    if (enSinLogica) setVerSinLogica(true);
  }, [enSinLogica]);
  useEffect(() => {
    const raiz = cuerpo.current;
    if (!raiz || !seleccionada) return;
    const el = raiz.querySelector<HTMLElement>(".is-on");
    if (!el) return;
    const r = raiz.getBoundingClientRect();
    const q = el.getBoundingClientRect();
    if (q.top < r.top || q.bottom > r.bottom) raiz.scrollTop += q.top - r.top - Math.max(16, (r.height - q.height) / 3);
  }, [seleccionada, verSinLogica, secciones.length]);

  return (
    <aside className="xfl-lista" aria-label="Lógica del formulario">
      <header className="xfl-lista__head">
        <div className="xfl-lista__tit"><span>Lógica del formulario</span><span className="xfl-lista__total">{total} reglas</span></div>
        <Segmented
          aria-label="Qué reglas mostrar"
          size="sm"
          value={filtro}
          onChange={setFiltro}
          options={[
            { value: "todas", label: "Todas", count: total },
            { value: "seccion", label: "Sección", count: lista.deSeccion },
            { value: "pregunta", label: "Pregunta", count: lista.dePregunta },
          ]}
        />
      </header>
      {focoDesconocido && total > 0 && seleccionada ? (
        <p className="xfl-aviso" role="status">No hay una regla de lógica para <code>{seleccionada}</code>: se muestra la lista completa.</p>
      ) : null}
      <div ref={cuerpo} className="xfl-lista__cuerpo" data-qa-geometry-group="xlsform/logica-secciones" data-qa-geometry-contract="intrinsic">
        {secciones.length === 0 && (filtro !== "todas" || sinLogica.length === 0) ? (
          <p className="xfl-vacio">Este formulario no tiene reglas de cuándo aparece una pregunta ni de qué opciones se muestran.</p>
        ) : (
          secciones.map((s) => {
            const items = verPregunta ? s.items : [];
            const focoSeccion = s.rowIndex != null ? `seccion:${s.rowIndex}` : null;
            return (
              <section key={s.id} className="xfl-sec">
                <header className="xfl-sec__head">
                  <span className="xfl-sec__letra">{s.letra}</span>
                  <span className="xfl-sec__nombre">{stripMarkdown(s.nombre)}</span>
                  <span className="xfl-sec__n">{s.preguntas} preg.{s.esRepeticion ? " · se repite" : ""}</span>
                </header>
                {verSeccion && s.regla ? (
                  <button type="button" className={seleccionada === focoSeccion ? "xfl-toda is-on" : "xfl-toda"} onClick={() => onSeleccionar(focoSeccion)}>
                    <span className="xfl-toda__marca">Toda la sección</span>
                    <span className="xfl-toda__lee">{lecturaPlana(describeExpression(s.regla, scope).summary, lector)}</span>
                    <span className="xfl-toda__nota">La heredan sus {s.preguntas} preguntas</span>
                  </button>
                ) : null}
                {items.length ? (
                  <div className={verSeccion && s.regla ? "xfl-items is-heredan" : "xfl-items"}>
                    {items.map((it) => (
                      <button
                        key={it.node.rowIndex}
                        type="button"
                        className={seleccionada === it.node.name ? "xfl-item is-on" : "xfl-item"}
                        aria-current={seleccionada === it.node.name ? "true" : undefined}
                        onClick={() => onSeleccionar(it.node.name)}
                      >
                        <TypeIcon baseType={it.node.typeInfo.base} size={13} />
                        <span className="xfl-item__txt">
                          <span className="xfl-item__titulo">{textoPreguntaPlano(it.node.label || it.node.name, lector) || it.node.name}</span>
                          <span className="xfl-item__lee">
                            {lecturaPlana((it.node.relevant
                              ? leerColumna("relevant", it.node, it.node.relevant, scope)
                              : leerColumna("choice_filter", it.node, it.node.choiceFilter, scope)).summary, lector)}
                          </span>
                        </span>
                        <span className="xfl-item__tipos">{it.tipos.map((t) => <IconoRegla key={t} tipo={t} />)}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </section>
            );
          })
        )}
        {filtro === "todas" && sinLogica.length ? (
          <section className="xfl-sin">
            <button type="button" className="xfl-sin__head" aria-expanded={verSinLogica} onClick={() => setVerSinLogica((v) => !v)}>
              <span className="xfl-sin__tit">Sin lógica propia</span>
              <span className="xfl-sin__n">{sinLogica.length} {sinLogica.length === 1 ? "sección" : "secciones"}</span>
              <span className="xfl-sin__chev" aria-hidden="true">{verSinLogica ? "−" : "+"}</span>
            </button>
            <p className="xfl-sin__nota">Sus preguntas aparecen siempre y muestran todas sus opciones.</p>
            {verSinLogica ? (
              <ul className="xfl-sin__lista" data-qa-geometry-group="xlsform/logica-sin" data-qa-geometry-contract="intrinsic">
                {sinLogica.map((s) => {
                  const foco = s.rowIndex != null ? `seccion:${s.rowIndex}` : null;
                  return (
                    <li key={s.id}>
                      <button type="button" className={seleccionada === foco ? "xfl-sin__sec is-on" : "xfl-sin__sec"} onClick={() => onSeleccionar(foco)}>
                        <span className="xfl-sec__letra">{s.letra}</span>
                        <span className="xfl-sin__nombre">{stripMarkdown(s.nombre)}</span>
                        <span className="xfl-sin__preg">{s.preguntas}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </section>
        ) : null}
      </div>
      <footer className="xfl-lista__pie">
        <span><IconoRegla tipo="aparece" /> Cuándo aparece</span>
        <span><IconoRegla tipo="opciones" /> Opciones visibles</span>
      </footer>
    </aside>
  );
}
