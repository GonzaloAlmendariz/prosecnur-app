import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  BarChart2,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Database,
  FileSpreadsheet,
  Grid3x3,
  Layers,
  type LucideIcon,
} from "lucide-react";
import { apiAnaliticaPreparar } from "../../api/client";
import { useSession } from "../../lib/SessionContext";
import { Alert } from "../../components/Alert";
import { EmptyState, LoadingBlock } from "../../components/States";
import { PageFrame } from "../../components/PageFrame";
import { useAnaliticaAutosave } from "./useAnaliticaAutosave";
import { AnaliticaHeader } from "./AnaliticaHeader";
import { CodebookPane } from "./panes/CodebookPane";
import { FrecuenciasPane } from "./panes/FrecuenciasPane";
import { CrucesPane } from "./panes/CrucesPane";
import { BasesPane } from "./panes/BasesPane";
import { DimensionesPane } from "./panes/DimensionesPane";
import { DataReviewPane } from "./panes/DataReviewPane";

// Revisión de data primero; enumeradores vive en Monitoreo.
type Reporte = "datos" | "codebook" | "bases" | "frecuencias" | "cruces" | "dimensiones";

type ReporteMeta = {
  key: Reporte;
  label: string;
  icon: LucideIcon;
  desc: string;
};

const REPORTES: ReporteMeta[] = [
  { key: "datos",        label: "Datos",             icon: ClipboardList, desc: "Revisión de data" },
  { key: "codebook",     label: "Libro de códigos",  icon: BookOpen,  desc: "Diccionario de variables" },
  { key: "bases",        label: "Bases",             icon: Database,  desc: "Datos exportables (SPSS)" },
  { key: "frecuencias",  label: "Frecuencias",       icon: BarChart2, desc: "Tablas univariadas" },
  { key: "cruces",       label: "Cruces",            icon: Grid3x3,   desc: "Tablas 2D con semáforo" },
  { key: "dimensiones",  label: "Dimensiones",       icon: Layers,    desc: "Índices 0-100 jerárquicos" },
];

export default function AnaliticaPage() {
  const { state, refresh } = useSession();
  const location = useLocation();
  const navigate = useNavigate();

  useAnaliticaAutosave();

  const prereqOk = !!state?.xlsform && !!state?.data;
  const prepOk = !!state?.analitica_prep_ok;

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

  // Reporte activo desde el query string.
  const raw = new URLSearchParams(location.search).get("reporte");
  const active: Reporte = (REPORTES.find((r) => r.key === raw)?.key) ?? "datos";
  const activeMeta = REPORTES.find((r) => r.key === active) ?? REPORTES[0];
  const ActiveIcon = activeMeta.icon;

  function goReporte(next: Reporte) {
    const sp = new URLSearchParams(location.search);
    if (next === "datos") sp.delete("reporte");
    else sp.set("reporte", next);
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
      resetScrollKey={active}
      toolbar={
        <div className="pulso-analitica-toolbar-stack">
          {!prereqOk && (
            <Alert kind="warn">
              Necesitas cargar el XLSForm y la base de datos en <strong>1. Carga</strong> antes de analizar.
            </Alert>
          )}

          {prereqOk && (
            <AnaliticaHeader prepBusy={prepBusy} prepError={prepError} />
          )}
        </div>
      }
    >
      <section className={`pulso-analitica-shell pulso-split-view${!prereqOk ? " is-empty" : ""}`}>
        <AnaliticaSidebar
          active={active}
          onChange={goReporte}
          disabled={!prereqOk || prepBusy || !prepOk}
          prepBusy={prepBusy}
          prepOk={prepOk}
          state={state}
        />

        <main
          id="analitica-panel"
          className="pulso-analitica-content pulso-content-area"
          role="tabpanel"
          aria-labelledby={`analitica-tab-${active}`}
        >
          {!prereqOk ? (
            <EmptyState
              icon={<FileSpreadsheet size={20} />}
              title="Carga insumos para analizar"
              hint="Analítica se habilita cuando la sesión tiene un XLSForm y una base de datos cargados."
            />
          ) : (
            <>
              <header className="pulso-analitica-panel-head">
                <span aria-hidden="true" className="pulso-analitica-panel-icon">
                  <ActiveIcon size={17} />
                </span>
                <div className="pulso-analitica-panel-copy">
                  <span className="pulso-section-eyebrow">Reporte actual</span>
                  <h2>{activeMeta.label}</h2>
                  <p>{activeMeta.desc}</p>
                </div>
                <span className={`pulso-analitica-prep-pill${prepOk ? " is-done" : prepBusy ? " is-busy" : ""}`}>
                  {prepOk ? <CheckCircle2 size={12} /> : <Database size={12} />}
                  {prepBusy ? "Preparando" : prepOk ? "Datos listos" : "Pendiente"}
                </span>
              </header>

              <div className="pulso-analitica-panel-body">
                {prepBusy ? (
                  <LoadingBlock label="Preparando datos…" />
                ) : prepOk ? (
                  <>
                    {active === "datos"        && <DataReviewPane />}
                    {active === "codebook"     && <CodebookPane />}
                    {active === "bases"        && <BasesPane />}
                    {active === "frecuencias"  && <FrecuenciasPane />}
                    {active === "cruces"       && <CrucesPane />}
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
      </section>
    </PageFrame>
  );
}

function AnaliticaSidebar({
  active,
  onChange,
  disabled,
  prepBusy,
  prepOk,
  state,
}: {
  active: Reporte;
  onChange: (reporte: Reporte) => void;
  disabled: boolean;
  prepBusy: boolean;
  prepOk: boolean;
  state: ReturnType<typeof useSession>["state"];
}) {
  return (
    <aside className="pulso-analitica-sidebar pulso-sidebar" aria-label="Reportes de analítica">
      <div className="pulso-analitica-sidebar-head">
        <span className="pulso-section-eyebrow">Analítica</span>
        <strong>{prepBusy ? "Preparando datos" : prepOk ? "Mesa de reportes" : "Pendiente"}</strong>
      </div>
      <div
        role="tablist"
        aria-label="Reportes disponibles"
        aria-orientation="vertical"
        className="pulso-analitica-nav"
      >
        {REPORTES.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.key;
          const done = reporteDone(item.key, state);
          return (
            <button
              key={item.key}
              id={`analitica-tab-${item.key}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls="analitica-panel"
              disabled={disabled}
              onClick={() => onChange(item.key)}
              className={`pulso-analitica-nav-item${isActive ? " is-active" : ""}${done ? " is-done" : ""}`}
            >
              <span aria-hidden="true" className="pulso-analitica-nav-icon">
                <Icon size={15} />
              </span>
              <span className="pulso-analitica-nav-copy">
                <strong>{item.label}</strong>
                <span>{item.desc}</span>
              </span>
              {done && (
                <span className="pulso-analitica-nav-done">
                  <CheckCircle2 size={12} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function reporteDone(reporte: Reporte, state: ReturnType<typeof useSession>["state"]) {
  if (!state) return false;
  if (reporte === "datos") return !!state.analitica_prep_ok;
  if (reporte === "codebook") return !!state.analitica_codebook_ok;
  if (reporte === "bases") return !!state.analitica_spss_ok;
  if (reporte === "frecuencias") return !!state.analitica_frecuencias_ok;
  if (reporte === "cruces") return !!state.analitica_cruces_ok;
  if (reporte === "dimensiones") return !!state.analitica_dim_ok;
  return false;
}
