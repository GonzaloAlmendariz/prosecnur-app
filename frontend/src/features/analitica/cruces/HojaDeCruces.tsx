// La tabla cruzada de la pregunta elegida tal como la devuelve la vista
// previa: con todas las variables de cruce lado a lado, como el archivo, y la
// leyenda de las letras dicha una vez al final.
//
// La hoja mide lo que la tabla con todas sus columnas: el cuerpo del panel la
// desplaza a lo ancho y a lo alto (un solo dueño de scroll), con la primera
// columna y el Total fijos, y lo que no es tabla (título, notas, leyenda) queda
// fijo a la izquierda.

import { useMemo, type CSSProperties } from "react";

import type { CrucesPreviewTabla } from "../../../api/analitica";
import type { ModoDeCifras } from "../tablas/vistaDeTablasStore";
import { columnasDeCifras, lineasDeLeyenda } from "./crucesModelo";
import { TablaCruzada } from "./TablaCruzada";

export function HojaDeCruces({ tabla, ponderado, cifras = "porcentaje", releyendo = false, maxLetras = 6 }: {
  tabla: CrucesPreviewTabla;
  ponderado: boolean;
  /** Qué cifras se leen en cada celda. */
  cifras?: ModoDeCifras;
  /** Lo que se ve es de una lectura anterior o espera a que se guarde un cambio. */
  releyendo?: boolean;
  /** Con más columnas que esto, la regla compara cada una frente al resto (`significancia_regla.max_letras`). */
  maxLetras?: number;
}) {
  // La nota de letras de la tabla va en la leyenda, una vez, y no se repite en su pie.
  const nota = tabla.significancia?.nota ?? null;
  const estilo = { "--cruces-max": columnasDeCifras(tabla.cruces) } as CSSProperties;
  const leyenda = useMemo(
    () => lineasDeLeyenda(tabla.cruces, ponderado, nota, maxLetras, { conPorcentaje: false }),
    [tabla.cruces, ponderado, nota, maxLetras],
  );

  return (
    <div
      className="cruces-hoja"
      style={estilo}
      // C1: la tabla y la leyenda, cada una con el alto de su contenido.
      data-qa-geometry-group="analitica/cruces-hoja"
      data-qa-geometry-contract="intrinsic"
      aria-busy={releyendo || undefined}
      data-releyendo={releyendo ? "" : undefined}
    >
      <TablaCruzada tabla={tabla} cruces={tabla.cruces} ponderado={ponderado} notaComun={nota} cifras={cifras} />
      {leyenda.length > 0 ? (
        <div className="cruces-fijo cruces-leyenda">
          {leyenda.map((linea) => <p key={linea}>{linea}</p>)}
        </div>
      ) : null}
    </div>
  );
}
