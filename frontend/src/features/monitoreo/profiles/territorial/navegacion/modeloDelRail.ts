import type { MonitoreoState, MonitoreoTerritorialDashboard } from "../../../../../api/client";
import type { MonitoreoWorkbenchRailTab } from "../../../components/MonitoreoWorkbenchRail";
import { corteTerritorial } from "../../../corte/corteAdapters";
import { estadoVisual, readinessDeSalidas } from "../../../corte/corteContract";
import { MONITOREO_PESTANAS } from "../../../../../lib/navegacion/catalogos/monitoreo";
import { fmt } from "../rotulos";
import type { SeccionTerritorial } from "./direccionTerritorial";

/**
 * ¿El proyecto declara el parte de ocurrencias de campo? En ACNUR es parte del
 * protocolo (procedimientos respondidos) y siempre está; para otros clientes
 * depende de `field_occurrences.enabled`. Sin capacidad, las dos pestañas no
 * existen ni reservan espacio (E4).
 */
export function tieneOcurrencias(state: MonitoreoState | null): boolean {
  const fo = (state?.config?.territorial as { field_occurrences?: { enabled?: boolean; source_id?: string; asset_uid?: string } } | undefined)?.field_occurrences;
  if (!fo) return false;
  if (fo.enabled === false) return false;
  return Boolean(fo.enabled || fo.source_id || fo.asset_uid);
}

const CONDICIONALES_DE_OCURRENCIAS = new Set(["ocurrencias", "reportes"]);

/** Las pestañas que el catálogo declara para la sección y existen en este proyecto. */
export function pestanasDisponibles(seccion: SeccionTerritorial, state: MonitoreoState | null) {
  const conOcurrencias = tieneOcurrencias(state);
  return MONITOREO_PESTANAS.territorial[seccion].filter((tab) => (
    seccion !== "control" || conOcurrencias || !CONDICIONALES_DE_OCURRENCIAS.has(tab.key)
  ));
}

/**
 * El rail de una sección. Nombre, detalle e ícono salen del catálogo; la
 * insignia y el estado, del mismo corte que pinta la pestaña, para que el rail
 * no cuente distinto que la vista.
 */
export function pestanasDelRail(
  seccion: SeccionTerritorial,
  state: MonitoreoState | null,
  reports: MonitoreoTerritorialDashboard | null,
): MonitoreoWorkbenchRailTab[] {
  return pestanasDisponibles(seccion, state).map((tab) => ({
    key: tab.key,
    label: tab.label,
    detail: tab.detail,
    icon: tab.icon,
    ...(seccion === "avance" ? estadoDeAvance(tab.key, state, reports) : {}),
  }));
}

function estadoDeAvance(
  pestana: string,
  state: MonitoreoState | null,
  reports: MonitoreoTerritorialDashboard | null,
): Pick<MonitoreoWorkbenchRailTab, "badge" | "estado"> {
  const corte = corteTerritorial(state, reports);
  const evaluado = corte.oficial != null;
  if (pestana === "salidas") {
    const readiness = readinessDeSalidas(corte);
    return { estado: readiness.estado, badge: readiness.bloqueos.length ? fmt(readiness.bloqueos.length) : undefined };
  }
  if (pestana === "faltante") {
    const resumen = reports?.route_quota_progress?.ump_summary;
    const pendientes = Number(resumen?.pending ?? 0) + Number(resumen?.partial ?? 0);
    return {
      estado: estadoVisual({ configurado: Boolean(reports?.route_quota_progress?.configured), evaluado: Boolean(resumen), completo: pendientes === 0 }),
      badge: pendientes ? fmt(pendientes) : undefined,
    };
  }
  return { estado: estadoVisual({ configurado: Boolean(state?.has_snapshot), evaluado, completo: evaluado && corte.brecha === 0 }) };
}

/**
 * Grupos de Control (§1): Calidad, Ocurrencias y Correcciones. La sobrelínea
 * de la cabecera dice «Control · Calidad» y el rail pone un divisor antes del
 * primero de cada grupo.
 */
const GRUPOS_DE_CONTROL: Record<string, string> = {
  bandeja: "Calidad",
  senales: "Calidad",
  recorrido: "Calidad",
  equipo: "Calidad",
  ocurrencias: "Ocurrencias",
  reportes: "Ocurrencias",
  subsanaciones: "Correcciones",
  anulaciones: "Correcciones",
  conciliacion: "Correcciones",
};

const NOMBRE_DE_SECCION: Record<SeccionTerritorial, string> = {
  insumos: "Insumos",
  modelo: "Modelo",
  control: "Control",
  avance: "Avance",
};

export function antetituloDePestana(seccion: SeccionTerritorial, pestana: string): string {
  const grupo = seccion === "control" ? GRUPOS_DE_CONTROL[pestana] : undefined;
  return grupo ? `${NOMBRE_DE_SECCION[seccion]} · ${grupo}` : NOMBRE_DE_SECCION[seccion];
}
