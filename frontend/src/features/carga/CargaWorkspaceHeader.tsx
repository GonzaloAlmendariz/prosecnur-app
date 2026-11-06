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
 * Carga usa la cabecera única de pestaña del kit (L14): «Pestaña n de m» porque
 * Carga sí es un recorrido con orden, el estado como palabra fuera del h2 y el
 * detalle de la pestaña. Neutral y «Revisando…» no llevan palabra de estado.
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
  const activeIndex = Math.max(0, items.findIndex((item) => item.key === active));
  const activeItem = items[activeIndex] ?? items[0];

  return (
    <TabHeading
      eyebrow="Carga"
      titulo={activeItem.label}
      icono={ClipboardList}
      estado={estadoDeCabecera(activeItem.state)}
      detalle={activeItem.description}
      pestanaN={activeIndex + 1}
      pestanaDe={items.length}
    />
  );
}
