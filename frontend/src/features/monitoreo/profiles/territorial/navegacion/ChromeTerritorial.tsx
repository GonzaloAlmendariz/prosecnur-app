import { MonitoreoWorkbenchRail, type MonitoreoWorkbenchRailTab } from "../../../components/MonitoreoWorkbenchRail";
import { TERRITORIAL_SECCIONES_PUBLICAS } from "../../../core/monitoreoRegistry";
import { TabHeading } from "../../../../../components/TabHeading";
import { chipsDeTexto } from "../../../core/chipsDeTexto";
import { SelectorDeSubvistas } from "../../../core/selectorDeSubvistas/SelectorDeSubvistas";
import { antetituloDePestana } from "./modeloDelRail";
import { subvistasDePestana, type DireccionTerritorial, type SeccionTerritorial } from "./direccionTerritorial";
// Las clases de la cabecera de pestaña (`mon-tel-cabecera`, `mon-tel-chip`,
// `mon-tel-subvistas`) son el lenguaje común que estrenó Telefónico; se usan
// tal cual para que los dos modos no diverjan.
import "../../telefonico/navegacion/chromeTelefonico.css";
import "./chromeTerritorial.css";

function definicionDe(seccion: SeccionTerritorial) {
  return TERRITORIAL_SECCIONES_PUBLICAS.find((item) => item.key === seccion) ?? TERRITORIAL_SECCIONES_PUBLICAS[0];
}

/**
 * Rail de pestañas del territorial: a toda altura, sólo íconos, con divisores
 * entre los grupos de Control y el corte al pie.
 */
export function RailTerritorial({
  seccion,
  pestana,
  pestanas,
  corte,
  onCambioPestana,
}: {
  seccion: SeccionTerritorial;
  pestana: string;
  pestanas: readonly MonitoreoWorkbenchRailTab[];
  corte: string;
  onCambioPestana: (pestana: string) => void;
}) {
  const definicion = definicionDe(seccion);
  return (
    <MonitoreoWorkbenchRail
      pestanaActiva={pestana}
      activeSection={definicion}
      seccionActiva={seccion}
      ariaLabel={`Pestañas de ${definicion.label}`}
      className={`is-territorial is-seccion-${seccion}`}
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

/**
 * Cabecera de pestaña de una línea (§0): ícono, sobrelínea «SECCIÓN · GRUPO» y
 * el nombre; a la derecha el selector de sub-vistas y los chips de contexto.
 * Se pinta con la variante «sección» del TabHeading del kit (L14).
 */
export function CabeceraTerritorial({
  direccion,
  pestanas,
  chips = [],
  onSubvista,
}: {
  direccion: DireccionTerritorial;
  pestanas: readonly MonitoreoWorkbenchRailTab[];
  chips?: readonly string[];
  onSubvista: (panel: string | null) => void;
}) {
  const definicion = definicionDe(direccion.seccion);
  const actual = pestanas.find((item) => item.key === direccion.pestana);
  const subvistas = subvistasDePestana(direccion.seccion, direccion.pestana);
  return (
    <TabHeading
      variante="seccion"
      icono={actual?.icon ?? definicion.icon}
      eyebrow={antetituloDePestana(direccion.seccion, direccion.pestana)}
      titulo={actual?.label ?? definicion.label}
      control={
        <SelectorDeSubvistas
          opciones={subvistas.map((item) => ({ clave: item.panel ?? "principal", etiqueta: item.etiqueta, valor: item.panel ?? null }))}
          esActiva={(panel) => panel === (direccion.panel ?? null)}
          onElegir={onSubvista}
        />
      }
      chips={chipsDeTexto(chips)}
    />
  );
}
