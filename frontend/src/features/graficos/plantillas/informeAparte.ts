// Informe aparte de la pestaña Plantillas (ítem 48 del checklist de validación, 2026-11-13): cuando el proyecto ya
// tiene láminas, la plantilla no las reemplaza en silencio. Se puede generar el PowerPoint de la plantilla como un
// archivo nuevo, con la misma identidad que tendría al reemplazar, y las láminas del proyecto quedan como están. Puro:
// arma el pedido de exportación a partir de una copia del estado.

import type { PlanJson } from "../../../api/graficos";
import type { PlanSugeridoAplicable } from "../armarDesde/aplicarPlanSugerido";
import { buildGraficosConfig } from "../configSnapshot";
import { cambiosDePlanSugerido, type PlanStore } from "../store";

export type PedidoInformeAparte = {
  plan: PlanJson;
  presets: Record<string, unknown>;
  wPresets: Record<string, unknown>;
  config: ReturnType<typeof buildGraficosConfig>;
};

/** El pedido de PowerPoint con la plantilla aplicada sobre una copia del estado; el estado no cambia. */
export function pedidoDeInformeAparte(estado: PlanStore, entrada: PlanSugeridoAplicable): PedidoInformeAparte {
  const copia = { ...estado, ...cambiosDePlanSugerido(estado, entrada) } as PlanStore;
  return {
    plan: copia.plan,
    presets: copia.presets as Record<string, unknown>,
    wPresets: copia.wPresets as unknown as Record<string, unknown>,
    config: buildGraficosConfig(copia),
  };
}
