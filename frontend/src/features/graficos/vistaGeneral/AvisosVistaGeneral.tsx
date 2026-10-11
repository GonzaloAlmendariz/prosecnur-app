// «N avisos» de la barra común abre `panel=avisos` también en Vista general (contrato A5 2b): el mismo `PanelAvisos` de
// Láminas, sobre el clasificador. Cada aviso con lámina lleva a Láminas con `foco=<id>` (la vía de abrir una tarjeta).

import { useMemo } from "react";
import { usePanelDireccionable } from "../../../lib/navegacion/paneles";
import { useAvisosPlanSesion } from "../avisosPlan";
import { PANEL_AVISOS_INFORME } from "../panelesGraficos";
import { usePlanStore } from "../store";
import { usePlanValidator } from "../usePlanValidator";
import { useLaminasUi } from "../laminas/laminasStore";
import type { EstructuraInforme } from "../laminas/modeloEstructura";
import { PanelAvisos } from "../laminas/PanelAvisos";
import { agruparAvisos } from "../laminas/resumenInforme";
import { useDeclaracionAplicada } from "../useDeclaracionAplicada";

type Props = {
  estructura: EstructuraInforme;
  /** Abre la lámina (por id) en Láminas. */
  onIr: (id: string) => void;
};

export function AvisosVistaGeneral({ estructura, onIr }: Props) {
  const avisos = usePanelDireccionable(PANEL_AVISOS_INFORME);
  if (!avisos.abierto) return null;
  return <PanelAvisosAbierto panel={avisos} estructura={estructura} onIr={onIr} />;
}

// Aparte para que el validador y el agrupado corran sólo con el panel abierto.
function PanelAvisosAbierto({ panel, estructura, onIr }: Props & { panel: ReturnType<typeof usePanelDireccionable> }) {
  const slides = usePlanStore((s) => s.plan.slides);
  const resumenes = useLaminasUi((s) => s.resumenes);
  const avisosPlan = useAvisosPlanSesion();
  const { issues } = usePlanValidator();
  const ids = useMemo(() => slides.map((s) => s.id), [slides]);
  const { avisos: avisosEquivalencias } = useDeclaracionAplicada();
  const grupos = useMemo(() => agruparAvisos(issues, resumenes, ids, avisosPlan, avisosEquivalencias), [issues, resumenes, ids, avisosPlan, avisosEquivalencias]);
  const irAPosicion = (posicion: number) => {
    const id = estructura.laminas[posicion - 1]?.id;
    if (id) onIr(id);
  };
  return <PanelAvisos panel={panel} grupos={grupos} estructura={estructura} onIr={irAPosicion} />;
}
