import { useMemo } from "react";
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
  const footer = deriveChartFooter(view);
  const chips = buildMetaChips(view.meta);
  const eyebrow = deriveChartEyebrow(view);

  return (
    <article
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        minHeight: 144,
        padding: "16px 18px 18px",
        borderRadius: 16,
        border: `1px solid ${colors.border}`,
        background: `linear-gradient(180deg, ${colors.panel} 0%, ${colors.bg} 62%, #ffffff 100%)`,
        boxShadow: "var(--pulso-shadow-soft)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 10,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: 0.5,
              color: colors.fg,
            }}
          >
            <Icon size={13} />
            {eyebrow}
          </span>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              lineHeight: 1.3,
              color: "var(--pulso-text)",
            }}
          >
            {view.title}
          </div>
        </div>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 42,
            height: 42,
            borderRadius: 999,
            background: "rgba(255,255,255,0.85)",
            border: `1px solid ${colors.border}`,
            color: colors.fg,
          }}
        >
          <Icon size={18} />
        </span>
      </div>

      <div
        style={{
          fontSize: 40,
          fontWeight: 800,
          color: colors.fg,
          fontVariantNumeric: "tabular-nums",
          letterSpacing: -1.2,
          lineHeight: 1,
        }}
      >
        {value == null || value === "" ? "—" : String(value)}
      </div>

      {view.subtitle && (
        <div
          style={{
            fontSize: 12,
            lineHeight: 1.5,
            color: "var(--pulso-text-soft)",
          }}
        >
          {view.subtitle}
        </div>
      )}

      {(chips.length > 0 || footer) && (
        <footer
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            marginTop: "auto",
            paddingTop: 12,
            borderTop: "1px solid rgba(255,255,255,0.75)",
          }}
        >
          {chips.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {chips.map((chip) => (
                <MetaChip key={chip.label} label={chip.label} tone={chip.tone} mono={chip.mono} />
              ))}
            </div>
          )}
          {footer && (
            <div style={{ fontSize: 11, lineHeight: 1.5, color: colors.fg, opacity: 0.92 }}>
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
  height,
}: {
  view: ViewDescriptor;
  onAction?: OnAction;
  height?: number;
}) {
  const tone = getChartTone(view);
  const eyebrow = deriveChartEyebrow(view);
  const chips = buildMetaChips(view.meta);
  const footer = deriveChartFooter(view);

  const layout = useMemo(() => buildPlotlyLayout(view, height), [view, height]);
  const config = useMemo(() => buildPlotlyConfig(view), [view]);
  const data = useMemo(() => buildPlotlyData(view), [view]);
  const empty = !hasPlotlyData(view);

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
        title={view.title}
        subtitle={view.subtitle}
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
          ) : (
            <SharedPlotlyChart
              data={data as unknown[]}
              layout={layout as Record<string, unknown>}
              config={config as Record<string, unknown>}
              height={height ?? 260}
              ariaLabel={view.title}
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

