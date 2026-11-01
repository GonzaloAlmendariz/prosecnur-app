// El Planner del estudio (ADR 0122, reemplazado en parte por el 0123). Cuatro
// secciones —Estudio, Muestra, Cronograma y Bitácora— con la dirección
// canónica (`useSeccion`): las secciones van en el pillbar compartido y las
// pestañas de una sección con dos o más, en el rail de la casa.
//
// Contrato de Superficie: el panel activo es `diseno-estudio/<sección>` y es el
// único dueño del scroll (`.planner-panel`, No Scroll Jail).

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  apiBitacoraState,
  apiPlanTrabajoState,
  type DisenoEstudioBitacoraEntry,
  type PlanTrabajoState,
} from "../../api/client";
import { AdaptiveSplitView } from "../../components/AdaptiveSplitView";
import { Alert } from "../../components/Alert";
import { ContextTabRail, type ContextTabRailItem } from "../../components/ContextTabRail";
import { LoadingBlock } from "../../components/States";
import { PageFrame } from "../../components/PageFrame";
import { ChromeIndicator, ChromeIndicatorGroup } from "../../components/ChromeIndicator";
import { ModuleCommandBar } from "../../components/ModuleCommandBar";
import { SectionPillbar } from "../../components/SectionPillbar";
import {
  moduleChromeVars,
  PROSECNUR_MODULES,
  type ProsecnurModuleSectionMeta,
} from "../../lib/modules";
import { LogbookSection } from "./LogbookSection";
import { CronogramaSection } from "./CronogramaSection";
import { Calendar, CALENDAR_VIEW_A11Y } from "./Calendar";
import { CanvasSection } from "./canvas/CanvasSection";
import { PanelImportar } from "./portabilidad/PanelImportar";
import { descargarMapaDelEstudio } from "./portabilidad/descargar";
import { apiBitacoraEstado, type BitacoraEstado } from "../../api/bitacora";
import { PANEL_IMPORTAR } from "../../lib/navegacion/manifiesto";
import { usePanelDireccionable } from "../../lib/navegacion/paneles";
import { useDireccion, useSeccion } from "../../lib/navegacion/useDireccion";
import { PlannerCalendarioResumen } from "./planner/PlannerCalendarioResumen";
import { PlannerEstudio } from "./planner/PlannerEstudio";
import { PlannerMuestra } from "./planner/PlannerMuestra";
import { usePlanner } from "./planner/usePlanner";
import "./bitacora.css";
import "./planner/planner.css";

type Seccion = "estudio" | "muestra" | "cronograma" | "bitacora";

const BITACORA_MODULE =
  PROSECNUR_MODULES.find((module) => module.slug === "diseno-estudio") ?? PROSECNUR_MODULES[0];

type PlannerSection = ProsecnurModuleSectionMeta & { id: Seccion };

const SECCIONES_PLANNER: readonly string[] = ["estudio", "muestra", "cronograma", "bitacora"];

function isPlannerSection(section: ProsecnurModuleSectionMeta): section is PlannerSection {
  return SECCIONES_PLANNER.includes(section.id);
}

const BITACORA_SECTIONS = BITACORA_MODULE.sections.filter(isPlannerSection);

// El rail de Cronograma usa los mismos ids de tab/panel que el calendario: la
// vista Mes o Semana sigue siendo un tabpanel etiquetado por su pestaña.
// Secciones que salieron del Planner (ADR 0123 §2): lo que dice el aviso
// cuando alguien llega por una dirección vieja.
const MUDANZAS: Record<string, { texto: string; enlace: string; href: string }> = {
  "equipo-en-monitoreo": {
    texto: "El equipo de campo ya no se declara en el Planner: vive en Monitoreo, con el control de encuestadores y aplicadores.",
    enlace: "Ir a Monitoreo",
    href: "/monitoreo",
  },
  "codigos-en-material": {
    texto: "Los códigos de resultado y los status del barrido ya no se declaran en el Planner: viven en Material de campo.",
    enlace: "Ir a Material de campo",
    href: "/material-campo?modo=territorial&seccion=catalogo&pestana=codigos",
  },
};

