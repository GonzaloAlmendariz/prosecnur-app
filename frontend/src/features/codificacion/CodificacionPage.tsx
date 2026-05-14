import { useLocation, useNavigate } from "react-router-dom";
import { Layers, Tags, Wand2 } from "lucide-react";
import { useSession } from "../../lib/SessionContext";
import { Alert } from "../../components/Alert";
import { PageFrame } from "../../components/PageFrame";
import { Stepper, StepMeta } from "../../components/Stepper";
import { PreguntasLanding } from "./PreguntasLanding";
import { CodificarWizard } from "./CodificarWizard";
import { AdaptarPane } from "./AdaptarPane";
import { useCodifSource } from "./useCodifSource";

type Step = "organizar" | "codificar" | "adaptar";

export default function CodificacionPage() {
  const { state } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  // Necesitamos el `active` para forzar remount de los hijos al cambiar
  // de base (ver comentario abajo en los key={codifActive}).
  const codifSource = useCodifSource();
  const codifActive = codifSource.active ?? "default";

  const prereqOk = !!state?.xlsform && !!state?.data;

  // Step persistido en query string (?step=codificar | adaptar).
  const rawStep = new URLSearchParams(location.search).get("step");
  const step: Step =
    rawStep === "codificar" ? "codificar" :
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
      resetScrollKey={step}
      lead={
        step === "organizar"
          ? "Organiza las preguntas abiertas y marca las que quieres codificar."
          : step === "codificar"
          ? "Agrupa respuestas similares y asigna códigos pregunta por pregunta."
          : "Revisa la adaptación y descarga los archivos finales."
      }
      toolbar={
        <>
          {prereqOk && codifSource.options.length > 1 && (
            <BaseSelector source={codifSource} />
          )}

          {prereqOk && (
            <Stepper<Step>
              steps={CODIFICACION_STEPS}
              current={step}
              onChange={goStep}
              ariaLabel="Fases de la codificación"
            />
          )}

          {!prereqOk && (
            <Alert kind="warn">Necesitas cargar el XLSForm y la base de datos en <strong>1. Carga</strong> antes de codificar.</Alert>
          )}
        </>
      }
    >
      {/* `key={codifActive}` fuerza el remount de los hijos cuando
          el analista cambia la base activa. Cada hijo tiene sus propios
          useEffect([]) que refetchean familias/preguntas/columnas del
          backend; al remontarse cargan el estado scoped de la base
          nueva sin tener que refactorear 8 archivos con listeners. */}
      {prereqOk && step === "organizar" && (
        <PreguntasLanding key={codifActive} />
      )}

      {prereqOk && step === "codificar" && (
        <CodificarWizard key={codifActive} onBackToOrganizar={() => goStep("organizar")} />
      )}

      {prereqOk && step === "adaptar" && (
        <AdaptarPane key={codifActive} onBackToCodificar={() => goStep("codificar")} />
      )}
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
    <div
      style={{
        marginBottom: 16,
        padding: "10px 14px",
        borderRadius: "var(--pulso-radius)",
        background: "var(--pulso-primary-soft)",
        border: "1px solid var(--pulso-primary-border)",
        display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
      }}
    >
      <Layers size={16} color="var(--pulso-primary)" />
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--pulso-primary)" }}>
          Codificando la base:
        </div>
        <div style={{ fontSize: 11, color: "var(--pulso-text-soft)", marginTop: 2, lineHeight: 1.4 }}>
          Cada base tiene su propio progreso de codificación (familias, grupos, plantilla).
          Al cambiar verás el estado guardado de la otra base.
        </div>
      </div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {options.map((src) => {
          const isActive = src === active;
          return (
            <button
              key={src}
              type="button"
              disabled={loading}
              onClick={() => setActive(src)}
              style={{
                fontSize: 12, fontWeight: 600,
                padding: "6px 12px", borderRadius: 999,
                border: `1px solid ${isActive ? "var(--pulso-primary)" : "var(--pulso-primary-border)"}`,
                background: isActive ? "var(--pulso-primary)" : "white",
                color: isActive ? "white" : "var(--pulso-primary)",
                cursor: loading ? "wait" : "pointer",
              }}
            >
              {src}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Definición de los 3 pasos del flujo de codificación. El componente
// visual vive en `components/Stepper.tsx` — unificado con otras fases
// que tengan flujos lineales.
const CODIFICACION_STEPS: StepMeta<Step>[] = [
  { key: "organizar", n: 1, label: "Organizar", icon: Layers, hint: "Emparejar y marcar" },
  { key: "codificar", n: 2, label: "Codificar", icon: Tags,   hint: "Agrupar respuestas" },
  { key: "adaptar",   n: 3, label: "Adaptar",   icon: Wand2,  hint: "Generar el dataset" },
];
