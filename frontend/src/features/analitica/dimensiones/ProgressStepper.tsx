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
      style={{
        display: "flex",
        alignItems: "stretch",
        gap: 0,
        padding: "16px 18px",
        borderRadius: 12,
        border: "1px solid var(--pulso-border)",
        background: "var(--pulso-surface)",
        boxShadow: "var(--pulso-shadow-low)",
      }}
    >
      {STEPS.map((s, i) => {
        const isActive = current === s.n;
        const isDone = current > s.n;
        const isReachable = s.n <= furthestVisited;
        const isLast = i === STEPS.length - 1;
        return (
          <div key={s.n} style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0 }}>
            <button
              type="button"
              onClick={() => isReachable && onJump(s.n)}
              disabled={!isReachable}
              aria-current={isActive ? "step" : undefined}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "6px 8px",
                background: "transparent",
                border: "none",
                cursor: isReachable ? "pointer" : "default",
                opacity: isReachable ? 1 : 0.55,
                flex: 1,
                minWidth: 0,
                textAlign: "left",
                transition: "opacity var(--anim-dur-short) var(--anim-ease-smooth)",
              }}
            >
              <span
                className={isActive ? "pulso-stepper-pulse" : undefined}
                aria-hidden="true"
                style={{
                  width: 32,
                  height: 32,
                  minWidth: 32,
                  borderRadius: 999,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 13,
                  fontWeight: 700,
                  background: isActive
                    ? "var(--pulso-primary)"
                    : isDone
                      ? "var(--pulso-success-fg, #15803d)"
                      : "var(--pulso-surface-2, #f4f5f9)",
                  color: isActive || isDone ? "white" : "var(--pulso-text-soft)",
                  border: `1px solid ${isActive ? "var(--pulso-primary)" : isDone ? "var(--pulso-success-fg, #15803d)" : "var(--pulso-border)"}`,
                  transition: "background var(--anim-dur-short) var(--anim-ease-smooth), border-color var(--anim-dur-short) var(--anim-ease-smooth)",
                }}
              >
                {isDone ? <Check size={16} /> : s.n}
              </span>
              <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: isActive ? 700 : 600,
                    color: isActive ? "var(--pulso-primary)" : "var(--pulso-text)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {s.label}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    color: "var(--pulso-text-soft)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {s.hint}
                </span>
              </div>
            </button>
            {!isLast && (
              <span
                aria-hidden="true"
                style={{
                  height: 2,
                  flex: "0 0 24px",
                  margin: "0 4px",
                  background: isDone
                    ? "var(--pulso-success-fg, #15803d)"
                    : "var(--pulso-border)",
                  borderRadius: 2,
                  transition: "background var(--anim-dur-med) var(--anim-ease-smooth)",
                }}
              />
            )}
          </div>
        );
      })}
    </nav>
  );
}
