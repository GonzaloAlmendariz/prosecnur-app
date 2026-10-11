// CTA «Armar desde un plan sugerido» de los vacíos de Láminas y Vista general (contrato A5 2b). Abre el mismo popover
// direccionable de la barra (`panel=armar-desde`); en el informe compartido queda `aria-disabled` con el motivo a la
// vista, sin abrir nada ni llamar al backend.

import { useId } from "react";
import { useLocation } from "react-router-dom";
import { LayoutTemplate } from "../../../vendor/lucide-react";
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
      <button
        type="button"
        className={`pulso-f6-boton${motivo ? " is-deshabilitado" : ""}`}
        onClick={motivo ? undefined : panel.abrir}
        {...(motivo ? { "aria-disabled": true, "aria-describedby": motivoId } : {})}
      >
        <LayoutTemplate size={14} aria-hidden="true" />
        {ROTULO_ARMAR_DESDE_VACIO}
      </button>
      {motivo && <p id={motivoId} className="pulso-f6-armar-motivo">{motivo}</p>}
    </>
  );
}
