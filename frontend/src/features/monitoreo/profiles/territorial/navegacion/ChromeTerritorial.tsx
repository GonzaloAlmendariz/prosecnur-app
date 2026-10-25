import { MonitoreoWorkbenchRail, type MonitoreoWorkbenchRailTab } from "../../../components/MonitoreoWorkbenchRail";
import { TERRITORIAL_SECCIONES_PUBLICAS } from "../../../core/monitoreoRegistry";
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
  const Icono = actual?.icon ?? definicion.icon;
  const subvistas = subvistasDePestana(direccion.seccion, direccion.pestana);
  return (
    <header className="mon-tel-cabecera mon-ter-cabecera">
      <span className="mon-tel-cabecera-icono" aria-hidden="true">
        <Icono size={17} />
      </span>
      <span className="mon-tel-cabecera-copia">
        <span className="mon-tel-cabecera-antetitulo">{antetituloDePestana(direccion.seccion, direccion.pestana)}</span>
        <h2>{actual?.label ?? definicion.label}</h2>
      </span>
      <span className="mon-tel-cabecera-derecha">
        {subvistas.length ? (
          <span className="mon-tel-subvistas" role="group" aria-label="Vista de la pestaña">
            {subvistas.map((item) => {
              const elegida = (item.panel ?? null) === (direccion.panel ?? null);
              return (
                <button
                  key={item.panel ?? "principal"}
                  type="button"
                  className={`mon-tel-subvista${elegida ? " is-active" : ""}`}
                  aria-pressed={elegida}
                  data-subvista={item.panel ?? "principal"}
                  onClick={() => {
                    if (!elegida) onSubvista(item.panel);
                  }}
                >
                  {item.etiqueta}
                </button>
              );
            })}
          </span>
        ) : null}
        {chips.map((chip) => (
          <span key={chip} className="mon-tel-chip">{chip}</span>
        ))}
      </span>
    </header>
  );
}
