import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { CalendarRange, Clock, ContactRound, MapPin, ShieldAlert } from "lucide-react";
import type {
  MonitoreoTerritorialConfig,
  MonitoreoTerritorialDashboard,
  TerritorialResponseAuditRow,
} from "../../../../api/client";
import {
  compareInternalQueryDateValues,
  formatInternalQueryDateAxisLabel,
} from "../../internalQueries";
import {
  TERRITORIAL_DURATION_SHORT_SECONDS,
  TERRITORIAL_DURATION_VERY_SHORT_SECONDS,
  type TerritorialDurationOperationalKey,
  territorialDurationIsReviewStatus,
  territorialDurationOperationalStatusFromValues,
  territorialDurationReviewPriority,
} from "../../territorialDuration";

type TerritorialDurationCategorySummary = {
  key: TerritorialDurationOperationalKey;
  label: string;
  detail: string;
  count: number;
  rows: TerritorialResponseAuditRow[];
  className: string;
  caption: string;
};

type TerritorialDurationEnumeratorSummary = {
  key: string;
  label: string;
  total: number;
  normal: number;
  short: number;
  veryShort: number;
  outsideNormal: number;
  lastRecord: string;
  unassigned: boolean;
};

type TerritorialDurationDailyStatusSummary = {
  key: string;
  dateValue: string;
  dateLabel: string;
  total: number;
  normal: number;
  short: number;
  veryShort: number;
};

type TerritorialDurationModel = {
  validRows: TerritorialResponseAuditRow[];
  rowsWithDuration: TerritorialResponseAuditRow[];
  normalRows: TerritorialResponseAuditRow[];
  shortRows: TerritorialResponseAuditRow[];
  veryShortRows: TerritorialResponseAuditRow[];
  reviewRows: TerritorialResponseAuditRow[];
  categories: TerritorialDurationCategorySummary[];
  dailyStatuses: TerritorialDurationDailyStatusSummary[];
  shortThresholdSeconds: number;
  veryShortThresholdSeconds: number;
  enumerators: TerritorialDurationEnumeratorSummary[];
};

type TerritorialDurationDailyHover = {
  dateLabel: string;
  total: number;
  normal: number;
  short: number;
  veryShort: number;
  x: number;
};

function TerritorialDurationControlImpl({
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
  void config;
  const rows = reports.response_audit ?? [];
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const didResetScrollRef = useRef(false);
  const model = useMemo(() => buildTerritorialDurationModel(rows), [rows]);
  const reviewRows = useMemo(
    () => rows.filter((row) => row.advance_valid === true && territorialRowHasDurationObservation(row)),
    [rows],
  );
  const durationReviewRows = useMemo(
    () => mergeDurationReviewRows(model.reviewRows, reviewRows),
    [model.reviewRows, reviewRows],
  );
  const selectedDurationRow = useMemo(() => {
    const responseId = stringOrEmpty(selectedResponseId).trim();
    return responseId ? rows.find((row) => row.response_id === responseId) ?? null : null;
  }, [rows, selectedResponseId]);
  const durationTableRows = useMemo(
    () => selectedDurationRow ? mergeDurationReviewRows(durationReviewRows, [selectedDurationRow]) : durationReviewRows,
    [durationReviewRows, selectedDurationRow],
  );

  useEffect(() => {
    if (didResetScrollRef.current) return;
    scrollAreaRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });
    didResetScrollRef.current = true;
  }, []);

  return (
    <div className="mon-duration-control">
      <TerritorialDurationOverview model={model} />
      <div ref={scrollAreaRef} className="mon-duration-scroll-area">
        <div className="mon-duration-workbench-grid">
          <TerritorialDurationCategoriesPanel model={model} />
          <TerritorialDurationDailyCard rows={model.dailyStatuses} />
        </div>
        <TerritorialDurationReviewTable
          rows={durationTableRows}
          selectedResponseId={selectedResponseId}
          onOpenGeoCase={onOpenGeoCase}
          onSelectResponse={onSelectResponse}
        />
        <div className="mon-duration-lower-grid">
          <TerritorialDurationEnumeratorTable rows={model.enumerators} />
        </div>
      </div>
    </div>
  );
}

