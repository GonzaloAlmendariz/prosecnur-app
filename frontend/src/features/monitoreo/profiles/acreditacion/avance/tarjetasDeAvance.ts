import type { MonitoreoGoal } from "../../../../../api/client";
import { acreditacionObjetivoDeGoals } from "../AcreditacionObjetivoActor";
import { normalizeSourceMatch } from "../formato";

/**
 * Tarjeta de avance por público: universo, efectivas, parciales, rechazos,
 * sin respuesta y meta. Es la única cuenta del avance de acreditación —la
 * leen el chrome, Avance › Resumen, Avance › Por público y las salidas—, así
 * que una misma cifra dice lo mismo en todas partes. Salió del page-file
 * congelado sin cambiar una línea de lógica.
 */

function num(value: unknown, fallback = 0) {
  if (value == null || value === "") return fallback;
  const parsed = Number(String(value).replace(/%/g, "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function rowNumber(row: Record<string, unknown>, keys: string[], fallback = 0) {
  const normalized = new Map(Object.keys(row).map((key) => [
    key.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(),
    key,
  ]));
  for (const key of keys) {
    const hit = normalized.get(key.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase());
    if (hit) return num(row[hit], fallback);
  }
  return fallback;
}

// Nombres canónicos de columna del reporte de acreditación. Existían SIETE
// listas distintas para el mismo concepto y varias omitían el nombre real:
// el reporte publica "Rechazos plataforma", pero `advanceCardsFromRows` sólo
// buscaba "Rechazo"/"Rechazos"/"Refusals", así que la banda de universo de
// Avance mostraba RECHAZOS 0 mientras la leyenda del gráfico —que sí leía la
// columna buena— mostraba 3 en la misma pantalla (acrconta, 2026-07-26).
// Una métrica, un origen: estos son los alias válidos y no se declaran ad hoc.
export const COL_UNIVERSO = ["Universo", "Base reportada", "Total", "Base", "Casos"];
export const COL_EFECTIVAS = ["Efectivas", "Validas", "Válidas", "Completas", "Completed"];
export const COL_PARCIALES = ["Parciales", "Partial"];
export const COL_RECHAZOS = ["Rechazos plataforma", "Rechazos", "Rechazo", "Refusals"];
export const COL_SIN_RESPUESTA = ["Sin respuesta", "Sin respuesta plataforma", "Pendientes", "Unanswered", "Pending"];

export type AcreditacionAdvanceCard = {
  id: string;
  actor: string;
  /** Objetivo declarado para este actor (barrido | minimo). Null => se sugiere. */
  objetivo?: "barrido" | "minimo" | null;
  universe: number;
  effective: number;
  partial: number;
  refusals: number;
  pending: number;
  meta: number | null;
  missing: number | null;
  progress: number | null;
  coverage: number | null;
  statusTone: "complete" | "steady" | "low" | "muted";
};

export function rowText(row: Record<string, unknown>, keys: string[], fallback = "") {
  const normalized = new Map(Object.keys(row).map((key) => [
    key.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(),
    key,
  ]));
  for (const key of keys) {
    const hit = normalized.get(key.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase());
    if (!hit) continue;
    const value = row[hit];
    if (value != null && value !== "") return String(value);
  }
  return fallback;
}

export function safePercentValue(value: number | null | undefined, total: number | null | undefined) {
  if (!Number.isFinite(Number(value)) || !Number.isFinite(Number(total)) || Number(total) <= 0) return null;
  return (Number(value) / Number(total)) * 100;
}

function advanceGoalForActor(actor: string, goals: MonitoreoGoal[]) {
  const actorKey = normalizeSourceMatch(actor);
  const direct = goals.find((goal) => Object.values(goal.filters ?? {}).some((value) => normalizeSourceMatch(value) === actorKey));
  return direct && Number.isFinite(Number(direct.meta)) ? Number(direct.meta) : null;
}

export function advanceCardsFromRows(rows: Array<Record<string, unknown>>, goals: MonitoreoGoal[] = []): AcreditacionAdvanceCard[] {
  // Dos actores cuyo nombre normaliza igual —"Estudiantes" en dos cortes, o con
  // distinta capitalización— producían el mismo `id`. React lo veía como una
  // key duplicada y podía **omitir una de las tarjetas sin avisar**: en el corte
  // de acreditación multiactor desaparecía un actor completo de Avance. El
  // desempate mantiene el slug legible y garantiza unicidad.
  const slugsVistos = new Map<string, number>();
  const idUnico = (actor: string, index: number) => {
    const base = normalizeSourceMatch(actor) || String(index);
    const repeticion = slugsVistos.get(base) ?? 0;
    slugsVistos.set(base, repeticion + 1);
    return repeticion === 0 ? `avance-${base}` : `avance-${base}-${repeticion + 1}`;
  };

  return rows.map((row, index) => {
    const actor = rowText(row, ["Actor", "Unidad", "Corte", "Carrera"], `Actor ${index + 1}`);
    const universe = rowNumber(row, COL_UNIVERSO, 0);
    const effective = rowNumber(row, COL_EFECTIVAS, 0);
    const partial = rowNumber(row, COL_PARCIALES, 0);
    const refusals = rowNumber(row, COL_RECHAZOS, 0);
    const explicitPending = rowNumber(row, COL_SIN_RESPUESTA, NaN);
    const pending = Number.isFinite(explicitPending) ? explicitPending : Math.max(0, universe - effective - partial - refusals);
    const rowMeta = rowNumber(row, ["Meta", "Objetivo", "Meta efectiva", "Target"], NaN);
    const goalMeta = advanceGoalForActor(actor, goals);
    const meta = Number.isFinite(rowMeta) && rowMeta > 0 ? rowMeta : goalMeta;
    const missing = meta != null ? Math.max(0, meta - effective) : null;
    const progress = safePercentValue(effective, universe);
    const coverage = progress;
    const targetProgress = meta != null ? safePercentValue(effective, meta) : null;
    const statusTone: AcreditacionAdvanceCard["statusTone"] = meta == null
      ? "muted"
      : missing === 0
        ? "complete"
        : (targetProgress ?? 0) >= 70
          ? "steady"
          : "low";
    return {
      id: idUnico(actor, index),
      actor,
      objetivo: acreditacionObjetivoDeGoals(goals, actor),
      universe,
      effective,
      partial,
      refusals,
      pending,
      meta,
      missing,
      progress,
      coverage,
      statusTone,
    };
  }).sort((a, b) => {
    const aNeeds = a.meta == null ? 1 : 0;
    const bNeeds = b.meta == null ? 1 : 0;
    return aNeeds - bNeeds || b.effective - a.effective || a.actor.localeCompare(b.actor, "es");
  });
}
