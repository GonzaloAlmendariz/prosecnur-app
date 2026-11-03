// Los tres paneles de «Diferencias entre grupos» de la pestaña Láminas (ADR 0126): la regla del estudio (diálogo), el
// «Por qué» de la lámina a la vista (capa anclada) y la revisión del informe (sideover no modal, como Avisos). Se montan
// una vez en LaminasWorkbench; cada uno se abre con su `?panel=`.

import { usePanelDireccionable } from "../../../../lib/navegacion/paneles";
import { PANEL_DIFERENCIAS_INFORME } from "../../panelesGraficos";
import type { EstructuraInforme } from "../modeloEstructura";
import { PorQuePopover } from "./PorQuePopover";
import { ReglaDiferenciasDialog } from "./ReglaDiferenciasDialog";
import { RevisionDiferenciasPanel } from "./RevisionDiferenciasPanel";

type Props = {
  slideId: string | null;
  estructura: EstructuraInforme;
  onIr: (posicion: number) => void;
};

export function DiferenciasPaneles({ slideId, estructura, onIr }: Props) {
  const revision = usePanelDireccionable(PANEL_DIFERENCIAS_INFORME);
  return (
    <>
      <ReglaDiferenciasDialog />
      <PorQuePopover slideId={slideId} />
      {revision.abierto && <RevisionDiferenciasPanel panel={revision} estructura={estructura} slideIdActual={slideId} onIr={onIr} />}
    </>
  );
}
