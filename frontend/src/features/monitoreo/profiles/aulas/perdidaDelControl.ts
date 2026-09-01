type Fila = Readonly<Record<string, unknown>>;

const num = (v: unknown): number | null => {
  const c = Array.isArray(v) ? v[0] : v;
  if (c === null || c === undefined || c === "") return null;
  const n = typeof c === "number" ? c : Number.parseFloat(String(c).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/**
 * Cuánto de lo que la hoja da por enviado acaba contando, sumado sobre el libro.
 *
 * La comparación es entre dos cifras de la MISMA hoja: `sent_total` —lo que el
 * equipo da por enviado en su Excel— y `efectivas_obtenidas` —la efectiva de
 * plataforma que la app escribe en la fila—. Ésa es la pérdida honesta dentro
 * de la Base de control; medida en 2025 es el 9-13 % y no es constante.
 *
 * `valid_total` y `valid_population` NO entran en ninguna suma: son el
 * VEREDICTO del aula, no un conteo. `carga_base_control.R` los declara
 * `solo_lectura` y no los numeriza —llegan «SI», «NO CUMPLE» o una bandera 0/1
 * del 70 %—, `aulasPresentation` los rotula «Válido total» y `fichaDeAula` los
 * lee como veredicto. Leerlos como cifra daba «De 770 enviadas cuentan 2» sobre
 * un libro con banderas, y con «SI»/«NO» apagaba la banda entera (checklist
 * A20 · censo de las cuatro cifras 2026-09-01, choque 1).
 *
 * `efectivas_obtenidas` la escribe la app pero no está en `.cbc_numericos`, así
 * que al releer el libro vuelve como TEXTO: el guard de arriba la coerciona.
 *
 * **Sólo cuenta las aulas que declaran las dos cifras.** Un aula con enviadas y
 * sin efectiva de plataforma todavía no se puede comparar; fabricarle pérdida
 * diría que su trabajo se tiró, cuando lo que pasa es que la cifra no ha vuelto.
 */
export type PerdidaDelControl = {
  /** Aulas del libro que declaran enviadas Y efectiva de plataforma. */
  aulas: number;
  /** Aulas con enviadas pero sin efectiva de plataforma: sin con qué comparar. */
  sinRevisar: number;
  enviadas: number;
  /** La efectiva de plataforma sumada (`efectivas_obtenidas`, no el veredicto). */
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
    const efe = num(fila.efectivas_obtenidas);
    if (env === null || env <= 0) continue;
    if (efe === null) { sinRevisar += 1; continue; }
    aulas += 1;
    enviadas += env;
    validas += efe;
  }
  // Sin ninguna aula con las dos cifras no hay pérdida que medir. Devolver ceros
  // dibujaría una banda llena diciendo «pasa el 100 %» sobre un libro vacío, y
  // una bandera sola en el veredicto tampoco habilita nada: sería fabricar la
  // banda desde una columna que no es un conteo.
  if (!aulas || enviadas <= 0) return null;
  const pierde = Math.max(0, enviadas - validas);
  return { aulas, sinRevisar, enviadas, validas, pierde, pasa: validas / enviadas };
}
