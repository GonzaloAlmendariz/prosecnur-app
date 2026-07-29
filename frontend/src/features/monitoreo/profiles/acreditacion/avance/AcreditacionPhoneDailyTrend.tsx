import { useMemo } from "react";
import type { CSSProperties } from "react";
import type { MonitoreoStateRule } from "../../../../../api/monitoreo";
import { PlotlyChart } from "../../../../../lib/PlotlyChart";
import {
  buildAcreditacionPhoneDailyPoints,
  buildAcreditacionPhoneDailyStatusSeries,
  type AcreditacionPhoneDailyPoint,
} from "../AcreditacionPhoneDailyTrend";
import { acreditacionDeclaracionesDesdeReglas } from "../AcreditacionEstadosLlamada";
import { GraficoDeEstadosPorDia } from "../telefono/GraficoDeEstadosPorDia";
import { formatMetric } from "../formato";
import { EmptyPanel } from "../EmptyPanel";
import { COLOR_RESULTADO } from "../../../coloresDeResultado";

// Ritmo diario telefónico (efectivas Kobo + apilado de estados declarados),
// extraído del page-file congelado (AcreditacionMonitoreoPage.tsx) en la ola 2
// del plan de performance. Copia por perfil deliberada. La rejilla muerta
// `AcreditacionPhoneDailyStatusBars` (sustituida por GraficoDeEstadosPorDia,
// ver telefono/apiladoEnRitmoDiario.test.ts) se retiró en esta extracción.

const SIN_FILAS_DE_ESTADO: Array<Record<string, unknown>> = [];

const SIN_REGLAS_DE_ESTADO: MonitoreoStateRule[] = [];

const TREND_CHART_CONFIG = {
  displayModeBar: false,
  doubleClick: false,
  responsive: true,
  scrollZoom: false,
};

