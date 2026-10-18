// «Así se ve» (C8): la pregunta como la verá el encuestado o como sale impresa. No es la réplica exacta de la
// plataforma ni del impreso, pero nunca recorta las opciones por la representación: una lista normal sale entera.

import { useState } from "react";
import { Segmented } from "../../kit";
import { TituloLegible } from "../../kit/CuerpoPanelMarca";
import { lecturaRequired } from "../../parsing/parseType";
import type { BuilderNode, ChoiceItem } from "../../types";
import { aparienciaActiva, esSeleccion } from "./modeloFicha";

/** Sólo una lista muy larga (un país, un distrito) se corta; el resto se ve entero. */
const TOPE = 40;

export function VistaPregunta({ node, choices, numero, requiredRaw }: { node: BuilderNode; choices: ChoiceItem[]; numero: number | null; requiredRaw?: string }) {
  const [modo, setModo] = useState<"enc" | "imp">("enc");
  const imp = modo === "imp";
  const base = node.typeInfo.base;
  const apa = aparienciaActiva(base, node.appearance);
  const obligatoria = requiredRaw !== undefined ? lecturaRequired(requiredRaw) === "siempre" : node.required;
  const ops = choices.slice(0, TOPE);
  const resto = choices.length - ops.length;
  const multiple = base === "select_multiple";

  let cuerpo = null;
  if (esSeleccion(base)) {
    if (!choices.length) cuerpo = <p className="xfh-vista__vacio">Sin opciones todavía.</p>;
    else if (!imp && (apa === "minimal" || apa === "autocomplete")) {
      cuerpo = <div className="xfh-vista__desplegable"><span>{apa === "autocomplete" ? "Busca una opción" : "Elige una opción"}</span><span aria-hidden="true">▾</span></div>;
    } else if (!imp && apa === "columns-pack") {
      cuerpo = <div className="xfh-vista__fila">{ops.map((o) => <span key={o.rowIndex}>{o.label || o.name}</span>)}</div>;
    } else {
      cuerpo = (
        <ul className={ops.length > 6 ? "xfh-vista__ops is-cols" : "xfh-vista__ops"}>
          {ops.map((o) => (
            <li key={o.rowIndex}>
              <span className={multiple && !imp ? "xfh-vista__marca is-cuad" : "xfh-vista__marca"} aria-hidden="true" />
              {imp ? <code>{o.name}</code> : null}
              <span>{o.label || o.name}</span>
            </li>
          ))}
        </ul>
      );
    }
  } else if (node.kind !== "note") {
    cuerpo = imp ? <div className="xfh-vista__linea" aria-hidden="true" /> : <div className="xfh-vista__input" aria-hidden="true" />;
  }

  return (
    <section className="xfh-caja xfh-vista" aria-label="Así se ve">
      <div className="xfh-vista__cab">
        <h2>Así se ve</h2>
        <Segmented size="sm" aria-label="Vista" value={modo} onChange={setModo} options={[{ value: "enc", label: "Encuestado" }, { value: "imp", label: "Impreso" }]} />
      </div>
      <div className={imp ? "xfh-hoja is-imp" : "xfh-hoja"}>
        <p className="xfh-hoja__pq">
          {numero != null ? <span className="xfh-hoja__num">{numero}.</span> : null}
          <span>
            <TituloLegible texto={node.label || node.name} />
            {obligatoria && !imp ? <span className="xfh-hoja__oblig" aria-label="obligatoria"> *</span> : null}
          </span>
        </p>
        {node.hint ? <p className="xfh-hoja__ayuda"><TituloLegible texto={node.hint} /></p> : null}
        {cuerpo}
        {resto > 0 ? <p className="xfh-vista__resto">y {resto} opciones más de la lista</p> : null}
      </div>
    </section>
  );
}
