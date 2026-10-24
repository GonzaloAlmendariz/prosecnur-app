import { MonitoreoWorkbenchRail, type MonitoreoWorkbenchRailTab } from "../../../components/MonitoreoWorkbenchRail";
import { ACREDITACION_WORKBENCH_VIEWS } from "../../../core/monitoreoRegistry";
import { CabeceraDePestana, SelectorDeSubvistas } from "../../../core/cabeceraDePestana/CabeceraDePestana";
import { PESTANAS_DE_CONTACTO, subvistasDePestana, type SeccionAcreditacion, type VistaInterna } from "./direccionAcreditacion";
import { antetituloDePestana, catalogoDeSeccion, nombreDePestana } from "./modeloDelRail";
import type { RotuloDePestana } from "./rotuloDePestana";
import "./chromeAcreditacion.css";

function definicionDe(seccion: SeccionAcreditacion) {
  return ACREDITACION_WORKBENCH_VIEWS.find((item) => item.key === seccion) ?? ACREDITACION_WORKBENCH_VIEWS[0];
}

/**
 * Rail de acreditación (G2): a toda altura, solo íconos, con el corte al pie.
 * En Control, una línea separa el grupo Contacto (si el estudio lo declara)
 * del grupo Casos.
 */
export function RailAcreditacion({
  seccion,
  pestana,
  pestanas,
  corte,
  onCambioPestana,
}: {
  seccion: SeccionAcreditacion;
  pestana: string;
  pestanas: readonly MonitoreoWorkbenchRailTab[];
  corte: string;
  onCambioPestana: (pestana: string) => void;
}) {
  const definicion = definicionDe(seccion);
  const conContacto = seccion === "control" && pestanas.some((tab) => PESTANAS_DE_CONTACTO.includes(tab.key));
  return (
    <MonitoreoWorkbenchRail
      pestanaActiva={pestana}
      activeSection={definicion}
      seccionActiva={seccion}
      ariaLabel={`Pestañas de ${definicion.label}`}
      className={`is-acreditacion-nav${conContacto ? " con-contacto" : ""}`}
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

/** Cabecera de pestaña de 44 px con «Sección · Grupo» y, si la pestaña absorbe varias vistas, su selector. */
export function CabeceraAcreditacion({
  seccion,
  pestana,
  activa,
  chips,
  onElegirVista,
}: {
  seccion: SeccionAcreditacion;
  pestana: string;
  activa: VistaInterna;
  chips?: readonly string[];
  onElegirVista: (vista: VistaInterna) => void;
}) {
  const icono = catalogoDeSeccion(seccion).find((tab) => tab.key === pestana)?.icon ?? definicionDe(seccion).icon;
  const opciones = subvistasDePestana(seccion, pestana).map((item) => ({
    clave: item.panel ?? "principal",
    etiqueta: item.etiqueta,
    valor: item.interna,
  }));
  return (
    <CabeceraDePestana
      icono={icono}
      antetitulo={antetituloDePestana(seccion, pestana)}
      titulo={nombreDePestana(seccion, pestana)}
      chips={chips}
      control={(
        <SelectorDeSubvistas
          opciones={opciones}
          esActiva={(vista) => vista.seccion === activa.seccion && vista.pestana === activa.pestana}
          onElegir={onElegirVista}
        />
      )}
    />
  );
}

/** El mismo contenido de la cabecera, para llevarlo dentro de la primera tarjeta (§2a-bis). */
export function rotuloDeAcreditacion({
  seccion,
  pestana,
  activa,
  chips = [],
  onElegirVista,
}: {
  seccion: SeccionAcreditacion;
  pestana: string;
  activa: VistaInterna;
  chips?: readonly string[];
  onElegirVista: (vista: VistaInterna) => void;
}): RotuloDePestana {
  const opciones = subvistasDePestana(seccion, pestana).map((item) => ({
    clave: item.panel ?? "principal",
    etiqueta: item.etiqueta,
    valor: item.interna,
  }));
  return {
    antetitulo: `${antetituloDePestana(seccion, pestana)} · ${nombreDePestana(seccion, pestana)}`,
    chips,
    control: opciones.length > 1 ? (
      <SelectorDeSubvistas
        opciones={opciones}
        esActiva={(vista) => vista.seccion === activa.seccion && vista.pestana === activa.pestana}
        onElegir={onElegirVista}
      />
    ) : undefined,
  };
}
