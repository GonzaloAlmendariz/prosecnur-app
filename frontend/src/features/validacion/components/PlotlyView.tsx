import { useMemo, type CSSProperties } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ListChecks,
} from "lucide-react";
import type { ViewDescriptor } from "../types";
import {
  buildMetaChips,
  buildPlotlyConfig,
  buildPlotlyData,
  buildPlotlyLayout,
  deriveChartEyebrow,
  deriveChartFooter,
  getChartTone,
  hasPlotlyData,
} from "./plotlyTheme";
import { PlotlyChart as SharedPlotlyChart } from "../../../lib/PlotlyChart";

type OnAction = (action: { id: string; payload?: Record<string, unknown>; target_tab?: string }) => void;

type Props = {
  view: ViewDescriptor;
  onAction?: OnAction;
  height?: number;
};

const SEVERIDAD_ICONS: Record<string, typeof CheckCircle2> = {
  success: CheckCircle2,
  warn: AlertTriangle,
  danger: AlertCircle,
  neutral: ListChecks,
};

const SEVERIDAD_COLORS: Record<
  string,
  { bg: string; border: string; fg: string; panel: string }
> = {
  success: {
    bg: "var(--pulso-success-bg)",
    border: "var(--pulso-success-border)",
    fg: "var(--pulso-success-fg)",
    panel: "rgba(22, 101, 52, 0.08)",
  },
  warn: {
    bg: "var(--pulso-warn-bg)",
    border: "var(--pulso-warn-border)",
    fg: "var(--pulso-warn-fg)",
    panel: "rgba(180, 83, 9, 0.10)",
  },
  danger: {
    bg: "var(--pulso-danger-bg)",
    border: "var(--pulso-danger-border)",
    fg: "var(--pulso-danger-fg)",
    panel: "rgba(185, 28, 28, 0.10)",
  },
  neutral: {
    bg: "var(--pulso-surface-2)",
    border: "var(--pulso-border)",
    fg: "var(--pulso-primary)",
    panel: "rgba(0, 36, 87, 0.08)",
  },
};

function friendlyValidationText(value?: string | null) {
  if (!value) return value;
  return value
    .replace(/\bTotal casos\b/g, "Casos revisados")
    .replace(/\bFilas en la base\b/g, "Registros en la base")
    .replace(/\bMissing\b/g, "Sin respuesta")
    .replace(/\bmissing\b/g, "sin respuesta");
}

export default function PlotlyView({ view, onAction, height }: Props) {
  if (view.kind === "kpi_card") {
    return <KpiCard view={view} onAction={onAction} />;
  }
  return <PlotlyChart view={view} onAction={onAction} height={height} />;
}

function KpiCard({ view }: { view: ViewDescriptor; onAction?: OnAction }) {
  const sev = String(view.meta?.severidad ?? "neutral");
  const colors = SEVERIDAD_COLORS[sev] ?? SEVERIDAD_COLORS.neutral;
  const Icon = SEVERIDAD_ICONS[sev] ?? SEVERIDAD_ICONS.neutral;
  const value = view.meta?.value;
  const footer = friendlyValidationText(deriveChartFooter(view));
  const chips = buildMetaChips(view.meta);
  const eyebrow = friendlyValidationText(deriveChartEyebrow(view));
  const title = friendlyValidationText(view.title);
  const subtitle = friendlyValidationText(view.subtitle);
  const cardStyle = {
    "--pulso-validacion-kpi-border": colors.border,
    "--pulso-validacion-kpi-panel": colors.panel,
    "--pulso-validacion-kpi-bg": colors.bg,
    "--pulso-validacion-kpi-fg": colors.fg,
  } as CSSProperties & Record<string, string>;

  return (
    <article className="pulso-validacion-kpi-card" style={cardStyle}>
      <div className="pulso-validacion-kpi-card-head">
        <div className="pulso-validacion-kpi-card-copy">
          <span
            className="pulso-validacion-kpi-eyebrow"
          >
            <Icon size={13} />
            {eyebrow}
          </span>
          <div
            className="pulso-validacion-kpi-title"
          >
            {title}
          </div>
        </div>
        <span
          className="pulso-validacion-kpi-icon"
        >
          <Icon size={18} />
        </span>
      </div>

      <div
        className="pulso-validacion-kpi-value"
      >
        {value == null || value === "" ? "—" : String(value)}
      </div>

      {subtitle && (
        <div
          className="pulso-validacion-kpi-subtitle"
        >
          {subtitle}
        </div>
      )}

      {(chips.length > 0 || footer) && (
        <footer className="pulso-validacion-kpi-footer">
          {chips.length > 0 && (
            <div className="pulso-validacion-kpi-chips">
              {chips.map((chip) => (
                <MetaChip key={chip.label} label={chip.label} tone={chip.tone} mono={chip.mono} />
              ))}
            </div>
          )}
          {footer && (
            <div className="pulso-validacion-kpi-note">
              {footer}
            </div>
          )}
        </footer>
      )}
    </article>
  );
}

