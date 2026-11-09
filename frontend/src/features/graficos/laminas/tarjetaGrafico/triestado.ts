// Interruptor de tres estados de la tarjeta (ronda 18, «N en la leyenda»): un arg `bool` del registro sin `default`
// cuyo NULL es una decisión del motor («Automático»), no un «No». Un interruptor sólo dice encendido o apagado y, sin
// valor guardado, mentiría uno de los dos; el segmentado «Automático / Sí / No» deja los tres a la vista. Módulo puro.

export type ClaveTriestado = "auto" | "si" | "no";

export const OPCIONES_TRIESTADO: readonly { value: ClaveTriestado; label: string }[] = [
  { value: "auto", label: "Automático" },
  { value: "si", label: "Sí" },
  { value: "no", label: "No" },
];

/** La opción que se ve con el valor guardado: `true` es Sí, `false` es No; cualquier otra cosa (sin guardar), Automático. */
export function claveTriestado(valor: unknown): ClaveTriestado {
  return valor === true ? "si" : valor === false ? "no" : "auto";
}

/** Lo que se guarda al elegir: Automático vuelve a `null` (el motor decide). */
export function valorTriestado(clave: string): boolean | null {
  return clave === "si" ? true : clave === "no" ? false : null;
}
