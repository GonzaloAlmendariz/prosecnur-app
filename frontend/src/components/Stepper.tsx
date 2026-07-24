import { Check } from "lucide-react";
import { StageStepper } from "./StageStepper";

// Stepper — navegación SECUENCIAL entre pasos de un flujo.
//
// Distinto semánticamente de `TabStrip` (que selecciona un tab entre
// pares, sin progreso). El Stepper comunica "estás en el paso N de M,
// los anteriores están done, los siguientes pending".
//
// Visual:
//   [1 Organizar · Emparejar y marcar] — [2 Codificar · Agrupar…] — [3 Adaptar · …]
//
//   Cada chip tiene ícono + número + label + hint, con 3 estados:
//     - done    → primary-soft background, ícono Check.
//     - active  → solid primary background, box-shadow.
//     - pending → transparent, ícono en neutral.
//   Los connectors entre chips cambian de color cuando el step anterior
//   está done; un dot central aparece para marcar el progreso.
//
// Originalmente hecho en CodificacionPage; extraído acá para que
// cualquier fase con flujo lineal lo use (ej. una futura Fase de carga
// multi-step, un wizard de setup, etc.).

export type StepMeta<K extends string = string> = {
  key: K;
  n: number;
  label: string;
  icon: typeof Check;
  hint?: string;
  done?: boolean;
  disabled?: boolean;
  disabledReason?: string;
};

type Props<K extends string = string> = {
  steps: readonly StepMeta<K>[];
  current: K;
  onChange: (key: K) => void;
  /** ariaLabel para el container (ej. "Fases del procesamiento"). */
  ariaLabel?: string;
};

export function Stepper<K extends string = string>({
  steps, current, onChange, ariaLabel,
}: Props<K>) {
  return (
    <StageStepper
      stages={steps.map((step) => ({
        key: step.key,
        label: step.label,
        description: step.hint,
        icon: step.icon,
        completed: step.done,
        disabled: step.disabled,
        disabledReason: step.disabledReason,
      }))}
      currentStage={current}
      onStageChange={onChange}
      ariaLabel={ariaLabel ?? "Stepper"}
    />
  );
}
