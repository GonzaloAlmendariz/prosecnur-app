import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  CalendarDays,
  CalendarRange,
  ClipboardList,
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
import { moduleChromeVars, PROSECNUR_MODULES } from "../../lib/modules";
import { LogbookSection } from "./LogbookSection";
import { CronogramaSection } from "./CronogramaSection";
import { Calendar } from "./Calendar";
import "./bitacora.css";

type Tab = "bitacora" | "cronograma" | "calendario";

const BITACORA_MODULE =
  PROSECNUR_MODULES.find((module) => module.slug === "diseno-estudio") ?? PROSECNUR_MODULES[0];

const TABS: Array<{ key: Tab; label: string; icon: typeof ClipboardList }> = [
  { key: "bitacora", label: "Bitácora", icon: ClipboardList },
  { key: "cronograma", label: "Cronograma", icon: CalendarRange },
  { key: "calendario", label: "Calendario", icon: CalendarDays },
];

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
      title="Bitácora"
      headerMode="sr-only"
      layout="workbench"
      bodyMode="fill"
      scrollOwner="panels"
      className="bitacora-frame"
    >
      <div className="bitacora-shell" style={moduleChromeVars(BITACORA_MODULE)}>
        {/* Sin franja de identidad: el rail superior ya nombra el módulo.
            Las tabs SON la capa de comando; el refresh vive a su derecha. */}
        <div className="bitacora-command-row">
          <nav className="bitacora-tabs" aria-label="Secciones de la bitácora">
            {TABS.map((item) => {
              const Icon = item.icon;
              const active = tab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  className={active ? "is-active" : ""}
                  aria-pressed={active}
                  onClick={() => setTab(item.key)}
                >
                  <Icon size={14} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
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