export function AcreditacionPhoneDailyTrend({
  rows,
  statusRows = SIN_FILAS_DE_ESTADO,
  stateRules = SIN_REGLAS_DE_ESTADO,
}: {
  rows: Array<Record<string, unknown>>;
  statusRows?: Array<Record<string, unknown>>;
  stateRules?: MonitoreoStateRule[];
}) {
  // Derivación memoizada (unidad 2.3): specs de Plotly estables entre
  // renders; sin esto, el deep-compare del wrapper recorría el layout
  // completo en cada render del árbol.
  const model = useMemo(() => buildPhoneDailyTrendModel(rows, statusRows, stateRules), [rows, statusRows, stateRules]);
  const {
    declaraciones, points, statusSeries, loosePoints, chartRows, totalPeriod,
    averageLabel, bestPoint, lastPoint, chartData, chartLayout,
  } = model;
  if (!chartRows.length) {
    if (statusSeries.length) {
      return (
        <div className="mon-phone-trend" aria-label="Composición temporal de estados telefónicos">
          <EmptyPanel
            title={points.length ? "Efectivas sin fecha diaria" : "Sin efectivas diarias"}
            detail={points.length ? "El corte trae efectivas Kobo sin fecha usable; se muestran fuera del gráfico para no crear un día ficticio." : "El corte no trae efectivas Kobo con fecha, pero sí estados telefónicos del barrido."}
          />
          <GraficoDeEstadosPorDia series={statusSeries} declaraciones={declaraciones} />
          {loosePoints.length > 0 && (
            <div className="mon-phone-trend-loose">
              {loosePoints.map((point) => (
                <span key={`loose-${point.rawLabel}`}>
                  <strong>{point.label}</strong>
                  <em>{formatMetric(point.effective)} efectivas Kobo sin fecha diaria</em>
                </span>
              ))}
            </div>
          )}
        </div>
      );
    }
    if (loosePoints.length) {
      return (
        <div className="mon-phone-trend" aria-label="Efectivas Kobo sin fecha diaria">
          <EmptyPanel
            title="Efectivas sin fecha diaria"
            detail="El corte trae efectivas Kobo sin fecha usable; se muestran fuera del gráfico para no crear un día ficticio."
          />
          <div className="mon-phone-trend-loose">
            {loosePoints.map((point) => (
              <span key={`loose-${point.rawLabel}`}>
                <strong>{point.label}</strong>
                <em>{formatMetric(point.effective)} efectivas Kobo sin fecha diaria</em>
              </span>
            ))}
          </div>
        </div>
      );
    }
    return (
      <EmptyPanel
        title="Sin avance diario"
        detail="Cuando el corte traiga fecha de respuesta Kobo, aquí aparecerá el ritmo diario."
      />
    );
  }
  return (
    <div className="mon-phone-trend" aria-label="Efectivas Kobo por día">
      <header className="mon-phone-trend-head">
        <div>
          <span>Efectivas Kobo</span>
          <strong>Ritmo diario y acumulado</strong>
        </div>
        <div className="mon-phone-trend-legend" aria-label="Series">
          <span className="is-effective">Efectivas Kobo</span>
          <span className="is-cumulative">Acumulado</span>
        </div>
      </header>

      <div className="mon-phone-trend-metrics">
        <span className="is-total">
          <em>Total periodo</em>
          <strong>{formatMetric(totalPeriod)}</strong>
          <small>efectivas Kobo fechadas</small>
        </span>
        <span className="is-average">
          <em>Promedio/día</em>
          <strong>{averageLabel}</strong>
          <small>{formatMetric(chartRows.length)} cortes diarios</small>
        </span>
        <span className="is-best">
          <em>Mejor día</em>
          <strong>{bestPoint ? formatMetric(bestPoint.dailyTotal) : "S/D"}</strong>
          <small>{bestPoint?.label ?? "Sin fecha"}</small>
        </span>
        <span className="is-last">
          <em>Último corte</em>
          <strong>{lastPoint ? formatMetric(lastPoint.dailyTotal) : "S/D"}</strong>
          <small>{lastPoint?.label ?? "Sin fecha"}</small>
        </span>
      </div>

      <div className="mon-phone-trend-parallel is-single">
        {/* El número de cortes decide el ancho mínimo del gráfico: pasado el mes
            de campo, apretar 40 fechas en la caja las vuelve ilegibles, así que
            a partir de ~30 el gráfico scrollea dentro de su tarjeta. */}
        <div className="mon-phone-trend-chart" style={{ "--trend-cortes": chartRows.length } as CSSProperties}>
          <PlotlyChart
            data={chartData}
            layout={chartLayout}
            config={TREND_CHART_CONFIG}
            height={340}
            ariaLabel="Efectivas Kobo diarias y acumuladas"
          />
        </div>
      </div>

      {/* Debajo del ritmo, no al lado: son dos lecturas del mismo periodo
          —producción arriba, composición del barrido abajo— y compartir la
          fila las estrechaba a las dos. */}
      <GraficoDeEstadosPorDia series={statusSeries} declaraciones={declaraciones} />

      {loosePoints.length > 0 && (
        <div className="mon-phone-trend-loose">
          {loosePoints.map((point) => (
            <span key={`loose-${point.rawLabel}`}>
              <strong>{point.label}</strong>
              <em>{formatMetric(point.effective)} efectivas Kobo sin fecha diaria</em>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// Derivación pura del gráfico. Antes vivía en el cuerpo del componente y
// reconstruía chartData/chartLayout en cada render.
function buildPhoneDailyTrendModel(
  rows: Array<Record<string, unknown>>,
  statusRows: Array<Record<string, unknown>>,
  stateRules: MonitoreoStateRule[],
) {
  // Los colores del apilado son los que el usuario declaró en el definidor de
  // estados: gráfico y tabla leen la misma fuente y no pueden discrepar.
  const declaraciones = acreditacionDeclaracionesDesdeReglas(stateRules);
  const points = buildAcreditacionPhoneDailyPoints(rows);
  const statusSeries = buildAcreditacionPhoneDailyStatusSeries(statusRows);
  const loosePoints = points.filter((point) => !point.date);
  const datedPoints = points.filter((point) => point.date);
  const series = datedPoints;
  const pointTotal = (point: AcreditacionPhoneDailyPoint) => point.effective;
  let runningTotal = 0;
  const chartRows = series.map((point) => {
    const dailyTotal = pointTotal(point);
    runningTotal += dailyTotal;
    return {
      ...point,
      dailyTotal,
      cumulativeTotal: runningTotal,
    };
  });
  const totalPeriod = chartRows[chartRows.length - 1]?.cumulativeTotal ?? 0;
  const averagePerDay = chartRows.length ? totalPeriod / chartRows.length : 0;
  const averageLabel = averagePerDay.toLocaleString("es-PE", {
    maximumFractionDigits: averagePerDay < 10 ? 1 : 0,
  });
  const bestPoint = chartRows.reduce<(AcreditacionPhoneDailyPoint & { dailyTotal: number; cumulativeTotal: number }) | null>((best, point) => (
    !best || point.dailyTotal > best.dailyTotal ? point : best
  ), null);
  const lastPoint = [...chartRows].reverse().find((point) => point.date) ?? chartRows[chartRows.length - 1] ?? null;
  const xLabels = chartRows.map((point) => point.axisLabel || point.label);
  const hoverData = chartRows.map((point) => [
    point.label,
    point.effective,
    point.dailyTotal,
    point.cumulativeTotal,
  ]);
  const chartData = [
    {
      type: "bar" as const,
      name: "Efectivas",
      x: xLabels,
      y: chartRows.map((point) => point.effective),
      marker: { color: COLOR_RESULTADO.efectiva, line: { width: 0 } },
      customdata: hoverData,
      hovertemplate: "Efectivas: %{y}<extra></extra>",
    },
    {
      type: "scatter" as const,
      mode: "lines+markers" as const,
      name: "Acumulado",
      x: xLabels,
      y: chartRows.map((point) => point.cumulativeTotal),
      yaxis: "y2",
      line: { color: "#17212f", width: 3, shape: "spline" as const, smoothing: 0.45 },
      marker: {
        color: "#ffffff",
        size: 8,
        line: { color: "#17212f", width: 2 },
      },
      customdata: hoverData,
      hovertemplate: "Efectivas Kobo: %{customdata[2]}<br>Acumulado: %{customdata[3]}<extra></extra>",
    },
  ];
  const chartLayout = {
    barmode: "stack" as const,
    bargap: chartRows.length <= 1 ? 0.72 : chartRows.length <= 7 ? 0.42 : 0.24,
    hovermode: "x unified" as const,
    showlegend: false,
    margin: { l: 48, r: 58, t: 14, b: chartRows.length > 7 ? 70 : 48 },
    paper_bgcolor: "transparent",
    plot_bgcolor: "transparent",
    hoverlabel: {
      align: "left" as const,
      bgcolor: "#ffffff",
      bordercolor: "rgba(15, 23, 42, 0.12)",
      font: { color: "#17212f", size: 12 },
    },
    xaxis: {
      type: "category",
      fixedrange: true,
      showgrid: false,
      zeroline: false,
      tickangle: chartRows.length > 7 ? -32 : 0,
      tickfont: { color: "#474f5b", size: 10 },
      automargin: true,
    },
    yaxis: {
      title: { text: "Efectivas/día", font: { color: "#474f5b", size: 11 } },
      fixedrange: true,
      rangemode: "tozero",
      showline: false,
      zeroline: false,
      gridcolor: "rgba(15, 23, 42, 0.08)",
      tickfont: { color: "#474f5b", size: 10 },
    },
    yaxis2: {
      title: { text: "Acumulado", font: { color: "#17212f", size: 11 } },
      overlaying: "y",
      side: "right",
      fixedrange: true,
      rangemode: "tozero",
      showgrid: false,
      zeroline: false,
      tickfont: { color: "#17212f", size: 10 },
    },
  };
  return {
    declaraciones, points, statusSeries, loosePoints, chartRows, totalPeriod,
    averageLabel, bestPoint, lastPoint, chartData, chartLayout,
  };
}
