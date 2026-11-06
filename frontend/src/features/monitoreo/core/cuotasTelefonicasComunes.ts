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
  // Una cuota referencial no suma a la meta (ADR 0126): su número es referencia.
  return goals.reduce((sum, goal) => (
    !phoneQuotaGoalHasActor(goal) && phoneQuotaGoalValue(goal, variable) && goal.caracter !== "referencial"
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
  // El carácter declarado (ADR 0126) viaja con la cuota al cambiar su número.
  const caracter = goals.find((goal) => !phoneQuotaGoalHasActor(goal) && phoneQuotaGoalValue(goal, variable) === cleanValue)?.caracter;
  const next = goals.filter((goal) => {
    if (phoneQuotaGoalHasActor(goal)) return true;
    return phoneQuotaGoalValue(goal, variable) !== cleanValue;
  });
  if (cleanValue && (cleanMeta > 0 || keepZero || caracter === "referencial")) {
    next.push({ filters: { [variable]: cleanValue }, meta: cleanMeta, ...(caracter ? { caracter } : {}) });
  }
  return next;
}

/** El carácter declarado de la cuota `variable = value` (sin actor), o `null`. */
export function phoneQuotaGoalCaracter(goals: MonitoreoGoal[], variable: string, value: string): MonitoreoGoal["caracter"] {
  const cleanValue = value.trim();
  return goals.find((goal) => !phoneQuotaGoalHasActor(goal) && phoneQuotaGoalValue(goal, variable) === cleanValue)?.caracter ?? null;
}

/**
 * Declara el carácter de la cuota `variable = value`. Una referencial sin número
 * se guarda con meta 0 y su carácter, para que la lista blanca la conserve.
 */
export function phoneQuotaSetCaracter(goals: MonitoreoGoal[], variable: string, value: string, caracter: "meta" | "referencial") {
  const cleanValue = value.trim();
  if (!cleanValue) return goals;
  const actual = goals.find((goal) => !phoneQuotaGoalHasActor(goal) && phoneQuotaGoalValue(goal, variable) === cleanValue);
  const resto = goals.filter((goal) => phoneQuotaGoalHasActor(goal) || phoneQuotaGoalValue(goal, variable) !== cleanValue);
  return [...resto, { ...(actual ?? { filters: { [variable]: cleanValue }, meta: 0 }), caracter }];
}

/**
 * Lo que Modelo › Cuotas necesita para declarar meta o referencial (ADR 0126):
 * lo declarado por categoría y cómo guardarlo. Vive aquí para que la página
 * congelada lo conecte en una línea.
 */
export function caracterDeCuotas(goals: MonitoreoGoal[], variable: string, patchGoals: (goals: MonitoreoGoal[]) => void) {
  const caracteres: Record<string, MonitoreoGoal["caracter"]> = {};
  for (const goal of goals) {
    const valor = phoneQuotaGoalHasActor(goal) ? "" : phoneQuotaGoalValue(goal, variable);
    if (valor && goal.caracter) caracteres[valor] = goal.caracter;
  }
  return {
    caracteres,
    onCaracter: (valor: string, caracter: "meta" | "referencial") => {
      if (variable) patchGoals(phoneQuotaSetCaracter(goals, variable, valor, caracter));
    },
  };
}
