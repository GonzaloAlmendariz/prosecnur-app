// La campaña territorial abierta (ADR 0118 §1 y §4): Unidades, Catálogo,
// Paquetes y Entrega sobre la foto de la muestra que envió Hojas de ruta.
//
// La dirección ya llega canónica (`redirecciones.ts` la reescribe): aquí sólo
// se lee y se escribe con `searchDeCampanas`. Las secciones son navegación de
// ruta (SectionPillbar, `aria-current`); las pestañas de una sección con dos o
// más van en el rail de la casa, con su relación tab/tabpanel.
//
// Contrato de Superficie: el panel activo es `material-campo/territorial/<sección>`
// (intrinsic) y es el único dueño del scroll (`.rec-tab-panel`, No Scroll Jail).

import { useCallback, useMemo, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import type { CampanaMaterial } from "../../../api/materialCampanas";
import { AdaptiveSplitView } from "../../../components/AdaptiveSplitView";
import { ChromeIndicator, ChromeIndicatorGroup } from "../../../components/ChromeIndicator";
import { ContextTabRail, type ContextTabRailItem } from "../../../components/ContextTabRail";
import { ModuleCommandBar } from "../../../components/ModuleCommandBar";
import { useDensidadDelChrome } from "../useDensidadDelChrome";
import { PageFrame } from "../../../components/PageFrame";
import { SectionPillbar } from "../../../components/SectionPillbar";
import { useDireccion } from "../../../lib/navegacion/useDireccion";
import { RefreshCw } from "../../../vendor/lucide-react";
import { searchDeCampanas } from "../campanas/direccionDeCampanas";
import { CatalogoTerritorial, esPestanaDeCatalogo } from "./CatalogoTerritorial";
import { EntregaTerritorial } from "./EntregaTerritorial";
import { PESTANAS_TERRITORIALES, SECCIONES_TERRITORIALES, resolverSeccionTerritorial, type SeccionTerritorial } from "./navegacionTerritorial";
import { PaquetesTerritoriales } from "./PaquetesTerritoriales";
import { UnidadesTerritoriales } from "./UnidadesTerritoriales";
import { useCampanaTerritorial } from "./useCampanaTerritorial";
import "../styles/recopiladores-shell.css";
import "./territorial.css";

const COPIA: Record<SeccionTerritorial, { title: string; lead: string }> = {
  unidades: { title: "Unidades", lead: "Las UMP titulares y sus reemplazos, tal como las envió Hojas de ruta." },
  catalogo: { title: "Catálogo", lead: "Las piezas que se imprimen: la ficha de cada UMP, la hoja de cada zona y el papel que campo llena." },
  paquetes: { title: "Paquetes", lead: "El ZIP de fichas por distrito, el Excel operativo, las hojas de campo y los reemplazos puntuales." },
  entrega: { title: "Entrega", lead: "Cómo se reparte el campo: jornadas por encuestador y día, con su hoja del día." },
};

type Props = {
  campana: CampanaMaterial;
  /** Volver a la lista, nombre y menú de la campaña (zona de contexto de la barra). */
  cabecera?: ReactNode;
};

export function CampanaTerritorialShell({ campana, cabecera = null }: Props) {
  const densidadChrome = useDensidadDelChrome();
  const location = useLocation();
  const navigate = useNavigate();
  const direccion = useDireccion();
  const { seccion, pestana } = resolverSeccionTerritorial(direccion?.seccion, direccion?.pestana);
  const datos = useCampanaTerritorial(campana.id);
  const { unidades, sinFuente, hojas, carga, error, recargar, guardarPlan } = datos;
  // M4: «no alcanza» se mide en visitas con la respuesta y la ocupación del estudio, como en Selección.
  const ss = hojas?.integrated_config.sample_size;
  const supuestos = useMemo(() => (ss ? { respuesta: ss.response_rate, ocupacion: ss.ocupacion ?? 1 } : undefined), [ss]);

  const hrefDe = useCallback((s: SeccionTerritorial, p: string, extra: { panel?: string; foco?: string } = {}) => (
    `${location.pathname}${searchDeCampanas(location.search, { modo: "territorial", campana: campana.id, seccion: s, pestana: p, ...extra })}`
  ), [campana.id, location.pathname, location.search]);

  const irAPestana = useCallback((p: string) => navigate(hrefDe(seccion, p)), [hrefDe, navigate, seccion]);

  const pestanas = SECCIONES_TERRITORIALES.find((s) => s.id === seccion)?.tabs ?? [];
  const conRail = pestanas.length > 1;
  const rail: readonly ContextTabRailItem<string>[] = pestanas.map((t) => ({ key: t.id, label: t.label, icon: t.icon }));
  const copia = COPIA[seccion];
  const cargando = carga === "cargando";

  const panel = (
    <section
      id={conRail ? `rec-terr-panel-${pestana}` : undefined}
      className="rec-tab-panel rec-terr"
      role={conRail ? "tabpanel" : undefined}
      aria-labelledby={conRail ? `rec-terr-tab-${pestana}` : undefined}
      aria-busy={cargando}
      data-qa-geometry-group={`material-campo/territorial/${seccion}`}
      data-qa-geometry-contract="intrinsic"
    >
      {cargando && !hojas ? (
        <div className="rec-loading" data-qa-geometry-capacity="owned">Leyendo la muestra enviada…</div>
      ) : null}
      {!cargando && seccion === "unidades" ? (
        <UnidadesTerritoriales
          unidades={unidades}
          sinFuente={sinFuente}
          foco={direccion?.foco ?? null}
          hrefDeFoco={(foco) => hrefDe("unidades", "lista", { foco })}
          hrefDeHoja={(foco) => hrefDe("unidades", "lista", { foco, panel: "hoja" })}
          supuestos={supuestos}
        />
      ) : null}
      {!cargando && seccion === "catalogo" ? (
        <CatalogoTerritorial pestana={esPestanaDeCatalogo(pestana) ? pestana : "fichas"} campaignId={campana.id} unidades={unidades} hojas={hojas} />
      ) : null}
      {!cargando && seccion === "paquetes" ? (
        <PaquetesTerritoriales campaignId={campana.id} unidades={unidades} hojas={hojas} onRecargar={recargar} focoInicial={direccion?.foco ?? null} />
      ) : null}
      {!cargando && seccion === "entrega" ? (
        <EntregaTerritorial unidades={unidades} hojas={hojas} onGuardarPlan={guardarPlan} />
      ) : null}
    </section>
  );

  return (
    <PageFrame
      title={copia.title}
      lead={copia.lead}
      layout="workbench"
      scrollOwner="panels"
      bodyMode="fill"
      headerMode="sr-only"
      resetScrollKey={`territorial/${seccion}/${pestana}`}
      auditReady={cargando ? false : `material-campo/territorial/${seccion}/${pestana}`}
      className="rec-page"
      chrome={(
        <ModuleCommandBar
          densidad={densidadChrome}
          modulo="material-campo"
          contexto={(
            <>
              {cabecera}
              {unidades ? (
                <ChromeIndicatorGroup ariaLabel="Contexto de la campaña territorial">
                  <ChromeIndicator label="Titulares" value={unidades.n_titulares.toLocaleString("es-PE")} prioridad="alta" />
                  <ChromeIndicator label="Reemplazos" value={unidades.n_reemplazos.toLocaleString("es-PE")} />
                </ChromeIndicatorGroup>
              ) : null}
            </>
          )}
          secciones={(
            <SectionPillbar
              modulo="material-campo"
              ariaLabel="Secciones de la campaña territorial"
              seccionActiva={seccion}
              className="rec-section-selector"
              items={SECCIONES_TERRITORIALES.map((s) => {
                const id = s.id as SeccionTerritorial;
                return { id, label: s.label, href: hrefDe(id, PESTANAS_TERRITORIALES[id][0]) };
              })}
            />
          )}
          acciones={[{
            id: "refresh",
            label: "Actualizar",
            icon: RefreshCw,
            onSelect: () => { void recargar(); },
            kind: "ghost",
            rank: 2,
            busy: cargando,
          }]}
          estado={unidades ? [{
            id: "territorial-envio",
            label: unidades.stale ? "Desactualizada" : "Muestra recibida",
            tone: unidades.stale ? "danger" : "success",
          }] : []}
          ariaLabel="Controles de la campaña territorial"
        />
      )}
      notices={error ? <div className="rec-notice is-error" role="alert">{error}</div> : null}
    >
      <div className={`rec-workbench${conRail ? " rec-workbench--rail" : ""}`}>
        {conRail ? (
          <AdaptiveSplitView
            ariaLabel={`Mesa de ${copia.title}`}
            railLabel={`Pestañas de ${copia.title}`}
            className="rec-workbench-split pulso-context-tab-layout"
            rail={(
              <ContextTabRail
                ariaLabel={`Pestañas de ${copia.title}`}
                activeKey={pestana}
                items={rail}
                panelId={(key) => `rec-terr-panel-${key}`}
                tabId={(key) => `rec-terr-tab-${key}`}
                onChange={irAPestana}
              />
            )}
          >
            {panel}
          </AdaptiveSplitView>
        ) : panel}
      </div>
    </PageFrame>
  );
}
