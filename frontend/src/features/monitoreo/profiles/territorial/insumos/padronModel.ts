import type { MonitoreoState, MonitoreoTerritorialDashboard } from "../../../../../api/client";
import { diaYMes, fechaYHoraDeLima } from "../rotulos";

/**
 * Insumos › Padrón (territorial.md §3.3): quién está en el padrón y cuánto
 * trajo cada código, y los códigos que la base trae sin estar en el padrón. El
 * DNI del archivo nunca sale de aquí: el modelo no lo lee.
 */

export type EstadoEnPadron = "con-casos" | "anulado" | "sin-casos";

export type FilaDelPadron = {
  codigo: string;
  nombre: string;
  casos: number;
  umps: number;
  ultimo: string;
  estado: EstadoEnPadron;
};

export type ModeloPadron = {
  disponible: boolean;
  archivo: { nombre: string; personas: number; formato: string; subido: string };
  filas: FilaDelPadron[];
  fueraDelPadron: Array<{ codigo: string; casos: number }>;
};

export const ROTULO_DE_ESTADO: Record<EstadoEnPadron, string> = {
  "con-casos": "Con casos",
  anulado: "Producción anulada",
  "sin-casos": "Sin casos",
};

function n(valor: unknown): number {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
}

function codigoDe(valor: unknown): string {
  return String(valor ?? "").trim().toUpperCase();
}

export function construirPadron(
  state: MonitoreoState | null | undefined,
  reports: MonitoreoTerritorialDashboard | null | undefined,
): ModeloPadron {
  const padron = state?.config?.territorial?.enumerator_roster;
  const asignaciones = padron?.assignments ?? [];
  const porCodigo = new Map((reports?.production_annulments?.responsibles ?? []).map((item) => [codigoDe(item.pulso_code), item]));
  const enPadron = new Set<string>();

  const filas: FilaDelPadron[] = asignaciones
    .map((asignacion) => {
      const codigo = codigoDe(asignacion.codigo_pulso);
      enPadron.add(codigo);
      const responsable = porCodigo.get(codigo);
      const casos = Math.round(n(responsable?.responses));
      const anulado = String(responsable?.status ?? "").toLowerCase() === "anulado";
      return {
        codigo,
        nombre: String(asignacion.nombre ?? "").trim(),
        casos,
        umps: Math.round(n(responsable?.umps)),
        ultimo: diaYMes(responsable?.latest_activity),
        estado: anulado ? "anulado" : casos > 0 ? "con-casos" : "sin-casos",
      } satisfies FilaDelPadron;
    })
    .filter((fila) => fila.codigo)
    .sort((a, b) => a.codigo.localeCompare(b.codigo, "es", { numeric: true }));

  const fueraDelPadron = [...porCodigo.entries()]
    .filter(([codigo]) => codigo && !enPadron.has(codigo))
    .map(([codigo, item]) => ({ codigo, casos: Math.round(n(item.responses)) }))
    .sort((a, b) => b.casos - a.casos || a.codigo.localeCompare(b.codigo, "es", { numeric: true }));

  return {
    disponible: asignaciones.length > 0,
    archivo: {
      nombre: String(padron?.file_name ?? ""),
      personas: Math.round(n(padron?.total) || asignaciones.length),
      formato: String(padron?.code_format ?? ""),
      subido: fechaYHoraDeLima(padron?.uploaded_at),
    },
    filas,
    fueraDelPadron,
  };
}
