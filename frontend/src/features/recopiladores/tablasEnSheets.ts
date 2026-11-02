import type { EstadoDeEntrega } from "../../api/monitoreoAulasEntrega";
import type { MonitoreoAulasHojaPublicada } from "../../api/monitoreo";

/**
 * R13 del mapa de responsabilidades (2 nov 2026): Material construye sobre el Sheets del estudio las
 * tablas que campo llena y Monitoreo lee y supervisa. No hay motor nuevo: se llama al de Monitoreo
 * (`/aulas/entrega/traer` y `/aulas/publicar-libro`), que antes de escribir LEE lo que el equipo
 * tecleó y nunca pisa sus hojas.
 *
 * Una función pura con las llamadas inyectadas, para probar el orden y los cortes sin red.
 */

export type DepsDeTablas = {
  entrega: () => Promise<{ estado: EstadoDeEntrega }>;
  traer: () => Promise<unknown>;
  publicar: (enlace?: string) => Promise<{ spreadsheet_url: string; hojas: MonitoreoAulasHojaPublicada[] }>;
};

export type ResultadoDeTablas =
  | { ok: true; url: string; hojas: MonitoreoAulasHojaPublicada[]; trajo: boolean }
  | { ok: false; motivo: string };

export async function construirTablasEnSheets(deps: DepsDeTablas, enlace: string): Promise<ResultadoDeTablas> {
  const { estado } = await deps.entrega();
  if (estado === "sin_entrega") return { ok: false, motivo: "Primero entrega a Monitoreo: las tablas se arman con lo entregado." };
  if (estado === "desactualizada") return { ok: false, motivo: "La entrega cambió después de su recibo: vuelve a entregar antes de construir las tablas." };
  // Monitoreo publica desde su plan; si todavía no trajo esta entrega, se trae primero (es su mismo paso).
  const trajo = estado === "por_traer";
  if (trajo) await deps.traer();
  const r = await deps.publicar(enlace.trim() || undefined);
  return { ok: true, url: r.spreadsheet_url, hojas: r.hojas, trajo };
}

const ACCION: Record<string, string> = {
  sembrada: "creada",
  actualizada: "actualizada",
  sin_cambios: "sin cambios",
  respetada: "del equipo, sin tocar",
};

/** «Base de control · actualizada (193 filas)». */
export function rotuloDeHoja(h: MonitoreoAulasHojaPublicada): string {
  const accion = ACCION[h.accion] ?? h.accion;
  return `${h.hoja} · ${accion} (${h.filas.toLocaleString("es-PE")} ${h.filas === 1 ? "fila" : "filas"})`;
}
