// Metas de cuota telefónica: idénticas entre las páginas de Telefónico y
// Acreditación (L33 parte 2, lote 2). Se movieron sin cambiar una línea; las dos
// páginas las importan de aquí. Semántica de familia: no se fusiona nada más.
import type { MonitoreoGoal } from "../../../api/client";
import { normalizeSourceMatch } from "../profiles/telefonico/formato";
import { phoneQuotaGoalValue, uniqueDisplayValues } from "./helpersComunesTelAcr";

export const PHONE_QUOTA_ACTOR_FILTER_KEYS = new Set([
  "actor",
  "dim actor",
  "unidad",
  "publico objetivo",
  "público objetivo",
]);

export function phoneQuotaGoalHasActor(goal: MonitoreoGoal) {
  return Object.keys(goal.filters ?? {}).some(phoneQuotaIsActorFilterKey);
}
export function phoneQuotaIsActorFilterKey(key: string) {
  return PHONE_QUOTA_ACTOR_FILTER_KEYS.has(normalizeSourceMatch(key));
}
export function phoneQuotaGoalTotal(goals: MonitoreoGoal[], variable: string) {
  return goals.reduce((sum, goal) => (
    !phoneQuotaGoalHasActor(goal) && phoneQuotaGoalValue(goal, variable)
      ? sum + Math.max(0, Number(goal.meta) || 0)
      : sum
  ), 0);
}
export function phoneQuotaRemoveGoal(goals: MonitoreoGoal[], variable: string, value: string) {
  const cleanValue = value.trim();
  return goals.filter((goal) => {
    if (phoneQuotaGoalHasActor(goal)) return true;
    return phoneQuotaGoalValue(goal, variable) !== cleanValue;
  });
}
export function phoneQuotaGoalVariables(goals: MonitoreoGoal[] = []) {
  const names = goals.flatMap((goal) => (
    phoneQuotaGoalHasActor(goal)
      ? []
      : Object.keys(goal.filters ?? {}).filter((key) => String(goal.filters?.[key] ?? "").trim())
  ));
  return uniqueDisplayValues(names);
}
export function phoneQuotaUpsertGoal(goals: MonitoreoGoal[], variable: string, value: string, meta: number, keepZero = false) {
  const cleanValue = value.trim();
  const cleanMeta = Math.max(0, Number(meta) || 0);
  const next = goals.filter((goal) => {
    if (phoneQuotaGoalHasActor(goal)) return true;
    return phoneQuotaGoalValue(goal, variable) !== cleanValue;
  });
  if (cleanValue && (cleanMeta > 0 || keepZero)) {
    next.push({ filters: { [variable]: cleanValue }, meta: cleanMeta });
  }
  return next;
}
