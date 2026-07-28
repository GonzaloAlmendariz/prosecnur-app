import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { PARAMS_DIRECCION } from "../../lib/navegacion/direccion";
import {
  BarChart2,
  BookOpen,
  ClipboardList,
  Database,
  FileSpreadsheet,
  FileText,
  Grid3x3,
  GitBranch,
  GitMerge,
  Layers,
  ListOrdered,
  Scale,
  Table2,
  type LucideIcon,
} from "lucide-react";
import { apiAnaliticaBaseSheet, apiAnaliticaPreparar } from "../../api/client";
import { useSession } from "../../lib/SessionContext";
import { Alert } from "../../components/Alert";
import { LoadingBlock } from "../../components/States";
import { PageFrame } from "../../components/PageFrame";
import { ChromeSlotPortal } from "../../app/ModuleChromeSlots";
import { ChromeBaseSelector } from "../../components/ChromeBaseSelector";
import { AdaptiveSplitView } from "../../components/AdaptiveSplitView";
import { ContextTabRail } from "../../components/ContextTabRail";
import { useAnaliticaAutosave } from "./useAnaliticaAutosave";
import { AnaliticaHeader } from "./AnaliticaHeader";
import { CodebookPane } from "./panes/CodebookPane";
import { FrecuenciasPane } from "./panes/FrecuenciasPane";
import { CrucesPane } from "./panes/CrucesPane";
import { BasesPane } from "./panes/BasesPane";
import { DimensionesPane } from "./panes/DimensionesPane";
import { OrdenCategoriasPane } from "./panes/OrdenCategoriasPane";
import { DataReviewPane } from "./panes/DataReviewPane";
import { MultibaseTablasPane } from "./panes/MultibaseTablasPane";
import { PanelBasePane } from "./panes/PanelBasePane";
import { FichaTecnicaPane } from "./panes/FichaTecnicaPane";
import { PonderacionPane } from "./panes/PonderacionPane";
import { ProcessingSheetViewer } from "../procesamiento/ProcessingSheetViewer";
import { ProcessingPrereqGate } from "../procesamiento/ProcessingPrereqGate";
import { ProcessingReleasePanel } from "./ProcessingReleasePanel";
import "./analitica-v2.css";

// Revisión de data primero; enumeradores vive en Monitoreo.
type Reporte = "datos" | "base_final" | "codebook" | "bases" | "ponderacion" | "frecuencias" | "multibase" | "panel" | "ficha" | "cruces" | "orden" | "dimensiones";

type ReporteMeta = {
  key: Reporte;
  label: string;
  icon: LucideIcon;
  desc: string;
};

const REPORTES: ReporteMeta[] = [
  { key: "datos",        label: "Datos",             icon: ClipboardList, desc: "Etiquetas y variables" },
  { key: "base_final",   label: "Base final",        icon: Table2, desc: "Tabla lista para exportar" },
  { key: "codebook",     label: "Libro de códigos",  icon: BookOpen,  desc: "Diccionario del estudio" },
  { key: "bases",        label: "Bases e instrumentos", icon: Database,  desc: "Archivos y versiones" },
  { key: "ponderacion",  label: "Ponderación",       icon: Scale,     desc: "Representar a la población" },
  { key: "frecuencias",  label: "Frecuencias",       icon: BarChart2, desc: "Distribución de respuestas" },
  { key: "multibase",    label: "Tablas multibase",  icon: GitBranch, desc: "Comparación entre bases" },
  { key: "panel",        label: "Base panel",        icon: GitMerge,  desc: "Personas y mediciones" },
  { key: "ficha",        label: "Ficha técnica",     icon: FileText,  desc: "Metodología e informe" },
  { key: "cruces",       label: "Cruces",            icon: Grid3x3,   desc: "Comparaciones 2D" },
  { key: "orden",        label: "Orden de categorías", icon: ListOrdered, desc: "Secuencia de respuestas ordinales" },
  { key: "dimensiones",  label: "Dimensiones",       icon: Layers,    desc: "Índices y puntajes" },
];

