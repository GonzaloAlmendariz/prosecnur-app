import type { ReactNode } from "react";
import { TabHeading } from "../../../../../components/TabHeading";
import { chipsDeTexto } from "../../../core/chipsDeTexto";
import type { MonitoreoWorkbenchRailTab } from "../../../components/MonitoreoWorkbenchRail";
import { TELEFONICO_WORKBENCH_VIEWS } from "../../../core/monitoreoRegistry";
import type { SeccionTelefonica } from "./direccionTelefonica";
import { antetituloDePestana } from "./modeloDelRail";
import "./chromeTelefonico.css";

/**
 * Cabecera de pestaña del telefónico: resuelve ícono, antetítulo y nombre
 * desde su sección y los pinta con la variante «sección» del TabHeading del kit
 * (L14: una sola implementación de «estás en esta pestaña» en la app).
 */
export function CabeceraTelefonica({
  seccion,
  pestana,
  pestanas,
  control,
  chips = [],
}: {
  seccion: SeccionTelefonica;
  pestana: string;
  pestanas: readonly MonitoreoWorkbenchRailTab[];
  control?: ReactNode;
  chips?: readonly string[];
}) {
  const definicion = TELEFONICO_WORKBENCH_VIEWS.find((item) => item.key === seccion) ?? TELEFONICO_WORKBENCH_VIEWS[0];
  const actual = pestanas.find((item) => item.key === pestana);
  return (
    <TabHeading
      variante="seccion"
      icono={actual?.icon ?? definicion.icon}
      eyebrow={antetituloDePestana(seccion, pestana)}
      titulo={actual?.label ?? definicion.label}
      control={control}
      chips={chipsDeTexto(chips)}
    />
  );
}
