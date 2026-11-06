import type { MonitoreoReportScope } from "../../types";
import { monitoreoDireccionDesdeParams } from "../../../useMonitoreoDireccion";
import { vistaInicial } from "../navegacion/direccionAcreditacion";

// El scope que pide cada sección interna del perfil, para que el warm start
// sepa qué corte necesita la vista de aterrizaje sin cargar la página. Gemelo
// deliberado de `scopeForView` en AcreditacionMonitoreoPage.tsx: el contrato de
// readiness (MonitoringProfilesReadinessContract.test.ts) resuelve nombres
// dentro de UN archivo y exige ver allí `phone_summary`; el test de este
// módulo fija que los dos digan lo mismo.
export function scopeParaSeccion(seccion: string, familia?: string): MonitoreoReportScope {
  if (seccion === "telefonico") return "phone_summary";
  if (seccion === "modelo" && familia === "telefonico") return "phone_summary";
  if (seccion === "consultas") return "queries_summary";
  if (seccion === "modelo") return "advance_summary";
  if (seccion === "fuentes") return "source";
  return "advance_summary";
}

// Antes de entrar, el warm start pedía los cuatro scopes en serie a un Plumber
// de un solo hilo, y Avance tenía que esperar a que terminaran consultas y
// teléfono, que no lee (medido: 35 s + 21 s de cola). Ahora pide sólo el corte
// de la vista a la que se aterriza; el resto lo trae el prefetch de fondo de la
// página cuando la vista ya está pintada.
export function scopeDeAterrizaje(search: string, familia?: string): MonitoreoReportScope {
  return scopeParaSeccion(vistaInicial(monitoreoDireccionDesdeParams(search)).seccion, familia);
}
