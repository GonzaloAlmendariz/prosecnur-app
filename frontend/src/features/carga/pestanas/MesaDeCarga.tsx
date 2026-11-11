import type { ReactNode } from "react";
import { AdaptiveSplitView } from "../../../components/AdaptiveSplitView";
import { CARGA_WORKSPACE_TABS, type CargaWorkspaceContext, type CargaWorkspaceTab } from "../CargaWorkspaceModel";
import { CargaWorkspaceHeader } from "../CargaWorkspaceHeader";
import {
  CARGA_WORKSPACE_PANEL_ID,
  CargaWorkspaceNavigation,
  cargaWorkspaceTabId,
} from "../CargaWorkspaceNavigation";

/**
 * Mesa de trabajo de Carga: riel de pestañas, encabezado y panel de la pestaña
 * activa. Con varias bases el panel va enmarcado y su cuerpo es un área de
 * scroll propia; con una base el cuerpo es el panel mismo.
 */
export function MesaDeCarga({
  varias,
  activa,
  contexto,
  onCambiar,
  children,
}: {
  varias: boolean;
  activa: CargaWorkspaceTab;
  contexto: CargaWorkspaceContext;
  onCambiar: (pestana: CargaWorkspaceTab) => void;
  children: ReactNode;
}) {
  const planActivo = activa === CARGA_WORKSPACE_TABS[0].key;
  // Pestañas de lectura que crecen con su contenido en escritorio bajo
  // (CargaWorkbenchBajo.css). Revisión lleva su propia regla.
  const crece = activa === "fuentes" || activa === "equivalencias";
  return (
    <AdaptiveSplitView
      ariaLabel={varias ? "Mesa de trabajo de varias bases" : "Mesa de trabajo de carga"}
      railLabel="Pestañas de carga"
      className={varias
        ? `pulso-upload-section pulso-carga-workbench pulso-carga-workbench--multibase pulso-context-tab-layout${activa === "revision" ? " pulso-carga-workbench--revision" : ""}${crece ? " pulso-carga-workbench--crece" : ""}`
        : `pulso-upload-section pulso-carga-workbench pulso-context-tab-layout${crece ? " pulso-carga-workbench--crece" : ""}`}
      rail={(
        <CargaWorkspaceNavigation
          active={activa}
          context={contexto}
          onChange={onCambiar}
        />
      )}
    >
      <div
        id={CARGA_WORKSPACE_PANEL_ID}
        role="tabpanel"
        aria-labelledby={cargaWorkspaceTabId(activa)}
        tabIndex={0}
        className={varias
          ? `pulso-carga-content pulso-content-area pulso-carga-content--multi pulso-carga-content--framed${planActivo ? " is-plan" : ""}`
          : `pulso-carga-content pulso-content-area${planActivo ? " is-plan" : ""}`}
      >
        <CargaWorkspaceHeader active={activa} context={contexto} />
        {varias ? <div className="pulso-carga-scrollarea">{children}</div> : children}
      </div>
    </AdaptiveSplitView>
  );
}
