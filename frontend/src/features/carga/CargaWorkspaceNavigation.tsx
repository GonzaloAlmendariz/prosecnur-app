import { ContextTabRail, type ContextTabRailItem } from "../../components/ContextTabRail";
import {
  ClipboardCheck,
  ClipboardList,
  GitCompare,
  ListTree,
  Table2,
  UploadCloud,
  type LucideIcon,
} from "../../vendor/lucide-react";
import {
  cargaWorkspaceItems,
  type CargaWorkspaceContext,
  type CargaWorkspaceState,
  type CargaWorkspaceTab,
} from "./CargaWorkspaceModel";
import "./CargaWorkspaceNavigation.css";

export const CARGA_WORKSPACE_PANEL_ID = "carga-workspace-panel";

export function cargaWorkspaceTabId(tab: CargaWorkspaceTab): string {
  return `carga-workspace-tab-${tab}`;
}

const CARGA_WORKSPACE_ICONS: Readonly<Record<CargaWorkspaceTab, LucideIcon>> = {
  plan: ClipboardList,
  fuentes: UploadCloud,
  revision: ClipboardCheck,
  estructura: ListTree,
  datos: Table2,
  equivalencias: GitCompare,
};

const CARGA_WORKSPACE_RAIL_STATES = {
  neutral: "no-evaluado",
  pending: "sin-configurar",
  attention: "parcial",
  ready: "listo",
} as const satisfies Readonly<
  Record<CargaWorkspaceState, NonNullable<ContextTabRailItem<CargaWorkspaceTab>["estado"]>>
>;

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
  const railItems: readonly ContextTabRailItem<CargaWorkspaceTab>[] = workspaceItems.map(
    (workspaceItem) => ({
      key: workspaceItem.key,
      label: workspaceItem.label,
      description: workspaceItem.summary,
      icon: CARGA_WORKSPACE_ICONS[workspaceItem.key],
      estado: CARGA_WORKSPACE_RAIL_STATES[workspaceItem.state],
      estadoLabel: workspaceItem.statusLabel,
    }),
  );

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
        {activeItem.label}: {activeItem.statusLabel}. {activeItem.description}
      </span>
    </div>
  );
}
