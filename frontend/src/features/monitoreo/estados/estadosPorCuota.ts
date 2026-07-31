/**
 * Las filas de estados por día que corresponden a UNA cuota.
 *
 * El bloque `estatus_dia` es del estudio entero. Pintarlo bajo el rótulo de una
 * cuota afirma que ese es el barrido de esa cuota, y no lo es: en PDM MedVida
 * dos cuotas de 156 y 27 casos habrían mostrado exactamente el mismo gráfico.
 *
 * Por eso el motor publica también `estatus_actor_dia`, con la misma partición
 * y una columna `Actor`. Aquí se elige la parte que toca y se retira esa
 * columna, porque el consumidor —`buildAcreditacionPhoneDailyStatusSeries`—
 * espera filas de `Estado × fecha` y trataría el actor como una serie más.
 */

function clave(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

const COLUMNAS_DE_ACTOR = ["actor", "sede", "cuota", "segmento", "unidad"];

/**
 * Filas del actor pedido, sin su columna de agrupación.
 *
 * Devuelve vacío cuando el actor no aparece, en vez de caer al conjunto
 * completo: un gráfico que no puede decir lo de ESTA cuota no debe dibujar el
 * de todas como si lo fuera.
 */
export function estadosPorDiaDeLaCuota(
  rows: ReadonlyArray<Record<string, unknown>>,
  actor: string,
): Array<Record<string, unknown>> {
  const buscado = clave(actor);
  if (!buscado || !rows.length) return [];

  const columnaActor = Object.keys(rows[0]).find((columna) => COLUMNAS_DE_ACTOR.includes(clave(columna)));
  if (!columnaActor) return [];

  return rows
    .filter((row) => clave(row[columnaActor]) === buscado)
    .map((row) => {
      const { [columnaActor]: _actor, ...resto } = row;
      return resto;
    });
}
