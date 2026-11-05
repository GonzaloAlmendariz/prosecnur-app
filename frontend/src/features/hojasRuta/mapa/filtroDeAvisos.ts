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

/**
 * El texto de un aviso del motor, en buen castellano. El motor (congelado) escribe «2 distrito(s) no tienen
 * N externo»: los avisos conocidos se reescriben con su número y la concordancia del verbo; en los demás,
 * el «(s)» se resuelve por el número que lo precede.
 */
const POR_CODIGO: Record<string, (n: number) => string> = {
  W_EXTERNAL_DISTRICT_MISSING: (n) => (n === 1 ? "1 distrito no tiene N externo." : `${formatoConteo(n)} distritos no tienen N externo.`),
  W_DISTRICT_MARGIN_HIGH: (n) => (n === 1 ? "1 distrito queda con margen de error distrital alto." : `${formatoConteo(n)} distritos quedan con margen de error distrital alto.`),
};
export function textoDeAviso(a: Pick<HojasRutaAlert, "code" | "message">): string {
  const texto = a.message ?? "";
  const n = Number(/^(\d+)\s/.exec(texto)?.[1]);
  const propio = POR_CODIGO[a.code ?? ""];
  if (propio && Number.isFinite(n)) return propio(n);
  return texto.replace(/(\d+)(\s+[^\s(]+)\(s\)/g, (_, k: string, palabra: string) => `${k}${palabra}${Number(k) === 1 ? "" : "s"}`);
}

/** Las cuotas que no cuadran con el N objetivo (el chip en aviso de la clásica); null si cuadran. */
export function cuotasDescuadradas(quota: Pick<QuotaPlan, "total_asignado" | "n_objetivo"> | null | undefined): string | null {
  if (!quota || !Number.isFinite(quota.total_asignado) || !Number.isFinite(quota.n_objetivo)) return null;
  if (quota.total_asignado === quota.n_objetivo) return null;
  const fmt = (n: number) => formatoConteo(n);
  return `Las cuotas reparten ${fmt(quota.total_asignado)} entrevistas y el N objetivo es ${fmt(quota.n_objetivo)}.`;
}
