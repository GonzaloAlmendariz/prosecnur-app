// Los bloques de un índice con su puntaje medio y sus casos, y bajo cada uno las
// preguntas que promedia (código y texto). En un bloque suelto, solo sus
// preguntas: su puntaje ya está arriba. Rejilla con roles de tabla. Si el foco
// es un bloque del índice, su fila se marca y se trae a la vista.

import { useEffect, useRef } from "react";

import { formatoConteo, formatoConteoDe, formatoDecimal } from "../../../lib/formatoNumero";
import type { BloqueDeDimension, EntradaDeDimension } from "./modeloDeDimensiones";

function filaDePregunta(codigo: string, etiqueta: string | undefined, columnas: number) {
  return (
    <div key={codigo} role="row" className="dimensiones-fila dimensiones-fila--pregunta">
      <span role="cell" className="dimensiones-pregunta" aria-colspan={columnas > 1 ? columnas : undefined}>
        <code>{codigo}</code>
        <span>{etiqueta || "Sin texto en el formulario"}</span>
      </span>
    </div>
  );
}

function filasDelBloque(bloque: BloqueDeDimension, etiquetas: ReadonlyMap<string, string>, conFila: boolean, enFoco: boolean) {
  const c = bloque.cobertura;
  return (
    // C1: cada bloque mide lo que sus preguntas; las filas no son marcos pares.
    <div
      key={bloque.columna}
      role="rowgroup"
      className="dimensiones-bloque"
      data-foco={enFoco ? "" : undefined}
      data-qa-geometry-group="analitica/dimensiones-bloque"
      data-qa-geometry-contract="intrinsic"
    >
      {conFila ? (
        <div role="row" className="dimensiones-fila dimensiones-fila--bloque" aria-current={enFoco ? "true" : undefined}>
          <span role="rowheader" className="dimensiones-bloque-nombre">
            <b>{bloque.etiqueta}</b>
            <small>{formatoConteoDe(bloque.preguntas.length, "pregunta", "preguntas")}</small>
          </span>
          <span role="cell" className="dimensiones-num dimensiones-puntaje"><b>{c ? formatoDecimal(c.media, 1) : "Sin puntaje"}</b></span>
          <span role="cell" className="dimensiones-num dimensiones-casos">{c ? formatoConteo(c.n_validos) : ""}</span>
        </div>
      ) : null}
      {bloque.preguntas.map((p) => filaDePregunta(p, etiquetas.get(p), conFila ? 3 : 1))}
    </div>
  );
}

export function TablaDeBloques({ entrada, etiquetas, foco }: {
  entrada: EntradaDeDimension;
  etiquetas: ReadonlyMap<string, string>;
  /** La columna pedida en `?foco=`; si es un bloque de este índice, se marca. */
  foco: string | null;
}) {
  const conBloques = entrada.tipo === "indice";
  const tablaRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    tablaRef.current?.querySelector<HTMLElement>(".dimensiones-bloque[data-foco]")?.scrollIntoView?.({ block: "nearest" });
  }, [foco, entrada.columna]);
  return (
    <div
      ref={tablaRef}
      role="table"
      className="dimensiones-tabla"
      data-con-bloques={conBloques ? "" : undefined}
      aria-label={conBloques ? `Bloques y preguntas de ${entrada.etiqueta}` : `Preguntas de ${entrada.etiqueta}`}
      data-qa-geometry-group="analitica/dimensiones-tabla"
      data-qa-geometry-contract="intrinsic"
    >
      <div role="rowgroup">
        <div role="row" className="dimensiones-fila dimensiones-fila--cabeza">
          <span role="columnheader">{conBloques ? "Bloque y preguntas" : "Pregunta"}</span>
          {conBloques ? <span role="columnheader" className="dimensiones-num dimensiones-puntaje">Puntaje</span> : null}
          {conBloques ? <span role="columnheader" className="dimensiones-num dimensiones-casos">Casos</span> : null}
        </div>
      </div>
      {entrada.bloques.map((b) => filasDelBloque(b, etiquetas, conBloques, conBloques && b.columna === foco))}
    </div>
  );
}
