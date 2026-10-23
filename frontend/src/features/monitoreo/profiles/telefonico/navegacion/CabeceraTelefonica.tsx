import type { ReactNode } from "react";
import type { MonitoreoWorkbenchRailTab } from "../../../components/MonitoreoWorkbenchRail";
import { MonitoreoWorkbenchHead } from "../../../components/MonitoreoWorkbenchHead";
import { TELEFONICO_WORKBENCH_VIEWS } from "../../../core/monitoreoRegistry";
import type { SeccionTelefonica } from "./direccionTelefonica";

/**
 * Cabecera de la pestaña activa del telefónico: la sección como antetítulo y
 * el nombre de la pestaña como título. A la derecha, el selector de vistas de
 * la pestaña cuando absorbe más de una.
 */
export function CabeceraTelefonica({
  seccion,
  pestana,
  pestanas,
  control,
}: {
  seccion: SeccionTelefonica;
  pestana: string;
  pestanas: readonly MonitoreoWorkbenchRailTab[];
  control?: ReactNode;
}) {
  const definicion = TELEFONICO_WORKBENCH_VIEWS.find((item) => item.key === seccion) ?? TELEFONICO_WORKBENCH_VIEWS[0];
  const actual = pestanas.find((item) => item.key === pestana);
  return (
    <MonitoreoWorkbenchHead
      icon={actual?.icon ?? definicion.icon}
      eyebrow={definicion.label}
      title={actual?.label ?? definicion.label}
      control={control}
    />
  );
}
