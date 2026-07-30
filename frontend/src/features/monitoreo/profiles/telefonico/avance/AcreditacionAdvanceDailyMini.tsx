import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { MonitoreoReportWeekday } from "../../../../../api/client";
import { PlotlyChart } from "../../../../../lib/PlotlyChart";
import { countText, fmt } from "../formato";
import { EmptyPanel } from "../EmptyPanel";
import { COLOR_RESULTADO, COLOR_SEPARADOR_BARRA } from "../../../coloresDeResultado";
import { MarcoDeEjesSiHaceFalta } from "../../../ritmo/MarcoDeEjesSiHaceFalta";
import {
  calendarReportWeekdayFromDate,
  compactAdvanceDateTickLabel,
  dailyCutsForChart,
  dailyEffectiveValue,
  dailyPointTotals,
  dailyPointTotalValue,
  expandAcreditacionDailyCalendar,
  mergeAcreditacionDailyPoints,
  normalizeCalendarReportWeekday,
  paddedAdvanceAxisMax,
  shortAdvanceDateLabel,
  sortAcreditacionDailyPoints,
  sparseDailyChartRows,
  weeklyCutsForChart,
  type AcreditacionAdvanceDailyPoint,
  type AcreditacionDailyReportCut,
} from "./ritmoDiario";

// Ritmo diario del avance, extraído del page-file congelado
// (TelefonicoMonitoreoPage.tsx) en la ola 2 del plan de performance (paso 4
// del mapa de extracción). Copia por perfil deliberada.

const SIN_CORTES_DE_REPORTE: AcreditacionDailyReportCut[] = [];

const MINI_CHART_CONFIG = {
  displayModeBar: false,
  doubleClick: false,
  responsive: true,
  scrollZoom: false,
};

