/**
 * La meta del corte telefónico es la del proyecto (`objetivo_total` o la suma
 * de metas por cuota), la misma que dice FALTAN y Avance › Cuotas. Las
 * salidas la reconstruían sumando las tarjetas por actor del reporte del
 * cliente, y si una categoría no traía tarjeta la meta salía corta (RMS
 * ficticio: «meta 300» en Entregas contra «40 de 400» en la cabecera).
 */
import type { MonitoreoState } from "../../../../../api/client";
import type { MonitoreoCorte } from "../../../corte/corteContract";
import { metaDelProyecto } from "./metaDelProyecto";

export function conMetaDelProyecto(corte: MonitoreoCorte, state: MonitoreoState | null | undefined): MonitoreoCorte {
  const meta = metaDelProyecto(state) ?? corte.meta;
  if (meta === corte.meta) return corte;
  return {
    ...corte,
    meta,
    brecha: meta != null && corte.oficial != null ? Math.max(0, meta - corte.oficial) : null,
    avancePct: meta != null && meta > 0 && corte.oficial != null ? (corte.oficial / meta) * 100 : null,
  };
}
