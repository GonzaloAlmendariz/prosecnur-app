// Qué fuentes toca cada botón de sincronización, y qué decir cuando no hay
// ninguna.
//
// La regla vivía dentro de `runProfileSourceSync`, escrita como un filtro
// anónimo, y el botón del chrome no la conocía: se ofrecía siempre. Con cero
// fuentes eso daba un botón que no podía hacer nada y que, al pulsarlo,
// guardaba «No hay fuentes activas para actualizar» en el mismo casillero que
// un fallo de carga —`setError`—. Dos consecuencias, las dos falsas: un banner
// rojo de vista rota por una acción que simplemente no aplicaba, y la readiness
// caída (`auditReady` exige `!error`), justo en el estudio recién abierto que
// acababa de conseguirla.
//
// La regla sale aquí para que la afordancia y la acción no puedan discrepar: el
// botón se apaga con la misma cuenta con la que la acción se rendiría. Es lo
// que ya hacían los botones de la franja de Fuentes —`disabled: !count` y un
// título que dice por qué—; el chrome no lo había adoptado.

import type { MonitoreoSource } from "../../../api/monitoreo";

export type ModoDeSync = "full" | "advance";

/**
 * Las fuentes que ese modo de sincronización va a leer.
 *
 * `full` toma todo lo activo. `advance` solo lo que mueve el avance: en
 * telefónico, las hojas de universo y barrido más la encuesta de Kobo; en
 * acreditación, las respuestas de plataforma.
 *
 * El `!source.role` de cada rama es deliberado: una fuente conectada antes de
 * que el papel existiera no tiene rol guardado y no puede quedar fuera del
 * avance por una migración.
 */
export function fuentesSincronizables(
  sources: MonitoreoSource[],
  modo: ModoDeSync,
  family: string,
): MonitoreoSource[] {
  return sources.filter((source) => {
    if (!source.enabled) return false;
    if (modo === "full") return true;
    if (family === "telefonico") {
      if (source.kind === "google_sheets") {
        return source.role === "universo" || source.role === "barrido" || !source.role;
      }
      return source.kind === "kobo" && (source.role === "respuestas" || !source.role || Boolean(source.asset_uid));
    }
    return (source.kind === "surveymonkey" || source.kind === "kobo")
      && (source.role === "respuestas" || !source.role);
  });
}

/** Por qué ese botón está apagado. Va en su `title`, no en un banner de error. */
export function motivoSinFuentes(modo: ModoDeSync): string {
  return modo === "full"
    ? "No hay fuentes activas para actualizar."
    : "No hay fuentes de respuesta activas para actualizar avance.";
}
