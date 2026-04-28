import { useEffect, useRef } from "react";

// Wrapper minimalista sobre plotly.js-dist-min cargado lazy. Vive en
// `lib/` (neutral) para que Dashboard y Validación lo compartan sin
// crear dependencia cruzada entre features. Vite así genera UN solo
// chunk para plotly.js-dist-min en lugar de duplicarlo cuando cada
// feature trae su propia versión (react-plotly.js trae plotly.js entero).
//
// Updates: usa Plotly.react() en lugar de purge+newPlot por cada cambio
// de props. Esto preserva el contexto de la gráfica entre renders y
// evita re-animaciones agresivas cuando la prop padre cambia por
// razones que no afectan los datos (p. ej. el usuario alterna entre
// pestañas de configuración del sidebar). El purge solo corre al
// unmount real del componente.

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
  onReady,
}: {
  data: PlotlyData[];
  layout?: PlotlyLayout;
  config?: PlotlyConfig;
  height?: number;
  ariaLabel?: string;
  /** Callback opcional invocado tras `Plotly.react`, recibe el div graph
   * para attachear eventos custom (hover, click) sin acoplar este wrapper
   * a una librería específica de event handlers. */
  onReady?: (gd: HTMLElement) => void | (() => void);
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Re-render incremental: Plotly.react reusa traces existentes y anima
  // cambios de datos sin reiniciar la animación entera (a diferencia de
  // purge+newPlot que se veía como un "flash").
  useEffect(() => {
    let cancelled = false;
    let cleanup: void | (() => void);
    getPlotly().then((Plotly) => {
      if (cancelled || !ref.current) return;
      const finalLayout: PlotlyLayout = {
        margin: { t: 0, r: 18, b: 0, l: 0 },
        font: { family: "system-ui, -apple-system, sans-serif", size: 11 },
        paper_bgcolor: "transparent",
        plot_bgcolor: "transparent",
        showlegend: false,
        dragmode: false,
        ...(layout ?? {}),
      };
      const finalConfig: PlotlyConfig = {
        displayModeBar: false,
        doubleClick: false,
        responsive: true,
        scrollZoom: false,
        ...(config ?? {}),
      };
      Plotly.react(
        ref.current,
        data as Parameters<typeof Plotly.react>[1],
        finalLayout,
        finalConfig,
      ).then(() => {
        if (cancelled || !ref.current) return;
        cleanup = onReady?.(ref.current);
      });
    });
    return () => {
      cancelled = true;
      if (typeof cleanup === "function") cleanup();
    };
  }, [data, layout, config, onReady]);

  // Purge solo al unmount real del componente — libera memoria y
  // event listeners de Plotly. Se separa del effect anterior para no
  // disparar purge en cada update de props.
  useEffect(() => {
    const node = ref.current;
    return () => {
      if (node) {
        getPlotly().then((Plotly) => Plotly.purge(node)).catch(() => {});
      }
    };
  }, []);

  return (
    <div
      ref={ref}
      className="dash-plotly-chart"
      role="img"
      aria-label={ariaLabel}
      style={{ width: "100%", height, minHeight: height }}
    />
  );
}
