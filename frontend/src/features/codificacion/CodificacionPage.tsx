import { useState, type CSSProperties } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { PARAMS_DIRECCION } from "../../lib/navegacion/direccion";
import { AlertCircle, CheckCircle2, ChevronDown, Database, FileSpreadsheet, Layers, Network, Tags, Wand2 } from "lucide-react";
import { useSession } from "../../lib/SessionContext";
import { Alert } from "../../components/Alert";
import { PageFrame } from "../../components/PageFrame";
import { ChromeSlotPortal } from "../../app/ModuleChromeSlots";
import { BaseSelectorTrigger, BasesInspectorMenu } from "../../components/BasesInspectorMenu";
import { AdaptiveSplitView } from "../../components/AdaptiveSplitView";
import { StepMeta } from "../../components/Stepper";
import { GlidingTabList } from "../../components/GlidingTabList";
import { LoadingBlock } from "../../components/States";
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

  // Pestaña de la sección Codificación, persistida en la URL
  // (?pestana=codificar | matrices | adaptar). `?step=` es el alias legacy:
  // se lee, no se escribe. Contrato: `lib/navegacion/direccion.ts`.
  const codifParams = new URLSearchParams(location.search);
  const rawStep = codifParams.get(PARAMS_DIRECCION.pestana) ?? codifParams.get("step");
  const step: Step =
    rawStep === "codificar" ? "codificar" :
    rawStep === "matrices" ? "matrices" :
    rawStep === "adaptar" ? "adaptar" :
    "organizar";

  function goStep(next: Step) {
    const sp = new URLSearchParams(location.search);
    sp.delete("step");
    if (next === "organizar") sp.delete(PARAMS_DIRECCION.pestana);
    else sp.set(PARAMS_DIRECCION.pestana, next);
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
      notices={
        !prereqOk ? (
          <Alert kind="warn">Necesitas cargar el formulario y las respuestas en <strong>1. Carga</strong> antes de codificar.</Alert>
        ) : null
      }
    >
      {/* El contexto sube a la banda del shell; antes esta página dibujaba una
          segunda banda debajo del rail de secciones. */}
      {/* Sin chips de estado en la banda, igual que en Carga y Validación: el rail
          ya comunica el avance. Queda el selector de base. */}
      <ChromeSlotPortal zona="contexto">
        {prereqOk && codifSource.options.length > 1 && state?.estudio_processing_mode !== "independent_siblings" && (
          <BaseSelector source={codifSource} />
        )}
      </ChromeSlotPortal>
      <AdaptiveSplitView
        ariaLabel="Mesa de trabajo de codificación"
        railLabel="Pestañas de codificación"
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
          data-audit-ready={
            !prereqOk && !codifSource.loading && !codifSource.error
              ? `codificacion-${step}`
              : undefined
          }
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
              {codifSource.loading && (
                <LoadingBlock label="Cargando base de codificación…" />
              )}
              {!codifSource.loading && (
                <div
                  key={`${step}:${codifActive}`}
                  className="pulso-codificacion-panel-body"
                >
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
              )}
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

  // Antes esto era una lista de chips con el nombre completo de cada base dentro
  // de la banda: con un nombre largo —«Post-Distribution Monitoring - Espacios de
  // Protección 2026 Q2»— se comía el lado izquierdo entero. Ahora es el mismo
  // desglose compartido que usan Carga y Validación, con el ancho acotado.
  //
  // Codificación no carga el payload del estudio, así que sus resúmenes van sin
  // instrumento ni archivo: el desglose lista los nombres y ya. Es la degradación
  // honesta, y evita que este módulo vuelva a escribirse su propio selector.
  const bases = options.map((src) => ({ nombre: src, etiqueta: source.labelFor(src) }));
  const etiquetaActiva = active ? source.labelFor(active) : "Elegir base";

  return (
    <BasesInspectorMenu
      bases={bases}
      activa={active}
      onSeleccionar={(nombre) => void setActive(nombre)}
      deshabilitado={loading}
      disparador={<BaseSelectorTrigger etiqueta={etiquetaActiva} total={options.length} />}
    />
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
    <aside className="pulso-codificacion-sidebar pulso-sidebar" aria-label="Pestañas de codificación">
      <div className="pulso-codificacion-sidebar-head">
        <span className="pulso-section-eyebrow">Codificación</span>
        <strong>Vistas</strong>
        {disabled ? <small className="pulso-sidebar-head-status">Pendiente</small> : null}
      </div>
      <GlidingTabList
        activeKey={active}
        orientation="vertical"
        style={{ "--pulso-gliding-indicator-radius": "10px" } as CSSProperties}
        role="tablist"
        aria-label="Pestañas de codificación"
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
              data-nav-item=""
              data-nav-shape="row"
              data-nav-state={isActive ? "selected" : undefined}
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
