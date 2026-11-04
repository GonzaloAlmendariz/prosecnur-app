import type { HojasRutaAlert, QuotaPlan } from "../../../api/hojasRuta";

import { formatoConteo } from "../../../lib/formatoNumero";
/**
 * P5 de la paridad con la página clásica: los avisos que el motor de R ya calcula (`population.alerts`,
 * `quota.alerts`) y que el lienzo no mostraba. Los de nivel «info» no se pintan; un aviso repetido
 * (mismo código y texto) sale una vez.
 */
export function avisosVisibles(avisos: readonly HojasRutaAlert[] | null | undefined): HojasRutaAlert[] {
  const vistos = new Set<string>();
  const out: HojasRutaAlert[] = [];
  for (const a of avisos ?? []) {
    if (!a || a.level === "info" || !a.message) continue;
    const clave = `${a.code}|${a.message}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    out.push(a);
  }
  return out;
}

/** Las cuotas que no cuadran con el N objetivo (el chip en aviso de la clásica); null si cuadran. */
export function cuotasDescuadradas(quota: Pick<QuotaPlan, "total_asignado" | "n_objetivo"> | null | undefined): string | null {
  if (!quota || !Number.isFinite(quota.total_asignado) || !Number.isFinite(quota.n_objetivo)) return null;
  if (quota.total_asignado === quota.n_objetivo) return null;
  const fmt = (n: number) => formatoConteo(n);
  return `Las cuotas reparten ${fmt(quota.total_asignado)} entrevistas y el N objetivo es ${fmt(quota.n_objetivo)}.`;
}
