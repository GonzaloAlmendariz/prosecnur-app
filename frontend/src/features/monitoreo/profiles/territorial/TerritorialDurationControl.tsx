import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { BarChart3, CalendarRange, Clock, ContactRound, MapPin, ShieldAlert } from "lucide-react";
import type {
  MonitoreoTerritorialConfig,
  MonitoreoTerritorialDashboard,
  TerritorialResponseAuditRow,
} from "../../../../api/client";
import {
  compareInternalQueryDateValues,
  formatInternalQueryDateAxisLabel,
} from "../../internalQueries";

const TERRITORIAL_DURATION_VISUAL_CAP_SECONDS = 90 * 60;
const DEFAULT_DURATION_CONFIG = {
  min_duration_seconds: 60,
  max_duration_seconds: 7200,
};

const TERRITORIAL_DURATION_HISTOGRAM_BINS = [
  { start: 0, end: 60, label: "0-1 min" },
  { start: 60, end: 180, label: "1-3 min" },
  { start: 180, end: 300, label: "3-5 min" },
  { start: 300, end: 600, label: "5-10 min" },
  { start: 600, end: 900, label: "10-15 min" },
  { start: 900, end: 1200, label: "15-20 min" },
  { start: 1200, end: 1800, label: "20-30 min" },
  { start: 1800, end: 3600, label: "30-60 min" },
  { start: 3600, end: 5400, label: "60-90 min" },
];

type TerritorialDurationConfig = Pick<MonitoreoTerritorialConfig, "min_duration_seconds" | "max_duration_seconds">;

type TerritorialDurationHistogramBin = {
  key: string;
  label: string;
  start: number;
  end: number;
  count: number;
  pct: number;
  tone: "base" | "short" | "very-short";
};

type TerritorialDurationEnumeratorSummary = {
  key: string;
  label: string;
  total: number;
  median: number | null;
  p95: number | null;
  normal: number;
  short: number;
  veryShort: number;
  review: number;
  lastRecord: string;
  unassigned: boolean;
};

type TerritorialDurationModel = {
  validRows: TerritorialResponseAuditRow[];
  rowsWithDuration: TerritorialResponseAuditRow[];
  normalRows: TerritorialResponseAuditRow[];
  shortRows: TerritorialResponseAuditRow[];
  veryShortRows: TerritorialResponseAuditRow[];
  overflowRows: TerritorialResponseAuditRow[];
  histogramRows: TerritorialResponseAuditRow[];
  bins: TerritorialDurationHistogramBin[];
  median: number | null;
  p95: number | null;
  maxBinCount: number;
  visualCapSeconds: number;
  shortThresholdSeconds: number;
  enumerators: TerritorialDurationEnumeratorSummary[];
};

type TerritorialDurationDailyHover = {
  dateLabel: string;
  validas: number;
  revision: number;
  total: number;
  remainder: number;
  x: number;
};

export function TerritorialDurationControl({
  config,
  reports,
  selectedResponseId,
  onOpenGeoCase,
  onSelectResponse,
}: {
  config?: MonitoreoTerritorialConfig | null;
  reports: MonitoreoTerritorialDashboard;
  selectedResponseId?: string;
  onOpenGeoCase: (row: TerritorialResponseAuditRow) => void;
  onSelectResponse?: (responseId: string) => void;
}) {
  const durationConfig = useMemo(() => normalizeDurationConfig(config), [config]);
  const rows = reports.response_audit ?? [];
  const model = useMemo(() => buildTerritorialDurationModel(rows, durationConfig), [durationConfig, rows]);
  const reviewRows = useMemo(
    () => rows.filter((row) => row.advance_valid === true && territorialRowHasDurationObservation(row, durationConfig)),
    [durationConfig, rows],
  );
  const durationReviewRows = useMemo(
    () => mergeDurationReviewRows(model.shortRows, reviewRows),
    [model.shortRows, reviewRows],
  );
  const selectedDurationRow = useMemo(() => {
    const responseId = stringOrEmpty(selectedResponseId).trim();
    return responseId ? rows.find((row) => row.response_id === responseId) ?? null : null;
  }, [rows, selectedResponseId]);
  const durationTableRows = useMemo(
    () => selectedDurationRow ? mergeDurationReviewRows(durationReviewRows, [selectedDurationRow]) : durationReviewRows,
    [durationReviewRows, selectedDurationRow],
  );

  return (
    <div className="mon-duration-control">
      <TerritorialDurationOverview model={model} reviewCount={durationReviewRows.length} />
      <div className="mon-duration-workbench-grid">
        <TerritorialDurationHistogram model={model} />
        <TerritorialDurationDailyCard rows={reports.daily ?? []} />
      </div>
      <TerritorialDurationReviewTable
        config={durationConfig}
        rows={durationTableRows}
        selectedResponseId={selectedResponseId}
        onOpenGeoCase={onOpenGeoCase}
        onSelectResponse={onSelectResponse}
      />
      <div className="mon-duration-lower-grid">
        <TerritorialDurationEnumeratorTable rows={model.enumerators} />
      </div>
    </div>
  );
}

