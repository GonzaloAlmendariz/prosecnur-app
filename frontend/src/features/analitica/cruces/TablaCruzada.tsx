// La tabla cruzada de una pregunta, tal como la devuelve la vista previa: su
// título y sobre quiénes va el porcentaje, una cabecera de dos niveles (cada
// variable de cruce, lado a lado como en el archivo, y sus categorías con su
// letra), una fila por categoría de la pregunta con el Total (con su barra) y
// el porcentaje de cada columna con sus letras, los N y, con pesos, las bases.
// Según el conmutador de cifras, cada celda dice su porcentaje, su N o los dos.
//
// Cada celda se busca por el código de su fila (`celdas[].fila`), nunca por su
// posición. Las cifras se pintan como llegan; aquí solo se formatean.
//
// Es una rejilla con roles de tabla, no un `<table>`: la primera columna y la
// del Total quedan fijas al desplazar a lo ancho y la cabecera se queda arriba
// mientras la tabla está a la vista. El título y las notas quedan fijos a la izquierda.

import { memo, useId, type CSSProperties } from "react";

import type { CrucesPreviewCruce, CrucesPreviewTabla } from "../../../api/analitica";
import { formatoConteo } from "../../../lib/formatoNumero";
import { anchoDeBarra } from "../tablas/GrupoDeFrecuencia";
import { textoCasos } from "../tablas/vistaPreviaModelo";
import { seVenCasos, seVePorcentaje, type ModoDeCifras } from "../tablas/vistaDeTablasStore";
import {
  celdasPorFila, claseDeLetras, TABLA_SIN_RESPUESTAS, columnasDeCifras, conLetraDeColumna, notasDeLaTabla, porcentajeDeCelda, rotuloDeBase, rotuloDeN, textoDeBaseDeCruce,
  textoDelPorcentajeDeCruce,
} from "./crucesModelo";

