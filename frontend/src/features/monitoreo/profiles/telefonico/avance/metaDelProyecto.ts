import type { MonitoreoState } from "../../../../../api/client";

/**
 * La meta de efectivas del proyecto: el objetivo total declarado o, si no lo
 * hay, la suma de las metas por categoría (sin metas por actor). `null` si el
 * proyecto no declara ninguna.
 */
export function metaDelProyecto(state: MonitoreoState | null | undefined): number | null {
  const config = state?.config;
  if (!config) return null;
  if (config.objetivo_total != null && config.objetivo_total > 0) return config.objetivo_total;
  const suma = (config.goals ?? [])
    .filter((goal) => Object.keys(goal.filters ?? {}).some((clave) => String(goal.filters?.[clave] ?? "").trim()))
    .reduce((total, goal) => total + Math.max(0, Number(goal.meta) || 0), 0);
  return suma > 0 ? suma : null;
}
