// CTA «Armar desde un plan sugerido» de los vacíos de Láminas y Vista general (contrato A5 2b). Abre el mismo popover
// direccionable de la barra (`panel=armar-desde`), también en el informe compartido (ADR 0096 decisión 9). Si algún
// alcance vuelve a tener motivo (`motivoArmarDesdeDeshabilitado`), queda `aria-disabled` con el motivo a la vista.

import { useId } from "react";
import { useLocation } from "react-router-dom";
import { LayoutTemplate } from "../../../vendor/lucide-react";
import { PulsoButton } from "../../../components/PulsoButton";
import { usePanelDireccionable } from "../../../lib/navegacion/paneles";
import { PANEL_ARMAR_DESDE } from "../panelesGraficos";
import { useGraficosReportScope } from "../reportScope";
import { motivoArmarDesdeDeshabilitado } from "./aplicarPlanSugerido";
import "./armarDesde.css";

export const ROTULO_ARMAR_DESDE_VACIO = "Armar desde un plan sugerido";

export function BotonArmarDesdeVacio() {
  const panel = usePanelDireccionable(PANEL_ARMAR_DESDE);
  const motivo = motivoArmarDesdeDeshabilitado(useGraficosReportScope(useLocation().search));
  const motivoId = useId();
  return (
    <>
      {/* W2-B: el CTA del vacío es el primario (uno por superficie); inactivo, el deshabilitado honesto del kit. */}
      <PulsoButton
        variant="primary"
        onClick={motivo ? undefined : panel.abrir}
        {...(motivo ? { "aria-disabled": true, "aria-describedby": motivoId } : {})}
      >
        <LayoutTemplate size={14} aria-hidden="true" />
        {ROTULO_ARMAR_DESDE_VACIO}
      </PulsoButton>
      {motivo && <p id={motivoId} className="pulso-f6-armar-motivo">{motivo}</p>}
    </>
  );
}