function TerritorialDurationOverview({ model }: { model: TerritorialDurationModel }) {
  return (
    <section className="mon-duration-overview" aria-label="Resumen de duración de encuestas">
      <div>
        <span><Clock size={14} /> Duración de encuestas</span>
        <strong>
          {formatMetric(model.rowsWithDuration.length)} entrevistas con tiempo · {formatMetric(model.normalRows.length)} normales · {formatMetric(model.shortRows.length)} cortas · {formatMetric(model.veryShortRows.length)} muy cortas
        </strong>
      </div>
      <dl>
        <span><dt>Normal</dt><dd>{formatMetric(model.normalRows.length)}</dd></span>
        <span className={model.shortRows.length ? "is-warning" : ""}><dt>Corta</dt><dd>{formatMetric(model.shortRows.length)}</dd></span>
        <span className={model.veryShortRows.length ? "is-danger" : ""}><dt>Muy corta</dt><dd>{formatMetric(model.veryShortRows.length)}</dd></span>
      </dl>
    </section>
  );
}

function TerritorialDurationCategoriesPanel({ model }: { model: TerritorialDurationModel }) {
  const total = Math.max(1, model.rowsWithDuration.length);
  return (
    <section className="mon-duration-panel mon-duration-categories" aria-label="Tres categorías operativas de duración">
      <header>
        <div>
          <span><Clock size={14} /> Calidad del tiempo</span>
          <strong>Normal · Corta (&lt;5 min) · Muy corta (&lt;2 min)</strong>
        </div>
        <em>{model.reviewRows.length ? `${formatMetric(model.reviewRows.length)} cortas/muy cortas` : "todo normal"}</em>
      </header>
      <div className="mon-duration-category-grid">
        {model.categories.map((category) => (
          <article key={category.key} className={category.className}>
            <span><i /> {category.label}</span>
            <strong>{formatMetric(category.count)}</strong>
            <em>{category.detail}</em>
            <div aria-hidden="true">
              <i style={{ width: `${Math.max(category.count ? 5 : 0, (category.count / total) * 100)}%` }} />
            </div>
            <p>{category.caption}</p>
          </article>
        ))}
      </div>
      <div className="mon-duration-rule-row" aria-label="Reglas operativas de duración">
        <span><strong>Muy corta</strong><b>&lt; {formatDurationLabel(model.veryShortThresholdSeconds)}</b></span>
        <span><strong>Corta</strong><b>{formatDurationLabel(model.veryShortThresholdSeconds)} a &lt; {formatDurationLabel(model.shortThresholdSeconds)}</b></span>
        <span><strong>Normal</strong><b>&ge; {formatDurationLabel(model.shortThresholdSeconds)}</b></span>
      </div>
    </section>
  );
}

