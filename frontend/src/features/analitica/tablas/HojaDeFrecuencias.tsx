// La hoja de frecuencias tal como la devuelve la vista previa: una tabla por
// variable, en el orden del archivo, agrupadas por sección, con una sola
// cabecera de columnas que se queda arriba al desplazar.
//
// Es una rejilla con roles de tabla y no un `<table>` ni `PulsoTable`, igual
// que la tabla de metas de Ponderación: sus filas van agrupadas por variable,
// llevan título, barra y notas a todo el ancho, las etiquetas largas parten en
// dos renglones y las columnas se reparten el ancho del contenedor. PulsoTable
// es para filas planas de una línea con ancho declarado y scroll propio.

import { Fragment, useMemo } from "react";

import type { FrecuenciasPreviewTabla } from "../../../api/analitica";
import { COLUMNAS_DE_LA_HOJA, GrupoDeFrecuencia } from "./GrupoDeFrecuencia";
import { cabeceraDeCasos, esLaVariable, seccionesDeLaHoja } from "./vistaPreviaModelo";

export function HojaDeFrecuencias({ tablas, elegida, ponderado, aparte, releyendo = false }: {
  tablas: readonly FrecuenciasPreviewTabla[];
  /** La variable a la que se saltó (`?foco=`). */
  elegida: string | null;
  /** Las cifras de las filas son sumas de pesos (`preview.ponderado`). */
  ponderado: boolean;
  /** La tabla de la pregunta elegida cuando no está entre las primeras de la hoja. */
  aparte?: FrecuenciasPreviewTabla | null;
  /** Lo que se ve es de una lectura anterior o espera a que se guarde un cambio. */
  releyendo?: boolean;
}) {
  const secciones = useMemo(() => seccionesDeLaHoja(tablas), [tablas]);
  const marcada = (t: FrecuenciasPreviewTabla) => elegida !== null && esLaVariable(t, elegida);

  return (
    <div
      className="tablas-hoja"
      role="table"
      aria-label="Tablas de frecuencias del archivo"
      // C1: la hoja es una tabla. Se declara una vez aquí, nunca por fila o celda;
      // sus filas son maquetado de tabla, que la gramática deja fuera de la inferencia.
      data-qa-geometry-group="analitica/frecuencias-hoja"
      data-qa-geometry-contract="intrinsic"
      data-qa-geometry-exento="filas y celdas de una tabla con roles"
      aria-busy={releyendo || undefined}
      data-releyendo={releyendo ? "" : undefined}
    >
      <div className="tablas-hoja-cabecera" role="rowgroup">
        <div role="row">
          <span role="columnheader">Categoría</span>
          <span role="columnheader"><span className="pulso-sr-only">Distribución</span></span>
          {/* Con pesos las cifras son sumas de pesos; la base de cada tabla va en casos sin ponderar. */}
          <span className="tablas-cifra" role="columnheader">{cabeceraDeCasos(ponderado)}</span>
          <span className="tablas-cifra" role="columnheader">%</span>
        </div>
      </div>
      {secciones.map((seccion) => (
        <Fragment key={seccion.clave}>
          {seccion.nombre ? (
            <div className="tablas-seccion-de-hoja" role="rowgroup" data-en-archivo={seccion.enElArchivo ? "" : undefined}>
              <div role="row">
                <span role="rowheader" aria-colspan={COLUMNAS_DE_LA_HOJA}>{seccion.nombre}</span>
              </div>
            </div>
          ) : null}
          {/* La clave lleva la sección y la posición: una variable puede salir en dos secciones. */}
          {seccion.tablas.map((tabla, i) => (
            <GrupoDeFrecuencia key={`${seccion.clave}/${i}/${tabla.variable}`} tabla={tabla} elegida={marcada(tabla)} ponderado={ponderado} />
          ))}
        </Fragment>
      ))}
      {aparte ? (
        <>
          <div className="tablas-seccion-de-hoja" role="rowgroup">
            <div role="row">
              <span role="rowheader" aria-colspan={COLUMNAS_DE_LA_HOJA}>Pregunta elegida</span>
            </div>
          </div>
          <GrupoDeFrecuencia tabla={aparte} elegida ponderado={ponderado} />
        </>
      ) : null}
    </div>
  );
}