/** Deja partir un rótulo después de cada barra ("Metropolitano/SIT/Tren"), en vez de cortarlo en cualquier letra. */
function partible(rotulo: string): string {
  return rotulo.replace(/\//g, "/\u200b");
}

function Celda({ celda, letras, columna, cifras, inicio = false, excluida = false, conBarra = false }: {
  /** `undefined`: el servicio no trae celda para esta fila. */
  celda: { n: number | null; pct: number | null } | undefined;
  letras?: string | null;
  columna: string;
  /** Qué cifras se leen: el porcentaje (con sus letras), el N o los dos. */
  cifras: ModoDeCifras;
  /** Primera columna de una variable de cruce: lleva la línea que la separa de la anterior. */
  inicio?: boolean;
  excluida?: boolean;
  /** La columna del Total lleva la barra de su porcentaje. */
  conBarra?: boolean;
}) {
  const marcas = { "data-columna": columna, "data-inicio": inicio ? "" : undefined, "data-excluida": excluida ? "" : undefined };
  // Una celda que el servicio no trae para esta fila no se rellena con otra.
  if (celda === undefined) return <span className="cruces-cifra is-sin-dato" role="cell" {...marcas}>Sin dato</span>;
  const clase = seVePorcentaje(cifras) ? claseDeLetras(letras ?? null) : null;
  return (
    <span className="cruces-cifra" role="cell" {...marcas}>
      {/* La barra va al lado de su cifra, en el mismo renglón, como en el prototipo. */}
      {seVePorcentaje(cifras) ? (
        <span className="cruces-linea">
          {conBarra && (celda.n ?? 0) > 0 && celda.pct !== null ? (
            <i className="cruces-barra" aria-hidden="true" style={{ "--cruces-barra": anchoDeBarra(celda.pct) } as CSSProperties} />
          ) : null}
          <span className="cruces-pct">{porcentajeDeCelda(celda.pct)}</span>
        </span>
      ) : null}
      {/* El espacio separa la cifra de sus letras también para quien la escucha. */}
      {clase ? <>{" "}<span className="cruces-letras" data-clase={clase}>{letras}</span></> : null}
      {seVenCasos(cifras) ? <>{" "}<span className="cruces-n">{textoCasos(celda.n)}</span></> : null}
    </span>
  );
}

export const TablaCruzada = memo(function TablaCruzada({ tabla, cruces, ponderado, notaComun, cifras = "porcentaje" }: {
  tabla: CrucesPreviewTabla;
  /** Las variables de cruce que se ven, en el orden del archivo. */
  cruces: readonly CrucesPreviewCruce[];
  /** Las cifras de las celdas son sumas de pesos (`preview.ponderado`). */
  ponderado: boolean;
  /** La nota de letras que la hoja ya dice una vez al final. */
  notaComun: string | null;
  /** Qué cifras se leen en cada celda. */
  cifras?: ModoDeCifras;
}) {
  const idTitulo = useId();
  const notas = notasDeLaTabla(tabla, cruces, notaComun);
  const base = textoDeBaseDeCruce(tabla);
  const total = tabla.total;
  const totales = celdasPorFila(total?.celdas ?? []);
  const porColumna = cruces.map((c) => ({
    cruce: c,
    columnas: c.columnas.map((col) => ({ columna: col, celdas: celdasPorFila(col.celdas) })),
  }));
  // La primera columna y la del Total tienen ancho propio; las de las variables de cruce se reparten el resto.
  const estilo = { "--cruces-columnas-de-cruce": Math.max(1, columnasDeCifras(cruces) - 1) } as CSSProperties;

  return (
    <article
      className="cruces-tabla"
      aria-labelledby={idTitulo}
      data-variable={tabla.variable}
      data-forma={tabla.tipo}
      data-cifras={cifras}
    >
      <header className="cruces-fijo cruces-tabla-titulo">
        <h3 id={idTitulo}>
          {tabla.variable !== tabla.etiqueta ? <><code className="tablas-grupo-codigo">{tabla.variable}</code>{" "}</> : null}
          {tabla.etiqueta}
        </h3>
        {tabla.sin_datos ? null : <p>{textoDelPorcentajeDeCruce(tabla, ponderado)}</p>}
      </header>
      {tabla.sin_datos || !total ? (
        <p className="cruces-fijo cruces-nota">Sin datos válidos para cruzar.</p>
      ) : tabla.sin_respuestas ? (
        // Base 0: el vacío de la tabla en lugar de una grilla de celdas vacías.
        <p className="cruces-fijo cruces-vacio-tabla">{TABLA_SIN_RESPUESTAS}</p>
      ) : (
        // C1: la rejilla es una tabla. Se declara una vez aquí, nunca por fila o celda;
        // sus filas son maquetado de tabla, que la gramática deja fuera de la inferencia.
        <div
          className="cruces-rejilla"
          role="table"
          aria-labelledby={idTitulo}
          style={estilo}
          data-qa-geometry-group="analitica/cruces-tabla"
          data-qa-geometry-contract="intrinsic"
          data-qa-geometry-exento="filas y celdas de una tabla con roles"
        >
          <div className="cruces-cabecera" role="rowgroup">
            <div className="cruces-fila cruces-fila--variables" role="row">
              <span className="cruces-primera" role="columnheader"><span className="pulso-sr-only">Variable de cruce</span></span>
              <span className="cruces-total" role="columnheader"><span className="pulso-sr-only">Total</span></span>
              {cruces.map((c) => (
                <span
                  key={c.variable}
                  className="cruces-variable"
                  role="columnheader"
                  aria-colspan={c.columnas.length}
                  style={{ gridColumn: `span ${Math.max(1, c.columnas.length)}` }}
                  title={c.etiqueta}
                >
                  {/* El rótulo se queda a la vista al desplazar a lo ancho, junto a la primera columna. */}
                  <span className="cruces-variable-texto">{partible(c.etiqueta)}</span>
                </span>
              ))}
            </div>
            <div className="cruces-fila cruces-fila--categorias" role="row">
              <span className="cruces-primera" role="columnheader"><span className="pulso-sr-only">Respuesta</span></span>
              <span className="cruces-columna cruces-total" role="columnheader">Total</span>
              {porColumna.flatMap(({ cruce, columnas }) => columnas.map(({ columna }, k) => (
                <span
                  key={`${cruce.variable}/${columna.codigo}`}
                  className="cruces-columna"
                  role="columnheader"
                  data-columna={columna.codigo}
                  data-inicio={k === 0 ? "" : undefined}
                  data-excluida={columna.excluida && columna.exclusion_aplicada ? "" : undefined}
                  title={`Código ${columna.codigo}`}
                >
                  <span className="cruces-columna-etiqueta">{partible(columna.etiqueta)}</span>
                  {columna.letra && conLetraDeColumna(cruce) ? <span className="cruces-letra">{columna.letra}</span> : null}
                  {columna.excluida && columna.exclusion_aplicada ? <span className="cruces-marca">Excluida</span> : null}
                  {columna.excluida && !columna.exclusion_aplicada ? (
                    <span className="cruces-marca" title="La base guarda otro valor que el excluido; la exclusión no quitó casos">Excluida sin efecto</span>
                  ) : null}
                </span>
              )))}
            </div>
          </div>
          <div role="rowgroup">
            {tabla.filas.map((fila) => {
              const delTotal = totales.get(fila.codigo);
              return (
              <div
                key={fila.codigo}
                className="cruces-fila"
                role="row"
                data-categoria={fila.codigo}
                data-probada={fila.probada === false ? "no" : undefined}
              >
                <span className="cruces-primera" role="rowheader" title={fila.codigo !== fila.etiqueta ? `Código ${fila.codigo}` : undefined}>
                  <span className="cruces-categoria">{fila.etiqueta}</span>
                  {fila.probada === false ? <span className="cruces-marca" title="La fila no entra a la prueba de letras">No se compara</span> : null}
                </span>
                <Celda celda={delTotal} columna="total" cifras={cifras} conBarra />
                {porColumna.flatMap(({ cruce, columnas }) => columnas.map(({ columna, celdas }, k) => {
                  const celda = celdas.get(fila.codigo);
                  return (
                    <Celda
                      key={`${cruce.variable}/${columna.codigo}`}
                      celda={celda}
                      cifras={cifras}
                      letras={celda?.letras}
                      columna={columna.codigo}
                      inicio={k === 0}
                      excluida={columna.excluida && columna.exclusion_aplicada}
                    />
                  );
                }))}
              </div>
              );
            })}
          </div>
          {/* Con pesos, la base sin ponderar va primero y es la cifra de referencia (regla I1); el N ponderado,
              debajo. Sin pesos el N es la misma base y va una sola fila. */}
          <div className="cruces-pie-cifras" role="rowgroup">
            {ponderado ? (
              <div className="cruces-fila cruces-fila--base" role="row">
                <span className="cruces-primera" role="rowheader" title="La fila de base es de la vista previa; el archivo trae el N ponderado.">
                  {rotuloDeBase(tabla.base.unidad)}
                </span>
                <span className="cruces-cifra cruces-total" role="cell" data-columna="total">{formatoConteo(total.base_n)}</span>
                {porColumna.flatMap(({ cruce, columnas }) => columnas.map(({ columna }, k) => (
                  <span key={`${cruce.variable}/${columna.codigo}`} className="cruces-cifra" role="cell" data-columna={columna.codigo} data-inicio={k === 0 ? "" : undefined}>
                    {formatoConteo(columna.base_n)}
                  </span>
                )))}
              </div>
            ) : null}
            <div className="cruces-fila cruces-fila--n" role="row" data-ponderado={ponderado ? "" : undefined}>
              <span className="cruces-primera" role="rowheader">{rotuloDeN(ponderado, tabla.base.unidad)}</span>
              <span className="cruces-cifra cruces-total" role="cell" data-columna="total">{textoCasos(total.n)}</span>
              {porColumna.flatMap(({ cruce, columnas }) => columnas.map(({ columna }, k) => (
                <span key={`${cruce.variable}/${columna.codigo}`} className="cruces-cifra" role="cell" data-columna={columna.codigo} data-inicio={k === 0 ? "" : undefined}>
                  {textoCasos(columna.n)}
                </span>
              )))}
            </div>
          </div>
        </div>
      )}
      {base || notas.length > 0 ? (
        <p className="cruces-fijo cruces-nota">
          {base ? <span>{base}</span> : null}
          {notas.map((linea, i) => <span key={`${i}/${linea}`}>{linea}</span>)}
        </p>
      ) : null}
    </article>
  );
});
