// La tabla de frecuencias de la pregunta elegida, tal como la devuelve la
// vista previa: su título con el código, sobre quiénes va el porcentaje, la
// tabla (una fila por opción con su barra, sus casos y su porcentaje, y el
// total) o el resumen de la numérica, y debajo la base y las notas al pie.
//
// La tabla es una rejilla con roles de tabla y no un `<table>` ni
// `PulsoTable`: sus columnas se reparten el ancho del contenedor, las
// etiquetas largas parten en dos renglones y la barra ocupa su propia columna.
// Las columnas de casos y de porcentaje se ven según el conmutador de cifras.

import { useId } from "react";

import type { FrecuenciasPreviewTabla } from "../../../api/analitica";
import { GrupoDeFrecuencia } from "./GrupoDeFrecuencia";
import { ResumenNumerico } from "./ResumenNumerico";
import { cabeceraDeCasos, codigoDeLaTabla, textoDeBase, textoDelPorcentaje } from "./vistaPreviaModelo";
import { seVenCasos, seVePorcentaje, type ModoDeCifras } from "./vistaDeTablasStore";

export function HojaDeFrecuencias({ tabla, ponderado, cifras = "ambos", releyendo = false }: {
  tabla: FrecuenciasPreviewTabla;
  /** Las cifras de las filas son sumas de pesos (`preview.ponderado`). */
  ponderado: boolean;
  /** Qué cifras se leen: casos, porcentaje o los dos. */
  cifras?: ModoDeCifras;
  /** Lo que se ve es de una lectura anterior o espera a que se guarde un cambio. */
  releyendo?: boolean;
}) {
  const idTitulo = useId();
  const numerica = tabla.tipo === "numerica";
  const conFilas = !numerica && !tabla.sin_datos && tabla.filas.length > 0;
  const codigo = codigoDeLaTabla(tabla);
  const base = numerica ? undefined : textoDeBase(tabla.base);
  return (
    <article
      className="tablas-grupo"
      aria-labelledby={idTitulo}
      data-variable={tabla.variable}
      data-origen={tabla.variable_origen ?? undefined}
      data-forma={tabla.tipo}
      aria-busy={releyendo || undefined}
      data-releyendo={releyendo ? "" : undefined}
    >
      <header className="tablas-grupo-titulo">
        <h3 id={idTitulo}>
          {codigo !== tabla.etiqueta ? <><code className="tablas-grupo-codigo">{codigo}</code>{" "}</> : null}
          {tabla.etiqueta}
        </h3>
        {tabla.sin_datos ? null : <p>{textoDelPorcentaje(tabla, ponderado)}</p>}
      </header>

      {tabla.sin_datos ? <p className="tablas-grupo-vacio">Sin datos</p> : null}

      {conFilas ? (
        <div
          className="tablas-hoja"
          role="table"
          aria-labelledby={idTitulo}
          data-cifras={cifras}
          // C1: la tabla se declara una vez aquí, nunca por fila o celda; sus
          // filas son maquetado de tabla, que la gramática deja fuera de la inferencia.
          data-qa-geometry-group="analitica/frecuencias-hoja"
          data-qa-geometry-contract="intrinsic"
          data-qa-geometry-exento="filas y celdas de una tabla con roles"
        >
          <div className="tablas-hoja-cabecera" role="rowgroup">
            <div role="row">
              <span role="columnheader">Respuesta</span>
              <span role="columnheader"><span className="pulso-sr-only">Distribución</span></span>
              {/* Con pesos las cifras son sumas de pesos; la base de la tabla va en casos sin ponderar. */}
              {seVenCasos(cifras) ? <span className="tablas-cifra" role="columnheader">{cabeceraDeCasos(ponderado)}</span> : null}
              {seVePorcentaje(cifras) ? <span className="tablas-cifra" role="columnheader">%</span> : null}
            </div>
          </div>
          <GrupoDeFrecuencia tabla={tabla} cifras={cifras} />
        </div>
      ) : null}

      {numerica && !tabla.sin_datos ? <ResumenNumerico resumen={tabla.resumen} base={tabla.base} /> : null}

      {base || tabla.notas.length > 0 ? (
        <p className="tablas-grupo-pie">
          {base ? <span>{base}</span> : null}
          {tabla.notas.map((linea, i) => <span key={`${i}/${linea}`}>{linea}</span>)}
        </p>
      ) : null}
    </article>
  );
}
