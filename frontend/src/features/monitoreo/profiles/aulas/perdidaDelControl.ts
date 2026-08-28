type Fila = Readonly<Record<string, unknown>>;

const num = (v: unknown): number | null => {
  const c = Array.isArray(v) ? v[0] : v;
  if (c === null || c === undefined || c === "") return null;
  const n = typeof c === "number" ? c : Number.parseFloat(String(c).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/**
 * Cuántas encuestas se envían y cuántas acaban contando, sumado sobre el libro.
 *
 * Es **la cuarta cifra** de la familia «cuántas encuestas hay», y la única que
 * no se dibujaba en ninguna parte: asistentes → **enviadas** → válidas →
 * efectivas del parte. La Base de control las trae aula por aula en
 * `sent_total` y `valid_total`, pero la tabla las enseña una a una: para saber
 * cuánto se pierde en total había que sumar 190 filas a mano.
 *
 * Medido sobre el campo real de 2025: se pierde el **9-13 %** —91 % pasa la
 * primera semana, 87 % la segunda, 88 % la tercera—. No es ruido y no es
 * constante.
 *
 * **Sólo cuenta las aulas que declaran las dos cifras.** Un aula con enviadas y
 * sin válidas todavía no se ha revisado; contarla como pérdida diría que su
 * trabajo se tiró, cuando lo que pasa es que nadie lo ha mirado.
 */
export type PerdidaDelControl = {
  /** Aulas del libro que declaran enviadas Y válidas. */
  aulas: number;
  /** Aulas con enviadas pero sin válidas: nadie las ha revisado todavía. */
  sinRevisar: number;
  enviadas: number;
  validas: number;
  /** Lo que se pierde entre una y otra. Nunca negativo. */
  pierde: number;
  /** Qué proporción de lo enviado acaba contando, de 0 a 1. */
  pasa: number;
};

export function perdidaDelControl(filas: ReadonlyArray<Fila>): PerdidaDelControl | null {
  let aulas = 0;
  let sinRevisar = 0;
  let enviadas = 0;
  let validas = 0;
  for (const fila of filas) {
    const env = num(fila.sent_total);
    const val = num(fila.valid_total);
    if (env === null || env <= 0) continue;
    if (val === null) { sinRevisar += 1; continue; }
    aulas += 1;
    enviadas += env;
    validas += val;
  }
  // Sin ninguna aula con las dos cifras no hay pérdida que medir. Devolver ceros
  // dibujaría una banda llena diciendo «pasa el 100 %» sobre un libro vacío.
  if (!aulas || enviadas <= 0) return null;
  const pierde = Math.max(0, enviadas - validas);
  return { aulas, sinRevisar, enviadas, validas, pierde, pasa: validas / enviadas };
}
