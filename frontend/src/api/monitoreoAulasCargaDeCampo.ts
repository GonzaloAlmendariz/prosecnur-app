// La carga de campo de cursos-horario como libro de Excel real (.xlsx de dos
// hojas: la malla con color y el detalle por sesión), armado por el motor
// (`POST /api/monitoreo/aulas/carga-de-campo/excel`). Lo entrega el kit de
// entregables (ADR 0133): la respuesta conserva los campos del registro.

import { apiFetch, handle, headers } from "./core";
import { camposDeEntregable, type CamposDeEntregable } from "./jobs";

export type EjeDeCargaDeCampo = "semana" | "calendario";

/** Una cita confirmada del motor: la misma ventana que pinta la vista. */
export type VentanaDeCargaDeCampo = { codigo: string; fecha: string; inicioMin: number };

/** Las mismas opciones con que la vista calcula la malla. */
export type PedidoDeCargaDeCampo = {
  duracionMin: number;
  eje?: EjeDeCargaDeCampo;
  ventanas?: ReadonlyArray<VentanaDeCargaDeCampo>;
  preparacionMin?: number;
  salidaMin?: number;
};

export type PicoDeCargaDeCampo = { firmes: number; plausibles: number; fila: string; franja: string; aulas: number };

export type CargaDeCampoExcel = CamposDeEntregable & {
  ok: true;
  file_id: string;
  filename: string;
  eje: EjeDeCargaDeCampo;
  duracion_min: number;
  agendadas: number;
  por_agendar: number;
  pico: PicoDeCargaDeCampo | null;
};

/** El cuerpo en el idioma del motor; lo que no se pidió no viaja y el motor pone su valor. */
export function cuerpoDeCargaDeCampo(pedido: PedidoDeCargaDeCampo): Record<string, unknown> {
  return {
    duracion_min: Math.round(pedido.duracionMin),
    ...(pedido.eje ? { eje: pedido.eje } : {}),
    ...(pedido.ventanas?.length
      ? { ventanas: pedido.ventanas.map((v) => ({ codigo: v.codigo, fecha: v.fecha, inicio_min: Math.round(v.inicioMin) })) }
      : {}),
    ...(pedido.preparacionMin != null ? { preparacion_min: Math.round(pedido.preparacionMin) } : {}),
    ...(pedido.salidaMin != null ? { salida_min: Math.round(pedido.salidaMin) } : {}),
  };
}

function uno(v: unknown): unknown {
  return Array.isArray(v) && v.length === 1 ? v[0] : v;
}

function texto(v: unknown): string {
  const x = uno(v);
  return typeof x === "string" ? x : "";
}

function numero(v: unknown): number {
  const x = uno(v);
  const n = typeof x === "number" ? x : typeof x === "string" && x.trim() ? Number(x) : Number.NaN;
  return Number.isFinite(n) ? n : 0;
}

function registro(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/** Normalizador defensivo: el unboxed-JSON de R manda escalares como arreglos de uno y un NULL como `{}`. */
export function normalizarCargaDeCampoExcel(raw: unknown): CargaDeCampoExcel {
  const o = registro(raw) ?? {};
  const p = registro(o.pico);
  const pico = p && Object.keys(p).length
    ? { firmes: numero(p.firmes), plausibles: numero(p.plausibles), fila: texto(p.fila), franja: texto(p.franja), aulas: numero(p.aulas) }
    : null;
  return {
    ...camposDeEntregable(o),
    ok: true,
    file_id: texto(o.file_id),
    filename: texto(o.filename),
    eje: texto(o.eje) === "calendario" ? "calendario" : "semana",
    duracion_min: numero(o.duracion_min),
    agendadas: numero(o.agendadas),
    por_agendar: numero(o.por_agendar),
    pico,
  };
}

export async function apiMonitoreoAulasCargaDeCampoExcel(pedido: PedidoDeCargaDeCampo): Promise<CargaDeCampoExcel> {
  const raw = await handle<unknown>(
    await apiFetch("/api/monitoreo/aulas/carga-de-campo/excel", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(cuerpoDeCargaDeCampo(pedido)),
    }),
  );
  return normalizarCargaDeCampoExcel(raw);
}
