import { Check } from "lucide-react";
import { WizardStep } from "./store";

// Stepper horizontal de 5 pasos. El paso activo pulsa con
// `pulso-stepper-pulse` (definido en theme.css). Pasos completados
// muestran ✓; pasos futuros se ven atenuados.
//
// El stepper es CLICKEABLE: el usuario puede saltar a cualquier paso
// previo (no a uno futuro hasta haberlo visitado). Esto permite revisar
// y editar sin hacer back-back-back.

const STEPS: { n: WizardStep; label: string; hint: string }[] = [
  { n: 1, label: "Plantilla",  hint: "Punto de partida" },
  { n: 2, label: "Listas",     hint: "Escalas evaluativas" },
  { n: 3, label: "Bloques",    hint: "Agrupar preguntas" },
  { n: 4, label: "Índices",    hint: "Combinar bloques" },
  { n: 5, label: "Confirmar",  hint: "Revisar y generar" },
];

export function ProgressStepper({
  current,
  furthestVisited,
  onJump,
}: {
  current: WizardStep;
  furthestVisited: WizardStep;
  onJump: (s: WizardStep) => void;
}) {
  return (
    <nav
      aria-label="Pasos del asistente de Dimensiones"
      className="pulso-stepper analitica-dimensiones-stepper"
    >
      {STEPS.map((s, i) => {
        const isActive = current === s.n;
        const isDone = current > s.n;
        const isReachable = s.n <= furthestVisited;
        const isLast = i === STEPS.length - 1;
        return (
          <div key={s.n} className="pulso-stepper-node analitica-dimensiones-stepper-node">
            <button
              type="button"
              onClick={() => isReachable && onJump(s.n)}
              disabled={!isReachable}
              aria-current={isActive ? "step" : undefined}
              className={[
                "pulso-step-chip",
                "analitica-dimensiones-step-chip",
                isActive ? "is-active" : "",
                isDone ? "is-done" : "",
                !isReachable ? "is-disabled" : "",
              ].filter(Boolean).join(" ")}
            >
              <span
                className={`pulso-step-icon ${isActive ? "pulso-stepper-pulse" : ""}`}
                aria-hidden="true"
              >
                {isDone ? <Check size={16} /> : s.n}
              </span>
              <div className="pulso-step-copy">
                <span className="pulso-step-label">
                  {s.label}
                </span>
                <span className="pulso-step-hint">
                  {s.hint}
                </span>
              </div>
            </button>
            {!isLast && (
              <span
                aria-hidden="true"
                className={`pulso-step-connector ${isDone ? "is-done" : ""}`}
              />
            )}
          </div>
        );
      })}
    </nav>
  );
}