function PlotlyChart({
  view,
  onAction,
  height,
}: {
  view: ViewDescriptor;
  onAction?: OnAction;
  height?: number;
}) {
  const tone = getChartTone(view);
  const eyebrow = friendlyValidationText(deriveChartEyebrow(view)) ?? "";
  const chips = buildMetaChips(view.meta);
  const footer = friendlyValidationText(deriveChartFooter(view));
  const title = friendlyValidationText(view.title) ?? view.title;
  const subtitle = friendlyValidationText(view.subtitle) ?? undefined;

  const layout = useMemo(() => buildPlotlyLayout(view, height), [view, height]);
  const config = useMemo(() => buildPlotlyConfig(view), [view]);
  const data = useMemo(() => buildPlotlyData(view), [view]);
  const empty = !hasPlotlyData(view);
  const nativeSummary = useMemo(() => nativeValidationSummary(view), [view]);

  return (
    <article
      style={{
        overflow: "hidden",
        borderRadius: 18,
        border: "1px solid var(--pulso-chart-border)",
        background:
          `linear-gradient(180deg, ${tone.soft} 0%, rgba(255,255,255,0.98) 72px, #ffffff 100%)`,
        boxShadow: "var(--pulso-shadow-soft)",
      }}
    >
      <ChartHeader
        eyebrow={eyebrow}
        title={title}
        subtitle={subtitle}
        chips={chips}
        accent={tone.accent}
      />

      <div
        style={{
          padding: "0 18px 18px",
        }}
      >
        <div
          style={{
            borderRadius: 14,
            border: "1px solid rgba(216, 224, 239, 0.85)",
            background:
              "linear-gradient(180deg, rgba(248, 250, 255, 0.88) 0%, rgba(255,255,255,0.96) 100%)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.82)",
            padding: 14,
          }}
        >
          {empty ? (
            <EmptyChartHint hint={(view.meta?.empty_hint as string) ?? "Sin datos para mostrar."} />
          ) : nativeSummary ? (
            <NativeValidationSummary view={view} summary={nativeSummary} onAction={onAction} />
          ) : (
            <SharedPlotlyChart
              data={data as unknown[]}
              layout={layout as Record<string, unknown>}
              config={config as Record<string, unknown>}
              height={height ?? 260}
              ariaLabel={title}
            />
          )}
        </div>

        {footer && (
          <ChartFooter
            text={footer}
            accent={tone.accent}
            actionable={false}
          />
        )}
      </div>
    </article>
  );
}

type NativeBarSummary = {
  kind: "bar";
  rows: Array<{ label: string; value: number; actionId?: string }>;
};

type NativeHeatmapSummary = {
  kind: "heatmap";
  x: string[];
  y: string[];
  z: number[][];
};

