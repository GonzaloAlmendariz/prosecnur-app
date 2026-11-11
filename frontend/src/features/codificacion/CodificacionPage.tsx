import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { PARAMS_DIRECCION } from "../../lib/navegacion/direccion";
import { AlertCircle, ChevronDown, Database, FileSpreadsheet, Tags } from "lucide-react";
import { useSession } from "../../lib/SessionContext";
import { Alert } from "../../components/Alert";
import { PageFrame } from "../../components/PageFrame";
import { ChromeSlotPortal } from "../../app/ModuleChromeSlots";
import { ChromeBaseSelector } from "../../components/ChromeBaseSelector";
import { AdaptiveSplitView } from "../../components/AdaptiveSplitView";
import { ContextTabRail } from "../../components/ContextTabRail";
import { TabHeading } from "../../components/TabHeading";
import {
  PROCESAMIENTO_PESTANAS,
  type CodificacionTabId,
} from "../../lib/navegacion/catalogos/procesamiento";
import { LoadingBlock } from "../../components/States";
import { PreguntasLanding } from "./PreguntasLanding";
import { CodificarWizard } from "./CodificarWizard";
import { AdaptarPane } from "./AdaptarPane";
import { useCodifSource } from "./useCodifSource";
import { CodingConfigActions } from "./CodingConfigActions";
import { ProcessingPrereqGate } from "../procesamiento/ProcessingPrereqGate";
import "./codificacion-v2.css";

type Step = CodificacionTabId;

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
  // El selector común de la banda no se monta con bases independientes.
  const selectorEnBanda = prereqOk && state?.estudio_processing_mode !== "independent_siblings";

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
  const pasoActivo = CODIFICACION_STEPS.find((paso) => paso.key === step) ?? CODIFICACION_STEPS[0];

  function goStep(next: Step) {
    const sp = new URLSearchParams(location.search);
    sp.delete("step");
    // Cambiar de pestaña descarta sus niveles hijos: la pregunta en foco y el
    // panel abierto pertenecen a la pestaña que se deja.
    sp.delete(PARAMS_DIRECCION.foco);
    sp.delete(PARAMS_DIRECCION.panel);
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
          ? "Empareja las preguntas abiertas y decide cuáles se codifican."
          : step === "codificar"
          ? "Agrupa respuestas similares y asigna códigos pregunta por pregunta."
          : step === "matrices"
          ? "Prepara el mapeo Excel de textos abiertos con control por base, variable e ID caso."
          : "Revisa las preguntas y sus códigos antes de aplicarlos a la base."
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
          ya comunica el avance. Queda el selector de base, el mismo de Analítica y
          Gráficos. Cambia la base por la API del estudio y emite
          `pulso:active-base-changed`; `useCodifSource` escucha ese evento, vuelve a
          leer la base activa y con ella cambia `codifActive`, que remonta los hijos.
          Con una sola base el selector no se dibuja. Con bases independientes sigue
          fuera, como antes: ahí la base se cambia desde el control de la banda. */}
      <ChromeSlotPortal zona="contexto">
        {selectorEnBanda && <ChromeBaseSelector />}
      </ChromeSlotPortal>
      <AdaptiveSplitView
        ariaLabel="Mesa de trabajo de codificación"
        railLabel="Pestañas de codificación"
        className={`pulso-codificacion-shell pulso-context-tab-layout${!prereqOk ? " is-empty" : ""}`}
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
          className={`pulso-codificacion-content pulso-content-area${prereqOk ? " con-cabecera" : ""}`}
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
              {/* La cabecera única de pestaña (L14), la misma de Carga, Validación
                  y Analítica: la base activa va en el control porque es un nombre.
                  Cuando la banda ya la nombra en su selector (dos o más bases que
                  no son independientes) aquí no se repite. */}
              <TabHeading
                eyebrow="Codificación"
                titulo={pasoActivo.label}
                icono={pasoActivo.icon}
                detalle={pasoActivo.detail}
                pestanaN={CODIFICACION_STEPS.findIndex((paso) => paso.key === step) + 1}
                pestanaDe={CODIFICACION_STEPS.length}
                control={codifSource.active && !(selectorEnBanda && codifSource.options.length > 1) ? (
                  <span className="pulso-codificacion-base-actual">
                    <Database size={12} aria-hidden="true" />
                    {codifSource.labelFor(codifSource.active)}
                  </span>
                ) : undefined}
              />
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
                      base={codifSource.active}
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
    <ContextTabRail
      ariaLabel="Pestañas de codificación"
      activeKey={active}
      items={CODIFICACION_STEPS}
      panelId="codificacion-panel"
      tabId={(key) => `codificacion-step-${key}`}
      onChange={onChange}
      disabled={disabled}
    />
  );
}

// Definición de los pasos del flujo de codificación.
const CODIFICACION_STEPS = PROCESAMIENTO_PESTANAS.codificacion;
