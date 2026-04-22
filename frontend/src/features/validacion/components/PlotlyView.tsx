import { lazy, Suspense, useCallback, useMemo } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ListChecks,
} from "lucide-react";
import type { ViewDescriptor } from "../types";

// =============================================================================
// PlotlyView — renderer universal de ViewDescriptor
// =============================================================================
// El backend arma el descriptor; aquí decidimos cómo renderizarlo según el
// `kind`. La mayoría usa `react-plotly.js`, excepto `kpi_card` que es pura
// UI (no vale la pena cargar plotly para un número grande).
//
// `react-plotly.js` es pesado (~3 MB con deps) — lo importamos con
// React.lazy + Suspense para que sólo se descargue cuando aparece el
// primer chart.

const Plot = lazy(() => import("react-plotly.js"));

type OnAction = (action: { id: string; payload?: Record<string, unknown>; target_tab?: string }) => void;

type Props = {
  view: ViewDescriptor;
  /** Callback disparado cuando el usuario clickea un elemento accionable
      (ej. barra del top reglas → drill a esa regla). Recibe el action
      definido en `view.actions` + el customdata del point si lo trae. */
  onAction?: OnAction;
  /** Alto opcional en px. Si no se pasa se usa el que trae el layout. */
  height?: number;
};

export default function PlotlyView({ view, onAction, height }: Props) {
  if (view.kind === "kpi_card") {
    return <KpiCard view={view} onAction={onAction} />;
  }

  // Para cualquier otro kind, delegamos a plotly.
  return <PlotlyChart view={view} onAction={onAction} height={height} />;
}

// =============================================================================
// KPI card — puro HTML, no plotly.
// =============================================================================
const SEVERIDAD_ICONS: Record<string, typeof CheckCircle2> = {
  success: CheckCircle2,
  warn: AlertTriangle,
  danger: AlertCircle,
  neutral: ListChecks,
};

const SEVERIDAD_COLORS: Record<
  string,
  { bg: string; border: string; fg: string }
> = {
  success: {
    bg: "var(--pulso-success-bg)",
    border: "var(--pulso-success-border)",
    fg: "var(--pulso-success-fg)",
  },
  warn: {
    bg: "var(--pulso-warn-bg)",
    border: "var(--pulso-warn-border)",
    fg: "var(--pulso-warn-fg)",
  },
  danger: {
    bg: "var(--pulso-danger-bg)",
    border: "var(--pulso-danger-border)",
    fg: "var(--pulso-danger-fg)",
  },
  neutral: {
    bg: "var(--pulso-surface-2)",
    border: "var(--pulso-border)",
    fg: "var(--pulso-text)",
  },
};

function KpiCard({ view }: { view: ViewDescriptor; onAction?: OnAction }) {
  const sev = (view.meta?.severidad as string) ?? "neutral";
  const colors = SEVERIDAD_COLORS[sev] ?? SEVERIDAD_COLORS.neutral;
  const Icon = SEVERIDAD_ICONS[sev] ?? SEVERIDAD_ICONS.neutral;
  const value = view.meta?.value;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: "14px 16px",
        borderRadius: 10,
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        minHeight: 96,
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 11,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: 0.4,
          color: colors.fg,
        }}
      >
        <Icon size={13} />
        {view.title}
      </div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 700,
          color: colors.fg,
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1.1,
        }}
      >
        {value == null || value === "" ? "—" : String(value)}
      </div>
      {view.subtitle && (
        <div
          style={{
            fontSize: 11,
            color: colors.fg,
            opacity: 0.85,
            lineHeight: 1.4,
          }}
        >
          {view.subtitle}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Chart plotly (bar_h, heatmap_semaforo, etc.)
// =============================================================================
function PlotlyChart({
  view,
  onAction,
  height,
}: {
  view: ViewDescriptor;
  onAction?: OnAction;
  height?: number;
}) {
  const layout = useMemo(() => {
    const base = view.plotly.layout ?? {};
    return {
      ...base,
      autosize: true,
      ...(height ? { height } : {}),
    };
  }, [view.plotly.layout, height]);

  const config = useMemo(
    () => ({
      displayModeBar: false,
      responsive: true,
      ...(view.plotly.config ?? {}),
    }),
    [view.plotly.config],
  );

  // Empty hint: si el layout no tiene datos, mostramos un estado vacío.
  const empty =
    !view.plotly.data ||
    view.plotly.data.length === 0 ||
    ((view.plotly.data[0] as { x?: unknown[] })?.x?.length ?? 0) === 0;

  const handleClick = useCallback(
    (ev: { points?: Array<{ customdata?: string }> }) => {
      if (!onAction || !view.actions || view.actions.length === 0) return;
      const p = ev.points?.[0];
      if (!p) return;
      // Convención: si la acción tiene "id === 'drill_regla'" y el point
      // trae customdata, lo reenviamos como payload.id.
      const action = view.actions[0];
      onAction({
        ...action,
        payload: {
          ...(action.payload ?? {}),
          ...(p.customdata ? { id: p.customdata } : {}),
        },
      });
    },
    [onAction, view.actions],
  );

  return (
    <div
      style={{
        background: "white",
        border: "1px solid var(--pulso-border)",
        borderRadius: 10,
        padding: 16,
        boxShadow: "var(--pulso-shadow-low)",
      }}
    >
      <ChartHeader view={view} />
      {empty ? (
        <EmptyChartHint hint={(view.meta?.empty_hint as string) ?? "Sin datos para mostrar."} />
      ) : (
        <Suspense fallback={<ChartSkeleton height={height ?? 240} />}>
          <Plot
            data={view.plotly.data as Parameters<typeof Plot>[0]["data"]}
            layout={layout as Parameters<typeof Plot>[0]["layout"]}
            config={config as Parameters<typeof Plot>[0]["config"]}
            onClick={handleClick as Parameters<typeof Plot>[0]["onClick"]}
            useResizeHandler
            style={{ width: "100%" }}
          />
        </Suspense>
      )}
    </div>
  );
}

function ChartHeader({ view }: { view: ViewDescriptor }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: "var(--pulso-text)",
          lineHeight: 1.3,
        }}
      >
        {view.title}
      </div>
      {view.subtitle && (
        <div
          style={{
            fontSize: 11,
            color: "var(--pulso-text-soft)",
            marginTop: 2,
            lineHeight: 1.4,
          }}
        >
          {view.subtitle}
        </div>
      )}
    </div>
  );
}

function EmptyChartHint({ hint }: { hint: string }) {
  return (
    <div
      style={{
        padding: "24px 16px",
        textAlign: "center",
        fontSize: 12,
        color: "var(--pulso-text-soft)",
        fontStyle: "italic",
      }}
    >
      {hint}
    </div>
  );
}

function ChartSkeleton({ height }: { height: number }) {
  return (
    <div
      style={{
        height,
        background:
          "linear-gradient(90deg, var(--pulso-surface-2) 0%, var(--pulso-border) 50%, var(--pulso-surface-2) 100%)",
        backgroundSize: "200% 100%",
        animation: "pulso-shimmer 1.6s ease-in-out infinite",
        borderRadius: 6,
      }}
    />
  );
}