function TerritorialDurationDailyCard({ rows }: { rows: TerritorialDurationDailyStatusSummary[] }) {
  const ordered = [...rows].sort((a, b) => compareInternalQueryDateValues(a.dateValue, b.dateValue)).slice(-14);
  const maxTotal = Math.max(1, ...ordered.map((row) => row.total || 0));
  const scaleMax = territorialDailyScaleMax(maxTotal);
  const periodTotals = ordered.reduce((acc, row) => {
    acc.total += Math.max(0, row.total || 0);
    acc.normal += Math.max(0, row.normal || 0);
    acc.short += Math.max(0, row.short || 0);
    acc.veryShort += Math.max(0, row.veryShort || 0);
    return acc;
  }, { total: 0, normal: 0, short: 0, veryShort: 0 });
  const [hover, setHover] = useState<TerritorialDurationDailyHover | null>(null);
  const showHover = (target: HTMLElement, row: TerritorialDurationDailyStatusSummary) => {
    const normal = Math.max(0, row.normal || 0);
    const short = Math.max(0, row.short || 0);
    const veryShort = Math.max(0, row.veryShort || 0);
    const total = Math.max(0, row.total || 0);
    setHover({
      dateLabel: row.dateLabel,
      total,
      normal,
      short,
      veryShort,
      x: durationDailyHoverX(target),
    });
  };
  return (
    <section className="mon-duration-panel mon-duration-daily" aria-label="Ritmo diario por estado de duración">
      <header>
        <div>
          <span><CalendarRange size={14} /> Ritmo por estado</span>
          <strong>{formatMetric(periodTotals.normal)} normales · {formatMetric(periodTotals.short)} cortas · {formatMetric(periodTotals.veryShort)} muy cortas</strong>
        </div>
        <em>{formatMetric(ordered.length)} días</em>
      </header>
      <div className="mon-duration-daily-chart">
        <div className="mon-duration-daily-rows">
          {ordered.map((row) => {
            const total = Math.max(0, row.total || 0);
            const normal = Math.max(0, row.normal || 0);
            const short = Math.max(0, row.short || 0);
            const veryShort = Math.max(0, row.veryShort || 0);
            const totalWidth = Math.max(total ? 7 : 0, safePercent(total, scaleMax) ?? 0);
            const normalPct = Math.max(normal ? 2 : 0, safePercent(normal, Math.max(1, total)) ?? 0);
            const shortPct = Math.max(short ? 2 : 0, safePercent(short, Math.max(1, total)) ?? 0);
            const veryShortPct = Math.max(veryShort ? 2 : 0, safePercent(veryShort, Math.max(1, total)) ?? 0);
            const tooltipLabel = `${row.dateLabel}. Normal: ${formatMetric(normal)}. Corta: ${formatMetric(short)}. Muy corta: ${formatMetric(veryShort)}. Total: ${formatMetric(total)}.`;
            const stateLabel = veryShort
              ? `${formatMetric(veryShort)} muy corta${veryShort === 1 ? "" : "s"}`
              : short
                ? `${formatMetric(short)} corta${short === 1 ? "" : "s"}`
                : "normal";
            return (
              <article
                key={row.key}
                tabIndex={0}
                className={veryShort ? "has-very-short" : short ? "has-short" : ""}
                aria-label={tooltipLabel}
                title={tooltipLabel}
                onMouseEnter={(event) => showHover(event.currentTarget, row)}
                onFocus={(event) => showHover(event.currentTarget, row)}
                onMouseLeave={() => setHover(null)}
                onBlur={() => setHover(null)}
              >
                <time dateTime={row.dateValue === "sin_fecha" ? undefined : row.dateValue}>{row.dateLabel}</time>
                <div className="mon-duration-daily-track-shell">
                  <div className="mon-duration-daily-track" style={{ width: `${Math.min(100, totalWidth)}%` }}>
                    {normal > 0 && <i className="is-normal" style={{ width: `${Math.min(100, normalPct)}%` }} />}
                    {short > 0 && <i className="is-short" style={{ width: `${Math.min(100, shortPct)}%` }} />}
                    {veryShort > 0 && <i className="is-very-short" style={{ width: `${Math.min(100, veryShortPct)}%` }} />}
                  </div>
                </div>
                <div className="mon-duration-daily-value">
                  <strong>{formatMetric(total)}</strong>
                  <small>{formatMetric(normal)} N · {formatMetric(short)} C · {formatMetric(veryShort)} MC</small>
                </div>
                <em className={veryShort ? "is-danger" : short ? "is-warning" : "is-ready"}>{stateLabel}</em>
              </article>
            );
          })}
        </div>
        {hover && <TerritorialDurationDailyTooltip item={hover} />}
      </div>
      <footer>
        <span><i className="is-normal" /> Normal</span>
        <span><i className="is-short" /> Corta</span>
        <span><i className="is-very-short" /> Muy corta</span>
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
      <span>Normal: {formatMetric(item.normal)}</span>
      <span>Corta: {formatMetric(item.short)}</span>
      <span>Muy corta: {formatMetric(item.veryShort)}</span>
      <em>Total: {formatMetric(item.total)}</em>
    </span>
  );
}

