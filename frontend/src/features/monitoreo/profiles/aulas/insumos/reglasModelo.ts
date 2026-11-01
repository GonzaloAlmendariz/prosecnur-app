import type { MonitoreoAulasDashboard } from "../../../../../api/monitoreo";
import { fmt } from "../kpisDeAulas";
import { tiemposDeRespuesta } from "../tiemposDeRespuesta";

/**
 * Insumos › Reglas (ficha I2). ¿Qué cuenta como efectiva y cómo se atribuye?
 * Toda regla que cambia una cifra antes de contarla, en un solo lugar: los
 * paneles que guardan las construye la página; aquí se arma lo que se LEE junto
 * a ellos (lo que no cuenta, por grupo, y el resumen de duraciones).
 */

export type FilaNoCuenta = { grupo: string; leidas: number; efectivas: number; noPasan: number; fuera: number };

export type ModeloReglas = {
  /** «Lo que no cuenta, por facultad» (o por carrera): título y filas. */
  noCuenta: { titulo: string; filas: FilaNoCuenta[]; total: FilaNoCuenta } | null;
  duracion: {
    declarado: boolean;
    minutos: number | null;
    /** «513 de 3,610 marcadas · mediana 5.2 min», o el motivo si no se puede medir. */
    resumen: string;
  };
};

function n(v: unknown): number {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
}

export function construirReglas(dashboard: MonitoreoAulasDashboard | null): ModeloReglas {
  const desglose = dashboard?.respuestas_desglose;
  const etiqueta = (desglose?.agrupacion?.etiqueta || "Facultad").toLowerCase();
  const filas = (desglose?.facultades ?? [])
    .map((f) => ({
      grupo: f.facultad,
      leidas: n(f.observadas),
      efectivas: n(f.efectivas),
      noPasan: n(f.no_pasan_criterio),
      fuera: n(f.fuera_del_operativo),
    }))
    // Lo que más se pierde arriba: es lo que hay que mirar primero.
    .sort((a, b) => (b.noPasan + b.fuera) - (a.noPasan + a.fuera) || a.grupo.localeCompare(b.grupo, "es"));
  const t = desglose?.total;
  const total: FilaNoCuenta | null = t
    ? { grupo: "Total", leidas: n(t.observadas), efectivas: n(t.efectivas), noPasan: n(t.no_pasan_criterio), fuera: n(t.fuera_del_operativo) }
    : null;

  const tiempos = tiemposDeRespuesta(dashboard?.tiempos);
  const resumen = !tiempos.disponible
    ? tiempos.motivo || "Este estudio no trae la duración de cada respuesta."
    : [
      tiempos.marcadas ? `${fmt(tiempos.marcadas.n)} de ${fmt(tiempos.marcadas.de)} marcadas` : "sin umbral declarado",
      tiempos.resumen?.mediana != null ? `mediana ${tiempos.resumen.mediana.toFixed(1)} min` : null,
    ].filter(Boolean).join(" · ");

  return {
    noCuenta: total && filas.length ? { titulo: `Lo que no cuenta, por ${etiqueta}`, filas, total } : null,
    duracion: { declarado: tiempos.umbral.declarado, minutos: tiempos.umbral.minutos, resumen },
  };
}

export const MARCA_REGLAS_AULAS = "monitoreo-aulas-insumos-reglas";
export function readinessDeReglas(cargando: boolean, dashboard: MonitoreoAulasDashboard | null): string {
  if (cargando) return "false";
  return dashboard ? MARCA_REGLAS_AULAS : "vacio:sin-tablero";
}
