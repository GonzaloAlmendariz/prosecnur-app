// Calidad de campo (2026-10-17). Pedido de Gonzalo: «Podemos agregar start-geopoint, y audit pero con cabeza».
// En vez de dos tipos sueltos en el menú de alta, dos interruptores del formulario que escriben las filas correctas:
// - `start-geopoint` (ubicacion_inicio): una toma de GPS al abrir, sin que el encuestador vea nada.
// - `audit` (nombre fijo `audit`, lo exige XLSForm): tiempos por pregunta y, según el nivel, cambios de respuesta
//   y ubicación de cada paso. Los niveles fijan parámetros razonables; uno importado distinto queda «personalizado»
//   y no se toca mientras no se cambie el nivel.
// Las filas van al principio del survey, junto a los demás automáticos.

import type { XlsformEditorWorkbook } from "../types";
import { deleteRow, getCell, insertRecord, setCell } from "../parsing/sheetUtils";
import { esMetadato } from "../kit/tiposPregunta";

export type NivelRegistro = "tiempos" | "cambios" | "ubicacion";
export type CalidadCampo = {
  ubicacionInicio: boolean;
  registro: NivelRegistro | "personalizado" | null;
  parametrosRegistro: string;
};

export const NOMBRE_UBICACION = "ubicacion_inicio";
export const PARAMETROS_NIVEL: Record<NivelRegistro, string> = {
  tiempos: "",
  cambios: "track-changes=true",
  ubicacion: "track-changes=true location-priority=balanced location-min-interval=60 location-max-age=120",
};

const base = (wb: XlsformEditorWorkbook, i: number) => (getCell(wb.survey, i, "type") ?? "").trim().split(/\s+/)[0] ?? "";
const filaDe = (wb: XlsformEditorWorkbook, tipo: string) => wb.survey.rows.findIndex((_, i) => base(wb, i) === tipo);
const normalizar = (p: string) => p.trim().split(/\s+/).filter(Boolean).sort().join(" ");

export function nivelDeParametros(parametros: string): NivelRegistro | "personalizado" {
  const n = normalizar(parametros);
  const nivel = (Object.keys(PARAMETROS_NIVEL) as NivelRegistro[]).find((k) => normalizar(PARAMETROS_NIVEL[k]) === n);
  return nivel ?? "personalizado";
}

export function leerCalidadCampo(wb: XlsformEditorWorkbook | null): CalidadCampo {
  if (!wb) return { ubicacionInicio: false, registro: null, parametrosRegistro: "" };
  const a = filaDe(wb, "audit");
  const parametros = a >= 0 ? getCell(wb.survey, a, "parameters") ?? "" : "";
  return { ubicacionInicio: filaDe(wb, "start-geopoint") >= 0, registro: a >= 0 ? nivelDeParametros(parametros) : null, parametrosRegistro: parametros };
}

/** Índice tras el bloque de automáticos del principio: ahí van las filas nuevas. */
function despuesDeAutomaticos(wb: XlsformEditorWorkbook): number {
  let i = 0;
  while (i < wb.survey.rows.length && esMetadato(base(wb, i))) i += 1;
  return i;
}

/** Muta el borrador (patrón updateWorkbook). */
export function aplicarUbicacionInicio(wb: XlsformEditorWorkbook, activa: boolean): void {
  const i = filaDe(wb, "start-geopoint");
  if (!activa) { if (i >= 0) deleteRow(wb.survey, i); return; }
  if (i < 0) insertRecord(wb.survey, despuesDeAutomaticos(wb), { type: "start-geopoint", name: NOMBRE_UBICACION });
}

export function aplicarRegistro(wb: XlsformEditorWorkbook, nivel: NivelRegistro | null): void {
  const i = filaDe(wb, "audit");
  if (nivel === null) { if (i >= 0) deleteRow(wb.survey, i); return; }
  if (i < 0) {
    insertRecord(wb.survey, despuesDeAutomaticos(wb), { type: "audit", name: "audit", parameters: PARAMETROS_NIVEL[nivel] });
    return;
  }
  setCell(wb.survey, i, "parameters", PARAMETROS_NIVEL[nivel]);
}
