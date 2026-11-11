import type { ReactNode } from "react";
import { AdaptiveSplitView } from "../../../components/AdaptiveSplitView";
import type { CargaWorkspaceContext, CargaWorkspaceTab } from "../CargaWorkspaceModel";
import { CargaWorkspaceHeader } from "../CargaWorkspaceHeader";
import {
  CARGA_WORKSPACE_PANEL_ID,
  CargaWorkspaceNavigation,
  cargaWorkspaceTabId,
} from "../CargaWorkspaceNavigation";
import { CabeceraDeCargaContexto, pestanaConCabeceraPropia } from "./bases/contextoDeCabecera";

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
  // Pestañas de lectura que crecen con su contenido en escritorio bajo
  // (CargaWorkbenchBajo.css). Revisión lleva su propia regla. Bases no crece:
  // sus dos marcos (colección e inspector) llegan al borde inferior en todo
  // tamaño y cada uno desplaza su cuerpo (`pestanas/bases/bases.css`).
  const crece = activa === "variables" || activa === "equivalencias";
  const bases = activa === "bases" ? " pulso-carga-workbench--bases" : "";
  return (
    <AdaptiveSplitView
      ariaLabel={varias ? "Mesa de trabajo de varias bases" : "Mesa de trabajo de carga"}
      railLabel="Pestañas de carga"
      className={varias
        ? `pulso-upload-section pulso-carga-workbench pulso-carga-workbench--multibase pulso-context-tab-layout${activa === "revision" ? " pulso-carga-workbench--revision" : ""}${crece ? " pulso-carga-workbench--crece" : ""}${bases}`
        : `pulso-upload-section pulso-carga-workbench pulso-context-tab-layout${crece ? " pulso-carga-workbench--crece" : ""}${bases}`}
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
          ? "pulso-carga-content pulso-content-area pulso-carga-content--multi pulso-carga-content--framed"
          : "pulso-carga-content pulso-content-area"}
      >
        {/* Bases dibuja su cabecera con sus cifras y "Agregar base" (contextoDeCabecera.ts). */}
        {pestanaConCabeceraPropia(activa) ? null : <CargaWorkspaceHeader active={activa} context={contexto} />}
        <CabeceraDeCargaContexto.Provider value={{ activa, contexto }}>
          {varias ? <div className="pulso-carga-scrollarea">{children}</div> : children}
        </CabeceraDeCargaContexto.Provider>
      </div>
    </AdaptiveSplitView>
  );
}