export function AcreditacionAdvanceDailyMini({
  points,
  title = "Ritmo general del estudio",
  variant = "general",
  cutDate,
  reportCuts = SIN_CORTES_DE_REPORTE,
  reportWeekday = "",
  effectiveOnly = false,
  compact = false,
  compactHeight,
}: {
  points: AcreditacionAdvanceDailyPoint[];
  title?: string;
  variant?: "general" | "actor" | "source";
  cutDate?: string;
  reportCuts?: AcreditacionDailyReportCut[];
  reportWeekday?: MonitoreoReportWeekday | "";
  effectiveOnly?: boolean;
  compact?: boolean;
  compactHeight?: number;
}) {
  // Derivación memoizada (unidad 2.3): specs de Plotly estables entre
  // renders; sin esto, el deep-compare del wrapper recorría el layout
  // completo en cada render del árbol.
  const model = useMemo(
    () => buildAdvanceDailyMiniModel({ points, variant, cutDate, reportCuts, reportWeekday, effectiveOnly, compact, compactHeight }),
    [points, variant, cutDate, reportCuts, reportWeekday, effectiveOnly, compact, compactHeight],
  );
  const {
    orderedPoints, visiblePoints, totals, isCompactChart, usesEffectiveAxisBand, chartRows,
    hasDailySignal, chartData, chartLayout, chartHeight, chartSignature, averageLabel,
    dailyLabel, signalDayCount, dailyAxisMax, cumulativeAxisMax, chartBottomMargin,
    hayMarcoDeEjes, anchoDelCampo,
  } = model;
  const [readyChartSignature, setReadyChartSignature] = useState("");
  useEffect(() => {
    setReadyChartSignature("");
  }, [chartSignature]);
  const plotlyReady = Boolean(chartSignature) && readyChartSignature === chartSignature;
  const handlePlotlyReady = useCallback(() => {
    setReadyChartSignature(chartSignature);
  }, [chartSignature]);
  return (
    <article className={`mon-advance-daily-mini is-${variant}${isCompactChart ? " is-compact" : ""}`}>
      <header>
        <div>
          <span>Avance diario</span>
          <strong>{title}</strong>
          <em>{countText(signalDayCount, "día", "días")} con respuesta · {fmt(effectiveOnly ? totals.effective : totals.total)} {dailyLabel} · {averageLabel}/día</em>
        </div>
        <div className="mon-advance-daily-mini-tools">
          <div className="mon-advance-daily-mini-kpis">
            <span className="is-effective"><em>Efectivas</em><strong>{fmt(totals.effective)}</strong></span>
            {!effectiveOnly ? (
              <>
                <span className="is-partial"><em>Parciales</em><strong>{fmt(totals.partial)}</strong></span>
                <span className="is-refusals"><em>Rechazos</em><strong>{fmt(totals.refusals)}</strong></span>
              </>
            ) : null}
          </div>
          {hasDailySignal && !isCompactChart ? (
            <div className="mon-advance-daily-legend" aria-label="Leyenda de avance diario">
              <span className="is-completed">Efectivas</span>
              {!effectiveOnly ? (
                <>
                  <span className="is-partial">Parciales</span>
                  <span className="is-refusals">Rechazos</span>
                </>
              ) : null}
              <span className="is-cumulative">Acumulado</span>
            </div>
          ) : null}
        </div>
      </header>
      {hasDailySignal ? (
        <div className="mon-advance-daily-board">
          <div className={`mon-advance-line-chart${hayMarcoDeEjes ? " is-con-marco" : ""}${usesEffectiveAxisBand ? " is-phone-effective-axis" : ""}${plotlyReady ? " is-plotly-ready" : " is-plotly-loading"}`}>
            {/* Con marco, el gráfico y su banda de etiquetas viajan JUNTOS en la
                columna que se desplaza: la banda es un eje X propio y si se
                quedara fuera dejaría de alinearse con las barras al scrollear. */}
            <MarcoDeEjesSiHaceFalta
              activo={hayMarcoDeEjes}
              alto={chartHeight}
              margenInferior={chartBottomMargin}
              maximoIzquierdo={dailyAxisMax ?? 0}
              maximoDerecho={cumulativeAxisMax ?? 0}
              tituloIzquierdo={effectiveOnly ? "Efectivas/día" : "Respuestas/día"}
              anchoContenido={anchoDelCampo}
            >
            <PlotlyChart
              data={chartData}
              layout={chartLayout}
              config={MINI_CHART_CONFIG}
              height={chartHeight}
              ariaLabel={`Avance diario y acumulado: ${title}`}
              onReady={handlePlotlyReady}
            />
            {usesEffectiveAxisBand ? (
              <div
                className={`mon-phone-daily-axis-labels${isCompactChart ? " is-compact" : ""}${chartRows.length > 18 ? " is-dense" : ""}`}
                aria-label="Efectivas Kobo por día"
              >
                {chartRows.map((point) => {
                  const [monthLabel, dayLabel = ""] = point.axisLabel.split("<br>");
                  return (
                    <span key={point.date}>
                      <strong>{fmt(point.dailyTotal)}</strong>
                      <em>{monthLabel}{dayLabel ? <small>{dayLabel}</small> : null}</em>
                    </span>
                  );
                })}
              </div>
            ) : null}
            </MarcoDeEjesSiHaceFalta>
          </div>
        </div>
      ) : (
        <EmptyPanel title="Sin ritmo diario" detail="El corte todavía no trae respuestas fechadas para graficar avance." />
      )}
      {orderedPoints.length > visiblePoints.length ? (
        <div className="mon-advance-daily-loose">
          <span><strong>{fmt(visiblePoints.length)} de {fmt(orderedPoints.length)}</strong><em> días calendario visibles en el gráfico</em></span>
        </div>
      ) : null}
    </article>
  );
}

