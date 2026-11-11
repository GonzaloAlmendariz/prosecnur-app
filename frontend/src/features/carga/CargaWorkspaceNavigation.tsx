import { ContextTabRail, type ContextTabRailItem } from "../../components/ContextTabRail";
import { ETIQUETAS_GRUPO_PESTANA } from "../../lib/navegacion/catalogos/procesamiento";
import {
  cargaWorkspaceItems,
  type CargaWorkspaceContext,
  type CargaWorkspaceItem,
  type CargaWorkspaceState,
  type CargaWorkspaceTab,
} from "./CargaWorkspaceModel";
import "./CargaWorkspaceNavigation.css";
import "./CargaWorkbenchBajo.css";

export const CARGA_WORKSPACE_PANEL_ID = "carga-workspace-panel";

export function cargaWorkspaceTabId(tab: CargaWorkspaceTab): string {
  return `carga-workspace-tab-${tab}`;
}

const CARGA_WORKSPACE_RAIL_STATES = {
  neutral: "no-evaluado",
  pending: "sin-configurar",
  attention: "parcial",
  ready: "listo",
} as const satisfies Readonly<
  Record<CargaWorkspaceState, NonNullable<ContextTabRailItem<CargaWorkspaceTab>["estado"]>>
>;

/**
 * Una pestaña de Carga en el riel: ícono y grupo del catálogo. Sin palabra de
 * estado (Variables) el riel no dice ninguna, ni siquiera "No evaluado".
 */
export function railItemDeCarga(
  workspaceItem: CargaWorkspaceItem,
): ContextTabRailItem<CargaWorkspaceTab> {
  return {
    key: workspaceItem.key,
    label: workspaceItem.label,
    description: workspaceItem.summary,
    icon: workspaceItem.icon,
    ...(workspaceItem.statusLabel
      ? { estado: CARGA_WORKSPACE_RAIL_STATES[workspaceItem.state], estadoLabel: workspaceItem.statusLabel }
      : {}),
    ...(workspaceItem.grupo ? { grupo: ETIQUETAS_GRUPO_PESTANA[workspaceItem.grupo] } : {}),
  };
}

export type CargaWorkspaceNavigationProps = {
  active: CargaWorkspaceTab;
  context: CargaWorkspaceContext;
  onChange: (tab: CargaWorkspaceTab) => void;
  panelId?: string | ((tab: CargaWorkspaceTab) => string);
};

export function CargaWorkspaceNavigation({
  active,
  context,
  onChange,
  panelId = CARGA_WORKSPACE_PANEL_ID,
}: CargaWorkspaceNavigationProps) {
  const workspaceItems = cargaWorkspaceItems(context);
  const activeItem = workspaceItems.find((candidate) => candidate.key === active)
    ?? workspaceItems[0];
  const railItems: readonly ContextTabRailItem<CargaWorkspaceTab>[] = workspaceItems.map(railItemDeCarga);

  return (
    <div
      className="pulso-carga-workspace-navigation"
      data-workspace-state={activeItem.state}
    >
      <ContextTabRail
        ariaLabel="Pestañas de carga"
        activeKey={active}
        items={railItems}
        panelId={panelId}
        tabId={cargaWorkspaceTabId}
        onChange={onChange}
        className="pulso-carga-workspace-tab-rail"
      />
      <span
        className="pulso-carga-workspace-status"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {activeItem.statusLabel
          ? `${activeItem.label}: ${activeItem.statusLabel}. ${activeItem.description}`
          : `${activeItem.label}. ${activeItem.description}`}
      </span>
    </div>
  );
}
