import { useMemo, useState } from "react";
import type { BuilderStructure } from "../types";
import type { LogicScope } from "../logic";
import { stripMarkdown } from "../helpers/markdown";
import { Segmented, TypeIcon } from "../kit";
import { describeExpression } from "../canvas/reglasHumanas";
import { listaLogica, type TipoRegla } from "./listaLogicaModel";
import "./listaLogica.css";

// Lista de la lógica junto al mapa (revamp 2026-10-16). Cada sección es un contenedor: arriba la regla que
// vale para toda la sección (la heredan sus preguntas, unidas por una línea) y debajo las preguntas con regla
// propia. Elegir una fila la enfoca en el mapa (`foco` = nombre de la variable): no sale de la pestaña.

type Filtro = "todas" | "seccion" | "pregunta";

const TIPO: Record<TipoRegla, { titulo: string; d: string }> = {
  aparece: { titulo: "Cuándo aparece", d: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" },
  opciones: { titulo: "Opciones visibles", d: "M3 5h18l-7 8v6l-4 2v-8z" },
};

function IconoRegla({ tipo }: { tipo: TipoRegla }) {
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

export function ListaLogica({ structure, scope, seleccionada, onSeleccionar }: ListaLogicaProps) {
  const lista = useMemo(() => listaLogica(structure), [structure]);
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const verSeccion = filtro !== "pregunta";
  const verPregunta = filtro !== "seccion";
  const secciones = lista.secciones.filter((s) => (filtro === "seccion" ? Boolean(s.regla) : true));
  const total = lista.deSeccion + lista.dePregunta;

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
      <div className="xfl-lista__cuerpo" data-qa-geometry-group="xlsform/logica-secciones" data-qa-geometry-contract="intrinsic">
        {secciones.length === 0 ? (
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
                    <span className="xfl-toda__lee">{describeExpression(s.regla, scope).summary}</span>
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
                          <span className="xfl-item__titulo">{stripMarkdown(it.node.label || it.node.name)}</span>
                          <span className="xfl-item__lee">
                            {describeExpression(it.node.relevant || it.node.choiceFilter, scope).summary}
                          </span>
                        </span>
                        <span className="xfl-item__tipos">{it.tipos.map((t) => <IconoRegla key={t} tipo={t} />)}</span>
                      </button>
                    ))}
                  </div>
                ) : verPregunta && !(verSeccion && s.regla) ? (
                  <p className="xfl-sec__nada">Ninguna pregunta tiene lógica propia.</p>
                ) : null}
              </section>
            );
          })
        )}
      </div>
      <footer className="xfl-lista__pie">
        <span><IconoRegla tipo="aparece" /> Cuándo aparece</span>
        <span><IconoRegla tipo="opciones" /> Opciones visibles</span>
      </footer>
    </aside>
  );
}
