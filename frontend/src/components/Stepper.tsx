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
      style={{
        display: "inline-flex", alignItems: "stretch", gap: 0,
        padding: 8,
        borderRadius: 14,
        background: "var(--pulso-surface)",
        border: "1px solid var(--pulso-border)",
        boxShadow: "var(--pulso-shadow-low)",
      }}
    >
      {steps.map((s, i) => {
        const isActive = s.key === current;
        const isDone = currentIdx > i;
        return (
          <div key={s.key} style={{ display: "flex", alignItems: "center" }}>
            <StepChip
              meta={s}
              active={isActive}
              done={isDone}
              onClick={() => onChange(s.key)}
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
      onClick={onClick}
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
            {meta.n}
          </span>
          {meta.label}
        </span>
        {meta.hint && (
          <span
            style={{
              fontSize: 10,
              color: active ? "rgba(255,255,255,0.8)" : "var(--pulso-text-soft)",
              fontWeight: 500,
            }}
          >
            {meta.hint}
          </span>
        )}
      </span>
    </button>
  );
}
