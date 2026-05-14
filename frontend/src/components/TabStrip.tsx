import { Layers } from "lucide-react";

// TabStrip — selector horizontal de tab entre pares.
//
// Distinto del `Stepper`: no implica progreso ni orden lineal. Es un
// switch tipo "¿qué reporte quieres generar ahora?" o "¿qué vista
// quieres ver?". Los tabs son siblings sin relación de dependencia.
//
// Visual:
//   [ícono Label · hint][ícono Label · hint][ícono Label · hint]
//   Tabs comparten borders internos (no hay gap), se leen como una
//   banda unificada. El tab activo se rellena con primary solid, los
//   demás muestran hover primary-soft.
//
// Originalmente construido en AnaliticaPage.ReporteStepper; extraído
// acá para que cualquier fase con múltiples vistas paralelas lo use
// (ej. Validación podría tener tabs "Errores / Warnings / Info").

export type TabMeta<K extends string = string> = {
  key: K;
  label: string;
  icon: typeof Layers;
  desc?: string;
  disabled?: boolean;
  disabledReason?: string;
};

type Props<K extends string = string> = {
  tabs: TabMeta<K>[];
  active: K;
  onChange: (key: K) => void;
  /** ariaLabel del container (ej. "Reportes disponibles"). */
  ariaLabel?: string;
};

export function TabStrip<K extends string = string>({
  tabs, active, onChange, ariaLabel,
}: Props<K>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel ?? "Tabs"}
      className="pulso-tab-strip"
    >
      {tabs.map((t, i) => (
        <TabChip
          key={t.key}
          meta={t}
          active={active === t.key}
          last={i === tabs.length - 1}
          onClick={() => {
            if (!t.disabled) onChange(t.key);
          }}
        />
      ))}
    </div>
  );
}

function TabChip<K extends string = string>({
  meta, active, last, onClick,
}: {
  meta: TabMeta<K>;
  active: boolean;
  last: boolean;
  onClick: () => void;
}) {
  const Icon = meta.icon;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-disabled={meta.disabled || undefined}
      disabled={meta.disabled}
      title={meta.disabled ? meta.disabledReason : undefined}
      onClick={onClick}
      className={[
        "pulso-tab-chip",
        active ? "is-active" : "",
        last ? "is-last" : "",
        meta.disabled ? "is-disabled" : "",
      ].filter(Boolean).join(" ")}
    >
      <span className="pulso-tab-chip-label">
        <Icon size={14} />
        {meta.label}
      </span>
      {meta.desc && (
        <span className="pulso-tab-chip-desc">
          {meta.desc}
        </span>
      )}
    </button>
  );
}
