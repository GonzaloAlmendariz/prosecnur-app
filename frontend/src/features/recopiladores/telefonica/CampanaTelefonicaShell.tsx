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
import { ContextTabRail, type ContextTabRailItem } from "../../../components/ContextTabRail";
import { ModuleCommandBar } from "../../../components/ModuleCommandBar";
import { useDensidadDelChrome } from "../useDensidadDelChrome";
import { PageFrame } from "../../../components/PageFrame";
import { SectionPillbar } from "../../../components/SectionPillbar";
import { useDireccion } from "../../../lib/navegacion/useDireccion";
import { RefreshCw } from "../../../vendor/lucide-react";
import { ChipDeEntrada } from "../campanas/ChipDeEntrada";
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
  const densidadChrome = useDensidadDelChrome();
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
      key={seccion}
      id={conRail ? `rec-tel-panel-${pestana}` : undefined}
      className="rec-tab-panel rec-terr"
      role={conRail ? "tabpanel" : undefined}
      aria-labelledby={conRail ? `rec-tel-tab-${pestana}` : undefined}
      aria-busy={cargando}
    >
      <div className="rec-terr-seccion">
        {/* Revamp v5: en Casos los bloques son pares y comparten alto (C2); el resto son secciones independientes. */}
        <div
          className={`rec-terr-tarjetas${seccion === "casos" ? " rec-tel-pares" : ""}`}
          data-qa-geometry-group={`material-campo/telefonica/${seccion}`}
          data-qa-geometry-contract={seccion === "casos" ? "equal" : "intrinsic"}
        >
          {seccion === "casos" ? <CasosTelefonicos datos={datos} /> : null}
          {seccion === "barrido" ? <BarridoTelefonico datos={datos} pestana={pestana} campaignId={campana.id} hrefCasos={hrefDe("casos", PESTANAS_TELEFONICAS.casos[0])} /> : null}
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
          densidad={densidadChrome}
          modulo="material-campo"
          contexto={(
            <>
              {cabecera}
              {campana.relacion?.ronda ? (
                <ChipDeEntrada
                  origen="monitoreo"
                  rotulo="Ronda"
                  dato={String(campana.relacion.ronda)}
                  detalle={`Ronda ${campana.relacion.ronda}${campana.relacion.publico ? ` de ${campana.relacion.publico}` : ""} del Modelo de Monitoreo${campana.relacion.viene_de ? ", viene de la ronda anterior" : ", primera ronda"}`}
                />
              ) : (
                <ChipDeEntrada origen="monitoreo" rotulo="Modelo de Monitoreo" detalle="Las rondas y las cuotas las define el Modelo de Monitoreo" />
              )}
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
                const pendientes = !config ? 0
                  : id === "casos" ? (config.muestra + config.backup > 0 ? 0 : 1)
                  : id === "barrido" ? Number(!config.barrido.construido) + Number(!config.barrido.conectado_en_monitoreo)
                  : 0;
                const lista = Boolean(config) && pendientes === 0 && id !== "entrega";
                return { id, label: s.label, href: hrefDe(id, PESTANAS_TELEFONICAS[id][0]), pendientes, lista };
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
          estado={config ? [{
            id: "telefonica-entrega",
            label: config.barrido.conectado_en_monitoreo ? "Conectado en Monitoreo" : config.barrido.construido ? "Sin conectar en Monitoreo" : "Sin Sheets del barrido",
            tone: config.barrido.conectado_en_monitoreo ? "success" : config.barrido.construido ? "warn" : "neutral",
            detail: "Lo que Monitoreo lee de esta campaña: el Sheets del barrido, conectado en Insumos › Fuentes",
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
