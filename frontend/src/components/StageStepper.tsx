import { Check } from "lucide-react";

export type StageStepperState = "completed" | "current" | "pending";

export type StageStepperItem<K extends string = string> = {
  key: K;
  label: string;
  description?: string;
  icon?: typeof Check;
  completed?: boolean;
  disabled?: boolean;
  disabledReason?: string;
};

export type StageStepperProps<K extends string = string> = {
  stages: readonly StageStepperItem<K>[];
  currentStage: K;
  onStageChange: (stage: K) => void;
  ariaLabel: string;
  className?: string;
};

export function resolveStageState(
  index: number,
  currentIndex: number,
  completed?: boolean,
): StageStepperState {
  if (index === currentIndex) return "current";
  if (typeof completed === "boolean") return completed ? "completed" : "pending";
  return currentIndex >= 0 && index < currentIndex ? "completed" : "pending";
}

export function commitStageChange<K extends string>(
  currentStage: K,
  nextStage: K,
  onStageChange: (stage: K) => void,
) {
  if (currentStage !== nextStage) onStageChange(nextStage);
}

export function StageStepper<K extends string = string>({
  stages,
  currentStage,
  onStageChange,
  ariaLabel,
  className,
}: StageStepperProps<K>) {
  const currentIndex = stages.findIndex((stage) => stage.key === currentStage);

  return (
    <nav
      aria-label={ariaLabel}
      className={["pulso-stepper", "pulso-stage-stepper", className].filter(Boolean).join(" ")}
    >
      <ol className="pulso-stepper-list">
        {stages.map((stage, index) => {
          const state = resolveStageState(index, currentIndex, stage.completed);
          const isCurrent = state === "current";
          const isCompleted = state === "completed";
          const Icon = stage.icon;
          return (
            <li
              key={stage.key}
              className="pulso-stepper-node"
              data-stage-state={state}
            >
              <button
                type="button"
                aria-current={isCurrent ? "step" : undefined}
                aria-disabled={stage.disabled || undefined}
                disabled={stage.disabled}
                onClick={() => {
                  if (!stage.disabled) {
                    commitStageChange(currentStage, stage.key, onStageChange);
                  }
                }}
                title={
                  stage.disabled
                    ? stage.disabledReason
                    : isCurrent
                      ? "Paso actual"
                      : isCompleted
                        ? "Completado"
                        : "Pendiente"
                }
                className={[
                  "pulso-step-chip",
                  isCurrent ? "is-active" : "",
                  isCompleted ? "is-done" : "",
                  stage.disabled ? "is-disabled" : "",
                ].filter(Boolean).join(" ")}
              >
                <span aria-hidden="true" className="pulso-step-icon">
                  {isCompleted
                    ? <Check size={13} />
                    : Icon
                      ? <Icon size={13} />
                      : index + 1}
                </span>
                <span className="pulso-step-copy">
                  <span className="pulso-step-label">
                    <span className="pulso-step-number">{index + 1}</span>
                    {stage.label}
                  </span>
                  {stage.description && (
                    <span className="pulso-step-hint">
                      {stage.description}
                    </span>
                  )}
                </span>
              </button>
              {index < stages.length - 1 && (
                <span
                  aria-hidden="true"
                  className={`pulso-step-connector ${isCompleted ? "is-done" : ""}`}
                >
                  {isCompleted && <span />}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
