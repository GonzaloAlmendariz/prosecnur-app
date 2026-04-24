// =============================================================================
// DecisionStorageBar.tsx — barra segmentada tipo "almacenamiento iPhone"
// =============================================================================
// Muestra la distribución de decisiones del decision-maker como una sola
// barra horizontal segmentada por tipo de acción. En un vistazo el analista
// ve cuánto decidió, cuánto queda pendiente, y qué mezcla de acciones usó.
//
//   ┌─────────────────────────────────────────────────────────────────┐
//   │ ████████████████████████████████████▒░░░░░░░░░░░░░░░░░░░░░░░░░░│
//   └─────────────────────────────────────────────────────────────────┘
//    ■ Ignorar 6,847 · ■ Excluir 342 · ■ Reemplazar 124 · … ▒ Pendiente 123
//
// Interacciones:
//   - Hover sobre segmento: tooltip con N y %
//   - Click sobre segmento: filtra la cola a esa categoría (callback)
//   - Transición suave al cambiar proporciones (guardar una decisión)
// =============================================================================

import type { CSSProperties } from "react";
import { useMemo, useRef, useState } from "react";

export type DecisionKind =
  | "ignore"
  | "exclude"
  | "replace"
  | "normalize"
  | "impute"
  | "pending";

export type DecisionCounts = {
  ignore: number;
  exclude: number;
  replace: number;
  normalize: number;
  impute: number;
  pending: number;
};

export type DecisionStorageBarProps = {
  counts: DecisionCounts;
  /** Callback al hacer click sobre un segmento (ej: filtrar cola) */
  onSelectKind?: (kind: DecisionKind) => void;
  /** Kind resaltado (para indicar filtro actualmente activo) */
  activeKind?: DecisionKind | null;
  /** Mostrar leyenda debajo */
  showLegend?: boolean;
  /** Mostrar totales debajo de la leyenda */
  showTotals?: boolean;
  /** Altura de la barra en px (default 16) */
  height?: number;
  /** Estilos extra */
  style?: CSSProperties;
};

const KIND_META: Record<
  DecisionKind,
  { label: string; color: string; isPattern?: boolean }
> = {
  ignore: { label: "Ignorar", color: "var(--pulso-dec-ignore)" },
  exclude: { label: "Excluir", color: "var(--pulso-dec-exclude)" },
  replace: { label: "Reemplazar", color: "var(--pulso-dec-replace)" },
  normalize: { label: "Normalizar", color: "var(--pulso-dec-normalize)" },
  impute: { label: "Imputar", color: "var(--pulso-dec-impute)" },
  pending: { label: "Pendiente", color: "var(--pulso-dec-pending)", isPattern: true },
};

const DECIDED_KINDS: DecisionKind[] = [
  "ignore",
  "exclude",
  "replace",
  "normalize",
  "impute",
];
const ALL_KINDS: DecisionKind[] = [...DECIDED_KINDS, "pending"];

