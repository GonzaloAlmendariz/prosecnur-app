import { useState, type CSSProperties } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AlertCircle, CheckCircle2, Database, FileSpreadsheet, Layers, Network, Tags, Wand2 } from "lucide-react";
import { useSession } from "../../lib/SessionContext";
import { Alert } from "../../components/Alert";
import { ContextBar, ContextBarDivider } from "../../components/ContextBar";
import { PageFrame } from "../../components/PageFrame";
import { AdaptiveSplitView } from "../../components/AdaptiveSplitView";
import { StepMeta } from "../../components/Stepper";
import { GlidingTabList } from "../../components/GlidingTabList";
import { PreguntasLanding } from "./PreguntasLanding";
import { CodificarWizard } from "./CodificarWizard";
import { AdaptarPane } from "./AdaptarPane";
import { useCodifSource } from "./useCodifSource";
import { CodingConfigActions } from "./CodingConfigActions";
import { ProcessingPrereqGate } from "../procesamiento/ProcessingPrereqGate";
import "./codificacion-v2.css";

type Step = "organizar" | "codificar" | "matrices" | "adaptar";

export default function CodificacionPage() {
  const { state, refresh: refreshSession } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const [importRevision, setImportRevision] = useState(0);
  // Necesitamos el `active` para forzar remount de los hijos al cambiar
  // de base (ver comentario abajo en los key={codifActive}).
  const codifSource = useCodifSource();
  const codifActive = `${codifSource.active ?? "default"}:${importRevision}`;

  const prereqOk = !!state?.xlsform && !!state?.data;

  // Step persistido en query string (?step=codificar | adaptar).
  const rawStep = new URLSearchParams(location.search).get("step");
  const step: Step =
    rawStep === "codificar" ? "codificar" :
    rawStep === "matrices" ? "matrices" :
    rawStep === "adaptar" ? "adaptar" :
    "organizar";

  function goStep(next: Step) {
    const sp = new URLSearchParams(location.search);
    if (next === "organizar") sp.delete("step");
    else sp.set("step", next);
    navigate({ pathname: "/codificacion", search: sp.toString() ? `?${sp}` : "" });
  }

  return (
    <PageFrame
      title="Fase 3 - Codificación"
      className="pulso-codificacion-frame"
      density="compact"
      headerMode="sr-only"
      bodyMode="fill"
      layout="workbench"
      scrollOwner="panels"
      resetScrollKey={step}
      lead={
        step === "organizar"
          ? "Organiza las preguntas abiertas y marca las que quieres codificar."
          : step === "codificar"
          ? "Agrupa respuestas similares y asigna códigos pregunta por pregunta."
          : step === "matrices"
          ? "Prepara el mapeo Excel de textos abiertos con control por base, variable e ID caso."
          : "Confirma todos los mapeos manuales y de matriz antes de adaptar las respuestas."
      }
      toolbar={
        <div className="pulso-codificacion-toolbar-stack">
          <ContextBar
            ariaLabel="Contexto de codificación"
            className="pulso-codificacion-commandbar"
            elevated
          >
            <CodificacionStatusSummary
              hasXlsform={!!state?.xlsform}
              hasData={!!state?.data}
              prereqOk={prereqOk}
              applied={!!state?.codif_aplicado}
              bases={state?.n_bases ?? codifSource.options.length}
              step={step}
            />

            {prereqOk && codifSource.options.length > 1 && state?.estudio_processing_mode !== "independent_siblings" && (
              <>
                <ContextBarDivider />
                <BaseSelector source={codifSource} />
              </>
            )}

          </ContextBar>

          {!prereqOk && (
            <Alert kind="warn">Necesitas cargar el formulario y las respuestas en <strong>1. Carga</strong> antes de codificar.</Alert>
          )}
        </div>
      }
    >
      <AdaptiveSplitView
        ariaLabel="Mesa de trabajo de codificación"
        railLabel="Pasos de codificación"
        className={`pulso-codificacion-shell${!prereqOk ? " is-empty" : ""}`}
        rail={(
          <CodificacionModeSidebar
            active={step}
            onChange={goStep}
            disabled={!prereqOk}
          />
        )}
      >
        <main
          id="codificacion-panel"
          className="pulso-codificacion-content pulso-content-area"
          role="tabpanel"
          aria-labelledby={`codificacion-step-${step}`}
        >
          {!prereqOk ? (
            <ProcessingPrereqGate
              eyebrow="Antes de codificar"
              title="Carga formulario y respuestas"
              copy="Con esos insumos Prosecnur puede ubicar preguntas abiertas, leer respuestas y preparar la mesa de codificación."
              ctaLabel="Ir a Carga"
              note="No cambia tu base; solo habilita el trabajo de codificación."
              steps={[
                {
                  label: "Formulario",
                  detail: "Preguntas, tipos y etiquetas del instrumento.",
                  Icon: FileSpreadsheet,
                },
                {
                  label: "Respuestas",
                  detail: "Base cargada para revisar textos abiertos.",
                  Icon: Database,
                },
                {
                  label: "Codificación",
                  detail: "Luego podrás organizar, agrupar, mapear en matriz y adaptar códigos.",
                  Icon: Tags,
                },
              ]}
            />
          ) : (
            <>
              <div className="pulso-codificacion-panel-body">
                {/* `key={codifActive}` fuerza el remount de los hijos cuando
                    el analista cambia la base activa. Cada hijo tiene sus propios
                    useEffect([]) que refetchean familias/preguntas/columnas del
                    backend; al remontarse cargan el estado scoped de la base
                    nueva sin tener que refactorear 8 archivos con listeners. */}
                {step === "organizar" && <PreguntasLanding key={codifActive} />}
                {step === "codificar" && <CodificarWizard key={codifActive} onBackToOrganizar={() => goStep("organizar")} />}
                {step === "matrices" && (
                  <CodingConfigActions
                    key={codifActive}
                    onImported={() => {
                      setImportRevision((n) => n + 1);
                      void refreshSession();
                    }}
                  />
                )}
                {step === "adaptar" && (
                  <AdaptarPane
                    key={codifActive}
                    onBackToCodificar={() => goStep("codificar")}
                    onBackToMatrices={() => goStep("matrices")}
                  />
                )}
              </div>
            </>
          )}
        </main>
      </AdaptiveSplitView>
    </PageFrame>
  );
}

