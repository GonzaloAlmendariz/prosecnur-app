import { ClipboardList } from "../../vendor/lucide-react";
import {
  cargaWorkspaceItems,
  type CargaWorkspaceContext,
  type CargaWorkspaceTab,
} from "./CargaWorkspaceModel";

export type CargaWorkspaceHeaderProps = {
  active: CargaWorkspaceTab;
  context: CargaWorkspaceContext;
};

export function CargaWorkspaceHeader({
  active,
  context,
}: CargaWorkspaceHeaderProps) {
  const items = cargaWorkspaceItems(context);
  const activeIndex = Math.max(0, items.findIndex((item) => item.key === active));
  const activeItem = items[activeIndex] ?? items[0];

  return (
    <header
      className="pulso-carga-workspace-header"
      data-workspace-state={activeItem.state}
    >
      <span className="pulso-carga-workspace-header-icon" aria-hidden="true">
        <ClipboardList size={17} />
      </span>
      <div className="pulso-carga-workspace-header-copy">
        <span className="pulso-carga-workspace-header-kicker">
          Pestaña {activeIndex + 1} de {items.length}
        </span>
        <div className="pulso-carga-workspace-header-title">
          <h2>{activeItem.label}</h2>
          <span className="pulso-carga-workspace-header-state">
            {activeItem.statusLabel}
          </span>
        </div>
        <p>{activeItem.description}</p>
      </div>
    </header>
  );
}
