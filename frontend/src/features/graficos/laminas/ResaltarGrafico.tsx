// «Resaltar la barra más alta»: por defecto todas las barras van en un mismo color; resaltar la mayor es una decisión de
// cada gráfico (Gonzalo, 2026-10-11). Se guarda en `overrides.resaltar_mayor`.

import { useId } from "react";
import type { GraficadorRef } from "../../../api/graficos";
import { Switch } from "../../../components/Switch";
import { usePlanStore } from "../store";

export const GRAFICOS_CON_RESALTE = new Set(["p_barras_agrupadas", "p_barras_categoricas"]);

export function resaltaMayor(args: Record<string, unknown>): boolean {
  const ov = args.overrides && typeof args.overrides === "object" ? (args.overrides as Record<string, unknown>) : {};
  return (ov.resaltar_mayor ?? args.resaltar_mayor) === true;
}

export function ResaltarGrafico({ slideId, slot, valor }: { slideId: string; slot: string; valor: GraficadorRef }) {
  const id = useId();
  const updateSlotArgs = usePlanStore((s) => s.updateSlotArgs);
  if (!GRAFICOS_CON_RESALTE.has(valor.graficador)) return null;
  const args = (valor.args ?? {}) as Record<string, unknown>;
  const activo = resaltaMayor(args);
  const cambiar = () => {
    const ov: Record<string, unknown> = { ...(args.overrides && typeof args.overrides === "object" ? (args.overrides as Record<string, unknown>) : {}) };
    if (activo) delete ov.resaltar_mayor; else ov.resaltar_mayor = true;
    updateSlotArgs(slideId, slot, { overrides: ov });
  };
  return (
    <div className="pulso-f6-dato" data-qa="resaltar-mayor">
      <span className="pulso-f6-dato-rotulo" id={id}>Resaltar la barra más alta</span>
      <Switch checked={activo} ariaLabel="Resaltar la barra más alta" onToggle={cambiar} />
    </div>
  );
}
