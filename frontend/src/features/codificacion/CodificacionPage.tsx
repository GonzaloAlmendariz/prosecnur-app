import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Check, Layers, Tags, Wand2 } from "lucide-react";
import { useSession } from "../../lib/SessionContext";
import { Alert } from "../../components/Alert";
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

  useEffect(() => { window.scrollTo({ top: 0 }); }, [step]);

  return (
    <section>
      <h1 className="pulso-page-title">Fase 3 — Codificación de preguntas abiertas</h1>
      <p className="pulso-page-lead">
        {step === "organizar"
          ? "Organiza todas las preguntas: empareja SO/SM con sus 'Otros, especifique' y marca las que quieres codificar."
          : step === "codificar"
          ? "Codifica una por una las preguntas marcadas. Agrupa respuestas similares y asigna un código a cada grupo."
          : "Revisa lo que se va a adaptar. Cuando estés listo, lanza la adaptación y descarga los archivos."}
      </p>

      {prereqOk && codifSource.options.length > 1 && (
        <BaseSelector source={codifSource} />
      )}

      {prereqOk && (
        <div style={{ marginBottom: 20 }}>
          <Stepper step={step} onChange={goStep} />
        </div>
      )}

      {!prereqOk && (
        <div style={{ marginBottom: 12 }}>
          <Alert kind="warn">Necesitas cargar el XLSForm y la base de datos en <strong>1. Carga</strong> antes de codificar.</Alert>
        </div>
      )}

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
    </section>
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

// Stepper rediseñado: chips con icono + label + hint de status, y
// connectors con "track" gradiente que refleja el progreso. Envuelto
// en un container surface para que se lea como una barra de navegación
// macro (distinto de los filter chips de nivel operativo).
type StepMeta = {
  key: Step;
  n: number;
  label: string;
  icon: typeof Layers;
  hint: string;
};

const STEP_META: StepMeta[] = [
  { key: "organizar", n: 1, label: "Organizar", icon: Layers, hint: "Emparejar y marcar" },
  { key: "codificar", n: 2, label: "Codificar", icon: Tags,   hint: "Agrupar respuestas" },
  { key: "adaptar",   n: 3, label: "Adaptar",   icon: Wand2,  hint: "Generar el dataset" },
];

function Stepper({ step, onChange }: { step: Step; onChange: (s: Step) => void }) {
  const order: Step[] = STEP_META.map((s) => s.key);
  const currentIdx = order.indexOf(step);
  return (
    <div
      style={{
        display: "inline-flex", alignItems: "stretch", gap: 0,
        padding: 8,
        borderRadius: 14,
        background: "var(--pulso-surface)",
        border: "1px solid var(--pulso-border)",
        boxShadow: "var(--pulso-shadow-low)",
      }}
    >
      {STEP_META.map((s, i) => {
        const isActive = step === s.key;
        const isDone = currentIdx > i;
        return (
          <div key={s.key} style={{ display: "flex", alignItems: "center" }}>
            <StepChip
              n={s.n}
              label={s.label}
              hint={s.hint}
              icon={s.icon}
              active={isActive}
              done={isDone}
              onClick={() => onChange(s.key)}
            />
            {i < STEP_META.length - 1 && <StepConnector done={isDone} />}
          </div>
        );
      })}
    </div>
  );
}

function StepConnector({ done }: { done: boolean }) {
  return (
    <div
      aria-hidden="true"
      style={{
        flex: "0 0 36px", height: 2,
        margin: "0 4px",
        borderRadius: 1,
        background: done ? "var(--pulso-primary)" : "var(--pulso-border)",
        position: "relative",
        transition: "background 200ms ease",
      }}
    >
      {done && (
        <span
          style={{
            position: "absolute", top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            width: 6, height: 6, borderRadius: "50%",
            background: "var(--pulso-primary)",
            boxShadow: "0 0 0 3px var(--pulso-surface)",
          }}
        />
      )}
    </div>
  );
}

function StepChip({
  n, label, hint, icon: Icon, active, done, onClick,
}: {
  n: number;
  label: string;
  hint: string;
  icon: typeof Layers;
  active: boolean;
  done: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "step" : undefined}
      title={done ? "Completado" : active ? "Paso actual" : "Pendiente"}
      style={{
        display: "inline-flex", alignItems: "center", gap: 10,
        padding: "8px 14px",
        borderRadius: 10,
        border: active
          ? "1px solid var(--pulso-primary)"
          : done
            ? "1px solid var(--pulso-primary-border)"
            : "1px solid transparent",
        background: active
          ? "var(--pulso-primary)"
          : done
            ? "var(--pulso-primary-soft)"
            : "transparent",
        color: active ? "white" : done ? "var(--pulso-primary)" : "var(--pulso-text)",
        cursor: "pointer",
        transition: "background 180ms ease, border-color 180ms ease, color 180ms ease, box-shadow 180ms ease",
        boxShadow: active ? "0 4px 12px rgba(0, 36, 87, 0.18)" : "none",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 26, height: 26, borderRadius: 8,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          background: active
            ? "rgba(255,255,255,0.18)"
            : done
              ? "var(--pulso-primary)"
              : "var(--pulso-surface-2)",
          color: active ? "white" : done ? "white" : "var(--pulso-text-soft)",
          border: active ? "1px solid rgba(255,255,255,0.25)" : "none",
          flexShrink: 0,
          fontSize: 12, fontWeight: 700,
        }}
      >
        {done && !active ? <Check size={13} /> : <Icon size={13} />}
      </span>
      <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.15 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 700 }}>
          <span
            style={{
              fontSize: 10, fontWeight: 700,
              opacity: 0.7,
              fontFamily: "ui-monospace, monospace",
            }}
          >
            {n}
          </span>
          {label}
        </span>
        <span
          style={{
            fontSize: 10,
            color: active ? "rgba(255,255,255,0.8)" : "var(--pulso-text-soft)",
            fontWeight: 500,
          }}
        >
          {hint}
        </span>
      </span>
    </button>
  );
}
