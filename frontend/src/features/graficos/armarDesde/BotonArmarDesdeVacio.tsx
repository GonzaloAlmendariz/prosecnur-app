// CTA «Armar desde un plan sugerido» de los vacíos de Láminas y Vista general (contrato A5 2b). Abre el mismo popover
// direccionable de la barra (`panel=armar-desde`), también en el informe compartido (ADR 0096 decisión 9).

import { LayoutTemplate } from "../../../vendor/lucide-react";
import { PulsoButton } from "../../../components/PulsoButton";
import { usePanelDireccionable } from "../../../lib/navegacion/paneles";
import { PANEL_ARMAR_DESDE } from "../panelesGraficos";
import "./armarDesde.css";

export const ROTULO_ARMAR_DESDE_VACIO = "Armar desde un plan sugerido";

export function BotonArmarDesdeVacio() {
  const panel = usePanelDireccionable(PANEL_ARMAR_DESDE);
  // W2-B: el CTA del vacío es el primario (uno por superficie).
  return (
    <PulsoButton variant="primary" onClick={panel.abrir}>
      <LayoutTemplate size={14} aria-hidden="true" />
      {ROTULO_ARMAR_DESDE_VACIO}
    </PulsoButton>
  );
}
