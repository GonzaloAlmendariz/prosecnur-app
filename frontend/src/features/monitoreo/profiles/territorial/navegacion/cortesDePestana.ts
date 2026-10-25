import type { MonitoreoReportScope } from "../../types";
import { esPestanaPropia, type DireccionTerritorial } from "./direccionTerritorial";

export type CorteDePestana = "avance" | "validacion" | "consultas";

export const SCOPE_DEL_CORTE: Record<CorteDePestana, MonitoreoReportScope> = {
  avance: "advance_summary",
  validacion: "validation_summary",
  consultas: "queries_summary",
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
