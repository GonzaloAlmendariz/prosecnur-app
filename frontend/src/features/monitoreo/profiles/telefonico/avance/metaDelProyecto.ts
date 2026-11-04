import type { MonitoreoState } from "../../../../../api/client";
import { phoneQuotaGoalHasActor } from "../../../core/cuotasTelefonicasComunes";

/**
 * La meta de efectivas del proyecto: el objetivo total declarado o, si no lo
 * hay, la suma de las metas de UNA partición (ADR 0126 §6). `null` si el
 * proyecto no declara ninguna.
 *
 * Una partición es una variable sin actor: sumar sexo y edad contaba dos veces
 * la misma muestra, y las metas por actor repetían a las de la variable. Las
 * referenciales no suman: su número es una referencia. Con varias variables
 * manda la de mayor suma, que es la que reparte la muestra entera.
 */
export function metaDelProyecto(state: MonitoreoState | null | undefined): number | null {
  const config = state?.config;
  if (!config) return null;
  if (config.objetivo_total != null && config.objetivo_total > 0) return config.objetivo_total;
  const porVariable = new Map<string, number>();
  for (const goal of config.goals ?? []) {
    if (phoneQuotaGoalHasActor(goal) || goal.caracter === "referencial") continue;
    const claves = Object.keys(goal.filters ?? {}).filter((clave) => String(goal.filters?.[clave] ?? "").trim());
    if (claves.length !== 1) continue;
    porVariable.set(claves[0], (porVariable.get(claves[0]) ?? 0) + Math.max(0, Number(goal.meta) || 0));
  }
  const suma = Math.max(0, ...porVariable.values());
  return suma > 0 ? suma : null;
}