export default function AnaliticaPage() {
  const { state, refresh } = useSession();
  const location = useLocation();
  const navigate = useNavigate();

  useAnaliticaAutosave();

  const prepOk = !!state?.analitica_prep_ok;
  const prereqOk = prepOk || (!!state?.xlsform && !!state?.data);
  const independentSiblings = state?.estudio_processing_mode === "independent_siblings";
  const reportes = REPORTES.filter((r) => {
    if (r.key === "multibase" && independentSiblings) return false;
    return r.key !== "multibase" || !!state?.analitica_multibase_available;
  });

  // Preparar auto-on-mount. Antes era un paso manual; ahora se ejecuta
  // silenciosamente al entrar por primera vez si hay prereqs. El banner
  // de fuente en AnaliticaHeader muestra el resultado.
  const [prepBusy, setPrepBusy] = useState(false);
  const [prepError, setPrepError] = useState("");
  useEffect(() => {
    if (!prereqOk || prepOk || prepBusy) return;
    let cancelled = false;
    (async () => {
      setPrepBusy(true);
      setPrepError("");
      try {
        await apiAnaliticaPreparar();
        if (!cancelled) await refresh();
      } catch (e) {
        if (!cancelled) setPrepError((e as Error).message);
      } finally {
        if (!cancelled) setPrepBusy(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prereqOk, prepOk]);

  // Pestaña activa de la sección Analítica (cada reporte es una pestaña).
  // `?reporte=` es el alias legacy: se lee, no se escribe.
  // Contrato: `lib/navegacion/direccion.ts`.
  const analiticaParams = new URLSearchParams(location.search);
  const raw = analiticaParams.get(PARAMS_DIRECCION.pestana) ?? analiticaParams.get("reporte");
  const active: Reporte = (reportes.find((r) => r.key === raw)?.key) ?? "datos";
  const activeMeta = reportes.find((r) => r.key === active) ?? reportes[0] ?? REPORTES[0];
  const ActiveIcon = activeMeta.icon;

  function goReporte(next: Reporte) {
    const sp = new URLSearchParams(location.search);
    sp.delete("reporte");
    if (next === "datos") sp.delete(PARAMS_DIRECCION.pestana);
    else sp.set(PARAMS_DIRECCION.pestana, next);
    navigate({ pathname: "/analitica", search: sp.toString() ? `?${sp}` : "" });
  }

  return (
    <PageFrame
      title="Fase 4 - Análisis y reportes"
      lead="Configura y genera los reportes estándar desde una sola mesa de trabajo."
      className="pulso-analitica-frame"
      density="compact"
      headerMode="sr-only"
      bodyMode="fill"
      layout="workbench"
      scrollOwner="panels"
      resetScrollKey={`${active}:${state?.active_base ?? ""}`}
      // Readiness del QA visual. Los tres estados terminales del panel se
      // declaran con clave propia — incluido el vacío, que es una vista
      // legítima y no una pantalla a medio cargar (C3 del contrato de
      // superficie). Solo dicen "todavía no" la sesión sin hidratar y la
      // preparación en vuelo, que son exactamente los momentos en que una
      // captura saldría con contadores en cero.
      auditReady={
        !state
          ? false
          : !prereqOk
            ? "analitica-sin-insumos"
            : prepBusy
              ? false
              : prepOk
                ? "analitica"
                : "analitica-preparacion-fallida"
      }
      notices={!prereqOk ? (
        <Alert kind="warn">
          Necesitas cargar el XLSForm y la base de datos en <strong>1. Carga</strong> antes de analizar.
        </Alert>
      ) : undefined}
    >
      {/* Selector de base en la banda del shell. Todas las secciones de
          Procesamiento lo llevan menos Carga, que en su lugar tiene el control de
          multibase porque es donde se dan de alta. */}
      <ChromeSlotPortal zona="contexto">
        <ChromeBaseSelector />
      </ChromeSlotPortal>

      <AdaptiveSplitView
        ariaLabel="Mesa de trabajo de analítica"
        railLabel="Pestañas de analítica"
        className={`pulso-analitica-shell pulso-context-tab-layout${!prereqOk ? " is-empty" : ""}`}
        rail={(
          <AnaliticaSidebar
            active={active}
            onChange={goReporte}
            disabled={!prereqOk || prepBusy || !prepOk}
            reportes={reportes}
          />
        )}
      >
        <main
          id="analitica-panel"
          className="pulso-analitica-content pulso-content-area"
          role="tabpanel"
          aria-labelledby={`analitica-tab-${active}`}
        >
          {!prereqOk ? (
            <ProcessingPrereqGate
              eyebrow="Antes de analizar"
              title="Carga los insumos del estudio"
              copy="Analítica necesita el instrumento y la base para preparar tablas, frecuencias, cruces y libros de códigos."
              ctaLabel="Ir a Carga"
              note="La preparación se ejecuta automáticamente al entrar."
              steps={[
                {
                  label: "Formulario",
                  detail: "Estructura, etiquetas y tipos de pregunta.",
                  Icon: FileSpreadsheet,
                },
                {
                  label: "Base de datos",
                  detail: "Respuestas listas para lectura y tabulación.",
                  Icon: Database,
                },
                {
                  label: "Reportes",
                  detail: "Después se habilitan tablas, cruces y frecuencias.",
                  Icon: BarChart2,
                },
              ]}
            />
          ) : (
            <>
              {/* Sección superior: identidad del reporte (ícono + título + desc)
                  a la izquierda y el control de fuente/plantilla a la derecha.
                  La identidad vive aquí —no como header interno— y cada pane
                  deja su docbar como banda de stats (su -icon/-copy se ocultan
                  vía CSS). El rail sigue siendo el 3er nivel de navegación. */}
              <header className="pulso-analitica-panel-head">
                <span aria-hidden="true" className="pulso-analitica-panel-icon">
                  <ActiveIcon size={17} />
                </span>
                <div className="pulso-analitica-panel-copy">
                  <h2>{activeMeta.label}</h2>
                  <p>{activeMeta.desc}</p>
                </div>
                <AnaliticaHeader prepBusy={prepBusy} prepError={prepError} variant="panel" />
              </header>

              {independentSiblings ? <ProcessingReleasePanel activeBase={state?.active_base} /> : null}

              <div className="pulso-analitica-panel-body">
                {prepBusy ? (
                  <LoadingBlock label="Preparando datos…" />
                ) : prepOk ? (
                  <>
                    {active === "datos"        && <DataReviewPane />}
                    {active === "base_final"   && (
                      <ProcessingSheetViewer
                        title="Base final"
                        sourceLabel="Resultados listos para revisar y exportar"
                        highlightCoding
                        load={apiAnaliticaBaseSheet}
                      />
                    )}
                    {active === "codebook"     && <CodebookPane />}
                    {active === "bases"        && <BasesPane />}
                    {active === "ponderacion"  && <PonderacionPane />}
                    {active === "frecuencias"  && <FrecuenciasPane />}
                    {active === "multibase"    && <MultibaseTablasPane />}
                    {active === "panel"        && <PanelBasePane />}
                    {active === "ficha"        && <FichaTecnicaPane />}
                    {active === "cruces"       && <CrucesPane />}
                    {active === "orden"        && <OrdenCategoriasPane />}
                    {active === "dimensiones"  && <DimensionesPane />}
                  </>
                ) : (
                  <Alert kind="warn">
                    La preparación automática de datos aún no terminó o falló. Recarga la página para reintentar.
                  </Alert>
                )}
              </div>
            </>
          )}
        </main>
      </AdaptiveSplitView>
    </PageFrame>
  );
}

function AnaliticaSidebar({
  active,
  onChange,
  disabled,
  reportes,
}: {
  active: Reporte;
  onChange: (reporte: Reporte) => void;
  disabled: boolean;
  reportes: ReporteMeta[];
}) {
  return (
    <ContextTabRail
      ariaLabel="Pestañas de analítica"
      activeKey={active}
      items={reportes.map(({ key, label, icon, desc }) => ({
        key,
        label,
        icon,
        description: desc,
      }))}
      panelId="analitica-panel"
      tabId={(key) => `analitica-tab-${key}`}
      onChange={onChange}
      disabled={disabled}
    />
  );
}
