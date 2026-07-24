import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Loader2,
  RefreshCw,
} from "lucide-react";
import {
  apiBitacoraState,
  apiPlanTrabajoState,
  type DisenoEstudioBitacoraEntry,
  type PlanTrabajoState,
} from "../../api/client";
import { Alert } from "../../components/Alert";
import { LoadingBlock } from "../../components/States";
import { PageFrame } from "../../components/PageFrame";
import { GlidingTabList } from "../../components/GlidingTabList";
import {
  moduleChromeVars,
  PROSECNUR_MODULES,
  type ProsecnurModuleSectionMeta,
} from "../../lib/modules";
import { LogbookSection } from "./LogbookSection";
import { CronogramaSection } from "./CronogramaSection";
import { Calendar } from "./Calendar";
import "./bitacora.css";

type Tab = "bitacora" | "cronograma" | "calendario";

const BITACORA_MODULE =
  PROSECNUR_MODULES.find((module) => module.slug === "diseno-estudio") ?? PROSECNUR_MODULES[0];

type BitacoraSection = ProsecnurModuleSectionMeta & { id: Tab };

function isBitacoraSection(section: ProsecnurModuleSectionMeta): section is BitacoraSection {
  return section.id === "bitacora" || section.id === "cronograma" || section.id === "calendario";
}

const BITACORA_SECTIONS = BITACORA_MODULE.sections.filter(isBitacoraSection);

function tabFromSearch(search: string): Tab {
  const value = new URLSearchParams(search).get("tab");
  if (value === "cronograma" || value === "calendario") return value;
  return "bitacora";
}

export default function BitacoraPage() {
  const location = useLocation();
  const [tab, setTab] = useState<Tab>(() => tabFromSearch(location.search));
  const [plan, setPlan] = useState<PlanTrabajoState | null>(null);
  const [entries, setEntries] = useState<DisenoEstudioBitacoraEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTab(tabFromSearch(location.search));
  }, [location.search]);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const [planState, bitacora] = await Promise.all([
        apiPlanTrabajoState(),
        apiBitacoraState(),
      ]);
      setPlan(planState);
      setEntries(bitacora.bitacora);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo abrir la bitácora.");
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
    return <LoadingBlock label="Abriendo bitácora..." />;
  }

  return (
    <PageFrame
      auditReady={!loading && !error ? `bitacora-${tab}` : false}
      title="Bitácora"
      headerMode="sr-only"
      layout="workbench"
      bodyMode="fill"
      scrollOwner="panels"
      className="bitacora-frame"
    >
      <div className="bitacora-shell" style={moduleChromeVars(BITACORA_MODULE)}>
        {/* Command bar material de 3 zonas (patrón maestro 1, espejo del
            mon-commandbar): contexto (dot + kicker) | rail de secciones
            canónico (.pulso-phase-pillbar) | acciones (refresh). */}
        <div className="pulso-command-bar bitacora-commandbar" aria-label="Contexto de la bitácora">
          <span className="bitacora-command-context">
            <span className="bitacora-command-dot" aria-hidden="true" />
            <span className="bitacora-command-kicker">Bitácora</span>
          </span>
          <GlidingTabList
            as="nav"
            mode="nav"
            activeKey={tab}
            className="pulso-phase-pillbar bitacora-section-rail"
            aria-label="Secciones de la bitácora"
          >
            <ol className="pulso-phase-pill-list">
              {BITACORA_SECTIONS.map((item) => {
                const Icon = item.icon;
                const active = tab === item.id;
                return (
                  <li key={item.id} className="pulso-phase-pill-item">
                    <Link
                      to={item.to}
                      data-gliding-key={item.id}
                      className={`pulso-phase-pill bitacora-section-pill${active ? " is-active" : ""}`}
                      aria-current={active ? "page" : undefined}
                    >
                      <span className="pulso-phase-pill-circle" aria-hidden="true" />
                      <span className="pulso-phase-pill-stack">
                        <span className="pulso-phase-pill-label">
                          <Icon
                            size={14}
                            className="bitacora-section-pill-icon"
                            aria-hidden="true"
                          />
                          <span className="pulso-phase-pill-text">{item.label}</span>
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </GlidingTabList>
          <div className="bitacora-command-actions">
            <button
              type="button"
              className="bitacora-icon-button"
              onClick={load}
              title="Actualizar"
              aria-label="Actualizar bitácora"
            >
              {loading ? <Loader2 size={15} className="spin" /> : <RefreshCw size={15} />}
            </button>
          </div>
        </div>

        {error && <Alert kind="error">{error}</Alert>}

        <div className="bitacora-body">
          {tab === "bitacora" && <LogbookSection entries={entries} onChange={setEntries} />}
          {tab === "cronograma" && plan && (
            <CronogramaSection state={plan} onChange={setPlan} onReload={reloadPlan} />
          )}
          {tab === "calendario" && plan && (
            <Calendar state={plan} onChange={setPlan} />
          )}
        </div>
      </div>
    </PageFrame>
  );
}
