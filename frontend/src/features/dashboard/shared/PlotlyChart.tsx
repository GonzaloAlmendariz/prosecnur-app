import { useEffect, useRef } from "react";

// Wrapper minimalista sobre plotly.js-dist-min cargado lazy. Rescatado
// del WIP descartado (features/tablero/PlotlyChart.tsx). Evitamos
// react-plotly.js como dependencia en runtime para tener control total
// sobre el ciclo de vida y reducir el bundle.

type PlotlyData = unknown;
type PlotlyLayout = Record<string, unknown>;
type PlotlyConfig = Record<string, unknown>;

let plotlyPromise: Promise<typeof import("plotly.js-dist-min")> | null = null;
function getPlotly() {
  if (!plotlyPromise) {
    plotlyPromise = import("plotly.js-dist-min");
  }
  return plotlyPromise;
}

export function PlotlyChart({
  data,
  layout,
  config,
  height = 320,
  ariaLabel,
}: {
  data: PlotlyData[];
  layout?: PlotlyLayout;
  config?: PlotlyConfig;
  height?: number;
  ariaLabel?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    getPlotly().then((Plotly) => {
      if (cancelled || !ref.current) return;
      const finalLayout: PlotlyLayout = {
        margin: { t: 0, r: 18, b: 0, l: 0 },
        font: { family: "system-ui, -apple-system, sans-serif", size: 11 },
        paper_bgcolor: "transparent",
        plot_bgcolor: "transparent",
        showlegend: false,
        ...(layout ?? {}),
      };
      const finalConfig: PlotlyConfig = {
        displayModeBar: false,
        responsive: true,
        ...(config ?? {}),
      };
      Plotly.newPlot(
        ref.current,
        data as Parameters<typeof Plotly.newPlot>[1],
        finalLayout,
        finalConfig,
      );
    });
    return () => {
      cancelled = true;
      const node = ref.current;
      if (node) {
        getPlotly().then((Plotly) => Plotly.purge(node)).catch(() => {});
      }
    };
  }, [data, layout, config]);

  return (
    <div
      ref={ref}
      role="img"
      aria-label={ariaLabel}
      style={{ width: "100%", height, minHeight: height }}
    />
  );
}
