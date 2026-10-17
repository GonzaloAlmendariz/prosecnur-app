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
import { estadoListasRepetidas } from "../listas";
import { PESTANAS_EDITOR, type EditorFormulariosPestanaId } from "./pestanaEditor";
import "../styles/xf-pestanas.css";

export const ID_PANEL_PESTANA_EDITOR = "xf-pestana-panel";
export const idPestanaEditor = (key: EditorFormulariosPestanaId) => `xf-pestana-${key}`;

export function EditorPestanas({ pestana, onCambiar, listasRepetidas = 0, children }: {
  pestana: EditorFormulariosPestanaId;
  onCambiar: (pestana: EditorFormulariosPestanaId) => void;
  /** Escalas repetidas: el aviso viaja en la pestaña Listas de opciones (antes era un botón propio en la banda). */
  listasRepetidas?: number;
  children: ReactNode;
}) {
  const aviso = estadoListasRepetidas(listasRepetidas);
  const items = aviso
    ? PESTANAS_EDITOR.map((p) => (p.key === "opciones" ? { ...p, estado: "parcial" as const, estadoLabel: aviso } : p))
    : PESTANAS_EDITOR;
  return (
    <AdaptiveSplitView
      ariaLabel="Mesa de trabajo del formulario"
      railLabel="Pestañas del formulario"
      className="pulso-xlsform-workbench-panel pulso-xf-pestanas pulso-context-tab-layout"
      rail={(
        <ContextTabRail
          ariaLabel="Pestañas del formulario"
          activeKey={pestana}
          items={items}
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
