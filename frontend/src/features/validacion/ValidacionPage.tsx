import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, CheckCircle2, Compass, Database, ListTree, PieChart, ShieldCheck } from "lucide-react";
import {
  apiEstudioActiveBaseSet,
  apiEstudioGet,
  EstudioPayload,
} from "../../api/client";
import { useSession } from "../../lib/SessionContext";
import { Alert } from "../../components/Alert";
import { ContextBar, ContextBarDivider } from "../../components/ContextBar";
import { PageFrame } from "../../components/PageFrame";
import { AdaptiveSplitView } from "../../components/AdaptiveSplitView";
import { TabMeta } from "../../components/TabStrip";
import { EmptyState, ErrorBlock } from "../../components/States";
import BaseSelector from "./BaseSelector";
import LimpiezaTab from "./tabs/LimpiezaTab";
import InstrumentoTab from "./tabs/InstrumentoTab";
import ExplorarTab from "./tabs/ExplorarTab";
import ReglasCustomTab from "./tabs/ReglasCustomTab";
import { useValidacionStore } from "./store";
import type { ValidacionTabId } from "./types";

// =============================================================================
// Fase 2 — Validación v2 (shell)
// =============================================================================
// La Fase 2 es la "bisagra": antes de avanzar a Codificación, acá se
// revisa que la data cumple lo que el XLSForm promete, se definen reglas
// más finas y se explora cómo viene distribuida cada variable.
//
// Estructura:
//   - PageFrame compacto con toolbar y scroll interno.
//   - BaseSelector (solo visible cuando el estudio tiene ≥2 bases).
//   - TabStrip con 4 pestañas; el contenido de cada una vive en un
//     componente aparte (ver ./tabs/*).
//
// Estado "pesado" (plan, evaluación, reglas custom) vive en el backend
// scoped por base. Acá sólo manejamos el selector y el tab activo vía
// zustand (ver ./store.ts).
//
// Sprint 1: shell + stubs. Sprints 2-5 llenan cada tab.

const TABS: TabMeta<ValidacionTabId>[] = [
  {
    key: "explorar",
    label: "Explorar respuestas",
    icon: Compass,
    desc: "Distribuciones y señales de revisión",
  },
  {
    key: "instrumento",
    label: "Reglas del formulario",
    icon: ListTree,
    desc: "Saltos, rangos y catálogos",
  },
  {
    key: "reglas_custom",
    label: "Criterios de revisión",
    icon: PieChart,
    desc: "Señales adicionales",
  },
  {
    key: "limpieza",
    label: "Limpieza y normalización",
    icon: Activity,
    desc: "Decidir y cerrar la base",
  },
];