function TerritorialDurationOverview({ model, reviewCount }: { model: TerritorialDurationModel; reviewCount: number }) {
  return (
    <section className="mon-duration-overview" aria-label="Resumen de duración de encuestas">
      <div>
        <span><Clock size={14} /> Duración de encuestas</span>
        <strong>
          {formatMetric(model.rowsWithDuration.length)} con tiempo · {formatMetric(reviewCount)} por revisar · Mediana {formatDurationLabel(model.median)} · P95 {formatDurationLabel(model.p95)}
        </strong>
      </div>
      <dl>
        <span><dt>Mediana</dt><dd>{formatDurationLabel(model.median)}</dd></span>
        <span><dt>P95</dt><dd>{formatDurationLabel(model.p95)}</dd></span>
        <span><dt>Normal</dt><dd>{formatMetric(model.normalRows.length)}</dd></span>
        <span className={model.shortRows.length ? "is-warning" : ""}><dt>Por revisar</dt><dd>{formatMetric(model.shortRows.length)}</dd></span>
      </dl>
    </section>
  );
}

function TerritorialDurationHistogram({ model }: { model: TerritorialDurationModel }) {
  const marker = (value: number | null) => value == null
    ? null
    : `${Math.max(0, Math.min(100, (value / model.visualCapSeconds) * 100))}%`;
  const p95Outside = model.p95 != null && model.p95 > model.visualCapSeconds;
  const markers = [
    { key: "short", label: `Umbral corto: ${formatDurationLabel(model.shortThresholdSeconds)}`, value: model.shortThresholdSeconds, className: "is-short", visible: true },
    { key: "median", label: `Mediana: ${formatDurationLabel(model.median)}`, value: model.median, className: "is-median", visible: model.median == null || model.median <= model.visualCapSeconds },
    { key: "p95", label: `P95: ${formatDurationLabel(model.p95)}`, value: model.p95, className: "is-p95", visible: !p95Outside },
  ].filter((item) => item.value != null && item.visible);
  return (
    <section className="mon-duration-panel mon-duration-histogram" aria-label="Distribución de duración en minutos">
      <header>
        <div>
          <span><BarChart3 size={14} /> Distribución de duración</span>
          <strong>{formatMetric(model.histogramRows.length)} dentro de {formatDurationLabel(model.visualCapSeconds)}</strong>
        </div>
        <em>{model.overflowRows.length ? `${formatMetric(model.overflowRows.length)} fuera de escala` : "escala completa"}</em>
      </header>
      <div className="mon-duration-histogram-body">
        {model.bins.map((bin) => (
          <article key={bin.key} className={`is-${bin.tone}`}>
            <span>{bin.label}</span>
            <div>
              <i style={{ width: `${Math.max(bin.count ? 5 : 0, (bin.count / model.maxBinCount) * 100)}%` }} />
            </div>
            <strong>{formatMetric(bin.count)}</strong>
          </article>
        ))}
      </div>
      <div className="mon-duration-ruler" aria-label="Marcadores de duración con valores explícitos">
        <span>0</span>
        <span>{formatDurationLabel(model.visualCapSeconds)}</span>
        {markers.map((item) => {
          const left = marker(item.value);
          if (!left) return null;
          return (
            <b key={item.key} className={item.className} style={{ left }} title={item.label}>
              <i />
              <em>{item.label}</em>
            </b>
          );
        })}
      </div>
      {(p95Outside || model.overflowRows.length > 0) && (
        <div className="mon-duration-histogram-notes" aria-label="Notas del histograma de duración">
          {p95Outside && <span className="is-p95">P95 fuera del histograma principal: {formatDurationLabel(model.p95)}</span>}
          {model.overflowRows.length > 0 && (
            <span>{formatMetric(model.overflowRows.length)} registros quedan fuera de la escala visible del histograma.</span>
          )}
        </div>
      )}
    </section>
  );
}

