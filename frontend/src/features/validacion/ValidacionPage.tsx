import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { Activity, CheckCircle2, Compass, Database, ListTree, PieChart, ShieldCheck } from "lucide-react";
import {
  apiEstudioActiveBaseSet,
  apiEstudioGet,
  EstudioPayload,
} from "../../api/client";
import { useSession } from "../../lib/SessionContext";
import { repeatContextFromBase } from "../../lib/rosterExplorer";
import { Alert } from "../../components/Alert";
import { PageFrame } from "../../components/PageFrame";
import { ChromeSlotPortal } from "../../app/ModuleChromeSlots";
import { AdaptiveSplitView } from "../../components/AdaptiveSplitView";
import { TabMeta } from "../../components/TabStrip";
import { EmptyState, ErrorBlock } from "../../components/States";
import { GlidingTabList } from "../../components/GlidingTabList";
import BaseSelector from "./BaseSelector";
import LimpiezaTab from "./tabs/LimpiezaTab";
import InstrumentoTab from "./tabs/InstrumentoTab";
import ExplorarTab from "./tabs/ExplorarTab";
import ReglasCustomTab from "./tabs/ReglasCustomTab";
import { useValidacionStore } from "./store";
import type { ValidacionTabId } from "./types";
import "./validacion-v2.css";

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
    label: "Cierre de base",
    icon: Activity,
    desc: "Limpieza y normalización",
  },
];

export default function ValidacionPage() {
  const { sessionId, state } = useSession();
  const activeTab = useValidacionStore((s) => s.activeTab);
  const setActiveTab = useValidacionStore((s) => s.setActiveTab);
  const baseNombre = useValidacionStore((s) => s.baseNombre);
  const setBaseNombre = useValidacionStore((s) => s.setBaseNombre);
  const version = useValidacionStore((s) => s.version);
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
    setEstudio(null);
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
  const activePanelScope = { activeTab, baseNombre, version } as const;

  async function handleBaseChange(next: string) {
    setEstudio(null);
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
      notices={
        <>
          {!prereqsOk && (
            <Alert kind="warn">
              <strong>Faltan insumos.</strong>{" "}
              Para revisar consistencias necesitas un formulario y respuestas cargadas en la Fase 1.
            </Alert>
          )}

          {loadError && <ErrorBlock label="No se pudo cargar el estudio" detail={loadError} />}
        </>
      }
    >
      {/* El contexto de la página sube a la banda del shell en vez de dibujar una
          segunda banda debajo. Antes eran dos: la del shell con el rail de
          secciones y esta, con el resumen y el selector de base. */}
      {/* Sin chips de estado en la banda: «Insumos» y «Lista para auditar» repiten
          lo que el rail de secciones ya marca como completado. Queda el selector de
          base, que sí se opera. */}
      <ChromeSlotPortal zona="contexto">
        {showBaseSelector && (
          <BaseSelector
            estudio={estudio}
            selected={baseNombre}
            onChange={(next) => void handleBaseChange(next)}
          />
        )}
      </ChromeSlotPortal>

      <AdaptiveSplitView
        ariaLabel="Mesa de trabajo de validación"
        railLabel="Pestañas de validación"
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
          key={`${activePanelScope.activeTab}:${activePanelScope.baseNombre ?? ""}:${activePanelScope.version}`}
          id="validacion-panel"
          className={`pulso-validacion-content pulso-content-area${activeTab === "reglas_custom" ? " is-contained-scroll" : ""}`}
          role="tabpanel"
          aria-labelledby={`validacion-tab-${activeTab}`}
          data-audit-ready={!prereqsOk && estudio !== null && !loadError ? `validacion-${activeTab}` : undefined}
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
                {activeTab === "explorar" && <ExplorarTab repeat={repeatContextFromBase(selectedBase)} />}
                {activeTab === "reglas_custom" && <ReglasCustomTab />}
              </div>
            </>
          )}
        </main>
      </AdaptiveSplitView>
    </PageFrame>
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
    <aside className="pulso-validacion-sidebar pulso-sidebar" aria-label="Pestañas de validación">
      <div className="pulso-validacion-sidebar-head">
        <span className="pulso-section-eyebrow">Validación</span>
        <strong>Vistas</strong>
        {disabled ? <small className="pulso-sidebar-head-status">Pendiente</small> : null}
      </div>
      <GlidingTabList
        activeKey={active}
        orientation="vertical"
        style={{ "--pulso-gliding-indicator-radius": "10px" } as CSSProperties}
        role="tablist"
        aria-label="Pestañas de validación"
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
              aria-label={`${tab.label}${tab.desc ? `. ${tab.desc}` : ""}`}
              data-rail-title={tab.label}
              data-rail-desc={tab.desc ?? ""}
              data-rail-tooltip={tab.desc ? `${tab.label}\n${tab.desc}` : tab.label}
              data-gliding-key={tab.key}
              data-nav-item=""
              data-nav-shape="row"
              data-nav-state={isActive ? "selected" : undefined}
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
      </GlidingTabList>
    </aside>
  );
}
