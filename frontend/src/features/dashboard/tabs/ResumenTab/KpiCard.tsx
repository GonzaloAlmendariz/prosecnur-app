import { useMemo } from "react";
import type { DashboardKpi } from "../../../../api/client";
import { PlotlyChart } from "../../shared/PlotlyChart";
import { useDashboardStore } from "../../store";

// Card de KPI estilo "medio donut" del legacy. Espejo de
// .construir_kpi_halfdonut_safe / output$kpi_panel en
// api/R/interactivo_resumen.R:376-502 y 1620-1675.
//
// Render: título wrapped + donut Plotly (hole=0.68, rotation=180) +
// leyenda HTML con swatches debajo.

const PALETTE = [
  "#1f77b4",
  "#ff7f0e",
  "#2ca02c",
  "#d62728",
  "#9467bd",
  "#8c564b",
  "#e377c2",
  "#7f7f7f",
];

export function KpiCard({ kpi }: { kpi: DashboardKpi }) {
  const palette = useDashboardStore((s) =>
    kpi.list_name ? s.config.paletas_listas[kpi.list_name] : undefined,
  );

  if (!kpi.dist || kpi.dist.length === 0) {
    return (
      <div className="dash-kpi-cell">
        <div className="dash-kpi-title">{wrapTitle(kpi.label)}</div>
        <div className="dash-kpi-empty dash-kpi-empty--roomy">
          Sin datos
        </div>
      </div>
    );
  }

  const colors = useMemo(
    () => kpi.dist.map((d, i) => palette?.[d.label] || d.color || PALETTE[i % PALETTE.length]),
    [kpi.dist, palette],
  );

  const trace = useMemo(
    () => [
      {
        type: "pie" as const,
        labels: kpi.dist.map((d) => d.label),
        values: kpi.dist.map((d) => d.n),
        hole: 0.68,
        direction: "clockwise" as const,
        rotation: 180,
        sort: false,
        textinfo: "none" as const,
        marker: { colors },
        hovertemplate: "%{label}: %{percent}<extra></extra>",
      },
    ],
    [kpi.dist, colors],
  );

  const layout = {
    showlegend: false,
    margin: { l: 8, r: 8, t: 8, b: 6 },
  };

  return (
    <div className="dash-kpi-cell">
      <div
        className="dash-kpi-title"
        dangerouslySetInnerHTML={{ __html: wrapTitle(kpi.label) }}
      />
      <PlotlyChart
        data={trace}
        layout={layout}
        height={146}
        ariaLabel={`Distribución de ${kpi.label}`}
      />
      <div className="dash-kpi-legend">
        {kpi.dist.map((d, i) => (
          <span key={d.code} className="dash-kpi-legend-item">
            <span
              className="dash-kpi-legend-swatch"
              style={{ background: colors[i] }}
            />
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// Wrap simple (45 chars) — espejo de .wrap_titulo_html del legacy.
function wrapTitle(text: string, width = 45): string {
  const safe = (text ?? "").toString();
  const words = safe.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > width && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = (cur + " " + w).trim();
    }
  }
  if (cur) lines.push(cur);
  return lines.map(escapeHtml).join("<br>");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
