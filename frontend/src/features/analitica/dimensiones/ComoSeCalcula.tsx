// "Cómo se calcula" (prototipo, Analítica › Dimensiones): las reglas con las que
// el motor arma el puntaje de lo elegido. Las reglas son las de
// `reporte_dimensiones()` y `reporte_dimensiones_indices()`: las categorías se
// reparten de 0 a 100 en el orden de la lista, los códigos sin respuesta quedan
// fuera y cada nivel es el promedio simple del anterior con lo que haya.

import { PanelDeMesa } from "../../../components/procesamiento/PanelDeMesa";
import { enumerar } from "../../../lib/enumerar";
import type { DimensionesConfig } from "../store";
import type { EntradaDeDimension } from "./modeloDeDimensiones";

export function ComoSeCalcula({ entrada, listas, dim }: {
  entrada: EntradaDeDimension | null;
  /** Las listas de respuesta de sus preguntas; null si no se pudieron leer. */
  listas: readonly string[] | null;
  dim: DimensionesConfig;
}) {
  const noCuentan = [
    // El motor acepta también una lista por lista de respuesta; aquí se lee la global.
    ...(Array.isArray(dim.codigos_missing) ? dim.codigos_missing : []),
    ...(listas ?? []).flatMap((l) => dim.codigos_no_aplica[l] ?? []),
  ];
  const sinRespuesta = [...new Set(noCuentan)];
  return (
    <PanelDeMesa zona="calculo" titulo="Cómo se calcula">
      {entrada ? (
        <dl className="dimensiones-reglas">
          <dt>Listas de respuesta</dt>
          <dd>{listas === null ? "No se pudieron leer" : listas.length ? enumerar(listas) : "Ninguna"}</dd>
          <dt>Paso a puntaje</dt>
          <dd>Las categorías se reparten de 0 a 100 en el orden de la lista</dd>
          <dt>Códigos que no cuentan</dt>
          <dd>{sinRespuesta.length ? enumerar(sinRespuesta) : "Ninguno"}</dd>
          <dt>Bloque</dt>
          <dd>Promedio simple de sus preguntas</dd>
          {entrada.tipo === "indice" ? (
            <>
              <dt>Índice</dt>
              <dd>Promedio simple de sus bloques</dd>
            </>
          ) : null}
          <dt>Si falta una</dt>
          <dd>Se promedia con las que haya</dd>
          <dt>Columna en la base</dt>
          <dd><code>{entrada.columna}</code></dd>
        </dl>
      ) : null}
    </PanelDeMesa>
  );
}
