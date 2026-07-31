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
export function pct(value: unknown) {
  const n = value == null || value === "" ? NaN : Number(value);
  if (!Number.isFinite(n)) return "S/D";
  return `${Math.round(n)}%`;
}
