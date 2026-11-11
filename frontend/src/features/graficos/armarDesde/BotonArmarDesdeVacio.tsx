// CTA de los vacíos de Láminas y Vista general (contrato A5 2b). En la base activa lleva a la pestaña Plantillas
// (2026-11-11); en el informe compartido abre el popover direccionable de la barra (`panel=armar-desde`, ADR 0096
// decisión 9).

import { LayoutTemplate } from "../../../vendor/lucide-react";
import { PulsoButton } from "../../../components/PulsoButton";
import { useLocation } from "react-router-dom";
import { usePanelDireccionable } from "../../../lib/navegacion/paneles";
import { useIrAPlantillas } from "../plantillas/useIrAPlantillas";
import { useGraficosReportScope } from "../reportScope";
import { PANEL_ARMAR_DESDE } from "../panelesGraficos";
import "./armarDesde.css";

export const ROTULO_ARMAR_DESDE_VACIO = "Armar desde un plan sugerido";
export const ROTULO_ELEGIR_PLANTILLA = "Elegir una plantilla";

export function BotonArmarDesdeVacio() {
  const panel = usePanelDireccionable(PANEL_ARMAR_DESDE);
  const irAPlantillas = useIrAPlantillas();
  const enPestana = useGraficosReportScope(useLocation().search) !== "consolidated";
  // W2-B: el CTA del vacío es el primario (uno por superficie).
  return (
    <PulsoButton variant="primary" onClick={enPestana ? irAPlantillas : panel.abrir}>
      <LayoutTemplate size={14} aria-hidden="true" />
      {enPestana ? ROTULO_ELEGIR_PLANTILLA : ROTULO_ARMAR_DESDE_VACIO}
    </PulsoButton>
  );
}
