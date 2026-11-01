// La campaña telefónica abierta (P10): Casos, Barrido y Entrega sobre la configuración
// del barrido. Mismo cromo que la territorial: secciones en la SectionPillbar y, si una
// sección tiene dos o más pestañas, el rail de la casa.
//
// Contrato de Superficie: el panel activo es `material-campo/telefonica/<sección>`
// (intrinsic) y es el único dueño del scroll (`.rec-tab-panel`, No Scroll Jail).

import { useCallback, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import type { CampanaMaterial } from "../../../api/materialCampanas";
import { AdaptiveSplitView } from "../../../components/AdaptiveSplitView";
import { ChromeIndicator, ChromeIndicatorGroup } from "../../../components/ChromeIndicator";
import { ContextTabRail, type ContextTabRailItem } from "../../../components/ContextTabRail";
import { ModuleCommandBar } from "../../../components/ModuleCommandBar";
import { PageFrame } from "../../../components/PageFrame";
import { SectionPillbar } from "../../../components/SectionPillbar";
import { useDireccion } from "../../../lib/navegacion/useDireccion";
import { RefreshCw } from "../../../vendor/lucide-react";
import { searchDeCampanas } from "../campanas/direccionDeCampanas";
import { PESTANAS_TELEFONICAS, SECCIONES_TELEFONICAS, resolverSeccionTelefonica, type SeccionTelefonica } from "./navegacionTelefonica";
import { BarridoTelefonico, CasosTelefonicos, EntregaTelefonica } from "./SeccionesTelefonicas";
import { useConfigTelefonica } from "./useConfigTelefonica";
import "../styles/recopiladores-shell.css";
import "../territorial/territorial.css";
import "./telefonica.css";

const COPIA: Record<SeccionTelefonica, { title: string; lead: string }> = {
  casos: { title: "Casos", lead: "Cuántos casos entrega el cliente, cómo se identifican y quién llama." },
  barrido: { title: "Barrido", lead: "La plantilla que llena el equipo telefónico y el catálogo de Status." },
  entrega: { title: "Entrega", lead: "Qué lee Monitoreo del Sheets del barrido y qué no se debe tocar." },
};

type Props = {
  campana: CampanaMaterial;
  /** Volver a la lista, nombre y menú de la campaña (zona de contexto de la barra). */
  cabecera?: ReactNode;
};

export function CampanaTelefonicaShell({ campana, cabecera = null }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const direccion = useDireccion();
  const { seccion, pestana } = resolverSeccionTelefonica(direccion?.seccion, direccion?.pestana);
  const datos = useConfigTelefonica(campana.id);
  const { config, cargando, recargar } = datos;

  const hrefDe = useCallback((s: SeccionTelefonica, p: string) => (
    `${location.pathname}${searchDeCampanas(location.search, { modo: "telefonica", campana: campana.id, seccion: s, pestana: p })}`
  ), [campana.id, location.pathname, location.search]);
  const irAPestana = useCallback((p: string) => navigate(hrefDe(seccion, p)), [hrefDe, navigate, seccion]);

  const pestanas = SECCIONES_TELEFONICAS.find((s) => s.id === seccion)?.tabs ?? [];
  const conRail = pestanas.length > 1;
  const rail: readonly ContextTabRailItem<string>[] = pestanas.map((t) => ({ key: t.id, label: t.label, icon: t.icon }));
  const copia = COPIA[seccion];
  const listo = Boolean(config) || Boolean(datos.error);

  const panel = (
    <section
      id={conRail ? `rec-tel-panel-${pestana}` : undefined}
      className="rec-tab-panel rec-terr"
      role={conRail ? "tabpanel" : undefined}
      aria-labelledby={conRail ? `rec-tel-tab-${pestana}` : undefined}
      aria-busy={cargando}
    >
      <div className="rec-terr-seccion">
        <div className="rec-terr-tarjetas" data-qa-geometry-group={`material-campo/telefonica/${seccion}`} data-qa-geometry-contract="intrinsic">
          {seccion === "casos" ? <CasosTelefonicos datos={datos} /> : null}
          {seccion === "barrido" ? <BarridoTelefonico datos={datos} pestana={pestana} campaignId={campana.id} /> : null}
          {seccion === "entrega" ? <EntregaTelefonica config={config} /> : null}
        </div>
      </div>
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
      resetScrollKey={`telefonica/${seccion}/${pestana}`}
      auditReady={listo ? `material-campo/telefonica/${seccion}/${pestana}` : false}
      className="rec-page"
      chrome={(
        <ModuleCommandBar
          modulo="material-campo"
          contexto={(
            <>
              {cabecera}
              {config ? (
                <ChromeIndicatorGroup ariaLabel="Contexto de la campaña telefónica">
                  <ChromeIndicator label="Muestra" value={config.muestra.toLocaleString("es-PE")} prioridad="alta" />
                  <ChromeIndicator label="Backup" value={config.backup.toLocaleString("es-PE")} />
                </ChromeIndicatorGroup>
              ) : null}
            </>
          )}
          secciones={(
            <SectionPillbar
              modulo="material-campo"
              ariaLabel="Secciones de la campaña telefónica"
              seccionActiva={seccion}
              className="rec-section-selector"
              items={SECCIONES_TELEFONICAS.map((s) => {
                const id = s.id as SeccionTelefonica;
                return { id, label: s.label, href: hrefDe(id, PESTANAS_TELEFONICAS[id][0]) };
              })}
            />
          )}
          acciones={[{
            id: "refresh",
            label: "Actualizar",
            shortLabel: "Actualizar",
            icon: RefreshCw,
            onSelect: () => { void recargar(); },
            kind: "ghost",
            rank: 2,
            busy: cargando,
          }]}
          estado={config ? [{
            id: "telefonica-config",
            label: config.revision > 0 ? "Configurada" : "Por configurar",
            tone: config.revision > 0 ? "success" : "neutral",
          }] : []}
          ariaLabel="Controles de la campaña telefónica"
        />
      )}
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
                panelId={(key) => `rec-tel-panel-${key}`}
                tabId={(key) => `rec-tel-tab-${key}`}
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
