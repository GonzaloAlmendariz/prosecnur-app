import { TabHeading, type TabHeadingEstado } from "../../components/TabHeading";
import { ClipboardList } from "../../vendor/lucide-react";
import {
  cargaWorkspaceItems,
  type CargaWorkspaceContext,
  type CargaWorkspaceState,
  type CargaWorkspaceTab,
} from "./CargaWorkspaceModel";

export type CargaWorkspaceHeaderProps = {
  active: CargaWorkspaceTab;
  context: CargaWorkspaceContext;
};

/**
 * Carga usa la cabecera única de pestaña del kit (L14): el rótulo "Carga", el
 * estado como palabra fuera del h2 y el detalle de la pestaña. Neutral y
 * "Revisando" no llevan palabra de estado.
 */
export function estadoDeCabecera(estado: CargaWorkspaceState): TabHeadingEstado | undefined {
  if (estado === "ready") return "listo";
  if (estado === "attention") return "atencion";
  if (estado === "pending") return "parcial";
  return undefined;
}

export function CargaWorkspaceHeader({
  active,
  context,
}: CargaWorkspaceHeaderProps) {
  const items = cargaWorkspaceItems(context);
  const activeItem = items.find((item) => item.key === active) ?? items[0];

  return (
    <TabHeading
      eyebrow="Carga"
      titulo={activeItem.label}
      icono={ClipboardList}
      estado={estadoDeCabecera(activeItem.state)}
      detalle={activeItem.description}
    />
  );
}