// Selector de base activa cuando el estudio es multi-base. Si hay solo
// 1 base, el selector se esconde (sería ruido). Al cambiar, el backend
// sirve el estado scoped de la nueva base; el hook useCodifSource
// dispara `pulso:codif-source-changed` para que los componentes hijos
// (PreguntasLanding, CodificarWizard, AdaptarPane) recarguen sus datos.
function BaseSelector({ source }: { source: ReturnType<typeof useCodifSource> }) {
  const { active, options, loading, setActive } = source;
  if (options.length <= 1) return null;
  return (
    <div className="pulso-codificacion-base-selector">
      <span className="pulso-codificacion-base-label">
        <Layers size={13} />
        Base
      </span>
      <div className="pulso-codificacion-base-list">
        {options.map((src) => {
          const isActive = src === active;
          const label = source.labelFor(src);
          return (
            <button
              key={src}
              type="button"
              disabled={loading}
              onClick={() => setActive(src)}
              className={`pulso-codificacion-base-chip${isActive ? " is-active" : ""}`}
              title={label !== src ? src : undefined}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CodificacionStatusSummary({
  hasXlsform,
  hasData,
  prereqOk,
  applied,
  bases,
  step,
}: {
  hasXlsform: boolean;
  hasData: boolean;
  prereqOk: boolean;
  applied: boolean;
  bases: number;
  step: Step;
}) {
  const readyLabel =
    step === "codificar" ? "Lista para codificar" :
    step === "matrices" ? "Lista para matrices" :
    step === "adaptar" ? "Lista para adaptar" :
    "Lista para preparar";
  return (
    <div className="pulso-codificacion-status" aria-label="Estado de la codificación">
      <CodificacionStatusPill label="Formulario" done={hasXlsform} />
      <CodificacionStatusPill label="Respuestas" done={hasData} />
      <span className={`pulso-codificacion-status-pill${applied ? " is-done" : ""}`}>
        {applied ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
        {applied ? "Codificación aplicada" : prereqOk ? readyLabel : "En espera"}
      </span>
      {bases > 1 && (
        <span className="pulso-codificacion-status-pill">
          <Database size={13} />
          {bases} bases
        </span>
      )}
    </div>
  );
}

function CodificacionStatusPill({ label, done }: { label: string; done: boolean }) {
  return (
    <span className={`pulso-codificacion-status-pill${done ? " is-done" : ""}`}>
      <span aria-hidden="true" className="pulso-codificacion-status-dot" />
      {label}
    </span>
  );
}

function CodificacionModeSidebar({
  active,
  onChange,
  disabled,
}: {
  active: Step;
  onChange: (step: Step) => void;
  disabled: boolean;
}) {
  return (
    <aside className="pulso-codificacion-sidebar pulso-sidebar" aria-label="Pasos de codificación">
      <div className="pulso-codificacion-sidebar-head">
        <span className="pulso-section-eyebrow">Codificación</span>
        <strong>{disabled ? "Pendiente" : "Flujo de trabajo"}</strong>
      </div>
      <GlidingTabList
        activeKey={active}
        orientation="vertical"
        style={{ "--pulso-gliding-indicator-radius": "10px" } as CSSProperties}
        role="tablist"
        aria-label="Pasos de codificación"
        className="pulso-codificacion-nav"
      >
        {CODIFICACION_STEPS.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.key;
          return (
            <button
              key={item.key}
              id={`codificacion-step-${item.key}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls="codificacion-panel"
              disabled={disabled}
              onClick={() => onChange(item.key)}
              className={`pulso-codificacion-nav-item${isActive ? " is-active" : ""}`}
              aria-label={`${item.label}${item.hint ? `. ${item.hint}` : ""}`}
              title={item.hint ? `${item.label}\n${item.hint}` : item.label}
              data-rail-title={item.label}
              data-rail-desc={item.hint ?? ""}
              data-rail-tooltip={item.hint ? `${item.label}\n${item.hint}` : item.label}
              data-gliding-key={item.key}
            >
              <span className="pulso-codificacion-nav-index">{item.n}</span>
              <span aria-hidden="true" className="pulso-codificacion-nav-icon">
                <Icon size={15} />
              </span>
              <span className="pulso-codificacion-nav-copy">
                <strong>{item.label}</strong>
                {item.hint && <span>{item.hint}</span>}
              </span>
              {isActive && !disabled && (
                <span className="pulso-codificacion-nav-current">
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

// Definición de los pasos del flujo de codificación.
const CODIFICACION_STEPS: StepMeta<Step>[] = [
  { key: "organizar", n: 1, label: "Preparar", icon: Layers, hint: "Emparejar y marcar" },
  { key: "codificar", n: 2, label: "Codificar", icon: Tags, hint: "Agrupar respuestas" },
  { key: "matrices", n: 3, label: "Matrices", icon: Network, hint: "Mapear textos abiertos" },
  { key: "adaptar", n: 4, label: "Adaptación", icon: Wand2, hint: "Confirmar y aplicar" },
];