export default function DecisionStorageBar({
  counts,
  onSelectKind,
  activeKind = null,
  showLegend = true,
  showTotals = true,
  height = 16,
  style,
}: DecisionStorageBarProps) {
  const totals = useMemo(() => {
    const total =
      counts.ignore + counts.exclude + counts.replace + counts.normalize + counts.impute + counts.pending;
    const decided = total - counts.pending;
    return { total, decided, pct_done: total > 0 ? (decided / total) * 100 : 0 };
  }, [counts]);

  // Calcular segmentos no-vacíos para no dibujar slices de 0 px.
  const segments = useMemo(() => {
    const total = totals.total;
    if (total <= 0) return [];
    return ALL_KINDS.map((kind) => {
      const n = counts[kind] ?? 0;
      if (n <= 0) return null;
      const pct = (n / total) * 100;
      return { kind, n, pct };
    }).filter((s): s is { kind: DecisionKind; n: number; pct: number } => s !== null);
  }, [counts, totals.total]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, ...style }}>
      <BarTrack
        segments={segments}
        height={height}
        activeKind={activeKind}
        onSelectKind={onSelectKind}
        empty={totals.total === 0}
      />

      {showLegend && segments.length > 0 && (
        <Legend
          counts={counts}
          total={totals.total}
          activeKind={activeKind}
          onSelectKind={onSelectKind}
        />
      )}

      {showTotals && totals.total > 0 && (
        <div
          style={{
            fontSize: 11,
            color: "var(--pulso-text-soft)",
            lineHeight: 1.55,
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <span>
            Total inconsistencias: <strong style={{ color: "var(--pulso-text)" }}>{fmt(totals.total)}</strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            Decididas:{" "}
            <strong style={{ color: "var(--pulso-text)" }}>{fmt(totals.decided)}</strong>{" "}
            ({totals.pct_done.toFixed(1)}%)
          </span>
          {counts.pending > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span style={{ color: "var(--pulso-warn-fg)" }}>
                Pendientes: <strong>{fmt(counts.pending)}</strong>
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Barra propiamente
// -----------------------------------------------------------------------------

function BarTrack({
  segments,
  height,
  activeKind,
  onSelectKind,
  empty,
}: {
  segments: Array<{ kind: DecisionKind; n: number; pct: number }>;
  height: number;
  activeKind: DecisionKind | null;
  onSelectKind?: (k: DecisionKind) => void;
  empty: boolean;
}) {
  const [hoverKind, setHoverKind] = useState<DecisionKind | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);

  if (empty) {
    return (
      <div
        style={{
          height,
          borderRadius: "var(--pulso-radius-chip)",
          background: "var(--pulso-surface-2)",
          border: "1px dashed var(--pulso-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 10,
          color: "var(--pulso-text-soft)",
          letterSpacing: 0.3,
          textTransform: "uppercase",
          fontWeight: 700,
        }}
      >
        Sin inconsistencias
      </div>
    );
  }

  return (
    <div
      ref={trackRef}
      role="group"
      aria-label="Distribución de decisiones"
      style={{
        display: "flex",
        width: "100%",
        height,
        borderRadius: "var(--pulso-radius-chip)",
        overflow: "hidden",
        background: "var(--pulso-surface-2)",
        border: "1px solid var(--pulso-border)",
        boxShadow: "inset 0 1px 2px rgba(15, 23, 42, 0.04)",
      }}
    >
      {segments.map((seg, idx) => {
        const meta = KIND_META[seg.kind];
        const isActive = activeKind === seg.kind;
        const isDimmed = activeKind != null && activeKind !== seg.kind;
        const isClickable = !!onSelectKind;
        return (
          <div
            key={seg.kind}
            role={isClickable ? "button" : undefined}
            tabIndex={isClickable ? 0 : undefined}
            aria-label={`${meta.label}: ${fmt(seg.n)} casos (${seg.pct.toFixed(1)}%)`}
            title={`${meta.label}: ${fmt(seg.n)} · ${seg.pct.toFixed(1)}%`}
            onMouseEnter={() => setHoverKind(seg.kind)}
            onMouseLeave={() => setHoverKind(null)}
            onClick={() => onSelectKind?.(seg.kind)}
            onKeyDown={(e) => {
              if (isClickable && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                onSelectKind?.(seg.kind);
              }
            }}
            style={{
              flex: `${seg.pct} 0 0`,
              background: meta.color,
              borderRight: idx < segments.length - 1 ? "1px solid rgba(255,255,255,0.4)" : "none",
              cursor: isClickable ? "pointer" : "default",
              transition: "flex 400ms cubic-bezier(0.4, 0, 0.2, 1), opacity 120ms ease, filter 120ms ease",
              opacity: isDimmed ? 0.42 : 1,
              filter:
                hoverKind === seg.kind || isActive
                  ? "brightness(1.08) saturate(1.15)"
                  : "none",
              minWidth: 2,
            }}
          />
        );
      })}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Leyenda — chips clickeables
// -----------------------------------------------------------------------------

function Legend({
  counts,
  total,
  activeKind,
  onSelectKind,
}: {
  counts: DecisionCounts;
  total: number;
  activeKind: DecisionKind | null;
  onSelectKind?: (k: DecisionKind) => void;
}) {
  const items = ALL_KINDS.filter((k) => counts[k] > 0);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
      {items.map((kind) => {
        const meta = KIND_META[kind];
        const n = counts[kind];
        const pct = total > 0 ? (n / total) * 100 : 0;
        const isActive = activeKind === kind;
        const isDimmed = activeKind != null && !isActive;
        const isClickable = !!onSelectKind;
        return (
          <button
            key={kind}
            type="button"
            onClick={() => onSelectKind?.(kind)}
            disabled={!isClickable}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "3px 8px 3px 6px",
              borderRadius: "var(--pulso-radius-chip)",
              background: isActive ? "var(--pulso-surface)" : "var(--pulso-surface-2)",
              border: `1px solid ${isActive ? "var(--pulso-primary-border)" : "var(--pulso-border)"}`,
              color: "var(--pulso-text)",
              fontSize: 11,
              fontWeight: 600,
              cursor: isClickable ? "pointer" : "default",
              opacity: isDimmed ? 0.55 : 1,
              transition: "opacity 120ms ease, background 120ms ease, border-color 120ms ease",
            }}
          >
            <LegendSwatch color={meta.color} isPattern={meta.isPattern} />
            <span>{meta.label}</span>
            <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--pulso-text-soft)" }}>
              {fmt(n)}
            </span>
            <span style={{ fontSize: 10, color: "var(--pulso-text-soft)" }}>
              ({pct.toFixed(1)}%)
            </span>
          </button>
        );
      })}
    </div>
  );
}

function LegendSwatch({ color, isPattern }: { color: string; isPattern?: boolean }) {
  return (
    <span
      style={{
        width: 10,
        height: 10,
        borderRadius: 3,
        background: color,
        border: isPattern ? "1px solid var(--pulso-border)" : "none",
        display: "inline-block",
      }}
      aria-hidden="true"
    />
  );
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("es-PE").format(n);
}
