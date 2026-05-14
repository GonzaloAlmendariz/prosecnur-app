import { Check } from "lucide-react";

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
  steps: StepMeta<K>[];
  current: K;
  onChange: (key: K) => void;
  /** ariaLabel para el container (ej. "Fases del procesamiento"). */
  ariaLabel?: string;
};

export function Stepper<K extends string = string>({
  steps, current, onChange, ariaLabel,
}: Props<K>) {
  const currentIdx = steps.findIndex((s) => s.key === current);
  return (
    <div
      role="tablist"
      aria-label={ariaLabel ?? "Stepper"}
      className="pulso-stepper"
    >
      {steps.map((s, i) => {
        const isActive = s.key === current;
        const isDone = typeof s.done === "boolean" ? s.done : currentIdx > i;
        return (
          <div key={s.key} className="pulso-stepper-node">
            <StepChip
              meta={s}
              active={isActive}
              done={isDone}
              onClick={() => {
                if (!s.disabled) onChange(s.key);
              }}
            />
            {i < steps.length - 1 && <StepConnector done={isDone} />}
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
      className={`pulso-step-connector ${done ? "is-done" : ""}`}
    >
      {done && <span />}
    </div>
  );
}

function StepChip({
  meta, active, done, onClick,
}: {
  meta: StepMeta;
  active: boolean;
  done: boolean;
  onClick: () => void;
}) {
  const Icon = meta.icon;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-current={active ? "step" : undefined}
      aria-disabled={meta.disabled || undefined}
      disabled={meta.disabled}
      onClick={onClick}
      title={meta.disabled ? meta.disabledReason : active ? "Paso actual" : done ? "Completado" : "Pendiente"}
      className={[
        "pulso-step-chip",
        active ? "is-active" : "",
        done ? "is-done" : "",
        meta.disabled ? "is-disabled" : "",
      ].filter(Boolean).join(" ")}
    >
      <span aria-hidden="true" className="pulso-step-icon">
        {done && !active ? <Check size={13} /> : <Icon size={13} />}
      </span>
      <span className="pulso-step-copy">
        <span className="pulso-step-label">
          <span className="pulso-step-number">{meta.n}</span>
          {meta.label}
        </span>
        {meta.hint && (
          <span className="pulso-step-hint">
            {meta.hint}
          </span>
        )}
      </span>
    </button>
  );
}
