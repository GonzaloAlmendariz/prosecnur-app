/**
 * Qué relación tiene una reserva con el titular de su cadena de diseño —
 * la nomenclatura del dictado 2026-09-03: «yo sé que se llaman reemplazos,
 * pero no siempre reemplazan en ese sentido de la palabra».
 *
 *  - `reemplaza`   → el titular salió (caso A: rechazo o reemplazada).
 *  - `complementa` → el titular sigue vivo y ambos suman (caso B).
 *  - `refuerzo`    → no cuelga de ningún titular visible (caso C: una R
 *                    usada de forma operativa, con nomenclatura propia).
 *
 * La relación se lee de la CADENA DE DISEÑO: la decisión operativa «el que
 * mejor calza» aún no deja rastro en la fila del plan, y afirmar más sería
 * inventar. En módulo propio porque ya la leen dos superficies (la ruta por
 * facultad y la cola de contacto) y una tercera copia sería la clase de
 * divergencia que ya costó pestañas.
 */

export type RelacionDeReserva = "reemplaza" | "complementa" | "refuerzo";

/**
 * @param estadoDelTitular el `sample_status` del titular de la cadena, en
 *   minúsculas; `undefined` cuando el titular no está entre las filas.
 */
export function relacionConTitular(
  estadoDelTitular: string | undefined,
): RelacionDeReserva {
  if (estadoDelTitular === undefined) return "refuerzo";
  return /^(rechaz|reemplazada)/.test(estadoDelTitular) ? "reemplaza" : "complementa";
}

/** El caso del dictado, para clases CSS (`es-caso-a|b|c`). */
export function casoDeLaRelacion(relacion: RelacionDeReserva): "a" | "b" | "c" {
  return relacion === "reemplaza" ? "a" : relacion === "complementa" ? "b" : "c";
}
