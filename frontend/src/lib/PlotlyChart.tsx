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

// Guardia defensiva de memoización: varios callers (Monitoreo sobre todo)
// construyen data/layout/config inline en cada render, así que las REFERENCIAS
// cambian aunque el contenido sea idéntico y cada setState del padre relanzaba
// Plotly.react (relayout + reanimación). Comparamos estructuralmente el spec
// nuevo contra el último aplicado y, si son equivalentes, saltamos el re-plot.
// La comparación tiene presupuesto: pasado ese número de hojas visitadas se
// asume "cambiado" y se re-renderiza como antes (specs gigantes no pagan una
// comparación O(n) completa). Nunca salta un cambio real: solo declara igual
// lo que es estructuralmente igual. Exportado únicamente para tests.
const PLOTLY_SPEC_COMPARE_BUDGET = 50_000;

export function plotlySpecEquals(a: unknown, b: unknown): boolean {
  let budget = PLOTLY_SPEC_COMPARE_BUDGET;
  const eq = (x: unknown, y: unknown): boolean => {
    // El presupuesto se consume por hoja visitada (también en hojas iguales):
    // así un spec gigante corta la comparación y re-renderiza como antes.
    if (budget-- <= 0) return false;
    if (Object.is(x, y)) return true;
    if (x == null || y == null) return false;
    if (typeof x !== "object" || typeof y !== "object") return false;
    if (Array.isArray(x) || Array.isArray(y)) {
      if (!Array.isArray(x) || !Array.isArray(y) || x.length !== y.length) return false;
      for (let i = 0; i < x.length; i += 1) {
        if (!eq(x[i], y[i])) return false;
      }
      return true;
    }
    if (x instanceof Date || y instanceof Date) {
      return x instanceof Date && y instanceof Date && x.getTime() === y.getTime();
    }
    if (ArrayBuffer.isView(x) || ArrayBuffer.isView(y)) {
      // Plotly acepta typed arrays como series; DataView u otros views sin
      // length se tratan como "cambiado" (seguro).
      if (!ArrayBuffer.isView(x) || !ArrayBuffer.isView(y) || x.constructor !== y.constructor) return false;
      const xa = x as unknown as { length?: number; [index: number]: number };
      const ya = y as unknown as { length?: number; [index: number]: number };
      if (typeof xa.length !== "number" || xa.length !== ya.length) return false;
      for (let i = 0; i < xa.length; i += 1) {
        if (budget-- <= 0 || !Object.is(xa[i], ya[i])) return false;
      }
      return true;
    }
    const xr = x as Record<string, unknown>;
    const yr = y as Record<string, unknown>;
    const xKeys = Object.keys(xr);
    if (xKeys.length !== Object.keys(yr).length) return false;
    for (const key of xKeys) {
      if (!Object.prototype.hasOwnProperty.call(yr, key)) return false;
      if (!eq(xr[key], yr[key])) return false;
    }
    return true;
  };
  return eq(a, b);
}

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
  // Último spec efectivamente aplicado con Plotly.react sobre este div.
  const lastSpecRef = useRef<{
    data: PlotlyData[];
    layout: PlotlyLayout | null;
    config: PlotlyConfig | null;
  } | null>(null);

  // Re-render incremental: Plotly.react reusa traces existentes y anima
  // cambios de datos sin reiniciar la animación entera (a diferencia de
  // purge+newPlot que se veía como un "flash").
  useEffect(() => {
    let cancelled = false;
    let cleanup: void | (() => void);
    getPlotly().then((Plotly) => {
      if (cancelled || !ref.current) return;
      const prev = lastSpecRef.current;
      if (
        prev &&
        plotlySpecEquals(prev.data, data) &&
        plotlySpecEquals(prev.layout, layout ?? null) &&
        plotlySpecEquals(prev.config, config ?? null)
      ) {
        // Mismo spec con referencias nuevas: no relanzar Plotly.react.
        // Se re-attachea onReady igual que tras un re-plot (el teardown del
        // effect anterior ya corrió su cleanup).
        cleanup = onReady?.(ref.current);
        return;
      }
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
        // Registrar el spec aplicado aunque el effect se haya cancelado: el
        // div persiste entre updates y el próximo run compara contra lo que
        // realmente quedó dibujado.
        lastSpecRef.current = { data, layout: layout ?? null, config: config ?? null };
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

  // ResizeObserver del contenedor — Plotly.react no recalcula tamaño cuando
  // solo cambia el div padre (caso fullscreen / drawers / collapsibles).
  // Coalescemos eventos en un solo rAF para no thrashear durante la animación
  // de zoom-in del overlay.
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    let raf = 0;
    const observer = new ResizeObserver(() => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        raf = 0;
        getPlotly()
          .then((Plotly) => {
            if (!node.isConnected) return;
            Plotly.Plots.resize(node);
          })
          .catch(() => {});
      });
    });
    observer.observe(node);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      observer.disconnect();
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