function TerritorialDurationDailyCard({ rows }: { rows: MonitoreoTerritorialDashboard["daily"] }) {
  const ordered = [...rows].sort((a, b) => compareInternalQueryDateValues(a.date, b.date)).slice(-14);
  const maxTotal = Math.max(1, ...ordered.map((row) => row.total || 0));
  const scaleMax = territorialDailyScaleMax(maxTotal);
  const scaleMid = Math.round(scaleMax / 2);
  const periodTotals = ordered.reduce((acc, row) => {
    acc.total += Math.max(0, row.total || 0);
    acc.validas += Math.max(0, row.validas || 0);
    acc.revision += Math.max(0, row.revision || 0);
    return acc;
  }, { total: 0, validas: 0, revision: 0 });
  const [hover, setHover] = useState<TerritorialDurationDailyHover | null>(null);
  const showHover = (target: HTMLElement, row: MonitoreoTerritorialDashboard["daily"][number]) => {
    const validas = Math.max(0, row.validas || 0);
    const revision = Math.max(0, row.revision || 0);
    const total = Math.max(0, row.total || 0);
    setHover({
      dateLabel: territorialDailyDateLabel(row),
      validas,
      revision,
      total,
      remainder: Math.max(0, total - validas - revision),
      x: durationDailyHoverX(target),
    });
  };
  return (
    <section className="mon-duration-panel mon-duration-daily" aria-label="Ritmo diario de respuestas válidas">
      <header>
        <div>
          <span><CalendarRange size={14} /> Ritmo diario de respuestas válidas</span>
          <strong>{formatMetric(periodTotals.total)} respuestas · {formatMetric(periodTotals.validas)} válidas · {formatMetric(periodTotals.revision)} por revisar</strong>
        </div>
        <em>{formatMetric(ordered.length)} días</em>
      </header>
      <div className="mon-duration-daily-chart">
        <div className="mon-duration-daily-scale" aria-hidden="true">
          <span>0</span>
          <span>{formatMetric(scaleMid)}</span>
          <span>{formatMetric(scaleMax)}</span>
        </div>
        <div className="mon-duration-daily-rows">
          {ordered.map((row) => {
            const total = Math.max(0, row.total || 0);
            const validas = Math.max(0, row.validas || 0);
            const revision = Math.max(0, row.revision || 0);
            const remainder = Math.max(0, total - validas - revision);
            const totalWidth = Math.max(total ? 7 : 0, safePercent(total, scaleMax) ?? 0);
            const validPct = Math.max(validas ? 2 : 0, safePercent(validas, Math.max(1, total)) ?? 0);
            const reviewPct = Math.max(revision ? 2 : 0, safePercent(revision, Math.max(1, total)) ?? 0);
            const remainderPct = Math.max(remainder ? 2 : 0, 100 - validPct - reviewPct);
            const reviewRate = safePercent(revision, total);
            const dateLabel = territorialDailyDateLabel(row);
            const tooltipLabel = `${dateLabel}. Válidas: ${formatMetric(validas)}. Por revisar: ${formatMetric(revision)}. Total: ${formatMetric(total)}.`;
            return (
              <article
                key={row.date}
                tabIndex={0}
                className={revision ? "has-review" : ""}
                aria-label={tooltipLabel}
                title={tooltipLabel}
                onMouseEnter={(event) => showHover(event.currentTarget, row)}
                onFocus={(event) => showHover(event.currentTarget, row)}
                onMouseLeave={() => setHover(null)}
                onBlur={() => setHover(null)}
              >
                <time dateTime={row.date || undefined}>{dateLabel}</time>
                <div className="mon-duration-daily-track-shell">
                  <div className="mon-duration-daily-track" style={{ width: `${Math.min(100, totalWidth)}%` }}>
                    {validas > 0 && <i className="is-valid" style={{ width: `${Math.min(100, validPct)}%` }} />}
                    {revision > 0 && <i className="is-review" style={{ width: `${Math.min(100, reviewPct)}%` }} />}
                    {remainder > 0 && <i className="is-other" style={{ width: `${Math.max(0, Math.min(100, remainderPct))}%` }} />}
                  </div>
                </div>
                <div className="mon-duration-daily-value">
                  <strong>{formatMetric(total)}</strong>
                  <small>{formatMetric(validas)} V · {formatMetric(revision)} R</small>
                </div>
                <em className={revision ? "is-warning" : "is-ready"}>{formatPercentLabel(reviewRate)} revisar</em>
              </article>
            );
          })}
          {hover && <TerritorialDurationDailyTooltip item={hover} />}
        </div>
      </div>
      <footer>
        <span><i className="is-valid" /> Válidas</span>
        <span><i className="is-review" /> Por revisar</span>
        <span><i className="is-other" /> Otros del total</span>
      </footer>
    </section>
  );
}

function TerritorialDurationDailyTooltip({ item }: { item: TerritorialDurationDailyHover }) {
  return (
    <span
      className="mon-duration-daily-tooltip"
      aria-hidden="true"
      style={{ "--duration-daily-tooltip-x": `${item.x}%` } as CSSProperties}
    >
      <strong>{item.dateLabel}</strong>
      <span>Válidas: {formatMetric(item.validas)}</span>
      <span>Por revisar: {formatMetric(item.revision)}</span>
      {item.remainder > 0 && <span>Otros: {formatMetric(item.remainder)}</span>}
      <em>Total: {formatMetric(item.total)}</em>
    </span>
  );
}

