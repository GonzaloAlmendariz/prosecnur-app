import { MonitoreoWorkbenchRail, type MonitoreoWorkbenchRailTab } from "../../../components/MonitoreoWorkbenchRail";
import { TELEFONICO_WORKBENCH_VIEWS } from "../../../core/monitoreoRegistry";
import type { SeccionTelefonica } from "./direccionTelefonica";

/**
 * Rail de pestañas del telefónico: a toda altura, sólo íconos, con el corte al
 * pie («CORTE», fecha y hora). Las pestañas ya vienen resueltas por
 * `pestanasDelRail`, que también publica la página para el inspector.
 */
export function RailTelefonico({
  seccion,
  pestana,
  pestanas,
  corte,
  onCambioPestana,
}: {
  seccion: SeccionTelefonica;
  pestana: string;
  pestanas: readonly MonitoreoWorkbenchRailTab[];
  /** Fecha y hora del último corte, tal como la entrega el estado. */
  corte: string;
  onCambioPestana: (pestana: string) => void;
}) {
  const definicion = TELEFONICO_WORKBENCH_VIEWS.find((item) => item.key === seccion) ?? TELEFONICO_WORKBENCH_VIEWS[0];
  return (
    <MonitoreoWorkbenchRail
      pestanaActiva={pestana}
      activeSection={definicion}
      seccionActiva={seccion}
      ariaLabel={`Pestañas de ${definicion.label}`}
      className="is-telefonico"
      iconOnlyTabs
      localTabs={pestanas}
      routeSectionLabel={definicion.label}
      routeShortLabel={definicion.label}
      statusAriaLabel="Corte del monitoreo"
      statusItems={[{ label: "Corte", value: corte || "Sin actualización", ready: Boolean(corte) }]}
      onCambioPestana={(key) => onCambioPestana(key)}
    />
  );
}
