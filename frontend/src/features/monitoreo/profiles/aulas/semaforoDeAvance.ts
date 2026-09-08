/**
 * El color de una celda de las cinco tablas de «Avance de campo».
 *
 * **La escala la decide el motor, no esta pantalla.** El endpoint publica un
 * `semaforo` por columna (o por fila en la tabla traspuesta) y aquí sólo se
 * traduce a tinta. Si el front decidiera qué es una diferencia y qué un avance,
 * habría dos respuestas a la misma pregunta y una acabaría mintiendo: es
 * literalmente lo que pasó con la columna «Diferencia», que era encuestas en una
 * tabla y puntos porcentuales en otra y salió publicada como «−3 500,0 %».
 *
 * Las cuatro escalas, tal como las dictó Gonzalo el 2026-09-08:
 *
 *   · `deposito` — el avance es un depósito que se llena. **Sin rojo.** Se
 *     corrigió a sí mismo sobre su primer dictado: «rojo da a entender que es
 *     algo malo cuando puede ser sólo que recién esté empezando». Gris muy claro
 *     al empezar, verde al cubrir la meta, celeste al pasarse.
 *   · `diferencia` — aquí sí hay veredicto, porque se compara contra lo que se
 *     esperaba: rojo por debajo, verde por encima, y el cero clavado en el
 *     medio sin teñir.
 *   · `meta_muestra` — la celda vale 0 cuando ya no falta nadie: verde.
 *   · `meta_sobremuestra` — lo mismo contra la segunda meta: celeste.
 */

export type ClaveDeSemaforo =
  | "deposito"
  | "diferencia"
  | "meta_muestra"
  | "meta_sobremuestra"
  | "";

export type TintaDeCelda = {
  /** El color de fondo ya resuelto, o `undefined` cuando la celda no se tiñe. */
  fondo?: string;
  /** Tinta del texto cuando el fondo la exige; `undefined` deja la de la tabla. */
  texto?: string;
};

/**
 * @param clave la escala que publicó el motor para esa columna o fila.
 * @param valor el valor de la celda. Los porcentajes llegan como proporción.
 * @param escala referencia para graduar la intensidad de una `diferencia`: el
 *   mayor valor absoluto de su columna. Sin ella la tinta va al máximo, que es
 *   lo honesto cuando no hay con qué comparar.
 */
export function tintaDeCelda(
  clave: ClaveDeSemaforo,
  valor: string | number | null,
  escala?: number,
): TintaDeCelda {
  if (!clave || typeof valor !== "number" || !Number.isFinite(valor)) return {};

  if (clave === "deposito") {
    // El depósito se llena de gris a verde y se pasa a celeste. La opacidad
    // sigue al avance para que el ojo lea el nivel sin leer la cifra.
    if (valor > 1) return { fondo: "var(--pulso-info-bg)", texto: "var(--pulso-info-fg)" };
    if (valor >= 1) return { fondo: "var(--pulso-success-bg)", texto: "var(--pulso-success-fg)" };
    const parte = Math.max(0, Math.min(1, valor));
    // Por debajo del 4 % no se tiñe: un velo casi invisible se lee como suciedad
    // de render, no como dato.
    if (parte < 0.04) return {};
    return { fondo: `color-mix(in srgb, var(--pulso-success-bg) ${Math.round(parte * 100)}%, transparent)` };
  }

  if (clave === "diferencia") {
    if (valor === 0) return {};
    const tope = Number.isFinite(escala) && (escala as number) > 0 ? (escala as number) : Math.abs(valor);
    const parte = Math.max(0.15, Math.min(1, Math.abs(valor) / tope));
    const base = valor > 0 ? "var(--pulso-success-bg)" : "var(--pulso-danger-bg)";
    return {
      fondo: `color-mix(in srgb, ${base} ${Math.round(parte * 100)}%, transparent)`,
      texto: valor > 0 ? "var(--pulso-success-fg)" : "var(--pulso-danger-fg)",
    };
  }

  // Las dos de meta: sólo dicen algo cuando la celda llegó a cero, que es
  // cuando esa cuota dejó de faltar. Un cero es la noticia; el resto es el
  // camino, y el camino ya lo cuenta la columna de avance.
  if (valor === 0) {
    return clave === "meta_muestra"
      ? { fondo: "var(--pulso-success-bg)", texto: "var(--pulso-success-fg)" }
      : { fondo: "var(--pulso-info-bg)", texto: "var(--pulso-info-fg)" };
  }
  return {};
}

/** El mayor valor absoluto de una columna, para graduar sus diferencias. */
export function escalaDeColumna(
  filas: Array<Array<string | number | null>>,
  columna: number,
): number {
  let tope = 0;
  for (const fila of filas) {
    const v = fila[columna];
    if (typeof v === "number" && Number.isFinite(v)) tope = Math.max(tope, Math.abs(v));
  }
  return tope;
}