function tabIdDe(key: string) {
  if (key === "mes") return CALENDAR_VIEW_A11Y.month.tabId;
  if (key === "semana") return CALENDAR_VIEW_A11Y.week.tabId;
  return `planner-tab-${key}`;
}

function panelIdDe(key: string) {
  if (key === "mes") return CALENDAR_VIEW_A11Y.month.panelId;
  if (key === "semana") return CALENDAR_VIEW_A11Y.week.panelId;
  return `planner-panel-${key}`;
}

export default function BitacoraPage() {
  const navegacion = useSeccion("diseno-estudio");
  // Una dirección vieja a una sección que el Planner ya no tiene llega aquí con
  // el aviso de dónde vive ahora su dato (ADR 0123 §3).
  const mudanza = MUDANZAS[useDireccion()?.aviso ?? ""];
  const tab = (navegacion.seccion ?? "estudio") as Seccion;
  const pestanas = navegacion.pestanas;
  const pestana = navegacion.pestana && pestanas.some((p) => p.id === navegacion.pestana)
    ? navegacion.pestana
    : pestanas[0]?.id ?? "";
  const conRail = pestanas.length > 1;
  const rail: readonly ContextTabRailItem<string>[] = pestanas.map((p) => ({ key: p.id, label: p.label, icon: p.icon }));
  const planner = usePlanner();
  const [plan, setPlan] = useState<PlanTrabajoState | null>(null);
  const [bitacoraEstado, setBitacoraEstado] = useState<BitacoraEstado | null>(null);
  const [entries, setEntries] = useState<DisenoEstudioBitacoraEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const panelImportar = usePanelDireccionable(PANEL_IMPORTAR);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const [planState, bitacora, consolidado] = await Promise.all([
        apiPlanTrabajoState(),
        apiBitacoraState(),
        apiBitacoraEstado(),
      ]);
      setPlan(planState);
      setEntries(bitacora.bitacora);
      setBitacoraEstado(consolidado);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo abrir el Planner.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function reloadPlan() {
    try {
      setPlan(await apiPlanTrabajoState());
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar el cronograma.");
    }
  }

  if (loading && !plan) {
    return <LoadingBlock label="Abriendo el Planner..." />;
  }

  function contenido() {
    const rol = conRail && pestana !== "mes" && pestana !== "semana";
    // El cronograma y el lienzo traen su propio marco a toda altura (ADR 0047):
    // el grupo intrinsic sólo se declara para las secciones nuevas del Planner.
    const propia = tab !== "cronograma" && tab !== "bitacora";
    return (
      <section
        id={rol ? panelIdDe(pestana) : undefined}
        role={rol ? "tabpanel" : undefined}
        aria-labelledby={rol ? tabIdDe(pestana) : undefined}
        className={`planner-panel planner-panel--${tab}`}
        data-qa-geometry-group={propia ? `diseno-estudio/${tab}` : undefined}
        data-qa-geometry-contract={propia ? "intrinsic" : undefined}
      >
        {tab === "estudio" && <PlannerEstudio control={planner} pestana={pestana} />}
        {tab === "muestra" && <PlannerMuestra control={planner} />}
        {tab === "cronograma" && plan && pestana === "gantt" && (
          <>
            <PlannerCalendarioResumen recarga={plan} control={planner} />
            <CronogramaSection state={plan} onChange={setPlan} onReload={reloadPlan} />
          </>
        )}
        {tab === "cronograma" && plan && (pestana === "mes" || pestana === "semana") && (
          <Calendar state={plan} onChange={setPlan} selectorDeVista={false} />
        )}
        {tab === "bitacora" && pestana === "registro" && <LogbookSection entries={entries} onChange={setEntries} />}
        {tab === "bitacora" && pestana === "lienzo" && bitacoraEstado && (
          <CanvasSection estado={bitacoraEstado} onEstado={setBitacoraEstado} />
        )}
      </section>
    );
  }

  return (
    <PageFrame
      auditReady={!loading && !error && !planner.cargando ? `bitacora-${tab}` : false}
      title="Planner"
      headerMode="sr-only"
      layout="workbench"
      bodyMode="fill"
      scrollOwner="panels"
      className="bitacora-frame"
    >
      <div className="bitacora-shell" style={moduleChromeVars(BITACORA_MODULE)}>
        {/* La banda propia de Bitácora pasa al chrome compartido: era su propio
            grid de tres zonas, con el pillbar llevando un ícono por sección y la
            zona de contexto repitiendo el nombre del módulo, que la homepage ya
            dice. En su lugar va el dato que sí se consulta desde acá. */}
        <ModuleCommandBar
          modulo="diseno-estudio"
          ariaLabel="Acciones del Planner"
          className="bitacora-commandbar"
          contexto={
            <ChromeIndicatorGroup ariaLabel="Contexto del Planner">
              <ChromeIndicator
                label="Estudio"
                value={planner.estado?.planner.estudio.nombre || "sin nombre"}
                prioridad="alta"
              />
              <ChromeIndicator
                label="Perfiles"
                value={planner.estado ? String(planner.estado.planner.perfiles.length) : "—"}
              />
            </ChromeIndicatorGroup>
          }
          secciones={
            <SectionPillbar
              modulo="diseno-estudio"
              ariaLabel="Secciones del Planner"
              seccionActiva={tab}
              items={BITACORA_SECTIONS.map((item) => ({
                id: item.id,
                label: item.label,
                href: item.to,
              }))}
            />
          }
          acciones={[
            {
              id: "actualizar",
              label: "Actualizar",
              rank: 1,
              onSelect: () => {
                void load();
                void planner.recargar();
              },
              disabled: loading || planner.cargando,
              busy: loading || planner.cargando,
            },
            {
              id: "exportar",
              label: "Exportar mapa",
              rank: 3,
              onSelect: () => void descargarMapaDelEstudio(),
            },
            {
              id: "importar",
              label: "Importar mapa",
              rank: 3,
              onSelect: panelImportar.abrir,
            },
          ]}
        />

        {mudanza && (
          <Alert kind="info">
            {mudanza.texto} <Link to={mudanza.href}>{mudanza.enlace}</Link>
          </Alert>
        )}
        {error && <Alert kind="error">{error}</Alert>}
        {planner.error && <Alert kind="error">{planner.error}</Alert>}

        <div className="bitacora-body">
          {conRail ? (
            <AdaptiveSplitView
              ariaLabel={`Mesa de ${BITACORA_SECTIONS.find((s) => s.id === tab)?.label ?? "Planner"}`}
              railLabel="Pestañas de la sección"
              className="planner-split pulso-context-tab-layout"
              rail={(
                <ContextTabRail
                  ariaLabel="Pestañas de la sección"
                  activeKey={pestana}
                  items={rail}
                  panelId={panelIdDe}
                  tabId={tabIdDe}
                  onChange={(key) => navegacion.irA("pestana", key)}
                />
              )}
            >
              {contenido()}
            </AdaptiveSplitView>
          ) : contenido()}
        </div>
      </div>

      {panelImportar.abierto && (
        <div {...panelImportar.props}>
          <PanelImportar
            onImportado={(estado) => {
              // El import toca las tres colecciones a la vez. Lo que el panel
              // devuelve rehidrata el estado del lienzo y las entradas; el plan
              // se recarga porque `PlanTrabajoState` trae readiness y sync
              // derivados que el payload consolidado no incluye.
              setBitacoraEstado(estado);
              setEntries(estado.bitacora);
              void reloadPlan();
            }}
            onCerrar={panelImportar.cerrar}
          />
        </div>
      )}
    </PageFrame>
  );
}