type NativeSummary = NativeBarSummary | NativeHeatmapSummary;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function cleanPlotlyLabel(value: unknown) {
  return String(value ?? "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function nativeValidationSummary(view: ViewDescriptor): NativeSummary | null {
  const first = view.plotly.data?.[0];
  if (!isRecord(first)) return null;

  if (view.kind === "bar_h" && /top reglas violadas/i.test(view.title)) {
    const values = asArray(first.x).map((x) => Number(x)).filter((x) => Number.isFinite(x));
    const labels = asArray(first.hovertext).length ? asArray(first.hovertext) : asArray(first.y);
    const ids = asArray(first.customdata);
    const rows = values.map((value, index) => ({
      label: cleanPlotlyLabel(labels[index]),
      value,
      actionId: ids[index] == null ? undefined : String(ids[index]),
    }));
    return rows.length ? { kind: "bar", rows } : null;
  }

  if (view.kind === "heatmap_semaforo") {
    const x = asArray(first.x).map(cleanPlotlyLabel).filter(Boolean);
    const y = asArray(first.y).map(cleanPlotlyLabel).filter(Boolean);
    const z = asArray(first.z).map((row) =>
      asArray(row).map((cell) => {
        const value = Number(cell);
        return Number.isFinite(value) ? value : 0;
      }),
    );
    if (!x.length || !y.length || !z.length) return null;
    return { kind: "heatmap", x, y, z };
  }

  return null;
}

function NativeValidationSummary({
  view,
  summary,
  onAction,
}: {
  view: ViewDescriptor;
  summary: NativeSummary;
  onAction?: OnAction;
}) {
  if (summary.kind === "bar") {
    return <NativeBarChart summary={summary} view={view} onAction={onAction} />;
  }
  return <NativeHeatmap summary={summary} />;
}

function NativeBarChart({
  summary,
  view,
  onAction,
}: {
  summary: NativeBarSummary;
  view: ViewDescriptor;
  onAction?: OnAction;
}) {
  const max = Math.max(1, ...summary.rows.map((row) => row.value));
  const action = view.actions?.[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 220 }}>
      {summary.rows.map((row) => {
        const width = `${Math.max(8, (row.value / max) * 100)}%`;
        const clickable = !!(action && row.actionId && onAction);
        return (
          <button
            key={`${row.label}-${row.actionId ?? row.value}`}
            type="button"
            disabled={!clickable}
            onClick={() => {
              if (!clickable) return;
              onAction?.({
                id: action.id,
                target_tab: action.target_tab,
                payload: { ...(action.payload ?? {}), id_regla: row.actionId },
              });
            }}
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 0.55fr) minmax(80px, 1fr) minmax(28px, auto)",
              alignItems: "center",
              gap: 12,
              width: "100%",
              border: 0,
              padding: "8px 10px",
              borderRadius: 12,
              background: clickable ? "rgba(255,255,255,0.72)" : "transparent",
              color: "inherit",
              cursor: clickable ? "pointer" : "default",
              textAlign: "left",
              font: "inherit",
            }}
          >
            <span
              title={row.label}
              style={{
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                fontSize: 12,
                fontWeight: 750,
                color: "var(--pulso-text)",
              }}
            >
              {row.label}
            </span>
            <span
              aria-hidden="true"
              style={{
                position: "relative",
                height: 16,
                borderRadius: 999,
                background: "rgba(216, 224, 239, 0.72)",
                overflow: "hidden",
              }}
            >
              <span
                style={{
                  display: "block",
                  width,
                  height: "100%",
                  borderRadius: 999,
                  background: "linear-gradient(90deg, #2457d6 0%, #0f766e 100%)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35)",
                }}
              />
            </span>
            <span
              style={{
                minWidth: 30,
                textAlign: "right",
                fontSize: 12,
                fontWeight: 850,
                color: "var(--pulso-primary)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {row.value}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function heatColor(value: number, max: number) {
  if (value <= 0) return { bg: "rgba(248,250,252,0.92)", fg: "var(--pulso-text-soft)", border: "rgba(226,232,240,0.9)" };
  const ratio = value / Math.max(1, max);
  if (ratio >= 0.66) return { bg: "#dc2626", fg: "#ffffff", border: "#b91c1c" };
  if (ratio >= 0.34) return { bg: "#f97316", fg: "#ffffff", border: "#ea580c" };
  return { bg: "#16a34a", fg: "#ffffff", border: "#15803d" };
}

function NativeHeatmap({ summary }: { summary: NativeHeatmapSummary }) {
  const max = Math.max(1, ...summary.z.flat());
  const activeColumns = summary.x
    .map((label, index) => ({
      label,
      index,
      total: summary.z.reduce((sum, row) => sum + (row[index] ?? 0), 0),
    }))
    .filter((col) => col.total > 0);
  const activeRows = summary.y
    .map((label, index) => ({
      label,
      index,
      total: (summary.z[index] ?? []).reduce((sum, value) => sum + value, 0),
    }))
    .filter((row) => row.total > 0);
  const columnsShown = activeColumns.length ? activeColumns : summary.x.map((label, index) => ({ label, index, total: 0 }));
  const rowsShown = activeRows.length ? activeRows : summary.y.map((label, index) => ({ label, index, total: 0 }));
  const hiddenColumns = Math.max(0, summary.x.length - columnsShown.length);
  const hiddenRows = Math.max(0, summary.y.length - rowsShown.length);

  return (
    <div style={{ display: "grid", gap: 14, minHeight: 220, minWidth: 0 }}>
      <div style={{ display: "grid", gap: 10, minWidth: 0 }}>
        {rowsShown.map((row) => (
        <div
          key={row.label}
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(72px, 92px) minmax(0, 1fr)",
            gap: 8,
            minWidth: 0,
            alignItems: "center",
          }}
        >
          <div
            title={`${row.label}: ${row.total} casos`}
            style={{
              minWidth: 0,
              padding: "0 8px",
              alignSelf: "stretch",
              display: "flex",
              alignItems: "center",
              borderRadius: 10,
              background: "rgba(248,250,255,0.84)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              fontSize: 11,
              fontWeight: 800,
              color: "var(--pulso-text)",
            }}
          >
            {row.label}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(92px, 1fr))",
              gap: 8,
              minWidth: 0,
            }}
          >
            {columnsShown.map((col) => {
              const value = summary.z[row.index]?.[col.index] ?? 0;
              const color = heatColor(value, max);
              return (
                <div
                  key={`${row.label}-${col.label}`}
                  title={`${row.label} × ${col.label}: ${value} casos`}
                  style={{
                    minHeight: 58,
                    minWidth: 0,
                    display: "grid",
                    gridTemplateRows: "auto 1fr",
                    gap: 4,
                    alignItems: "center",
                    justifyItems: "center",
                    padding: "8px 10px",
                    borderRadius: 12,
                    border: `1px solid ${color.border}`,
                    background: color.bg,
                    color: color.fg,
                    boxShadow: value > 0 ? "0 10px 22px rgba(15, 23, 42, 0.12)" : "none",
                  }}
                >
                  <span
                    style={{
                      maxWidth: "100%",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      fontSize: 10,
                      lineHeight: 1.15,
                      fontWeight: 750,
                      opacity: value > 0 ? 0.92 : 0.72,
                    }}
                  >
                    {col.label}
                  </span>
                  <span
                    style={{
                      fontSize: value > 0 ? 17 : 12,
                      lineHeight: 1,
                      fontWeight: 850,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {value > 0 ? value : ""}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        ))}
      </div>
      {(hiddenColumns > 0 || hiddenRows > 0) && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            alignItems: "center",
            color: "var(--pulso-text-soft)",
            fontSize: 11,
            lineHeight: 1.4,
          }}
        >
          {hiddenColumns > 0 && (
            <span
              style={{
                padding: "5px 9px",
                borderRadius: 999,
                border: "1px solid var(--pulso-border)",
                background: "rgba(255,255,255,0.72)",
                fontWeight: 700,
              }}
            >
              {hiddenColumns} secciones sin casos
            </span>
          )}
          {hiddenRows > 0 && (
            <span
              style={{
                padding: "5px 9px",
                borderRadius: 999,
                border: "1px solid var(--pulso-border)",
                background: "rgba(255,255,255,0.72)",
                fontWeight: 700,
              }}
            >
              {hiddenRows} tipos sin casos
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function ChartHeader({
  eyebrow,
  title,
  subtitle,
  chips,
  accent,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  chips: Array<{ label: string; tone?: "neutral" | "info"; mono?: boolean }>;
  accent: string;
}) {
  return (
    <header
      style={{
        padding: "18px 18px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: 999,
            background: accent,
            boxShadow: `0 0 0 5px ${accent}1f`,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: 0.6,
            color: "var(--pulso-primary)",
          }}
        >
          {eyebrow}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div
          style={{
            fontSize: 17,
            fontWeight: 800,
            lineHeight: 1.25,
            color: "var(--pulso-text)",
            letterSpacing: -0.2,
          }}
        >
          {title}
        </div>
        {subtitle && (
          <div
            style={{
              fontSize: 12,
              lineHeight: 1.5,
              color: "var(--pulso-text-soft)",
              maxWidth: 760,
            }}
          >
            {subtitle}
          </div>
        )}
      </div>

      {chips.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {chips.map((chip) => (
            <MetaChip key={chip.label} label={chip.label} tone={chip.tone} mono={chip.mono} />
          ))}
        </div>
      )}
    </header>
  );
}

function MetaChip({
  label,
  tone = "neutral",
  mono = false,
}: {
  label: string;
  tone?: "neutral" | "info";
  mono?: boolean;
}) {
  const bg = tone === "info" ? "var(--pulso-primary-soft)" : "var(--pulso-chart-chip-bg)";
  const border = tone === "info" ? "var(--pulso-primary-border)" : "var(--pulso-chart-chip-border)";
  const color = tone === "info" ? "var(--pulso-primary)" : "var(--pulso-text-soft)";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 9px",
        borderRadius: 999,
        background: bg,
        border: `1px solid ${border}`,
        color,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 0.2,
        fontFamily: mono ? 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' : undefined,
      }}
    >
      {label}
    </span>
  );
}

function ChartFooter({
  text,
  accent,
  actionable,
}: {
  text: string;
  accent: string;
  actionable: boolean;
}) {
  return (
    <footer
      style={{
        marginTop: 12,
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "12px 14px",
        borderRadius: 12,
        border: "1px solid var(--pulso-chart-chip-border)",
        background: "var(--pulso-chart-panel)",
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: accent,
          marginTop: 5,
          flexShrink: 0,
        }}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            color: actionable ? "var(--pulso-primary)" : "var(--pulso-text-soft)",
          }}
        >
          {actionable ? "Acción disponible" : "Lectura"}
        </div>
        <div
          style={{
            fontSize: 11,
            lineHeight: 1.5,
            color: "var(--pulso-text-soft)",
          }}
        >
          {text}
        </div>
      </div>
    </footer>
  );
}

function EmptyChartHint({ hint }: { hint: string }) {
  return (
    <div
      style={{
        minHeight: 180,
        display: "grid",
        placeItems: "center",
        textAlign: "center",
        padding: "24px 18px",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 360 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: 0.6,
            color: "var(--pulso-text-soft)",
          }}
        >
          Sin visualización disponible
        </div>
        <div
          style={{
            fontSize: 12,
            lineHeight: 1.6,
            color: "var(--pulso-text-soft)",
          }}
        >
          {hint}
        </div>
      </div>
    </div>
  );
}
