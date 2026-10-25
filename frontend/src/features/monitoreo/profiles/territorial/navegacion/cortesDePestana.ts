import type { MonitoreoReportScope } from "../../types";
import { esPestanaPropia, type DireccionTerritorial } from "./direccionTerritorial";

export type CorteDePestana = "avance" | "validacion" | "consultas" | "ruta";

export const SCOPE_DEL_CORTE: Record<CorteDePestana, MonitoreoReportScope> = {
  avance: "advance_summary",
  validacion: "validation_summary",
  consultas: "queries_summary",
  ruta: "route_summary",
};

/**
 * Cortes extra que una pestaña propia lee además del suyo. Sin ellos la
 * pestaña se pinta con «—» o ceros que el motor sí sabe (Equipo sin GPS,
 * Reportes «sin partes» con 84, Conexiones sin meta): la página los pide y
 * no marca la vista lista hasta que llegan.
 */
const CORTES: Record<string, readonly CorteDePestana[]> = {
  "avance/faltante": ["avance"],
  "avance/umps": ["avance", "validacion"],
  "avance/mapa": ["avance", "validacion"],
  "control/bandeja": ["consultas"],
  "control/equipo": ["consultas", "validacion"],
  "control/subsanaciones": ["consultas"],
  "control/reportes": ["consultas", "validacion"],
  "control/conciliacion": ["validacion"],
  // Metas lee las manzanas de la ruta del corte de ruta: `advance_summary`
  // también cubre la sección Modelo pero llega con `route_blocks` vacío, y si
  // era el último aplicado la pestaña decía «Sin muestra de Hojas de ruta».
  // El de avance dice qué reemplazos están en uso (mapa de la muestra).
  "modelo/metas": ["ruta", "avance"],
  "modelo/cuotas": ["avance"],
  "insumos/conexiones": ["avance", "consultas"],
  "insumos/padron": ["validacion"],
  "insumos/historial": ["avance"],
};

export function cortesDePestana(direccion: DireccionTerritorial): readonly CorteDePestana[] {
  if (!esPestanaPropia(direccion)) return [];
  return CORTES[`${direccion.seccion}/${direccion.pestana}`] ?? [];
}

export function scopesDePestana(direccion: DireccionTerritorial): MonitoreoReportScope[] {
  return cortesDePestana(direccion).map((corte) => SCOPE_DEL_CORTE[corte]);
}
