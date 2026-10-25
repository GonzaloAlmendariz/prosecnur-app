import type { ProjectOverview } from "../../api/client";

/**
 * La lectura de avance de la tarjeta de Monitoreo (L20, Meta B): la cifra con
 * su base y, mientras el tablero se regenera, el estado en lugar de la cifra.
 *
 * `regenerando` todavía no lo manda el backend (`.overview_monitoreo_facts`
 * en `api/R/project_overview.R`): se lee como opcional para que la tarjeta lo
 * respete en cuanto llegue, sin otra vuelta por el frontend. Ver
 * `docs/qa/revamp-monitoreo/plan-metab-insignia.md`.
 */

export type HechosDeMonitoreo = ProjectOverview["facts"]["monitoreo"] & {
  /** El tablero se está regenerando: la cifra guardada es la del corte anterior. */
  regenerando?: boolean;
};

/** El mismo formato que `formatCount` de la tarjeta: «2,296». */
function cuenta(valor: number): string {
  return Number.isFinite(valor) ? Math.max(0, valor).toLocaleString("es-PE") : "Sin dato";
}

/** «423 de 400 efectivas» cuando hay meta y «188 efectivas de 519» si sólo hay universo. */
export function baseDelAvance(hechos: HechosDeMonitoreo): string {
  const valid = hechos.valid_label || "válidos";
  if (hechos.target > 0) return `${cuenta(hechos.valid)} de ${cuenta(hechos.target)} ${valid}`;
  if (hechos.collected > 0) return `${cuenta(hechos.valid)} ${valid} de ${cuenta(hechos.collected)}`;
  return "";
}

/**
 * La sub-línea: la base y, después, si se cumplió o cuánto falta. Una sola
 * frase con coma, sin encadenar con «·».
 */
export function lineaDelAvance(hechos: HechosDeMonitoreo): string {
  const base = baseDelAvance(hechos);
  if (!base) return "";
  if (!(hechos.target > 0)) return base;
  const faltan = Math.max(0, hechos.target - hechos.valid);
  return faltan === 0 ? `${base}, meta cumplida` : `${base}, faltan ${cuenta(faltan)}`;
}

/**
 * El que va último, si de verdad está rezagado respecto del conjunto. Un actor
 * que ya cumplió su meta no está rezagado aunque el agregado vaya más arriba.
 */
export function rezagado(hechos: HechosDeMonitoreo): string {
  const { actors_count: actores, lagging_actor: actor, lagging_pct: pct } = hechos;
  if (!actores || actores <= 1 || !actor || typeof pct !== "number" || pct < 0 || pct >= 100) return "";
  if (!(pct < hechos.avance_pct)) return "";
  return `${actor} al ${Math.round(pct)}%`;
}

export function estaRegenerando(hechos: HechosDeMonitoreo): boolean {
  return hechos.regenerando === true;
}