type AdvanceDailyMiniInputs = {
  points: AcreditacionAdvanceDailyPoint[];
  variant: "general" | "actor" | "source";
  cutDate?: string;
  reportCuts: AcreditacionDailyReportCut[];
  reportWeekday: MonitoreoReportWeekday | "";
  effectiveOnly: boolean;
  compact: boolean;
  compactHeight?: number;
};

// Derivación pura del gráfico. Antes vivía en el cuerpo del componente y
// reconstruía chartData/chartLayout en cada render.
function buildAdvanceDailyMiniModel({
  points,
  variant,
  cutDate,
  reportCuts,
  reportWeekday,
  effectiveOnly,
  compact,
  compactHeight,
}: AdvanceDailyMiniInputs) {
  const orderedSourcePoints = mergeAcreditacionDailyPoints(sortAcreditacionDailyPoints(points));
  const isEffectiveGeneralSource = effectiveOnly && variant === "general" && !compact;
  const orderedPoints = isEffectiveGeneralSource
    ? orderedSourcePoints.filter((point) => dailyEffectiveValue(point) > 0)
    : expandAcreditacionDailyCalendar(orderedSourcePoints, reportCuts);
  const totals = dailyPointTotals(orderedSourcePoints);
  const isCompactChart = compact && variant !== "general";
  const isEffectiveGeneralChart = isEffectiveGeneralSource && !isCompactChart;
  const usesEffectiveAxisBand = effectiveOnly && (isEffectiveGeneralChart || isCompactChart);
  const showYAxisLabels = !isCompactChart || usesEffectiveAxisBand;
  const visibleLimit = isCompactChart ? 14 : variant === "general" ? 42 : variant === "actor" ? 35 : 30;
  let cumulative = 0;
  const allChartRows = orderedPoints.map((point) => {
    const dailyTotal = effectiveOnly ? point.effective : dailyPointTotalValue(point);
    cumulative += dailyTotal;
    return {
      ...point,
      x: 0,
      axisLabel: compactAdvanceDateTickLabel(point.date),
      displayLabel: shortAdvanceDateLabel(point.date),
      dailyTotal,
      cumulative,
    };
  });
  const visiblePoints = allChartRows.slice(-visibleLimit);
  const chartRows = visiblePoints.map((point, index) => ({ ...point, x: index }));
  const hasDailySignal = chartRows.some((point) => point.dailyTotal > 0);
  const lastPoint = chartRows.at(-1) ?? null;
  const bestPoint = chartRows.reduce<typeof chartRows[number] | null>((best, point) => (
    !best || point.dailyTotal > best.dailyTotal ? point : best
  ), null);
  const averageBase = effectiveOnly ? totals.effective : totals.total;
  const averageDenominator = effectiveOnly
    ? Math.max(1, orderedSourcePoints.filter((point) => dailyEffectiveValue(point) > 0).length)
    : chartRows.length;
  const average = averageDenominator ? averageBase / averageDenominator : 0;
  const resolvedReportWeekday = normalizeCalendarReportWeekday(reportWeekday) || calendarReportWeekdayFromDate(cutDate);
  const datedCuts = dailyCutsForChart(chartRows, reportCuts);
  const inferredWeeklyCuts = datedCuts.length ? [] : weeklyCutsForChart(chartRows, resolvedReportWeekday);
  const cuts = datedCuts.length ? datedCuts : inferredWeeklyCuts.length ? inferredWeeklyCuts : dailyCutsForChart(chartRows, [], cutDate);
  const cutXSet = new Set(cuts.map((cut) => cut.x));
  const tickEvery = chartRows.length > 40 ? 7 : chartRows.length > 28 ? 5 : chartRows.length > 16 ? 3 : chartRows.length > 10 ? 2 : 1;
  const tickRows = chartRows.filter((point, index) => (
    index === 0 || index === chartRows.length - 1 || index % tickEvery === 0 || cutXSet.has(point.x)
  ));
  const cumulativeCandidates = Array.from(new Map([
    ...(chartRows.length <= 14 ? ([chartRows[0]].filter(Boolean) as typeof chartRows) : []),
    ...cuts.map((cut) => cut.point),
    ...([chartRows.at(-1)].filter(Boolean) as typeof chartRows),
  ].map((point) => [point.x, point])).values());
  const cumulativeLabelRows = isEffectiveGeneralChart
    ? []
    : sparseDailyChartRows(
      cumulativeCandidates,
      variant === "general" ? 3 : 4,
      variant === "general" ? 8 : 5,
    );
  // El techo por número de días existía porque sin scroll las etiquetas se
  // encimaban; ahora el gráfico garantiza 28 px por corte (`ritmoDiario.css`).
  const showDenseDailyLabels = isCompactChart ? chartRows.length <= 7 : true;
  const dailyLabelCandidates = usesEffectiveAxisBand
    ? []
    : showDenseDailyLabels
    ? chartRows.filter((point) => point.dailyTotal > 0)
    : Array.from(new Map([
      ...(bestPoint && bestPoint.dailyTotal > 0 ? [bestPoint] : []),
      ...(lastPoint && lastPoint.dailyTotal > 0 ? [lastPoint] : []),
      ...cuts.map((cut) => cut.point).filter((point) => point.dailyTotal > 0),
    ].map((point) => [point.x, point])).values());
  const dailyLabelRows = sparseDailyChartRows(
    dailyLabelCandidates,
    showDenseDailyLabels ? 1 : variant === "general" ? 2 : 3,
    showDenseDailyLabels ? dailyLabelCandidates.length : variant === "general" ? 8 : 5,
  );
  const dateLabelRows = isCompactChart || isEffectiveGeneralChart ? [] : chartRows;
  const xAxisTickRows = isEffectiveGeneralChart ? chartRows : tickRows;
  const xAxisTickText = isEffectiveGeneralChart
    ? xAxisTickRows.map((point) => `${fmt(point.dailyTotal)}<br>${point.axisLabel}`)
    : xAxisTickRows.map((point) => (isCompactChart ? point.displayLabel : point.axisLabel));
  const chartBottomMargin = isCompactChart ? (usesEffectiveAxisBand ? 18 : 42) : isEffectiveGeneralChart ? 30 : variant === "general" ? 86 : variant === "actor" ? 78 : 72;
  const maxDaily = chartRows.reduce((max, point) => Math.max(max, point.dailyTotal), 0);
  const maxCumulative = chartRows.reduce((max, point) => Math.max(max, point.cumulative), 0);
  const dailyAxisMax = paddedAdvanceAxisMax(maxDaily);
  const cumulativeAxisMax = paddedAdvanceAxisMax(maxCumulative);
  // Pasados los 45 cortes el gráfico se desplaza y los ejes se dibujan fuera de
  // la columna que se mueve (`MarcoDeRitmo`), así que Plotly les cede su margen.
  const hayMarcoDeEjes = !isCompactChart && chartRows.length > 45;
  const hoverData = chartRows.map((point) => [
    point.date,
    point.effective,
    point.partial,
    point.refusals,
    point.dailyTotal,
    point.cumulative,
  ]);
  const hoverTemplate = effectiveOnly
    ? [
      "<b>%{customdata[0]}</b>",
      "Efectivas Kobo <b>%{customdata[1]}</b>",
      "Acumulado <b>%{customdata[5]}</b>",
      "<extra></extra>",
    ].join("<br>")
    : [
      "<b>%{customdata[0]}</b>",
      "Efectivas %{customdata[1]} · Parciales %{customdata[2]} · Rechazos %{customdata[3]}",
      "Total día <b>%{customdata[4]}</b> · Acumulado <b>%{customdata[5]}</b>",
      "<extra></extra>",
    ].join("<br>");
  const chartData = [
    {
      type: "bar" as const,
      name: "Efectivas",
      x: chartRows.map((point) => point.x),
      y: chartRows.map((point) => point.effective),
      marker: { color: COLOR_RESULTADO.efectiva, line: { color: COLOR_SEPARADOR_BARRA, width: 0.8 } },
      customdata: hoverData,
      hovertemplate: hoverTemplate,
    },
    ...(!effectiveOnly ? [
    {
      type: "bar" as const,
      name: "Parciales",
      x: chartRows.map((point) => point.x),
      y: chartRows.map((point) => point.partial),
      marker: { color: COLOR_RESULTADO.parcial, line: { color: COLOR_SEPARADOR_BARRA, width: 0.8 } },
      customdata: hoverData,
      hovertemplate: hoverTemplate,
    },
    {
      type: "bar" as const,
      name: "Rechazos",
      x: chartRows.map((point) => point.x),
      y: chartRows.map((point) => point.refusals),
      marker: { color: COLOR_RESULTADO.rechazo, line: { color: COLOR_SEPARADOR_BARRA, width: 0.8 } },
      customdata: hoverData,
      hovertemplate: hoverTemplate,
    },
    ] : []),
    {
      type: "scatter" as const,
      mode: "lines+markers" as const,
      name: effectiveOnly ? "Acumulado Kobo" : "Acumulado total",
      x: chartRows.map((point) => point.x),
      y: chartRows.map((point) => point.cumulative),
      yaxis: "y2",
      line: { color: "#17212f", width: 3, shape: "spline" as const, smoothing: 0.45 },
      marker: {
        color: "#ffffff",
        size: variant === "general" ? 8 : 6,
        line: { color: "#17212f", width: 2 },
      },
      customdata: hoverData,
      hovertemplate: hoverTemplate,
    },
  ];
  const chartLayout = {
    barmode: "stack" as const,
    bargap: chartRows.length <= 1 ? (isCompactChart ? 0.72 : 0.5) : chartRows.length <= 7 ? 0.42 : 0.24,
    dragmode: false as const,
    font: {
      family: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
      color: "#17212f",
    },
    hovermode: "closest" as const,
    showlegend: false,
    margin: {
      l: hayMarcoDeEjes ? 0 : usesEffectiveAxisBand ? 54 : isCompactChart ? 24 : 48,
      r: hayMarcoDeEjes ? 0 : usesEffectiveAxisBand ? 56 : isCompactChart ? 28 : 58,
      t: isCompactChart ? 20 : 36,
      b: chartBottomMargin,
    },
    paper_bgcolor: "transparent",
    plot_bgcolor: "transparent",
    hoverlabel: {
      align: "left" as const,
      bgcolor: "#ffffff",
      bordercolor: "rgba(15, 23, 42, 0.12)",
      font: { color: "#17212f", size: 12, family: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" },
    },
    shapes: [
      ...cuts.map((cut) => ({
        type: "line" as const,
        xref: "x" as const,
        yref: "paper" as const,
        x0: cut.x,
        x1: cut.x,
        y0: 0,
        y1: 1,
        line: {
          color: cut.isFallback ? "rgba(190, 18, 60, 0.5)" : "rgba(15, 58, 117, 0.32)",
          width: cut.isFallback ? 1.4 : 1,
          dash: cut.isFallback ? "dash" : "dot",
        },
      })),
    ],
    annotations: [
      ...(isCompactChart ? [] : cumulativeLabelRows.map((point) => ({
        x: point.x,
        y: 1.08,
        xref: "x" as const,
        yref: "paper" as const,
        text: fmt(point.cumulative),
        showarrow: false,
        font: { color: "#0f3a75", size: 10, family: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" },
      }))),
      ...dailyLabelRows.map((point) => ({
        x: point.x,
        y: isEffectiveGeneralChart ? -0.045 : -0.08,
        xref: "x" as const,
        yref: "paper" as const,
        // Los días que cierran un reporte, en negrita: son las cifras que
        // viajan al informe. Los decide el cronograma, no el gráfico.
        text: cutXSet.has(point.x) ? `<b>${fmt(point.dailyTotal)}</b>` : fmt(point.dailyTotal),
        showarrow: false,
        xanchor: "center" as const,
        yanchor: "middle" as const,
        font: { color: COLOR_RESULTADO.efectiva, size: isEffectiveGeneralChart ? 11 : 10, family: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" },
      })),
      ...dateLabelRows.map((point) => ({
        x: point.x,
        y: isEffectiveGeneralChart ? -0.145 : -0.22,
        xref: "x" as const,
        yref: "paper" as const,
        text: point.axisLabel,
        showarrow: false,
        xanchor: "center" as const,
        yanchor: "top" as const,
        align: "center" as const,
        font: { color: "#474f5b", size: isEffectiveGeneralChart ? 11 : 10, family: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" },
      })),
    ],
    xaxis: {
      fixedrange: true,
      showgrid: false,
      zeroline: false,
      range: chartRows.length ? [-0.55, Math.max(0.55, chartRows.length - 0.45)] : undefined,
      tickangle: 0,
      tickvals: xAxisTickRows.map((point) => point.x),
      ticktext: xAxisTickText,
      showticklabels: isCompactChart && !usesEffectiveAxisBand,
      ticks: "",
      tickfont: { color: isEffectiveGeneralChart ? "#4f647a" : "#474f5b", size: isEffectiveGeneralChart ? 11 : isCompactChart ? 9 : 10 },
      automargin: true,
    },
    yaxis: {
      title: showYAxisLabels ? { text: effectiveOnly ? "Efectivas/día" : "Respuestas/día", font: { color: "#474f5b", size: usesEffectiveAxisBand ? 10 : 11 } } : undefined,
      fixedrange: true,
      range: dailyAxisMax ? [0, dailyAxisMax] : undefined,
      rangemode: "tozero",
      showline: false,
      showticklabels: showYAxisLabels,
      zeroline: false,
      gridcolor: "rgba(15, 23, 42, 0.06)",
      tickfont: { color: "#474f5b", size: usesEffectiveAxisBand ? 9 : 10 },
    },
    yaxis2: {
      title: showYAxisLabels ? { text: "Acumulado", font: { color: "#17212f", size: usesEffectiveAxisBand ? 10 : 11 } } : undefined,
      overlaying: "y",
      side: "right",
      fixedrange: true,
      range: cumulativeAxisMax ? [0, cumulativeAxisMax] : undefined,
      rangemode: "tozero",
      showgrid: false,
      showticklabels: showYAxisLabels,
      zeroline: false,
      tickfont: { color: "#17212f", size: usesEffectiveAxisBand ? 9 : 10 },
    },
  };
  const averageLabel = average ? average.toLocaleString("es-PE", { maximumFractionDigits: 1 }) : "S/D";
  const chartHeight = isCompactChart
    ? Math.max(104, (compactHeight ?? 154) - (usesEffectiveAxisBand ? 34 : 0))
    : variant === "general"
      ? (chartRows.length <= 7 ? 170 : 246)
      : 300;
  const chartSignature = chartRows.map((point) => `${point.date}:${point.dailyTotal}:${point.cumulative}`).join("|");
  const dailyLabel = effectiveOnly ? "efectivas" : "respuestas";
  const signalDayCount = orderedSourcePoints.filter((point) => (
    effectiveOnly ? point.effective : dailyPointTotalValue(point)
  ) > 0).length;
  return {
    orderedPoints, visiblePoints, totals, isCompactChart, usesEffectiveAxisBand, chartRows,
    hasDailySignal, chartData, chartLayout, chartHeight, chartSignature, averageLabel,
    dailyLabel, signalDayCount, dailyAxisMax, cumulativeAxisMax, chartBottomMargin,
    hayMarcoDeEjes, anchoDelCampo: chartRows.length * 28, effectiveOnly,
  };
}