function TerritorialDurationReviewTable({
  config,
  rows,
  selectedResponseId,
  onOpenGeoCase,
  onSelectResponse,
}: {
  config: TerritorialDurationConfig;
  rows: TerritorialResponseAuditRow[];
  selectedResponseId?: string;
  onOpenGeoCase: (row: TerritorialResponseAuditRow) => void;
  onSelectResponse?: (responseId: string) => void;
}) {
  const selectedResponseKey = stringOrEmpty(selectedResponseId).trim();
  const selectedRowRef = useRef<HTMLTableRowElement | null>(null);
  const ordered = [...rows].sort((a, b) => {
    const aSelected = selectedResponseKey && a.response_id === selectedResponseKey ? 0 : 1;
    const bSelected = selectedResponseKey && b.response_id === selectedResponseKey ? 0 : 1;
    if (aSelected !== bSelected) return aSelected - bSelected;
    return (durationSecondsForRow(a) ?? Infinity) - (durationSecondsForRow(b) ?? Infinity);
  });
  const orderedSignature = ordered.map((row) => row.response_id || `row-${row.row_index}`).join("|");

  useEffect(() => {
    if (!selectedResponseKey) return undefined;
    const handle = window.setTimeout(() => {
      selectedRowRef.current?.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
    }, 60);
    return () => window.clearTimeout(handle);
  }, [orderedSignature, selectedResponseKey]);

  return (
    <section className="mon-duration-review" aria-label="Casos con duración por revisar">
      <header>
        <div>
          <span><ShieldAlert size={14} /> Registros de duración</span>
          <strong>{formatMetric(ordered.length)} registros visibles</strong>
        </div>
        <em>selección actual, cortas y muy cortas por revisar</em>
      </header>
      {ordered.length ? (
        <div className="mon-duration-review-scroll">
          <table className="mon-duration-review-table">
            <thead>
              <tr>
                <th>Caso</th>
                <th>Fecha</th>
                <th>Encuestador</th>
                <th>Distrito</th>
                <th>UMP</th>
                <th>Duración</th>
                <th>Motivo</th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((row) => {
                const responseId = row.response_id || `row-${row.row_index}`;
                const selected = selectedResponseId && selectedResponseId === row.response_id;
                const durationBand = territorialDurationBand(row, config);
                const reasons = territorialDurationReviewReasonLabels(row, config);
                const nearestBlockId = stringOrEmpty(row.nearest_block_id).trim();
                return (
                  <tr
                    key={`${row.row_index}-${responseId}`}
                    ref={selected ? selectedRowRef : undefined}
                    data-response-id={row.response_id || undefined}
                    className={selected ? "is-selected" : ""}
                  >
                    <td>
                      <button
                        type="button"
                        className="mon-territorial-case-id-button"
                        title={responseId}
                        onClick={() => {
                          if (row.response_id) onSelectResponse?.(row.response_id);
                        }}
                      >
                        {shortenMiddle(responseId, 18)}
                      </button>
                      <small>Fila {formatMetric(row.row_index)}</small>
                    </td>
                    <td><strong>{territorialDurationDateLabel(row)}</strong><small>{normalizeTerritorialHourLabel(stringOrEmpty(row.submission_hour)) || "sin hora"}</small></td>
                    <td><strong>{territorialResolvedResponsibleLabel(row, true)}</strong><small>{territorialPulsoCodeLabel(row)}</small></td>
                    <td><strong>{row.distrito || "Sin distrito"}</strong><small>{row.ubigeo || row.district_code || "sin cruce"}</small></td>
                    <td>
                      {nearestBlockId ? (
                        <span className="mon-duration-map-cell">
                          <strong title={nearestBlockId}>{shortenMiddle(nearestBlockId, 18)}</strong>
                          <button
                            type="button"
                            className="mon-duration-ump-action"
                            onClick={() => onOpenGeoCase(row)}
                            title={`Ver ${nearestBlockId} en Geolocalización`}
                          >
                            <MapPin size={12} />
                            <span>Ver en mapa</span>
                          </button>
                        </span>
                      ) : (
                        <strong>S/D</strong>
                      )}
                      <small>{nearestBlockId ? row.nearest_block_type || "manzana" : "sin UMP"}</small>
                    </td>
                    <td>
                      {durationBand.hasDuration
                        ? <span className={`mon-territorial-band ${durationBand.className}`}><Clock size={13} /> {durationBand.label}</span>
                        : <span className="mon-territorial-duration-empty">No registrada</span>}
                      <small>{formatDurationLabel(row.duration_seconds)}</small>
                    </td>
                    <td>
                      <span className="mon-duration-reason-stack">
                        {reasons.map((reason) => <em key={reason}>{reason}</em>)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mon-territorial-audit-empty">Sin duraciones cortas por revisar.</div>
      )}
    </section>
  );
}

function TerritorialDurationEnumeratorTable({ rows }: { rows: TerritorialDurationEnumeratorSummary[] }) {
  return (
    <section className="mon-duration-panel mon-duration-enumerators" aria-label="Duración por encuestador">
      <header>
        <div>
          <span><ContactRound size={14} /> Duración por encuestador</span>
          <strong>{formatMetric(rows.length)} responsables</strong>
        </div>
      </header>
      <div className="mon-duration-enumerator-scroll">
        <table>
          <thead>
            <tr>
              <th>Encuestador</th>
              <th>Total</th>
              <th>Mediana</th>
              <th>P95</th>
              <th>Normal</th>
              <th>Corto</th>
              <th>Muy corto</th>
              <th>Revisar</th>
              <th>Último</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className={row.unassigned ? "is-unassigned" : ""}>
                <td><strong>{row.label}</strong></td>
                <td>{formatMetric(row.total)}</td>
                <td>{formatDurationLabel(row.median)}</td>
                <td>{formatDurationLabel(row.p95)}</td>
                <td>{formatMetric(row.normal)}</td>
                <td>{formatMetric(row.short)}</td>
                <td>{formatMetric(row.veryShort)}</td>
                <td>{formatMetric(row.review)}</td>
                <td>{row.lastRecord}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function buildTerritorialDurationModel(rows: TerritorialResponseAuditRow[], config: TerritorialDurationConfig): TerritorialDurationModel {
  const visualCapSeconds = Math.max(
    territorialShortDurationSeconds(config),
    Math.min(config.max_duration_seconds || TERRITORIAL_DURATION_VISUAL_CAP_SECONDS, TERRITORIAL_DURATION_VISUAL_CAP_SECONDS),
  );
  const validRows = rows.filter(territorialResponseIsEffective);
  const rowsWithDuration = validRows.filter((row) => durationSecondsForRow(row) != null);
  const values = rowsWithDuration
    .map(durationSecondsForRow)
    .filter((value): value is number => value != null)
    .sort((a, b) => a - b);
  const histogramRows = rowsWithDuration.filter((row) => (durationSecondsForRow(row) ?? Infinity) <= visualCapSeconds);
  const histogramValues = histogramRows.map(durationSecondsForRow).filter((value): value is number => value != null);
  const bins = TERRITORIAL_DURATION_HISTOGRAM_BINS
    .filter((bin) => bin.start < visualCapSeconds)
    .map((bin) => ({ ...bin, end: Math.min(bin.end, visualCapSeconds) }))
    .filter((bin) => bin.end > bin.start)
    .map((bin, index, allBins) => {
      const isLast = index === allBins.length - 1;
      const count = histogramValues.filter((value) => value >= bin.start && (isLast ? value <= bin.end : value < bin.end)).length;
      const pct = safePercent(count, Math.max(1, histogramValues.length)) ?? 0;
      const tone: TerritorialDurationHistogramBin["tone"] = bin.end <= config.min_duration_seconds
        ? "very-short"
        : bin.end <= territorialShortDurationSeconds(config) ? "short" : "base";
      return {
        key: `${bin.start}-${bin.end}`,
        label: bin.label,
        start: bin.start,
        end: bin.end,
        count,
        pct,
        tone,
      };
    });
  return {
    validRows,
    rowsWithDuration,
    normalRows: rowsWithDuration.filter((row) => territorialDurationOperationalStatus(row, config) === "normal"),
    shortRows: rowsWithDuration.filter((row) => territorialDurationIsShort(row, config)),
    veryShortRows: rowsWithDuration.filter((row) => territorialDurationIsVeryShort(row, config)),
    overflowRows: rowsWithDuration.filter((row) => territorialDurationExceedsVisualCap(row, visualCapSeconds)),
    histogramRows,
    bins,
    median: percentileFromSorted(values, 0.5),
    p95: percentileFromSorted(values, 0.95),
    maxBinCount: Math.max(1, ...bins.map((bin) => bin.count)),
    visualCapSeconds,
    shortThresholdSeconds: territorialShortDurationSeconds(config),
    enumerators: buildTerritorialDurationEnumeratorRows(rowsWithDuration, config),
  };
}

function buildTerritorialDurationEnumeratorRows(rows: TerritorialResponseAuditRow[], config: TerritorialDurationConfig) {
  const groups = new Map<string, { label: string; rows: TerritorialResponseAuditRow[]; unassigned: boolean }>();
  rows.forEach((row) => {
    const label = territorialResolvedResponsibleLabel(row, true);
    const key = normalizeMatch(label) || `row-${row.row_index}`;
    const current = groups.get(key) ?? {
      label,
      rows: [],
      unassigned: territorialMissingResponsibleLabel(label),
    };
    current.rows.push(row);
    groups.set(key, current);
  });
  return Array.from(groups.entries()).map(([key, item]) => {
    const values = item.rows
      .map(durationSecondsForRow)
      .filter((value): value is number => value != null)
      .sort((a, b) => a - b);
    const normal = item.rows.filter((row) => territorialDurationOperationalStatus(row, config) === "normal").length;
    const short = item.rows.filter((row) => territorialDurationOperationalStatus(row, config) === "corto").length;
    const veryShort = item.rows.filter((row) => territorialDurationIsVeryShort(row, config)).length;
    const review = short + veryShort;
    return {
      key,
      label: item.label,
      total: item.rows.length,
      median: percentileFromSorted(values, 0.5),
      p95: percentileFromSorted(values, 0.95),
      normal,
      short,
      veryShort,
      review,
      lastRecord: territorialLatestRecordLabel(item.rows),
      unassigned: item.unassigned,
    };
  }).sort((a, b) => {
    const unassignedRank = Number(a.unassigned) - Number(b.unassigned);
    if (unassignedRank !== 0) return unassignedRank;
    return b.review - a.review || b.veryShort - a.veryShort || b.total - a.total || a.label.localeCompare(b.label, "es");
  });
}

function mergeDurationReviewRows(primary: TerritorialResponseAuditRow[], fallback: TerritorialResponseAuditRow[]) {
  const byKey = new Map<string, TerritorialResponseAuditRow>();
  [...primary, ...fallback].forEach((row) => {
    const key = row.response_id || `row-${row.row_index}`;
    byKey.set(key, row);
  });
  return Array.from(byKey.values());
}

function normalizeDurationConfig(config?: MonitoreoTerritorialConfig | null): TerritorialDurationConfig {
  return {
    min_duration_seconds: numberOrFallback(config?.min_duration_seconds, DEFAULT_DURATION_CONFIG.min_duration_seconds),
    max_duration_seconds: numberOrFallback(config?.max_duration_seconds, DEFAULT_DURATION_CONFIG.max_duration_seconds),
  };
}

function territorialShortDurationSeconds(config: TerritorialDurationConfig) {
  return Math.max(300, config.min_duration_seconds * 5);
}

function durationSecondsForRow(row: TerritorialResponseAuditRow) {
  const seconds = numberOrNull(row.duration_seconds);
  return seconds != null && Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}

function percentileFromSorted(values: number[], percentile: number) {
  if (!values.length) return null;
  if (values.length === 1) return values[0];
  const position = (values.length - 1) * percentile;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return values[lower];
  const weight = position - lower;
  return values[lower] * (1 - weight) + values[upper] * weight;
}

function territorialDurationIsShort(row: TerritorialResponseAuditRow, config: TerritorialDurationConfig) {
  return territorialDurationOperationalStatus(row, config) === "corto" || territorialDurationOperationalStatus(row, config) === "muy_corto";
}

function territorialDurationIsVeryShort(row: TerritorialResponseAuditRow, config: TerritorialDurationConfig) {
  return territorialDurationOperationalStatus(row, config) === "muy_corto";
}

function territorialDurationExceedsVisualCap(row: TerritorialResponseAuditRow, visualCapSeconds: number) {
  const seconds = durationSecondsForRow(row);
  return seconds != null && seconds > visualCapSeconds;
}

type TerritorialDurationOperationalKey = "normal" | "corto" | "muy_corto";

function territorialDurationOperationalStatusFromRaw(value: unknown): TerritorialDurationOperationalKey {
  const key = normalizeMatch(value).replace(/\s+/g, "_");
  if (key === "muy_corta" || key === "muy_corto") return "muy_corto";
  if (key === "corta" || key === "corto") return "corto";
  return "normal";
}

function territorialDurationOperationalStatusFromSeconds(seconds: number | null, config: TerritorialDurationConfig): TerritorialDurationOperationalKey {
  if (seconds == null) return "normal";
  if (seconds < config.min_duration_seconds) return "muy_corto";
  if (seconds < territorialShortDurationSeconds(config)) return "corto";
  return "normal";
}

function territorialDurationHasEvaluableTime(row: Partial<TerritorialResponseAuditRow>) {
  const seconds = numberOrNull(row.duration_seconds);
  if (seconds != null && Number.isFinite(seconds) && seconds >= 0) return true;
  const direct = normalizeMatch(row.duration_operational_status).replace(/\s+/g, "_");
  if (direct === "corto" || direct === "muy_corto") return true;
  const raw = normalizeMatch(row.duration_status).replace(/\s+/g, "_");
  return ["muy_corta", "muy_corto", "corta", "corto", "esperada", "larga", "extrema"].includes(raw);
}

function territorialDurationOperationalStatus(row: Partial<TerritorialResponseAuditRow>, config: TerritorialDurationConfig): TerritorialDurationOperationalKey {
  const seconds = numberOrNull(row.duration_seconds);
  const direct = normalizeMatch(row.duration_operational_status).replace(/\s+/g, "_");
  if (direct === "corto" || direct === "muy_corto") return direct;
  const label = normalizeMatch(row.duration_operational_label);
  if (label === "muy corto") return "muy_corto";
  if (label === "corto") return "corto";
  const raw = normalizeMatch(row.duration_status).replace(/\s+/g, "_");
  if (["muy_corta", "muy_corto", "corta", "corto", "esperada", "larga", "extrema"].includes(raw)) {
    return territorialDurationOperationalStatusFromRaw(raw);
  }
  if (seconds != null) return territorialDurationOperationalStatusFromSeconds(seconds, config);
  if (direct === "normal" || label === "normal") return "normal";
  return "normal";
}

function territorialDurationOperationalClassName(key: TerritorialDurationOperationalKey) {
  return `is-duration-${key.replace("_", "-")}`;
}

function territorialDurationBand(row: TerritorialResponseAuditRow, config: TerritorialDurationConfig) {
  if (!territorialDurationHasEvaluableTime(row)) {
    return { key: "none", label: "", detail: "sin duración registrada", className: "is-duration-none", hasDuration: false };
  }
  const key = territorialDurationOperationalStatus(row, config);
  if (key === "muy_corto") {
    return { key, label: "Muy corto", detail: `< ${formatDurationLabel(config.min_duration_seconds)}`, className: territorialDurationOperationalClassName(key), hasDuration: true };
  }
  if (key === "corto") {
    return { key, label: "Corto", detail: `< ${formatDurationLabel(territorialShortDurationSeconds(config))}`, className: territorialDurationOperationalClassName(key), hasDuration: true };
  }
  return { key, label: "Normal", detail: "sin alerta operativa", className: territorialDurationOperationalClassName(key), hasDuration: true };
}

function territorialRowHasDurationObservation(row: TerritorialResponseAuditRow, config: TerritorialDurationConfig) {
  const reasons = territorialObservationReasonParts(row);
  if (!territorialDurationHasEvaluableTime(row)) return false;
  const operational = territorialDurationOperationalStatus(row, config);
  return reasons.includes("duracion_muy_corta")
    || reasons.includes("duracion_corta")
    || operational === "muy_corto"
    || operational === "corto";
}

function territorialDurationReviewReasonLabels(row: TerritorialResponseAuditRow, config: TerritorialDurationConfig) {
  const reasons: string[] = [];
  const durationBand = territorialDurationBand(row, config);
  const hasGpsReason = territorialRowHasGeoObservation(row);
  if (hasGpsReason && ["muy_corto", "corto"].includes(durationBand.key)) {
    reasons.push("Duración y GPS a revisar");
  } else if (durationBand.key === "muy_corto") {
    reasons.push("Muy corto");
  } else if (durationBand.key === "corto") {
    reasons.push("Duración corta");
  }
  if (hasGpsReason && !reasons.some((item) => item.includes("GPS"))) {
    reasons.push(row.geo_estado === "geo_sin_cruce" ? "Sin cruce territorial" : "Sin GPS");
  }
  if (territorialMissingResponsibleLabel(territorialResolvedResponsibleLabel(row, false))) reasons.push("Sin encuestador");
  return reasons.length ? reasons : ["Duración por revisar"];
}

function territorialRowHasGeoObservation(row: TerritorialResponseAuditRow) {
  const reasons = territorialObservationReasonParts(row);
  return reasons.some((reason) => reason.startsWith("gps_"))
    || ["geo_revision", "geo_no_defendible", "geo_sin_cruce", "geo_sin_gps"].includes(row.geo_estado);
}

function territorialResponseIsEffective(row: TerritorialResponseAuditRow) {
  const validationStatus = normalizeMatch(row.validation_status);
  const advanceStatus = normalizeMatch(row.advance_status);
  const observationStatus = normalizeMatch(row.observation_status);
  const consent = normalizeMatch(row.consent);
  const status = normalizeMatch(row.status);
  const nonEffectiveStatuses = new Set([
    "no defendible",
    "no valida",
    "no valido",
    "rechazo",
    "rechaza",
    "rechazado",
    "rechazada",
    "refusal",
    "rejected",
    "disqualified",
    "descalificado",
  ]);
  if (row.source_effective === false) return false;
  if (row.advance_valid === false) return false;
  if (nonEffectiveStatuses.has(validationStatus)) return false;
  if (nonEffectiveStatuses.has(advanceStatus)) return false;
  if (observationStatus === "no valida") return false;
  if (["0", "no", "false", "rechaza", "rechazo"].includes(consent)) return false;
  if (nonEffectiveStatuses.has(status)) return false;
  return true;
}

function territorialResolvedResponsibleLabel(row: TerritorialResponseAuditRow, includeCode = true) {
  const resolved = stringOrEmpty(row.responsible_display).trim();
  if (resolved) return resolved;
  return territorialCaseResponsibleLabel(row, includeCode);
}

function territorialCaseResponsibleLabel(row: TerritorialResponseAuditRow, includeCode = false) {
  const name = stringOrEmpty(row.enumerator_assigned).trim();
  const code = territorialPulsoCodeLabel(row);
  if (name && includeCode && code !== "S/D") return `${code} · ${name}`;
  if (name) return name;
  if (code !== "S/D") return "Responsable no identificado";
  return "Sin responsable asignado";
}

function territorialPulsoCodeLabel(row: TerritorialResponseAuditRow) {
  const code = stringOrEmpty(row.pulso_code_normalized || row.pulso_code || row.pulso_code_raw).trim();
  return code || "S/D";
}

function territorialMissingResponsibleLabel(value: unknown) {
  const key = normalizeMatch(value);
  return !key
    || key === "sd"
    || key === "s d"
    || /^responsable\s*\d+$/.test(key)
    || key.includes("sin responsable")
    || key.includes("sin asignar")
    || key.includes("no asignado")
    || key.includes("sin encuestador")
    || key.includes("responsable no identificado");
}

function territorialDurationDateLabel(row: TerritorialResponseAuditRow) {
  const label = stringOrEmpty(row.submission_date).trim();
  if (label) return formatInternalQueryDateAxisLabel(label);
  const iso = stringOrEmpty(row.submission_date_iso).trim();
  return formatInternalQueryDateAxisLabel(iso === "sin_fecha" ? "" : iso);
}

function territorialLatestRecordLabel(rows: TerritorialResponseAuditRow[]) {
  const dates = rows
    .map((row) => stringOrEmpty(row.submission_date_iso).trim())
    .filter((date) => date && date !== "sin_fecha")
    .sort(compareInternalQueryDateValues);
  if (!dates.length) return "S/D";
  return formatInternalQueryDateAxisLabel(dates[dates.length - 1]);
}

function territorialDailyDateLabel(row: MonitoreoTerritorialDashboard["daily"][number]) {
  const label = String(row.date_label ?? "").trim();
  if (label) return formatInternalQueryDateAxisLabel(label);
  const date = String(row.date ?? "").trim();
  return formatInternalQueryDateAxisLabel(date === "sin_fecha" ? "" : date);
}

function territorialDailyScaleMax(value: number) {
  if (value <= 0) return 1;
  if (value <= 10) return Math.max(5, value);
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = normalized <= 2 ? 0.25 : normalized <= 5 ? 0.5 : 1;
  return Math.ceil(normalized / step) * step * magnitude;
}

function durationDailyHoverX(target: HTMLElement) {
  const parent = target.parentElement?.getBoundingClientRect();
  const rect = target.getBoundingClientRect();
  if (!parent || parent.width <= 0) return 50;
  return Math.max(10, Math.min(90, ((rect.left + rect.width / 2 - parent.left) / parent.width) * 100));
}

function territorialObservationReasonParts(row: Partial<TerritorialResponseAuditRow>) {
  return [
    stringOrEmpty(row.observation_reasons),
    stringOrEmpty(row.issues),
  ].flatMap((value) => value.split(/[;,]/).map((item) => normalizeMatch(item)).filter(Boolean));
}

function normalizeTerritorialHourLabel(value: string) {
  const raw = value.trim();
  const twelveHour = raw.match(/^0?(\d{1,2}):(\d{2})\s*([ap])\.?m\.?$/i);
  if (twelveHour) return `${Number(twelveHour[1])}:${twelveHour[2]}${twelveHour[3].toLowerCase()}m`;
  const twentyFourHour = raw.match(/^([01]?\d|2[0-3]):(\d{2})(?::\d{2})?$/);
  if (twentyFourHour) {
    const hour = Number(twentyFourHour[1]);
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${twentyFourHour[2]}${hour >= 12 ? "pm" : "am"}`;
  }
  return raw;
}

function formatDurationLabel(value: number | null | undefined) {
  const seconds = numberOrNull(value);
  if (seconds == null) return "S/D";
  if (seconds < 60) return `${Math.round(seconds)} s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.round((seconds % 3600) / 60);
    return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`;
  }
  const days = Math.floor(seconds / 86400);
  const hours = Math.round((seconds % 86400) / 3600);
  return hours > 0 ? `${days} d ${hours} h` : `${days} d`;
}

function formatMetric(value: unknown, fallback = "0") {
  const number = numberOrNull(value);
  if (number == null) return fallback;
  return new Intl.NumberFormat("es-PE", { maximumFractionDigits: 0 }).format(number);
}

function formatPercentLabel(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "S/D";
  return `${Math.round(value)}%`;
}

function safePercent(value: number | null | undefined, total: number | null | undefined) {
  if (value == null || total == null || total <= 0) return null;
  return Math.min(100, (value / total) * 100);
}

function numberOrFallback(value: unknown, fallback: number) {
  const number = numberOrNull(value);
  return number == null ? fallback : number;
}

function numberOrNull(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function stringOrEmpty(value: unknown) {
  return value == null ? "" : String(value);
}

function normalizeMatch(value: unknown) {
  return stringOrEmpty(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function shortenMiddle(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  const side = Math.max(3, Math.floor((maxLength - 1) / 2));
  return `${value.slice(0, side)}...${value.slice(-side)}`;
}
