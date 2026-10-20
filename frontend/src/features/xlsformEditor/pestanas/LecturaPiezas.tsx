import type { ReactNode } from "react";
import { stripMarkdown } from "../helpers/markdown";
import type { Pieza } from "../reglas/piezas";
import { espacioAntes, etiquetaPlana, type EtiquetaDe } from "./variablesLegibles";

// La lectura de una regla en las pestañas: cada pregunta u opción por su etiqueta y, sin ella, por su código.
// El espacio entre piezas se decide aquí para no dejar «es 1 , vale» ni «( algo».

export function VariableLegible({ etiqueta, codigo, etiquetaDe }: { etiqueta: string; codigo: string; etiquetaDe?: EtiquetaDe }) {
  const plana = etiquetaPlana(etiqueta, etiquetaDe);
  return plana ? <span className="xfp-var" title={codigo}>{plana}</span> : <code className="xfp-var is-codigo">{codigo}</code>;
}

export function LecturaPiezas({ piezas, etiquetaDe }: { piezas: readonly Pieza[]; etiquetaDe?: EtiquetaDe }) {
  return (
    <>
      {piezas.map((p, i) => {
        const sep = espacioAntes(piezas[i - 1], p) ? " " : "";
        if (p.tipo === "pregunta") return <span key={i}>{sep}<VariableLegible etiqueta={p.etiqueta} codigo={p.name} etiquetaDe={etiquetaDe} /></span>;
        if (p.tipo === "opcion") return <span key={i}>{sep}<VariableLegible etiqueta={p.etiqueta} codigo={p.valor} etiquetaDe={etiquetaDe} /></span>;
        return <span key={i}>{sep}{p.texto}</span>;
      })}
    </>
  );
}

/** Una etiqueta con `${x}` dentro: cada referencia por la etiqueta de x o, si no tiene, por su código en <code>. */
export function EtiquetaLegible({ texto, etiquetaDe }: { texto: string; etiquetaDe?: EtiquetaDe }) {
  const limpio = stripMarkdown(texto).replace(/\s+/g, " ").trim();
  const partes: ReactNode[] = [];
  let desde = 0;
  for (const m of limpio.matchAll(/\$\{\s*([^}\s]+)\s*\}/g)) {
    const i = m.index ?? 0;
    if (i > desde) partes.push(limpio.slice(desde, i));
    const plana = etiquetaPlana(etiquetaDe?.(m[1]!) ?? "", etiquetaDe);
    partes.push(plana ? <span key={i}>{plana}</span> : <code key={i} className="xfp-var is-codigo">{m[1]}</code>);
    desde = i + m[0].length;
  }
  if (desde < limpio.length) partes.push(limpio.slice(desde));
  return <>{partes}</>;
}
