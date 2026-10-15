// =============================================================================
// shell/EditorPestanas.tsx — rail de pestañas del editor de formularios
// =============================================================================
// Con un formulario abierto, el workbench es un rail icon-only a la izquierda
// (el mismo `ContextTabRail` de Procesamiento › Gráficos) y la pestaña activa a
// la derecha. Reemplaza al toggle «Constructor | Hojas» y al popover «Más
// vistas» de la banda de comandos (2026-10-15). La biblioteca de formularios no
// lleva rail: este componente sólo se monta con un workbook.
// =============================================================================

import type { ReactNode } from "react";
import { AdaptiveSplitView } from "../../../components/AdaptiveSplitView";
import { ContextTabRail } from "../../../components/ContextTabRail";
import { PESTANAS_EDITOR, type EditorFormulariosPestanaId } from "./pestanaEditor";
import "../styles/xf-pestanas.css";

export const ID_PANEL_PESTANA_EDITOR = "xf-pestana-panel";
export const idPestanaEditor = (key: EditorFormulariosPestanaId) => `xf-pestana-${key}`;

export function EditorPestanas({ pestana, onCambiar, children }: {
  pestana: EditorFormulariosPestanaId;
  onCambiar: (pestana: EditorFormulariosPestanaId) => void;
  children: ReactNode;
}) {
  return (
    <AdaptiveSplitView
      ariaLabel="Mesa de trabajo del formulario"
      railLabel="Pestañas del formulario"
      className="pulso-xlsform-workbench-panel pulso-xf-pestanas pulso-context-tab-layout"
      rail={(
        <ContextTabRail
          ariaLabel="Pestañas del formulario"
          activeKey={pestana}
          items={PESTANAS_EDITOR}
          panelId={ID_PANEL_PESTANA_EDITOR}
          tabId={idPestanaEditor}
          onChange={onCambiar}
        />
      )}
    >
      <div
        id={ID_PANEL_PESTANA_EDITOR}
        className="pulso-xf-pestana"
        role="tabpanel"
        aria-labelledby={idPestanaEditor(pestana)}
        data-pestana={pestana}
      >
        {children}
      </div>
    </AdaptiveSplitView>
  );
}
