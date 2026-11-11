// La tabla de una variable dentro de la hoja, tal como la devuelve la vista
// previa: su título, una fila por opción, el total y las notas al pie. Las
// cifras se pintan como llegan; aquí solo se formatean. La opción se lee por
// su etiqueta; el código va delante como dato secundario y, si el motor no lo
// pudo recuperar, no se inventa.

import { memo, type CSSProperties } from "react";

import type { FrecuenciasPreviewTabla } from "../../../api/analitica";
import { BloquePregunta } from "../../../components/procesamiento/BloquePregunta";
import { ResumenNumerico } from "./ResumenNumerico";
import { codigoDeLaTabla, rotuloDelTotal, textoCasos, textoDeBase, textoPorcentaje } from "./vistaPreviaModelo";

/** Las columnas de la hoja: opción, barra, casos y porcentaje. */
export const COLUMNAS_DE_LA_HOJA = 4;

/** Una línea de texto a todo el ancho de la tabla. */
function filaDeNota(texto: string, clase = "tablas-grupo-nota") {
  return (
    <div className={clase} role="row">
      <span role="cell" aria-colspan={COLUMNAS_DE_LA_HOJA}>{texto}</span>
    </div>
  );
}

export const GrupoDeFrecuencia = memo(function GrupoDeFrecuencia({ tabla, elegida, ponderado }: {
  tabla: FrecuenciasPreviewTabla;
  elegida: boolean;
  /** Las cifras de las filas son sumas de pesos. */
  ponderado: boolean;
}) {
  const numerica = tabla.tipo === "numerica";
  const conFilas = !numerica && tabla.filas.length > 0;
  return (
    <div
      className="tablas-grupo"
      role="rowgroup"
      aria-label={tabla.etiqueta}
      data-variable={tabla.variable}
      data-origen={tabla.variable_origen ?? undefined}
      data-forma={tabla.tipo}
      aria-current={elegida ? "true" : undefined}
    >
      <div className="tablas-grupo-titulo" role="row">
        <span role="rowheader" aria-colspan={COLUMNAS_DE_LA_HOJA}>
          <BloquePregunta
            tipo={tabla.tipo}
            codigo={codigoDeLaTabla(tabla)}
            etiqueta={tabla.etiqueta}
            // La numérica dice su base dentro del resumen, junto a "Casos válidos".
            detalle={numerica ? undefined : textoDeBase(tabla.base, ponderado)}
            ancho="completo"
          />
        </span>
      </div>
      {tabla.sin_datos ? filaDeNota("Sin datos") : null}
      {conFilas ? tabla.filas.map((fila, i) => (
        <div
          // El código es la llave; sin código, la posición en la respuesta (el motor no repite rótulos).
          key={fila.codigo ?? `#${i}`}
          className={`tablas-fila${fila.especial ? " is-especial" : ""}`}
          role="row"
          data-categoria={fila.codigo ?? undefined}
        >
          <span className="tablas-categoria" role="rowheader">
            {fila.codigo !== null && fila.codigo !== fila.etiqueta ? (
              <code className="tablas-codigo" title="Código en la base">{fila.codigo}</code>
            ) : null}
            {fila.etiqueta}
          </span>
          <span className="tablas-barra-celda" role="cell" aria-hidden="true">
            {fila.n > 0 && fila.pct !== null ? (
              <i className="tablas-barra" style={{ "--tablas-barra": `${Math.min(1, Math.max(0, fila.pct)) * 100}%` } as CSSProperties} />
            ) : null}
          </span>
          <span className="tablas-cifra" role="cell">{textoCasos(fila.n)}</span>
          <span className="tablas-cifra is-porcentaje" role="cell">{textoPorcentaje(fila.pct)}</span>
        </div>
      )) : null}
      {conFilas && tabla.total.n !== null ? (
        <div className="tablas-fila tablas-total" role="row">
          <span className="tablas-categoria" role="rowheader">{rotuloDelTotal(tabla)}</span>
          <span role="cell" aria-hidden="true" />
          <span className="tablas-cifra" role="cell">{textoCasos(tabla.total.n)}</span>
          <span className="tablas-cifra is-porcentaje" role="cell">{textoPorcentaje(tabla.total.pct)}</span>
        </div>
      ) : null}
      {numerica && !tabla.sin_datos ? (
        <div className="tablas-resumen" role="row">
          <span role="cell" aria-colspan={COLUMNAS_DE_LA_HOJA}>
            <ResumenNumerico resumen={tabla.resumen} base={tabla.base} />
          </span>
        </div>
      ) : null}
      {tabla.notas.length > 0 ? (
        <div className="tablas-grupo-pie" role="row">
          <span role="cell" aria-colspan={COLUMNAS_DE_LA_HOJA}>
            {tabla.notas.map((linea, i) => <span key={`${i}/${linea}`}>{linea}</span>)}
          </span>
        </div>
      ) : null}
    </div>
  );
});
