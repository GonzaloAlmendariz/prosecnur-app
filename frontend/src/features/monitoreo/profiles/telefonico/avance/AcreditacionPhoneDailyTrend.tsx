import { useMemo } from "react";
import type { CSSProperties } from "react";
import { PlotlyChart } from "../../../../../lib/PlotlyChart";
import {
  buildAcreditacionPhoneDailyPoints,
  buildAcreditacionPhoneDailyStatusSeries,
  type AcreditacionPhoneDailyPoint,
  type AcreditacionPhoneDailyStatusSeries,
} from "../TelefonicoPhoneDailyTrend";
import { formatMetric, normalizeSourceMatch } from "../formato";
import { EmptyPanel } from "../EmptyPanel";
import { phoneStatusPalette, phoneStatusTone } from "./ritmoDiario";
import { COLOR_RESULTADO } from "../../../coloresDeResultado";

// Ritmo diario telefónico (efectivas Kobo + estados del barrido), extraído
// del page-file congelado (TelefonicoMonitoreoPage.tsx) en la ola 2 del plan
// de performance. Copia por perfil deliberada.

function AcreditacionPhoneDailyStatusBars({ series }: { series: AcreditacionPhoneDailyStatusSeries[] }) {
  if (!series.length) return null;
  const preparedSeries = series.map((item) => {
    const datedPoints = item.points.filter((point) => point.date);
    const datedTotal = datedPoints.reduce((sum, point) => sum + point.value, 0);
    const undatedTotal = item.points.reduce((sum, point) => sum + (!point.date ? point.value : 0), 0);
    return { ...item, points: datedPoints, datedTotal, undatedTotal };
  });
  const visibleSeries = preparedSeries.filter((item) => item.datedTotal > 0).slice(0, 8);
  const maxPoint = Math.max(1, ...visibleSeries.flatMap((item) => item.points.map((point) => point.value)));
  const total = series.reduce((sum, item) => sum + item.total, 0);
  const datedTotal = preparedSeries.reduce((sum, item) => sum + item.datedTotal, 0);
  const undatedSeries = preparedSeries.filter((item) => item.undatedTotal > 0).slice(0, 6);
  const undatedTotal = preparedSeries.reduce((sum, item) => sum + item.undatedTotal, 0);
  return (
    <div className="mon-phone-status-daily" aria-label="Estados telefónicos por día">
      <header className="mon-phone-status-daily-head">
        <div>
          <span>Estados telefónicos</span>
          <strong>Lectura paralela por día</strong>
        </div>
        <em>{formatMetric(datedTotal)} con fecha / {formatMetric(total)} total</em>
      </header>
      {visibleSeries.length ? (
        <div className="mon-phone-status-daily-grid">
          {visibleSeries.map((item) => {
            const palette = phoneStatusPalette(item.label);
            return (
              <section
                key={`phone-status-day-${normalizeSourceMatch(item.label)}`}
                className={`is-${phoneStatusTone(item.label)}`}
                style={{
                  "--phone-status-color": palette.color,
                  "--phone-status-color-hi": palette.highlight,
                } as CSSProperties}
              >
                <div className="mon-phone-status-daily-title">
                  <strong>{item.label}</strong>
                  <em>{formatMetric(item.datedTotal)}</em>
                </div>
                <div className="mon-phone-status-daily-bars" aria-label={`${item.label}: distribución diaria`}>
                  {item.points.map((point) => {
                    const size = point.value > 0 ? Math.max(5, Math.min(100, (point.value / maxPoint) * 100)) : 0;
                    return (
                      <span key={`${item.label}-${point.rawLabel}`} title={`${item.label} · ${point.label}: ${formatMetric(point.value)}`}>
                        <i style={{ "--phone-status-day": `${size}%` } as CSSProperties} />
                        <small>{point.axisLabel || point.label}</small>
                        <b>{formatMetric(point.value)}</b>
                      </span>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <p className="mon-phone-status-note">El barrido trae estados telefónicos, pero todavía no tienen una fecha diaria usable para graficar.</p>
      )}
      {undatedTotal > 0 && (
        <div className="mon-phone-status-undated" aria-label="Estados telefónicos sin fecha diaria">
          <strong>{formatMetric(undatedTotal)} casos sin fecha fuera del ritmo diario</strong>
          <div>
            {undatedSeries.map((item) => (
              <span key={`phone-status-undated-${normalizeSourceMatch(item.label)}`}>
                {item.label} <b>{formatMetric(item.undatedTotal)}</b>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const SIN_FILAS_DE_ESTADO: Array<Record<string, unknown>> = [];

const TREND_CHART_CONFIG = {
  displayModeBar: false,
  doubleClick: false,
  responsive: true,
  scrollZoom: false,
};

export function AcreditacionPhoneDailyTrend({
  rows,
  statusRows = SIN_FILAS_DE_ESTADO,
}: {
  rows: Array<Record<string, unknown>>;
  statusRows?: Array<Record<string, unknown>>;
}) {
  // Derivación memoizada (unidad 2.3): specs de Plotly estables entre
  // renders; sin esto, el deep-compare del wrapper recorría el layout
  // completo en cada render del árbol.
  const model = useMemo(() => buildPhoneDailyTrendModel(rows, statusRows), [rows, statusRows]);
  const {
    points, statusSeries, loosePoints, chartRows, totalPeriod, averageLabel,
    bestPoint, lastPoint, chartData, chartLayout,
  } = model;
  if (!chartRows.length) {
    if (statusSeries.length) {
      return (
        <div className="mon-phone-trend" aria-label="Composición temporal de estados telefónicos">
          <EmptyPanel
            title={points.length ? "Efectivas sin fecha diaria" : "Sin efectivas diarias"}
            detail={points.length ? "El corte trae efectivas Kobo sin fecha usable; se muestran fuera del gráfico para no crear un día ficticio." : "El corte no trae efectivas Kobo con fecha, pero sí estados telefónicos del barrido."}
          />
          <AcreditacionPhoneDailyStatusBars series={statusSeries} />
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

      <div className={`mon-phone-trend-parallel${statusSeries.length ? "" : " is-single"}`}>
        <div className="mon-phone-trend-chart" style={{ "--trend-cortes": chartRows.length } as CSSProperties}>
          <PlotlyChart
            data={chartData}
            layout={chartLayout}
            config={TREND_CHART_CONFIG}
            height={340}
            ariaLabel="Efectivas Kobo diarias y acumuladas"
          />
        </div>

        <AcreditacionPhoneDailyStatusBars series={statusSeries} />
      </div>

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
) {
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
    bargap: chartRows.length <= 1 ? 0.5 : chartRows.length <= 7 ? 0.42 : 0.24,
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
    points, statusSeries, loosePoints, chartRows, totalPeriod, averageLabel,
    bestPoint, lastPoint, chartData, chartLayout,
  };
}
