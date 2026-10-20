import { useMemo } from "react";
import { Folder } from "../../../vendor/lucide-react";
import type { BuilderStructure } from "../types";
import type { LogicScope } from "../logic";
import { stripMarkdown } from "../helpers/markdown";
import { TypeIcon } from "../kit";
import { IconoRegla } from "./ListaLogica";
import { vistaListaLogica, type LecturaFila } from "./vistaListaModel";
import "./vistaLista.css";

// Forma «Lista» de la pestaña Lógica (E1, 2026-10-20): la misma lógica que el mapa, en orden del formulario y agrupada
// por sección. Filas con línea fina, sin cajas. Un clic abre el mismo detalle del nodo que el mapa.

export type VistaListaLogicaProps = {
  structure: BuilderStructure | null;
  scope: LogicScope;
  /** Fila del nodo abierto en el detalle. */
  seleccionada: number | null;
  onElegir: (rowIndex: number) => void;
};

function Lectura({ lecturas }: { lecturas: LecturaFila[] }) {
  const depende = [...new Set(lecturas.flatMap((l) => l.depende))].map((d) => stripMarkdown(d)).join(", ");
  return (
    <>
      <span className="xfv-fila__lee" title={lecturas.map((l) => l.texto).join(" · ")}>
        {lecturas.map((l, i) => (
          <span key={l.tipo} className={l.tecnica ? "is-tecnica" : undefined}>
            {i > 0 ? " · " : ""}
            {l.texto}
          </span>
        ))}
      </span>
      <span className="xfv-fila__dep" title={depende || undefined}>{depende || "—"}</span>
      <span className="xfv-fila__glifos">
        {lecturas.map((l) => <IconoRegla key={l.tipo} tipo={l.tipo} />)}
      </span>
    </>
  );
}

export function VistaListaLogica({ structure, scope, seleccionada, onElegir }: VistaListaLogicaProps) {
  const vista = useMemo(() => vistaListaLogica(structure, scope), [structure, scope]);
  return (
    <div
      className={seleccionada != null ? "xfv has-detalle" : "xfv"}
      data-qa-geometry-group="xlsform/logica-vista-lista"
      data-qa-geometry-contract="intrinsic"
    >
      {vista.grupos.length === 0 ? (
        <p className="xfv-vacio">Este formulario no tiene reglas de cuándo aparece una pregunta ni de qué opciones se muestran.</p>
      ) : (
        <>
          <div className="xfv-cols" aria-hidden="true">
            <span />
            <span>Pregunta</span>
            <span>Condición</span>
            <span>Depende de</span>
            <span />
          </div>
          {vista.grupos.map((g) => (
            <section key={g.id} className="xfv-sec" aria-label={stripMarkdown(g.nombre)}>
              <h3 className="xfv-sec__tit">
                <span className="xfv-sec__letra">{g.letra}</span>
                <span className="xfv-sec__nombre">{stripMarkdown(g.nombre)}</span>
              </h3>
              <ul className="xfv-filas">
                {g.regla && g.rowIndex != null ? (
                  <li>
                    <button
                      type="button"
                      className={seleccionada === g.rowIndex ? "xfv-fila is-seccion is-on" : "xfv-fila is-seccion"}
                      aria-current={seleccionada === g.rowIndex ? "true" : undefined}
                      onClick={() => onElegir(g.rowIndex!)}
                    >
                      <span className="xfv-fila__sello" aria-hidden="true"><Folder size={13} /></span>
                      <span className="xfv-fila__preg">Toda la sección</span>
                      <Lectura lecturas={[g.regla]} />
                    </button>
                  </li>
                ) : null}
                {g.filas.map((f) => (
                  <li key={f.rowIndex}>
                    <button
                      type="button"
                      className={seleccionada === f.rowIndex ? "xfv-fila is-on" : "xfv-fila"}
                      aria-current={seleccionada === f.rowIndex ? "true" : undefined}
                      onClick={() => onElegir(f.rowIndex)}
                    >
                      <span className="xfv-fila__sello"><TypeIcon baseType={f.base} size={13} /></span>
                      <span className="xfv-fila__preg" title={stripMarkdown(f.etiqueta)}>
                        {stripMarkdown(f.etiqueta)}
                        <code>{f.name}</code>
                      </span>
                      <Lectura lecturas={f.lecturas} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {vista.sinLogica > 0 ? (
            <p className="xfv-pie">
              {vista.sinLogica === 1 ? "Otra sección no tiene lógica propia." : `Otras ${vista.sinLogica} secciones no tienen lógica propia.`}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
