import { useMemo } from "react";
import type { MonitoreoReportWeekday } from "../../../../../api/client";
import { PlotlyChart } from "../../../../../lib/PlotlyChart";
import { MarcoDeRitmo } from "../../../ritmo/MarcoDeRitmo";
import { countText, fmt } from "../formato";
import { EmptyPanel } from "../EmptyPanel";
import { COLOR_RESULTADO, COLOR_SEPARADOR_BARRA } from "../../../coloresDeResultado";
import {
  calendarReportWeekdayFromDate,
  compactAdvanceDateTickLabel,
  dailyCutsForChart,
  dailyEffectiveValue,
  dailyPointTotals,
  dailyPointTotalValue,
  expandAcreditacionDailyCalendar,
  isDatedAcreditacionDailyPoint,
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
// (AcreditacionMonitoreoPage.tsx) en la ola 2 del plan de performance (paso 4
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
}: {
  points: AcreditacionAdvanceDailyPoint[];
  title?: string;
  variant?: "general" | "actor" | "source";
  cutDate?: string;
  reportCuts?: AcreditacionDailyReportCut[];
  reportWeekday?: MonitoreoReportWeekday | "";
  effectiveOnly?: boolean;
  compact?: boolean;
}) {
  // Derivación memoizada (unidad 2.3): specs de Plotly estables entre
  // renders; sin esto, el deep-compare del wrapper recorría el layout
  // completo en cada render del árbol.
  const model = useMemo(
    () => buildAdvanceDailyMiniModel({ points, variant, cutDate, reportCuts, reportWeekday, effectiveOnly, compact }),
    [points, variant, cutDate, reportCuts, reportWeekday, effectiveOnly, compact],
  );
  const {
    isCompactChart, totals, signalDayCount, dailyLabel, averageLabel, hasDailySignal,
    hayDesplazamiento, chartHeight, chartBottomMargin, dailyAxisMax, cumulativeAxisMax,
    anchoDelCampo, chartData, chartLayout, undatedResponses, hiddenLeadingDays,
  } = model;
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
          <div className={`mon-advance-line-chart${hayDesplazamiento ? " is-con-marco" : ""}`}>
            {hayDesplazamiento ? (
              <MarcoDeRitmo
                alto={chartHeight}
                margenSuperior={36}
                margenInferior={chartBottomMargin}
                ejeIzquierdo={{ titulo: effectiveOnly ? "Efectivas/día" : "Respuestas/día", maximo: dailyAxisMax ?? 0 }}
                ejeDerecho={{ titulo: "Acumulado", maximo: cumulativeAxisMax ?? 0 }}
                anchoMinimoContenido={anchoDelCampo}
              >
                <PlotlyChart
                  data={chartData}
                  layout={chartLayout}
                  config={MINI_CHART_CONFIG}
                  height={chartHeight}
                  ariaLabel={`Avance diario y acumulado: ${title}`}
                />
              </MarcoDeRitmo>
            ) : (
              <PlotlyChart
                data={chartData}
                layout={chartLayout}
                config={MINI_CHART_CONFIG}
                height={chartHeight}
                ariaLabel={`Avance diario y acumulado: ${title}`}
              />
            )}
          </div>
        </div>
      ) : (
        <EmptyPanel
          title="Sin ritmo diario"
          detail={undatedResponses > 0
            ? `${fmt(undatedResponses)} ${dailyLabel} del corte llegaron sin fecha de respuesta, así que no hay ritmo que graficar.`
            : "El corte todavía no trae respuestas fechadas para graficar avance."}
        />
      )}
      {hiddenLeadingDays > 0 || undatedResponses > 0 ? (
        <div className="mon-advance-daily-loose">
          {hiddenLeadingDays > 0 ? (
            <span>
              <strong>{countText(hiddenLeadingDays, "día", "días")} sin respuesta</strong>
              <em> ocultos antes del inicio del campo</em>
            </span>
          ) : null}
          {undatedResponses > 0 ? (
            <span>
              <strong>{fmt(undatedResponses)} {dailyLabel} sin fecha</strong>
              <em> fuera del gráfico, contadas en los totales</em>
            </span>
          ) : null}
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
}: AdvanceDailyMiniInputs) {
  const orderedSourcePoints = mergeAcreditacionDailyPoints(sortAcreditacionDailyPoints(points));
  const orderedPoints = expandAcreditacionDailyCalendar(orderedSourcePoints, reportCuts);
  const totals = dailyPointTotals(orderedSourcePoints);
  const isCompactChart = compact && variant !== "general";
  const visibleLimit = isCompactChart ? 14 : variant === "general" ? 42 : variant === "actor" ? 35 : 30;
  let cumulative = 0;
  const allChartRows = orderedPoints.map((point) => {
    const dailyTotal = effectiveOnly ? dailyEffectiveValue(point) : dailyPointTotalValue(point);
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
  // El recorte SOLO puede comerse días vacíos. Con `slice(-visibleLimit)` a
  // secas, un estudio largo perdía sus primeros días CON producción: medido el
  // 2026-07-26 en acrconta, el gráfico general arrancaba el 11/06 con 288 de
  // 429 respuestas ya acumuladas —el 65% del campo, incluido el pico real del
  // 27/05— y la curva entraba a pantalla como una meseta. La ventana arranca
  // en el menor entre la cola pedida y el primer día con respuesta: un gráfico
  // denso es preferible a uno que miente sobre el ritmo.
  const firstSignalIndex = allChartRows.findIndex((point) => point.dailyTotal > 0);
  const tailStart = Math.max(0, allChartRows.length - visibleLimit);
  const windowStart = firstSignalIndex >= 0 ? Math.min(tailStart, firstSignalIndex) : tailStart;
  const visiblePoints = allChartRows.slice(windowStart);
  const chartRows = visiblePoints.map((point, index) => ({ ...point, x: index }));
  const hasDailySignal = chartRows.some((point) => point.dailyTotal > 0);
  const lastPoint = chartRows.at(-1) ?? null;
  const bestPoint = chartRows.reduce<typeof chartRows[number] | null>((best, point) => (
    !best || point.dailyTotal > best.dailyTotal ? point : best
  ), null);
  const averageBase = effectiveOnly ? totals.effective : totals.total;
  // El promedio se calcula más abajo contra los días CON respuesta, que es lo
  // que promete la frase del encabezado ("N días con respuesta · T · X/día").
  // Dividir el total completo entre los días dibujados daba un 10.2/día cuando
  // el real era 9.5 (429 sobre 45 días con respuesta).
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
  const cumulativeLabelRows = sparseDailyChartRows(
    cumulativeCandidates,
    variant === "general" ? 3 : 4,
    variant === "general" ? 8 : 5,
  );
  // Cada barra lleva su número de efectivas.
  //
  // El techo por número de días existía porque sin scroll las etiquetas se
  // encimaban: pasados los ~42 cortes solo se rotulaban los de reporte, y el
  // resto del campo quedaba sin cifra. Ahora el gráfico garantiza 28 px por
  // corte y se desplaza (`ritmoDiario.css`), así que el ancho ya no es la
  // restricción y la densidad deja de depender de cuánto dure el campo. Los
  // mini gráficos por actor sí conservan su tope: no tienen scroll propio.
  const showDenseDailyLabels = isCompactChart ? chartRows.length <= 7 : true;
  const dailyLabelCandidates = showDenseDailyLabels
    ? chartRows.filter((point) => point.dailyTotal > 0)
    : Array.from(new Map([
      ...(bestPoint && bestPoint.dailyTotal > 0 ? [bestPoint] : []),
      ...(lastPoint && lastPoint.dailyTotal > 0 ? [lastPoint] : []),
      ...cuts.map((cut) => cut.point).filter((point) => point.dailyTotal > 0),
    ].map((point) => [point.x, point])).values());
  const dailyLabelRows = sparseDailyChartRows(
    dailyLabelCandidates,
    showDenseDailyLabels ? 1 : variant === "general" ? 2 : 3,
    // Sin tope cuando se rotulan todas: el `Math.min(42, …)` recortaba
    // justamente los días de un campo largo, que es cuando más falta hace ver
    // el detalle día a día.
    showDenseDailyLabels ? dailyLabelCandidates.length : variant === "general" ? 8 : 5,
  );
  const dateLabelRows = isCompactChart ? [] : chartRows;
  // Ancho mínimo por corte. Pasados los ~45 cortes el campo no cabe y la
  // columna central del marco se desplaza, con los ejes fuera de ella.
  const ANCHO_POR_CORTE = 28;
  const anchoDelCampo = chartRows.length * ANCHO_POR_CORTE;
  const hayDesplazamiento = !isCompactChart && chartRows.length > 45;
  const chartBottomMargin = isCompactChart ? 36 : variant === "general" ? 86 : variant === "actor" ? 78 : 72;
  const maxDaily = chartRows.reduce((max, point) => Math.max(max, point.dailyTotal), 0);
  const maxCumulative = chartRows.reduce((max, point) => Math.max(max, point.cumulative), 0);
  const dailyAxisMax = paddedAdvanceAxisMax(maxDaily);
  const cumulativeAxisMax = paddedAdvanceAxisMax(maxCumulative);
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
    bargap: chartRows.length <= 1 ? 0.72 : chartRows.length <= 7 ? 0.42 : 0.24,
    dragmode: false as const,
    font: {
      family: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
      color: "#17212f",
    },
    hovermode: "closest" as const,
    showlegend: false,
    margin: {
      // Con marco los ejes viven fuera del gráfico, así que sus márgenes se
      // ceden a las columnas laterales; los verticales se mantienen porque son
      // los que fijan dónde cae cada marca.
      l: hayDesplazamiento ? 0 : isCompactChart ? 24 : 48,
      r: hayDesplazamiento ? 0 : isCompactChart ? 28 : 58,
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
        y: -0.08,
        xref: "x" as const,
        yref: "paper" as const,
        // Los días que cierran un reporte van en negrita: son las cifras que
        // viajan al informe, y el resto es el detalle diario que las explica.
        // Cuáles son lo decide el cronograma del estudio (`reportCuts`), no el
        // gráfico.
        text: cutXSet.has(point.x) ? `<b>${fmt(point.dailyTotal)}</b>` : fmt(point.dailyTotal),
        showarrow: false,
        xanchor: "center" as const,
        yanchor: "middle" as const,
        font: { color: COLOR_RESULTADO.efectiva, size: 10, family: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" },
      })),
      ...dateLabelRows.map((point) => ({
        x: point.x,
        y: -0.22,
        xref: "x" as const,
        yref: "paper" as const,
        text: point.axisLabel,
        showarrow: false,
        xanchor: "center" as const,
        yanchor: "top" as const,
        align: "center" as const,
        font: { color: "#474f5b", size: 10, family: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" },
      })),
    ],
    xaxis: {
      fixedrange: true,
      showgrid: false,
      zeroline: false,
      range: chartRows.length ? [-0.55, Math.max(0.55, chartRows.length - 0.45)] : undefined,
      tickangle: 0,
      tickvals: tickRows.map((point) => point.x),
      ticktext: tickRows.map((point) => (isCompactChart ? point.displayLabel : point.axisLabel)),
      showticklabels: isCompactChart,
      ticks: "",
      tickfont: { color: "#474f5b", size: isCompactChart ? 9 : 10 },
      // Con marco, el margen inferior no puede moverse: es la referencia con la
      // que se calcula dónde cae cada marca de los ejes dibujados al lado.
      automargin: !hayDesplazamiento,
    },
    yaxis: {
      title: isCompactChart || hayDesplazamiento
        ? undefined
        : { text: effectiveOnly ? "Efectivas/día" : "Respuestas/día", font: { color: "#474f5b", size: 11 } },
      fixedrange: true,
      range: dailyAxisMax ? [0, dailyAxisMax] : undefined,
      rangemode: "tozero",
      showline: false,
      showticklabels: !isCompactChart && !hayDesplazamiento,
      zeroline: false,
      gridcolor: "rgba(15, 23, 42, 0.06)",
      tickfont: { color: "#474f5b", size: 10 },
    },
    yaxis2: {
      title: isCompactChart || hayDesplazamiento ? undefined : { text: "Acumulado", font: { color: "#17212f", size: 11 } },
      overlaying: "y",
      side: "right",
      fixedrange: true,
      range: cumulativeAxisMax ? [0, cumulativeAxisMax] : undefined,
      rangemode: "tozero",
      showgrid: false,
      showticklabels: !isCompactChart && !hayDesplazamiento,
      zeroline: false,
      tickfont: { color: "#17212f", size: 10 },
    },
  };
  const dailyLabel = effectiveOnly ? "efectivas" : "respuestas";
  // Solo cuentan como "días con respuesta" los que además tienen fecha: si no,
  // el encabezado prometía "9 días con respuesta" sobre un gráfico que decía
  // "el corte todavía no trae respuestas fechadas" (Administrativos, 2026-07-26).
  const datedSignalPoints = orderedSourcePoints.filter((point) => (
    dailyPointTotalValue(point) > 0 && isDatedAcreditacionDailyPoint(point)
  ));
  const undatedResponses = orderedSourcePoints
    .filter((point) => !isDatedAcreditacionDailyPoint(point))
    .reduce((sum, point) => sum + (effectiveOnly ? dailyEffectiveValue(point) : dailyPointTotalValue(point)), 0);
  const signalDayCount = datedSignalPoints.length;
  const average = signalDayCount ? averageBase / signalDayCount : 0;
  const averageLabel = average ? average.toLocaleString("es-PE", { maximumFractionDigits: 1 }) : "S/D";
  const chartHeight = isCompactChart ? 154 : variant === "general" ? 360 : 300;
  const hiddenLeadingDays = windowStart;
  return {
    isCompactChart, totals, signalDayCount, dailyLabel, averageLabel, hasDailySignal,
    hayDesplazamiento, chartHeight, chartBottomMargin, dailyAxisMax, cumulativeAxisMax,
    anchoDelCampo, chartData, chartLayout, undatedResponses, hiddenLeadingDays,
  };
}
