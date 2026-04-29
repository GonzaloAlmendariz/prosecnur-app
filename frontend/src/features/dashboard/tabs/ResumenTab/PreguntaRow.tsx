import { useMemo } from "react";
import type { DashboardResumenRow } from "../../../../api/client";
import { PlotlyChart } from "../../shared/PlotlyChart";
import { useDashboardStore } from "../../store";

// Renderiza una pregunta del cuestionario como una "fila" del Resumen.
// Espejo del layout `.summary-row` del legacy (interactivo_resumen.R:1349):
// - SO: barra horizontal apilada (1 trace por categoría).
// - SM: una mini-barra por opción (fill-only estilo "chip").

// Alturas espejo del legacy (interactivo_resumen.R: BAR_HEIGHT=64 para SO,
// chips SM con altura ~32px individuales).
const BAR_HEIGHT = 56;
const SM_BAR_HEIGHT = 32;

export function PreguntaRow({ row }: { row: DashboardResumenRow }) {
  const palette = useDashboardStore((s) =>
    row.list_name ? s.config.paletas_listas[row.list_name] : undefined,
  );
  const decimals = useDashboardStore((s) => s.config.bar_decimals ?? 0);
  const smOrder = useDashboardStore((s) => s.config.sm_order ?? "questionnaire");

  if (row.type === "so") {
    return (
      <div className="dash-pregunta-row">
        <div className="dash-pregunta-label">{row.label}</div>
        <div>
          <SoBar dist={row.dist} palette={palette} ariaLabel={row.label} decimals={decimals} />
          <SoLegend dist={row.dist} palette={palette} />
        </div>
      </div>
    );
  }
  // SM — opcionalmente ordenadas por % desc en lugar del orden del XLSForm.
  const orderedOptions = smOrder === "desc"
    ? [...row.options].sort((a, b) => b.pct_yes - a.pct_yes)
    : row.options;
  return (
    <div className="dash-pregunta-row">
      <div className="dash-pregunta-label">{row.label}</div>
      <div className="dash-sm-options">
        {orderedOptions.map((opt) => (
          <div key={opt.col_dummy}>
            <div className="dash-sm-option-label">{opt.label}</div>
            <SmBar
              pctYes={opt.pct_yes}
              nYes={opt.n_yes}
              nTotal={opt.n_total}
              color={palette?.[opt.label] || opt.color}
              decimals={decimals}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// Formatea un porcentaje (0..1) con la cantidad de decimales configurada.
function fmtPct(pct: number, decimals: number): string {
  return `${(pct * 100).toFixed(decimals)}%`;
}

function SoBar({
  dist,
  palette,
  ariaLabel,
  decimals,
}: {
  dist: { code: string; label: string; n: number; pct: number; color?: string | null }[];
  palette?: Record<string, string>;
  ariaLabel: string;
  decimals: number;
}) {
  const traces = useMemo(
    () =>
      dist.map((d, i) => {
        const segColor = palette?.[d.label] || d.color || legendColor(i);
        const pequeno = d.pct < 0.06;
        return {
          type: "bar" as const,
          x: [d.pct],
          y: ["Total"],
          name: d.label,
          orientation: "h" as const,
          marker: { color: segColor },
          text: fmtPct(d.pct, decimals),
          // Si el segmento es chico, Plotly coloca el texto FUERA al lado
          // (a la derecha en orientación h). Si cabe, lo pone adentro.
          textposition: pequeno ? ("outside" as const) : ("inside" as const),
          insidetextanchor: "middle" as const,
          textfont: pequeno
            ? { color: segColor, size: 11 }
            : { color: "white", size: 12 },
          cliponaxis: false,
          constraintext: "none" as const,
          hovertemplate: `${d.label}: ${fmtPct(d.pct, Math.max(decimals, 1))}<br>n: ${d.n}<extra></extra>`,
        };
      }),
    [dist, palette, decimals],
  );

  if (!dist.length) return null;

  const layout = {
    barmode: "stack" as const,
    xaxis: {
      title: "",
      range: [0, 1],
      showgrid: false,
      zeroline: false,
      showticklabels: false,
      ticks: "",
      fixedrange: true,
    },
    yaxis: {
      title: "",
      showgrid: false,
      zeroline: false,
      showticklabels: false,
      ticks: "",
      fixedrange: true,
    },
    margin: { l: 0, r: 0, t: 0, b: 0 },
    showlegend: false,
  };

  return (
    <PlotlyChart
      data={traces}
      layout={layout}
      height={BAR_HEIGHT}
      ariaLabel={`Distribución de ${ariaLabel}`}
    />
  );
}

function SoLegend({
  dist,
  palette,
}: {
  dist: { code: string; label: string; color?: string | null }[];
  palette?: Record<string, string>;
}) {
  if (!dist.length) return null;
  return (
    <div className="dash-so-legend">
      {dist.map((d, i) => (
        <span key={d.code} className="dash-so-legend-item">
          <span
            className="dash-so-legend-swatch"
            style={{ background: palette?.[d.label] || d.color || legendColor(i) }}
          />
          {d.label}
        </span>
      ))}
    </div>
  );
}

// Plotly asigna colores por trace en orden. Replicamos el orden default
// (azules) para la leyenda. Cuando se conecte la paleta dinámica
// (Fase 3), esto leerá del tema.
function legendColor(i: number): string {
  const palette = [
    "#1f77b4",
    "#ff7f0e",
    "#2ca02c",
    "#d62728",
    "#9467bd",
    "#8c564b",
    "#e377c2",
    "#7f7f7f",
  ];
  return palette[i % palette.length];
}

function SmBar({
  pctYes,
  nYes,
  nTotal,
  color,
  decimals,
}: {
  pctYes: number;
  nYes: number;
  nTotal: number;
  color?: string | null;
  decimals: number;
}) {
  const traces = useMemo(
    () => [
      {
        type: "bar" as const,
        x: [pctYes],
        y: ["Total"],
        orientation: "h" as const,
        marker: { color: "var(--dash-primario)", line: { width: 0 } },
        hovertemplate: `Sí: ${fmtPct(pctYes, Math.max(decimals, 1))}<br>n: ${nYes}<br>N: ${nTotal}<extra></extra>`,
        showlegend: false,
      },
      {
        type: "bar" as const,
        x: [1 - pctYes],
        y: ["Total"],
        orientation: "h" as const,
        marker: { color: "var(--dash-superficie-2)", line: { width: 0 } },
        hoverinfo: "skip" as const,
        showlegend: false,
      },
    ],
    [pctYes, nYes, nTotal, decimals],
  );

  // Plotly no resuelve `var(--...)` directamente. Resolvemos a hex desde
  // computed style en runtime via un hook simple.
  const primario = color || useCssVar("--dash-primario") || "#002457";
  const bg = useCssVar("--dash-superficie-2") ?? "#fafbff";
  const tracesResolved = traces.map((t) => ({
    ...t,
    marker: {
      ...t.marker,
      color: t.marker.color === "var(--dash-primario)" ? primario : bg,
    },
  }));

  const layout = {
    barmode: "stack" as const,
    xaxis: {
      range: [0, 1],
      showgrid: false,
      zeroline: false,
      showticklabels: false,
      ticks: "",
      fixedrange: true,
    },
    yaxis: {
      showgrid: false,
      zeroline: false,
      showticklabels: false,
      ticks: "",
      fixedrange: true,
    },
    margin: { l: 0, r: 44, t: 0, b: 0 },
    showlegend: false,
    // % SIEMPRE visible — incluso para 0% o valores muy chicos. Si la
    // barra es ancha (>=5%) el texto va dentro y blanco; si es chica,
    // afuera a la derecha y en color primario.
    annotations: [
      {
        x: pctYes >= 0.05 ? pctYes / 2 : pctYes,
        y: "Total",
        xref: "x",
        yref: "y",
        text: pctYes >= 0.05
          ? `<b>${fmtPct(pctYes, decimals)}</b>`
          : fmtPct(pctYes, decimals),
        showarrow: false,
        xanchor: pctYes >= 0.05 ? "center" : "left",
        yanchor: "middle",
        xshift: pctYes >= 0.05 ? 0 : 6,
        font: {
          color: pctYes >= 0.05 ? "#ffffff" : primario,
          size: 12,
        },
      },
    ],
  };

  return (
    <PlotlyChart
      data={tracesResolved}
      layout={layout}
      height={SM_BAR_HEIGHT}
      ariaLabel="Porcentaje de selección"
    />
  );
}

// Lee una CSS custom property del scope dashboard. No se actualiza
// reactivamente en cambios de tema; se resuelve al render. Para v1 es
// suficiente — los cambios de paleta vienen de re-render top-level.
function useCssVar(name: string): string | null {
  if (typeof window === "undefined") return null;
  const el = document.querySelector(".dashboard-scope");
  if (!el) return null;
  const v = getComputedStyle(el).getPropertyValue(name).trim();
  return v || null;
}
