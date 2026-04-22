import { LayoutGrid } from "lucide-react";

// FilterChip — chip de filtro con icon + label + count pill.
//
// Usado en barras operativas para filtrar/categorizar listas:
//   - PreguntasLanding: Todas / Emparejadas / Por codificar / Codificadas.
//   - TimelinePanel (futuro uso): filtrar tipos de slide.
//   - Otras listas con contadores por estado.
//
// El `tone` define el color semántico del count pill cuando el chip
// NO está activo. Cuando está activo, el chip se rellena con primary
// solid y el count pill queda con fondo transparente blanco.

export type FilterTone = "neutral" | "primary" | "warn" | "success";

type Props = {
  label: string;
  count: number;
  icon: typeof LayoutGrid;
  tone: FilterTone;
  active: boolean;
  onClick: () => void;
};

export function FilterChip({
  label, count, icon: Icon, tone, active, onClick,
}: Props) {
  // Colores del count pill cuando NO está activo. Cuando sí está
  // activo, usa blanco semi-transparente sobre primary.
  const inactiveCountStyle =
    tone === "primary" ? { bg: "var(--pulso-primary-soft)", fg: "var(--pulso-primary)" } :
    tone === "warn" ? { bg: "var(--pulso-warn-bg)", fg: "var(--pulso-warn-fg)" } :
    tone === "success" ? { bg: "var(--pulso-success-bg)", fg: "var(--pulso-success-fg)" } :
    { bg: "var(--pulso-surface-2)", fg: "var(--pulso-text-soft)" };

  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 7,
        padding: "6px 8px 6px 12px",
        borderRadius: 999,
        fontSize: 13, fontWeight: 600,
        border: active ? "1px solid var(--pulso-primary)" : "1px solid transparent",
        background: active ? "var(--pulso-primary)" : "transparent",
        color: active ? "white" : "var(--pulso-text)",
        cursor: "pointer",
        transition: "background 140ms ease, border-color 140ms ease, color 140ms ease",
        boxShadow: active ? "0 2px 8px rgba(0, 36, 87, 0.14)" : "none",
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = "var(--pulso-surface-2)";
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = "transparent";
      }}
    >
      <Icon size={13} />
      <span>{label}</span>
      <span
        aria-hidden="true"
        style={{
          fontSize: 11, fontWeight: 700,
          padding: "1px 8px", borderRadius: 999,
          background: active ? "rgba(255,255,255,0.22)" : inactiveCountStyle.bg,
          color: active ? "white" : inactiveCountStyle.fg,
          fontFamily: "ui-monospace, monospace",
          fontVariantNumeric: "tabular-nums",
          minWidth: 22, textAlign: "center",
        }}
      >
        {count}
      </span>
    </button>
  );
}