export default function ValidacionPage() {
  const { sessionId, state } = useSession();
  const activeTab = useValidacionStore((s) => s.activeTab);
  const setActiveTab = useValidacionStore((s) => s.setActiveTab);
  const baseNombre = useValidacionStore((s) => s.baseNombre);
  const setBaseNombre = useValidacionStore((s) => s.setBaseNombre);
  const resetForSession = useValidacionStore((s) => s.resetForSession);

  const [estudio, setEstudio] = useState<EstudioPayload | null>(null);
  const [loadError, setLoadError] = useState<string>("");
  const lastSessionRef = useRef(sessionId);
  const basesSignature = useMemo(
    () => `${state?.session_id ?? sessionId}|${state?.n_bases ?? 0}|${state?.active_base ?? ""}|${(state?.bases_nombres ?? []).join("|")}`,
    [sessionId, state?.session_id, state?.n_bases, state?.active_base, state?.bases_nombres],
  );

  useEffect(() => {
    if (!sessionId || lastSessionRef.current === sessionId) return;
    lastSessionRef.current = sessionId;
    setEstudio(null);
    setLoadError("");
    resetForSession();
  }, [sessionId, resetForSession]);

  // Cargar el estudio para poblar el BaseSelector (si multi-base).
  useEffect(() => {
    let cancel = false;
    setLoadError("");
    apiEstudioGet()
      .then((p) => {
        if (cancel) return;
        setEstudio(p);
        const activeFromBackend = p.active_base || state?.active_base || null;
        // Si todavía no hay base seleccionada y el estudio tiene bases,
        // preseleccionamos la activa del backend o la primera.
        if (!baseNombre && p.n_bases > 0) {
          const first = activeFromBackend || Object.keys(p.bases)[0];
          if (first) setBaseNombre(first);
        }
        // Caso borde: base guardada en store ya no existe en el estudio
        // (puede pasar tras quitar una base en Fase 1).
        if (baseNombre && !p.bases[baseNombre]) {
          const first = activeFromBackend || Object.keys(p.bases)[0] || null;
          setBaseNombre(first);
        } else if (activeFromBackend && activeFromBackend !== baseNombre && p.bases[activeFromBackend]) {
          setBaseNombre(activeFromBackend);
        }
      })
      .catch((e) => {
        if (!cancel) setLoadError((e as Error).message);
      });
    return () => {
      cancel = true;
    };
  }, [baseNombre, setBaseNombre, basesSignature, state?.active_base]);

  const prereqsOk = !!state?.xlsform && !!state?.data;
  const activeMeta = TABS.find((tab) => tab.key === activeTab) ?? TABS[0];
  const ActiveIcon = activeMeta.icon;
  const independentSiblings = estudio?.processing_mode === "independent_siblings" || state?.estudio_processing_mode === "independent_siblings";
  const showBaseSelector = prereqsOk && !!estudio && estudio.n_bases > 1 && !independentSiblings;
  const selectedBase = baseNombre && estudio?.bases ? estudio.bases[baseNombre] : null;
  const displayBaseName = selectedBase?.source_alias || selectedBase?.source_title || (baseNombre && baseNombre !== "default" ? baseNombre : "Base única");

  async function handleBaseChange(next: string) {
    setBaseNombre(next);
    try {
      const r = await apiEstudioActiveBaseSet(next);
      window.dispatchEvent(new CustomEvent("pulso:active-base-changed", {
        detail: { active: r.active, processing_mode: r.processing_mode },
      }));
      window.dispatchEvent(new CustomEvent("pulso:codif-source-changed", {
        detail: { source: r.active },
      }));
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }

  return (
    <PageFrame
      title="Fase 2 - Validación"
      lead="Explora las respuestas, valida contra el formulario, afina criterios y cierra la limpieza."
      className="pulso-validacion-frame"
      density="compact"
      headerMode="sr-only"
      bodyMode="fill"
      layout="workbench"
      scrollOwner="panels"
      resetScrollKey={`${activeTab}:${baseNombre ?? ""}`}
      toolbar={
        <div className="pulso-validacion-toolbar-stack">
          <ContextBar
            ariaLabel="Contexto de validación"
            className="pulso-validacion-commandbar"
            elevated
          >
            <ValidacionStatusSummary
              hasXlsform={!!state?.xlsform}
              hasData={!!state?.data}
              prereqsOk={prereqsOk}
              auditoriaRun={!!state?.auditoria_run}
              bases={state?.n_bases ?? 0}
            />

            {showBaseSelector && (
              <>
                <ContextBarDivider />
                <BaseSelector
                  estudio={estudio}
                  selected={baseNombre}
                  onChange={(next) => void handleBaseChange(next)}
                />
              </>
            )}
          </ContextBar>

          {!prereqsOk && (
            <Alert kind="warn">
              <strong>Faltan insumos.</strong>{" "}
              Para revisar consistencias necesitas un formulario y respuestas cargadas en la Fase 1.
            </Alert>
          )}

          {loadError && <ErrorBlock label="No se pudo cargar el estudio" detail={loadError} />}
        </div>
      }
    >
      <AdaptiveSplitView
        ariaLabel="Mesa de trabajo de validación"
        railLabel="Secciones de validación"
        className={`pulso-validacion-shell${!prereqsOk ? " is-empty" : ""}`}
        rail={(
          <ValidacionModeSidebar
            active={activeTab}
            onChange={setActiveTab}
            disabled={!prereqsOk}
          />
        )}
      >
        <main
          id="validacion-panel"
          className={`pulso-validacion-content pulso-content-area${activeTab === "reglas_custom" ? " is-contained-scroll" : ""}`}
          role="tabpanel"
          aria-labelledby={`validacion-tab-${activeTab}`}
        >
          {!prereqsOk ? (
            <EmptyState
              icon={<Compass size={18} />}
              title="Carga insumos para validar"
              hint="La validación se habilita cuando la sesión tiene un formulario y respuestas cargadas."
              cta={<Link className="pulso-empty-cta" to="/carga">Ir a Carga</Link>}
            />
          ) : (
            <>
              <header className="pulso-validacion-panel-head">
                <span aria-hidden="true" className="pulso-validacion-panel-icon">
                  <ActiveIcon size={17} />
                </span>
                <div className="pulso-validacion-panel-copy">
                  <span className="pulso-section-eyebrow">Vista actual</span>
                  <h2>{activeMeta.label}</h2>
                  {activeMeta.desc && <p>{activeMeta.desc}</p>}
                </div>
                <span className="pulso-validacion-base-current">
                  <Database size={12} />
                  {displayBaseName}
                </span>
              </header>
              <div className="pulso-validacion-panel-body">
                {activeTab === "limpieza" && <LimpiezaTab />}
                {activeTab === "instrumento" && <InstrumentoTab />}
                {activeTab === "explorar" && <ExplorarTab />}
                {activeTab === "reglas_custom" && <ReglasCustomTab />}
              </div>
            </>
          )}
        </main>
      </AdaptiveSplitView>
    </PageFrame>
  );
}

function ValidacionStatusSummary({
  hasXlsform,
  hasData,
  prereqsOk,
  auditoriaRun,
  bases,
}: {
  hasXlsform: boolean;
  hasData: boolean;
  prereqsOk: boolean;
  auditoriaRun: boolean;
  bases: number;
}) {
  return (
    <div className="pulso-validacion-status" aria-label="Estado de la validación">
      <ValidacionStatusPill label="Formulario" done={hasXlsform} />
      <ValidacionStatusPill label="Respuestas" done={hasData} />
      <span className={`pulso-validacion-status-pill${auditoriaRun ? " is-done" : ""}`}>
        <ShieldCheck size={13} />
        {auditoriaRun ? "Auditoría corrida" : prereqsOk ? "Lista para auditar" : "En espera"}
      </span>
      {bases > 1 && (
        <span className="pulso-validacion-status-pill">
          <Database size={13} />
          {bases} bases
        </span>
      )}
    </div>
  );
}

function ValidacionStatusPill({ label, done }: { label: string; done: boolean }) {
  return (
    <span className={`pulso-validacion-status-pill${done ? " is-done" : ""}`}>
      <span aria-hidden="true" className="pulso-validacion-status-dot" />
      {label}
    </span>
  );
}

function ValidacionModeSidebar({
  active,
  onChange,
  disabled,
}: {
  active: ValidacionTabId;
  onChange: (tab: ValidacionTabId) => void;
  disabled: boolean;
}) {
  return (
    <aside className="pulso-validacion-sidebar pulso-sidebar" aria-label="Secciones de validación">
      <div className="pulso-validacion-sidebar-head">
        <span className="pulso-section-eyebrow">Validación</span>
        <strong>{disabled ? "Pendiente" : "Validación"}</strong>
      </div>
      <div
        role="tablist"
        aria-label="Secciones de validación"
        aria-orientation="vertical"
        className="pulso-validacion-nav"
      >
        {TABS.map((tab, index) => {
          const Icon = tab.icon;
          const isActive = active === tab.key;
          return (
            <button
              key={tab.key}
              id={`validacion-tab-${tab.key}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls="validacion-panel"
              disabled={disabled}
              onClick={() => onChange(tab.key)}
              className={`pulso-validacion-nav-item${isActive ? " is-active" : ""}`}
            >
              <span className="pulso-validacion-nav-index">{index + 1}</span>
              <span aria-hidden="true" className="pulso-validacion-nav-icon">
                <Icon size={15} />
              </span>
              <span className="pulso-validacion-nav-copy">
                <strong>{tab.label}</strong>
                {tab.desc && <span>{tab.desc}</span>}
              </span>
              {isActive && !disabled && (
                <span className="pulso-validacion-nav-current">
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
