/**
 * Modelo › Metas (ficha M1): cuántas encuestas por público. La meta y la
 * cobertura se calculan como en la tarjeta de hoy (`AcreditacionModelActorSummaryCard`):
 * meta = personas × cobertura, redondeada; cobertura = meta ÷ personas, con un
 * decimal. Guardar arma las metas con `upsertAcreditacionActorGoal`, el mismo
 * contrato (`filters`, `meta`, `meta_pct`) que guardaba cada tarjeta.
 */

import type { MonitoreoGoal } from "../../../../../api/client";
import { normalizeAcreditacionGoalMatch, upsertAcreditacionActorGoal } from "../AcreditacionActorGoals";

export type FilaDeMeta = {
  publico: string;
  personas: number | null;
  /** Meta guardada hoy. */
  meta: number | null;
  /** Cobertura guardada hoy, en porcentaje. */
  cobertura: number | null;
};

export type BorradorDeMeta = { meta: string; cobertura: string };

function goalDe(goals: readonly MonitoreoGoal[], publico: string) {
  const clave = normalizeAcreditacionGoalMatch(publico);
  return goals.find((goal) => Object.values(goal.filters ?? {}).some((valor) => normalizeAcreditacionGoalMatch(valor) === clave));
}

export function filasDeMetas(
  publicos: ReadonlyArray<{ actor: string; universo: number | null }>,
  goals: readonly MonitoreoGoal[],
): FilaDeMeta[] {
  return publicos.map(({ actor, universo }) => {
    const goal = goalDe(goals, actor);
    const meta = goal && Number.isFinite(Number(goal.meta)) ? Number(goal.meta) : null;
    const pct = goal && Number.isFinite(Number(goal.meta_pct)) ? Number(goal.meta_pct) : null;
    const cobertura = pct ?? (meta != null && universo ? Math.round((meta / universo) * 1000) / 10 : null);
    return { publico: actor, personas: universo, meta, cobertura };
  });
}

export function borradorDe(fila: FilaDeMeta): BorradorDeMeta {
  return { meta: fila.meta == null ? "" : String(fila.meta), cobertura: fila.cobertura == null ? "" : String(fila.cobertura) };
}

/** Escribir la cobertura recalcula la meta, y al revés. */
export function conCobertura(fila: FilaDeMeta, valor: string): BorradorDeMeta {
  const pct = Math.max(0, Math.min(100, Number(valor) || 0));
  return { cobertura: valor, meta: fila.personas ? String(Math.round((fila.personas * pct) / 100)) : "" };
}

export function conMeta(fila: FilaDeMeta, valor: string): BorradorDeMeta {
  const meta = Math.max(0, Math.round(Number(valor) || 0));
  return { meta: valor, cobertura: fila.personas ? String(Math.max(0, Math.min(100, Math.round((meta / fila.personas) * 1000) / 10))) : "" };
}

export function metaDelBorrador(borrador: BorradorDeMeta): number | null {
  return borrador.meta.trim() ? Math.max(0, Math.round(Number(borrador.meta) || 0)) : null;
}

export function coberturaDelBorrador(borrador: BorradorDeMeta): number | null {
  return borrador.cobertura.trim() ? Math.max(0, Math.min(100, Number(borrador.cobertura) || 0)) : null;
}

/** Los públicos cuyo borrador difiere de lo guardado. */
export function cambios(filas: readonly FilaDeMeta[], borradores: Readonly<Record<string, BorradorDeMeta>>) {
  return filas.filter((fila) => {
    const borrador = borradores[fila.publico];
    if (!borrador) return false;
    return metaDelBorrador(borrador) !== fila.meta || coberturaDelBorrador(borrador) !== fila.cobertura;
  });
}

/** Las metas a guardar: una upsert por público cambiado, sobre las metas de hoy. */
export function metasAGuardar(
  goals: readonly MonitoreoGoal[],
  cambiadas: readonly FilaDeMeta[],
  borradores: Readonly<Record<string, BorradorDeMeta>>,
  goalKey: string,
): MonitoreoGoal[] {
  return cambiadas.reduce<MonitoreoGoal[]>((acc, fila) => {
    const borrador = borradores[fila.publico];
    const meta = borrador ? metaDelBorrador(borrador) : null;
    if (meta == null) return acc;
    return upsertAcreditacionActorGoal({ goals: acc, actor: fila.publico, meta, metaPct: borrador ? coberturaDelBorrador(borrador) : null, goalKey });
  }, [...goals]);
}
