// Ranuras de gráfico de una lámina sobre su imagen (F6.1, parte 2). La geometría sale de la matriz de composición
// efectiva (`slide-layout-matrix`, la misma que usa el Editor anterior), con coordenadas relativas a la lámina (0–1).
// Sólo se toman las regiones de gráfico visibles que corresponden a ranuras del tipo, en el orden de las ranuras:
// la ranura k es la que nombra `foco=<slide.id>:gK` (`../focoLamina.ts`).

import type { GraficosSlideLayoutRegion } from "../../../api/graficos";

export type RanuraSobreLamina = { k: number; slot: string; rect: { x: number; y: number; width: number; height: number } };

export function ranurasSobreLamina(slots: readonly string[], regiones: readonly GraficosSlideLayoutRegion[]): RanuraSobreLamina[] {
  const salida: RanuraSobreLamina[] = [];
  slots.forEach((slot, i) => {
    const r = regiones.find((reg) => reg.visible && reg.role === "chart" && reg.payload_key === slot);
    if (!r) return;
    const { x, y, width, height } = r.rect;
    const ok = [x, y, width, height].every((v) => Number.isFinite(v)) && width > 0 && height > 0;
    if (!ok) return;
    const c = (v: number) => Math.min(1, Math.max(0, v));
    salida.push({ k: i + 1, slot, rect: { x: c(x), y: c(y), width: Math.min(width, 1 - c(x)), height: Math.min(height, 1 - c(y)) } });
  });
  return salida;
}
