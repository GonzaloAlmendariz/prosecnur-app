// Formateadores genéricos de Monitoreo, compartidos por los cuatro perfiles.
//
// **Esto no fusiona los perfiles.** La decisión vigente es que acreditación y
// telefónico son productos independientes y que arreglar dos veces la semántica
// de familia es el precio aceptado de esa independencia. El registro de deuda
// acota la excepción con precisión: «extraer al kit solo infraestructura
// genérica **sin semántica de familia**». Un formateador de porcentaje no tiene
// familia: no sabe qué es un actor, ni una cuota, ni un caso efectivo.
//
// Por qué se extrae ahora. El 2026-07-31 el rail de territorial mostraba
// `Avance 0%` mientras la misma pantalla decía «sin meta declarada». La causa
// era `Number(null) === 0`, y estaba en las **cuatro** copias de `pct`,
// idénticas entre sí. Un defecto en una era un defecto en cuatro, y se arregló
// cuatro veces. Mientras vivan copiadas, la próxima vez también.
//
// Cuidado con el nombre: en Monitoreo existe además un `pct(value, total)` que
// devuelve un número o `null` —el cálculo del cociente, no su presentación—.
// Son dos funciones distintas con el mismo nombre. Esta es la de presentación.

/**
 * Porcentaje ya calculado, listo para leerse.
 *
 * El guard de `null`/`""` es el punto de la función. `Number(null)` es `0` y
 * `Number.isFinite(0)` es `true`, así que sin él un `avance_pct: null` —que el
 * motor manda correctamente cuando no hay meta declarada— se imprimía como
 * `0%`: el backend decía «no sé» y la interfaz respondía «cero».
 *
 * Un cero real sigue siendo `0%`. Lo que se distingue es «sin vara» de «sin
 * avance», que es la regla que `corteContract.ts` ya enunciaba: un porcentaje
 * sin denominador es una afirmación sin respaldo.
 */
/**
 * El porcentaje CON un decimal de los perfiles telefónico y acreditación:
 * «49,7%», y «50%» cuando el decimal es cero. Sin espacio antes del símbolo,
 * que es como los escribe esa familia de pantallas —el perfil de aulas usa su
 * propio `pctPerfil()`, con espacio, y ésa es una diferencia de estilo entre
 * familias, no dos formas de la misma pantalla—.
 *
 * Existía CUATRO veces escrita entre los dos perfiles, y dos de ellas con
 * `toFixed(1)`, que produce **punto decimal** pase lo que pase con el locale:
 * el panel de metas del telefónico decía «49.7%» mientras la tabla de al lado
 * decía «49,7%». Censado el 2026-09-09 (loop de monitoreo, E1 llevado a los
 * otros perfiles).
 *
 * No sustituye a `pct()`, que redondea a entero y escribe «S/D»: son dos
 * formatos y los dos se usan. El que falta de escribir dos veces es éste.
 */
export function pctDecimal(value: unknown, sinDato = "S/D") {
  const n = value == null || value === "" ? NaN : Number(value);
  if (!Number.isFinite(n)) return sinDato;
  return `${n.toLocaleString("es-PE", { maximumFractionDigits: 1 })}%`;
}

export function pct(value: unknown) {
  const n = value == null || value === "" ? NaN : Number(value);
  if (!Number.isFinite(n)) return "S/D";
  return `${Math.round(n)}%`;
}
