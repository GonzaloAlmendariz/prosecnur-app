// El tono de `EstadoChip` para los estados de un caso que las páginas heredadas
// de Telefónico y Acreditación pintaban con píldoras propias (P6 de la pasada de
// formato, 2 nov 2026). Cada mapa traduce el color que tenía el modificador
// (`.mon-acr-status-pill.is-*`, `.mon-acr-cross-pill.is-*`,
// `.mon-acr-count-pill.is-*`, `.mon-query-badge.is-*` en profilePage.css), no
// su nombre: es presentación, la clasificación del caso no cambia.

import type { ChromeStatusTone } from "../../../components/ModuleCommandBar";

/** Estado de la respuesta en la plataforma (`internalCaseResponseStateValue`). */
export function tonoDeRespuesta(valor: string): ChromeStatusTone {
  if (valor === "complete") return "success";
  if (valor === "partial") return "warn";
  if (valor === "refusal") return "danger";
  return "neutral";
}

/** Cruce con la base (`internalCaseCrossingValue`): lo que cruza iba con el color del módulo. */
export function tonoDeCruce(valor: string): ChromeStatusTone {
  return valor === "sin_cruce" || valor === "sin_llave" || valor === "sin_base" ? "warn" : "info";
}

/** Si el caso cuenta en el avance: sí, no, o en revisión. */
export function tonoDeConteo(cuenta: boolean | null | undefined): ChromeStatusTone {
  return cuenta === true ? "success" : "warn";
}

/** Lectura de `platformToneValue` / `crossingToneValue`. */
export function tonoDeLectura(valor: "effective" | "partial" | "refusal" | "warning" | "muted"): ChromeStatusTone {
  if (valor === "effective") return "success";
  if (valor === "refusal") return "danger";
  if (valor === "muted") return "neutral";
  return "warn";
}