function TerritorialDurationReviewTable({
  rows,
  selectedResponseId,
  onOpenGeoCase,
  onSelectResponse,
}: {
  rows: TerritorialResponseAuditRow[];
  selectedResponseId?: string;
  onOpenGeoCase: (row: TerritorialResponseAuditRow) => void;
  onSelectResponse?: (responseId: string) => void;
}) {
  const ordered = [...rows].sort((a, b) => {
    const aPriority = territorialDurationReviewPriority(territorialDurationOperationalStatus(a));
    const bPriority = territorialDurationReviewPriority(territorialDurationOperationalStatus(b));
    if (aPriority !== bPriority) return aPriority - bPriority;
    return (durationSecondsForRow(a) ?? Infinity) - (durationSecondsForRow(b) ?? Infinity);
  });

  return (
    <section className="mon-duration-review" aria-label="Casos por estado de duración">
      <header>
        <div>
          <span><ShieldAlert size={14} /> Casos de tiempo corto</span>
          <strong>{formatMetric(ordered.length)} registros visibles</strong>
        </div>
        <em>muy corta primero, luego corta</em>
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
                <th>Estado operativo</th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((row) => {
                const responseId = row.response_id || `row-${row.row_index}`;
                const selected = selectedResponseId && selectedResponseId === row.response_id;
                const durationBand = territorialDurationBand(row);
                const reasons = territorialDurationReviewReasonLabels(row);
                const nearestBlockId = stringOrEmpty(row.nearest_block_id).trim();
                return (
                  <tr
                    key={`${row.row_index}-${responseId}`}
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
        <div className="mon-territorial-audit-empty">Sin entrevistas cortas o muy cortas en este corte.</div>
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
              <th>Normal</th>
              <th>Corta</th>
              <th>Muy corta</th>
              <th>Último</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className={row.unassigned ? "is-unassigned" : ""}>
                <td><strong>{row.label}</strong></td>
                <td>{formatMetric(row.total)}</td>
                <td>{formatMetric(row.normal)}</td>
                <td>{formatMetric(row.short)}</td>
                <td>{formatMetric(row.veryShort)}</td>
                <td>{row.lastRecord}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function buildTerritorialDurationModel(rows: TerritorialResponseAuditRow[]): TerritorialDurationModel {
  const validRows = rows.filter(territorialResponseIsEffective);
  const rowsWithDuration = validRows.filter((row) => durationSecondsForRow(row) != null);
  const normalRows = rowsWithDuration.filter((row) => territorialDurationOperationalStatus(row) === "normal");
  const shortRows = rowsWithDuration.filter((row) => territorialDurationOperationalStatus(row) === "corto");
  const veryShortRows = rowsWithDuration.filter((row) => territorialDurationOperationalStatus(row) === "muy_corto");
  const reviewRows = rowsWithDuration.filter((row) => territorialDurationIsReviewStatus(territorialDurationOperationalStatus(row)));
  const categories: TerritorialDurationCategorySummary[] = [
    {
      key: "normal",
      label: "Normal",
      detail: `>= ${formatDurationLabel(TERRITORIAL_DURATION_SHORT_SECONDS)}`,
      count: normalRows.length,
      rows: normalRows,
      className: "is-normal",
      caption: "Entrevistas con tiempo suficiente para considerarse esperadas.",
    },
    {
      key: "corto",
      label: "Corta",
      detail: `${formatDurationLabel(TERRITORIAL_DURATION_VERY_SHORT_SECONDS)} a < ${formatDurationLabel(TERRITORIAL_DURATION_SHORT_SECONDS)}`,
      count: shortRows.length,
      rows: shortRows,
      className: "is-short",
      caption: "Estado Corta: debajo de 5 min y desde 2 min.",
    },
    {
      key: "muy_corto",
      label: "Muy corta",
      detail: `< ${formatDurationLabel(TERRITORIAL_DURATION_VERY_SHORT_SECONDS)}`,
      count: veryShortRows.length,
      rows: veryShortRows,
      className: "is-very-short",
      caption: "Estado Muy corta: debajo de 2 min, prioridad más alta.",
    },
  ];
  return {
    validRows,
    rowsWithDuration,
    normalRows,
    shortRows,
    veryShortRows,
    reviewRows,
    categories,
    dailyStatuses: buildTerritorialDurationDailyRows(rowsWithDuration),
    shortThresholdSeconds: TERRITORIAL_DURATION_SHORT_SECONDS,
    veryShortThresholdSeconds: TERRITORIAL_DURATION_VERY_SHORT_SECONDS,
    enumerators: buildTerritorialDurationEnumeratorRows(rowsWithDuration),
  };
}

function buildTerritorialDurationEnumeratorRows(rows: TerritorialResponseAuditRow[]) {
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
    const normal = item.rows.filter((row) => territorialDurationOperationalStatus(row) === "normal").length;
    const short = item.rows.filter((row) => territorialDurationOperationalStatus(row) === "corto").length;
    const veryShort = item.rows.filter((row) => territorialDurationOperationalStatus(row) === "muy_corto").length;
    const outsideNormal = short + veryShort;
    return {
      key,
      label: item.label,
      total: item.rows.length,
      normal,
      short,
      veryShort,
      outsideNormal,
      lastRecord: territorialLatestRecordLabel(item.rows),
      unassigned: item.unassigned,
    };
  }).sort((a, b) => {
    const unassignedRank = Number(a.unassigned) - Number(b.unassigned);
    if (unassignedRank !== 0) return unassignedRank;
    return b.outsideNormal - a.outsideNormal || b.veryShort - a.veryShort || b.total - a.total || a.label.localeCompare(b.label, "es");
  });
}

function buildTerritorialDurationDailyRows(rows: TerritorialResponseAuditRow[]): TerritorialDurationDailyStatusSummary[] {
  const groups = new Map<string, TerritorialDurationDailyStatusSummary>();
  rows.forEach((row) => {
    const dateValue = territorialDurationDailyDateValue(row);
    const key = dateValue || "sin_fecha";
    const current = groups.get(key) ?? {
      key,
      dateValue: key,
      dateLabel: territorialDurationDailyDateLabelFromValue(key),
      total: 0,
      normal: 0,
      short: 0,
      veryShort: 0,
    };
    current.total += 1;
    const status = territorialDurationOperationalStatus(row);
    if (status === "muy_corto") current.veryShort += 1;
    else if (status === "corto") current.short += 1;
    else current.normal += 1;
    groups.set(key, current);
  });
  return Array.from(groups.values()).sort((a, b) => compareInternalQueryDateValues(a.dateValue, b.dateValue));
}

function mergeDurationReviewRows(primary: TerritorialResponseAuditRow[], fallback: TerritorialResponseAuditRow[]) {
  const byKey = new Map<string, TerritorialResponseAuditRow>();
  [...primary, ...fallback].forEach((row) => {
    const key = row.response_id || `row-${row.row_index}`;
    byKey.set(key, row);
  });
  return Array.from(byKey.values());
}

function durationSecondsForRow(row: TerritorialResponseAuditRow) {
  const seconds = numberOrNull(row.duration_seconds);
  return seconds != null && Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}

function territorialDurationHasEvaluableTime(row: Partial<TerritorialResponseAuditRow>) {
  const seconds = numberOrNull(row.duration_seconds);
  if (seconds != null && Number.isFinite(seconds) && seconds >= 0) return true;
  const direct = normalizeMatch(row.duration_operational_status).replace(/\s+/g, "_");
  if (direct === "corto" || direct === "muy_corto") return true;
  const raw = normalizeMatch(row.duration_status).replace(/\s+/g, "_");
  return ["muy_corta", "muy_corto", "corta", "corto", "esperada", "larga", "extrema"].includes(raw);
}

function territorialDurationOperationalStatus(row: Partial<TerritorialResponseAuditRow>): TerritorialDurationOperationalKey {
  const seconds = numberOrNull(row.duration_seconds);
  return territorialDurationOperationalStatusFromValues({
    seconds,
    durationStatus: row.duration_status,
    durationOperationalStatus: row.duration_operational_status,
    durationOperationalLabel: row.duration_operational_label,
  });
}

function territorialDurationOperationalClassName(key: TerritorialDurationOperationalKey) {
  return `is-duration-${key.replace("_", "-")}`;
}

function territorialDurationBand(row: TerritorialResponseAuditRow) {
  if (!territorialDurationHasEvaluableTime(row)) {
    return { key: "none", label: "", detail: "sin duración registrada", className: "is-duration-none", hasDuration: false };
  }
  const key = territorialDurationOperationalStatus(row);
  if (key === "muy_corto") {
    return { key, label: "Muy corta", detail: `< ${formatDurationLabel(TERRITORIAL_DURATION_VERY_SHORT_SECONDS)}`, className: territorialDurationOperationalClassName(key), hasDuration: true };
  }
  if (key === "corto") {
    return { key, label: "Corta", detail: `${formatDurationLabel(TERRITORIAL_DURATION_VERY_SHORT_SECONDS)}-${formatDurationLabel(TERRITORIAL_DURATION_SHORT_SECONDS)}`, className: territorialDurationOperationalClassName(key), hasDuration: true };
  }
  return { key, label: "Normal", detail: "sin alerta operativa", className: territorialDurationOperationalClassName(key), hasDuration: true };
}

function territorialRowHasDurationObservation(row: TerritorialResponseAuditRow) {
  const reasons = territorialObservationReasonParts(row);
  if (!territorialDurationHasEvaluableTime(row)) return false;
  const operational = territorialDurationOperationalStatus(row);
  return reasons.includes("duracion_muy_corta")
    || reasons.includes("duracion_corta")
    || operational === "muy_corto"
    || operational === "corto";
}

function territorialDurationReviewReasonLabels(row: TerritorialResponseAuditRow) {
  const reasons: string[] = [];
  const durationBand = territorialDurationBand(row);
  const hasGpsReason = territorialRowHasGeoObservation(row);
  if (hasGpsReason && ["muy_corto", "corto"].includes(durationBand.key)) {
    reasons.push(durationBand.key === "muy_corto" ? "Muy corta + GPS" : "Corta + GPS");
  } else if (durationBand.key === "muy_corto") {
    reasons.push("Muy corta");
  } else if (durationBand.key === "corto") {
    reasons.push("Corta");
  }
  if (hasGpsReason && !reasons.some((item) => item.includes("GPS"))) {
    reasons.push(row.geo_estado === "geo_sin_cruce" ? "Sin cruce territorial" : "Sin GPS");
  }
  if (territorialMissingResponsibleLabel(territorialResolvedResponsibleLabel(row, false))) reasons.push("Sin encuestador");
  return reasons.length ? reasons : ["Estado de tiempo"];
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

function territorialDurationDailyDateValue(row: TerritorialResponseAuditRow) {
  const candidates = [
    row.submission_date_iso,
    row.submission_date,
    row.submission_datetime,
    row.submission_time,
  ];
  for (const candidate of candidates) {
    const raw = stringOrEmpty(candidate).trim();
    if (!raw || raw === "sin_fecha") continue;
    const datePart = raw.includes("T") ? raw.split("T")[0] : raw.split(/\s+/)[0];
    if (datePart) return datePart;
  }
  return "sin_fecha";
}

function territorialDurationDailyDateLabelFromValue(value: string) {
  return value === "sin_fecha" ? "S/D" : formatInternalQueryDateAxisLabel(value);
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

function safePercent(value: number | null | undefined, total: number | null | undefined) {
  if (value == null || total == null || total <= 0) return null;
  return Math.min(100, (value / total) * 100);
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

// React.memo (unidad 3.6): la página re-renderiza en cada poll de sync y
// transición de scopes; con props estabilizadas en el caller, este workbench
// solo se re-renderiza cuando cambian sus datos reales.
export const TerritorialDurationControl = memo(TerritorialDurationControlImpl);
