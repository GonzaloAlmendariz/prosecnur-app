// =============================================================================
// StatCard.tsx — KPI con interpretación narrativa obligatoria
// =============================================================================
// Reemplaza los KpiCard sueltos que solo muestran un número. Cada StatCard
// exige un texto interpretativo: lo que el número *significa* para el
// analista. Evita la "metadata huérfana" que detectó la auditoría de UX.
//
//   ┌───────────────────────────────────┐
//   │ TOTAL DE CASOS                    │  ← eyebrow
//   │ 1,665                             │  ← value (grande)
//   │ 98% de encuestas completas        │  ← interpretation (pequeño)
//   │ ────                              │
//   │ 24 requieren atención  [Ver →]   │  ← optional CTA
//   └───────────────────────────────────┘
// =============================================================================

import type { CSSProperties, ReactNode } from "react";
import { ArrowRight, TrendingUp, TrendingDown, Minus } from "lucide-react";

export type StatTone = "neutral" | "primary" | "success" | "warn" | "danger";

export type StatCardProps = {
  /** Eyebrow pequeño en caps sobre el valor */
  eyebrow: string;
  /** Valor principal grande — número formateado o texto corto */
  value: string | number;
  /** Interpretación obligatoria — qué significa ese valor */
  interpretation?: string;
  /** Comparación con período/total anterior (opcional) */
  delta?: {
    value: number;
    direction?: "up" | "down" | "flat";
    label?: string;
  };
  /** Tono de color */
  tone?: StatTone;
  /** CTA opcional al pie */
  cta?: {
    label: string;
    onClick: () => void;
  };
  /** Icono opcional arriba a la derecha */
  icon?: ReactNode;
  /** Loading state */
  loading?: boolean;
  /** Estilos adicionales */
  style?: CSSProperties;
};

export default function StatCard({
  eyebrow,
  value,
  interpretation,
  delta,
  tone = "neutral",
  cta,
  icon,
  loading = false,
  style,
}: StatCardProps) {
  const colors = toneColors(tone);

  if (loading) {
    return (
      <article
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          padding: "14px 16px",
          borderRadius: "var(--pulso-radius-card)",
          border: "1px solid var(--pulso-border)",
          background: "var(--pulso-surface)",
          minHeight: 110,
          ...style,
        }}
      >
        <Shimmer width="40%" height={10} />
        <Shimmer width="55%" height={28} />
        <Shimmer width="80%" height={12} />
      </article>
    );
  }

  return (
    <article
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: "14px 16px",
        borderRadius: "var(--pulso-radius-card)",
        border: `1px solid ${colors.border}`,
        background: colors.bg,
        boxShadow: "var(--pulso-shadow-low)",
        position: "relative",
        minHeight: 110,
        ...style,
      }}
    >
      {icon && (
        <span
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            color: colors.fg,
            opacity: 0.65,
          }}
          aria-hidden="true"
        >
          {icon}
        </span>
      )}

      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: 0.6,
          textTransform: "uppercase",
          color: colors.fg,
          opacity: 0.8,
        }}
      >
        {eyebrow}
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <div
          style={{
            fontSize: 28,
            fontWeight: 800,
            lineHeight: 1.1,
            color: "var(--pulso-text)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {typeof value === "number" ? fmtNum(value) : value}
        </div>
        {delta && <DeltaPill delta={delta} />}
      </div>

      {interpretation && (
        <div
          style={{
            fontSize: 11,
            lineHeight: 1.55,
            color: "var(--pulso-text-soft)",
          }}
        >
          {interpretation}
        </div>
      )}

      {cta && (
        <button
          type="button"
          onClick={cta.onClick}
          style={{
            marginTop: 6,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "4px 8px",
            borderRadius: 6,
            background: "transparent",
            border: `1px solid ${colors.border}`,
            color: colors.fg,
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
            alignSelf: "flex-start",
          }}
        >
          {cta.label}
          <ArrowRight size={11} />
        </button>
      )}
    </article>
  );
}

// -----------------------------------------------------------------------------
// Sub-components
// -----------------------------------------------------------------------------

function DeltaPill({ delta }: { delta: NonNullable<StatCardProps["delta"]> }) {
  const direction = delta.direction ?? (delta.value > 0 ? "up" : delta.value < 0 ? "down" : "flat");
  const Icon = direction === "up" ? TrendingUp : direction === "down" ? TrendingDown : Minus;
  const color =
    direction === "up"
      ? "var(--pulso-success-fg)"
      : direction === "down"
      ? "var(--pulso-danger-fg)"
      : "var(--pulso-text-soft)";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        fontSize: 11,
        fontWeight: 700,
        color,
      }}
      title={delta.label}
    >
      <Icon size={12} />
      {delta.value > 0 ? "+" : ""}
      {fmtNum(delta.value, 1)}
      {delta.label ? ` ${delta.label}` : ""}
    </span>
  );
}

function Shimmer({ width, height }: { width: string | number; height: number }) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 4,
        background:
          "linear-gradient(90deg, var(--pulso-surface-2) 0%, var(--pulso-border) 50%, var(--pulso-surface-2) 100%)",
        backgroundSize: "200% 100%",
        animation: "pulso-shimmer 1.2s linear infinite",
      }}
    />
  );
}

function toneColors(tone: StatTone) {
  switch (tone) {
    case "primary":
      return {
        bg: "var(--pulso-primary-soft)",
        border: "var(--pulso-primary-border)",
        fg: "var(--pulso-primary)",
      };
    case "success":
      return {
        bg: "var(--pulso-success-bg)",
        border: "var(--pulso-success-border)",
        fg: "var(--pulso-success-fg)",
      };
    case "warn":
      return {
        bg: "var(--pulso-warn-bg)",
        border: "var(--pulso-warn-border)",
        fg: "var(--pulso-warn-fg)",
      };
    case "danger":
      return {
        bg: "var(--pulso-danger-bg)",
        border: "var(--pulso-danger-border)",
        fg: "var(--pulso-danger-fg)",
      };
    case "neutral":
    default:
      return {
        bg: "var(--pulso-surface)",
        border: "var(--pulso-border)",
        fg: "var(--pulso-text)",
      };
  }
}

function fmtNum(n: number, digits = 0): string {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("es-PE", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);
}
