import { useState } from "react";
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
      style={{
        display: "flex", alignItems: "stretch", gap: 0,
        flexWrap: "wrap",
        border: "1px solid var(--pulso-border)",
        borderRadius: 10,
        overflow: "hidden",
        background: "white",
        boxShadow: "var(--pulso-shadow-low)",
      }}
    >
      {tabs.map((t, i) => (
        <TabChip
          key={t.key}
          meta={t}
          active={active === t.key}
          last={i === tabs.length - 1}
          onClick={() => onChange(t.key)}
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
  const [hover, setHover] = useState(false);
  const Icon = meta.icon;
  const bg = active
    ? "var(--pulso-primary)"
    : hover
      ? "var(--pulso-primary-soft)"
      : "white";
  const color = active ? "white" : "var(--pulso-text)";
  const descColor = active
    ? "rgba(255,255,255,0.85)"
    : "var(--pulso-text-soft)";
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        flex: "1 1 0",
        minWidth: 140,
        display: "flex", flexDirection: "column", alignItems: "flex-start",
        gap: 3, padding: "12px 16px",
        background: bg,
        color,
        border: "none",
        borderRight: last ? "none" : "1px solid var(--pulso-border)",
        cursor: "pointer",
        textAlign: "left",
        transition: "background 140ms ease, color 140ms ease",
      }}
    >
      <span
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontSize: 13, fontWeight: 700, letterSpacing: -0.1,
        }}
      >
        <Icon size={14} />
        {meta.label}
      </span>
      {meta.desc && (
        <span style={{ fontSize: 10, color: descColor, letterSpacing: 0.2, lineHeight: 1.3 }}>
          {meta.desc}
        </span>
      )}
    </button>
  );
}
