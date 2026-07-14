/**
 * Distribución de la muestra por facultad y sexo: barras apiladas construidas
 * con la distribución validada del motor (`resultado.distribucion_estratos` +
 * `distribucion_sub`). Sin datos del motor no pinta nada aproximado.
 */
import { useMemo } from "react";
import type { CalcMuestraResultado } from "../../../api/client";
import { PlotlyChart } from "../../../lib/PlotlyChart";
import { BadgeMotor } from "./PasoDidactico";
import { buildStackedBars, didPlotLayout, didSexSeriesColor, DID_PLOT_CONFIG, useDidTokens } from "./didacticaCharts";

export function DistribucionFacultadSexo({ resultado }: { resultado: CalcMuestraResultado | null | undefined }) {
  const tokens = useDidTokens();
  const estratos = resultado?.distribucion_estratos ?? [];
  const subs = resultado?.distribucion_sub ?? [];

  const chart = useMemo(() => {
    if (!estratos.length) return null;
    const orden = [...estratos].sort((a, b) => a.n - b.n);
    const categorias = orden.map((e) => e.estrato);
    if (subs.length) {
      const subLabels = Array.from(new Set(subs.map((s) => s.sub)));
      const series = subLabels.map((sub, index) => ({
        nombre: sub,
        color: didSexSeriesColor(sub, tokens, index),
        valores: categorias.map(
          (estrato) => subs.find((s) => s.estrato === estrato && s.sub === sub)?.n ?? 0,
        ),
      }));
      return { categorias, series };
    }
    return {
      categorias,
      series: [{ nombre: "n asignado", valores: orden.map((e) => e.n) }],
    };
  }, [estratos, subs, tokens]);

  if (!chart) return null;
  const alto = Math.max(240, chart.categorias.length * 26 + 70);

  return (
    <div className="cmv2-did-result">
      <div className="cmv2-did-result-head">
        <span className="cmv2-eyebrow">Distribución por facultad y sexo</span>
        <BadgeMotor estado="validado" />
      </div>
      <div className="cmv2-did-chart">
        <PlotlyChart
          data={buildStackedBars(chart.categorias, chart.series, tokens)}
          layout={didPlotLayout(tokens, {
            barmode: "stack",
            height: alto,
            showlegend: chart.series.length > 1,
            legend: { orientation: "h", y: -0.08, font: { size: 11 } },
            xaxis: { gridcolor: tokens.border, zeroline: false, tickfont: { size: 10.5 } },
            yaxis: { automargin: true, tickfont: { size: 10.5 } },
          })}
          config={{ ...DID_PLOT_CONFIG }}
          height={alto}
          ariaLabel="Distribución de la muestra por facultad y sexo"
        />
      </div>
      <p className="cmv2-did-note">
        Cada facultad recibe una cuota proporcional a su peso en el marco; dentro de cada facultad, la cuota se
        reparte según la composición real por sexo. Así la muestra reproduce la estructura de la universidad en
        vez de sobre-representar a las facultades grandes o a un solo grupo.
      </p>
    </div>
  );
}
