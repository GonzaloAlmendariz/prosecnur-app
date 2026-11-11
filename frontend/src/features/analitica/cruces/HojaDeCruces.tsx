// La hoja de cruces tal como la devuelve la vista previa: una tabla cruzada por
// pregunta, en el orden del archivo y agrupadas por sección, con la leyenda de
// las letras dicha una vez al final.
//
// La hoja mide lo que la tabla más ancha con las columnas que se ven: el cuerpo
// del panel la desplaza a lo ancho y a lo alto (un solo dueño de scroll), y lo
// que no es tabla (sección, título, notas) queda fijo a la izquierda.

import { Fragment, useMemo, type CSSProperties } from "react";

import type { CrucesPreviewTabla } from "../../../api/analitica";
import { columnasDeCifras, crucesALaVista, lineasDeLeyenda, notaComun, seccionesDeCruces } from "./crucesModelo";
import { TablaCruzada } from "./TablaCruzada";

export function HojaDeCruces({ tablas, ponderado, cruce, elegida, aparte, releyendo = false, maxLetras = 6 }: {
  tablas: readonly CrucesPreviewTabla[];
  ponderado: boolean;
  /** La variable de cruce que se ve, o `TODAS_LAS_VARIABLES`. */
  cruce: string;
  /** La pregunta a la que se saltó (`?foco=`). */
  elegida: string | null;
  /** La tabla de la pregunta elegida cuando no está entre las primeras de la hoja. */
  aparte?: CrucesPreviewTabla | null;
  /** Lo que se ve es de una lectura anterior o espera a que se guarde un cambio. */
  releyendo?: boolean;
  /** Con más columnas que esto, la regla compara cada una frente al resto (`significancia_regla.max_letras`). */
  maxLetras?: number;
}) {
  const todas = useMemo(() => (aparte ? [...tablas, aparte] : [...tablas]), [tablas, aparte]);
  const secciones = useMemo(() => seccionesDeCruces(tablas), [tablas]);
  const comun = useMemo(() => notaComun(todas), [todas]);
  // La hoja tiene el ancho de la tabla con más columnas a la vista.
  const columnas = Math.max(1, ...todas.map((t) => columnasDeCifras(crucesALaVista(t, cruce))));
  const estilo = { "--cruces-max": columnas } as CSSProperties;
  const leyenda = lineasDeLeyenda(todas.flatMap((t) => crucesALaVista(t, cruce)), ponderado, comun, maxLetras);

  return (
    <div
      className="cruces-hoja"
      style={estilo}
      // C1: secciones, tablas y leyenda, cada una con el alto de su contenido.
      data-qa-geometry-group="analitica/cruces-hoja"
      data-qa-geometry-contract="intrinsic"
      aria-busy={releyendo || undefined}
      data-releyendo={releyendo ? "" : undefined}
    >
      {secciones.map((seccion) => (
        <Fragment key={seccion.clave}>
          {seccion.nombre ? (
            <h3 className="cruces-fijo cruces-seccion" data-en-archivo={seccion.enElArchivo ? "" : undefined}>{seccion.nombre}</h3>
          ) : null}
          {seccion.tablas.map((tabla, i) => (
            <TablaCruzada
              key={`${seccion.clave}/${i}/${tabla.variable}`}
              tabla={tabla}
              cruces={crucesALaVista(tabla, cruce)}
              ponderado={ponderado}
              elegida={elegida !== null && tabla.variable === elegida}
              notaComun={comun}
            />
          ))}
        </Fragment>
      ))}
      {aparte ? (
        <>
          <h3 className="cruces-fijo cruces-seccion">Pregunta elegida</h3>
          <TablaCruzada tabla={aparte} cruces={crucesALaVista(aparte, cruce)} ponderado={ponderado} elegida notaComun={comun} />
        </>
      ) : null}
      {/* La leyenda de las letras, una vez, al final: arriba le quitaba a la tabla el alto de una ventana baja. */}
      <div className="cruces-fijo cruces-leyenda">
        {leyenda.map((linea) => <p key={linea}>{linea}</p>)}
      </div>
    </div>
  );
}
