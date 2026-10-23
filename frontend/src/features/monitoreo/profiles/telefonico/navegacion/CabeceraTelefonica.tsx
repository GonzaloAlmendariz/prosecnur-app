import type { ReactNode } from "react";
import type { MonitoreoWorkbenchRailTab } from "../../../components/MonitoreoWorkbenchRail";
import { TELEFONICO_WORKBENCH_VIEWS } from "../../../core/monitoreoRegistry";
import type { SeccionTelefonica } from "./direccionTelefonica";
import { antetituloDePestana } from "./modeloDelRail";
import "./chromeTelefonico.css";

/**
 * Cabecera de pestaña del esqueleto común, 44 px: ícono carmesí en cuadro
 * suave, antetítulo «SECCIÓN · GRUPO» en versalitas y el nombre debajo, sin
 * subtítulo. A la derecha, el selector de vistas (cuando la pestaña absorbe
 * más de una) y los chips de contexto.
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
  const Icono = actual?.icon ?? definicion.icon;
  return (
    <header className="mon-tel-cabecera">
      <span className="mon-tel-cabecera-icono" aria-hidden="true">
        <Icono size={17} />
      </span>
      <span className="mon-tel-cabecera-copia">
        <span className="mon-tel-cabecera-antetitulo">{antetituloDePestana(seccion, pestana)}</span>
        <h2>{actual?.label ?? definicion.label}</h2>
      </span>
      <span className="mon-tel-cabecera-derecha">
        {control}
        {chips.map((chip) => (
          <span key={chip} className="mon-tel-chip">{chip}</span>
        ))}
      </span>
    </header>
  );
}
