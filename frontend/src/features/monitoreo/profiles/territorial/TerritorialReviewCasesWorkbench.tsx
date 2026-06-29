import { useEffect, useMemo, useState } from "react";
import {
  Clock,
  ContactRound,
  Copy,
  FileCheck2,
  MapPin,
  Search,
  XCircle,
} from "lucide-react";
import type {
  MonitoreoTerritorialConfig,
  MonitoreoTerritorialDashboard,
  MonitoreoTerritorialOperationalAdjustment,
  MonitoreoTerritorialPhase,
  TerritorialBlockProgress,
  TerritorialInternalReviewCase,
  TerritorialResponseAuditRow,
} from "../../../../api/client";
import {
  formatInternalQueryDateAxisLabel,
} from "../../internalQueries";
import { TerritorialOperationalAdjustmentsWorkspace } from "./TerritorialOperationalAdjustmentsWorkspace";

type TerritorialValidationTab = "geolocalizacion" | "duracion";
type TerritorialReviewTypeFilter = "all" | "record" | "gps" | "duration" | "ump" | "subsanacion";
type TerritorialReviewStateFilter = "all" | "sin_observacion" | "pendiente" | "en_observacion";

type TerritorialReviewFilters = {
  type: TerritorialReviewTypeFilter;
  district: string;
  responsible: string;
  ump: string;
  state: TerritorialReviewStateFilter;
  search: string;
};

type TerritorialReviewRowType = "record" | "gps" | "duration" | "ump";

type TerritorialReviewRow = {
  id: string;
  responseId: string;
  rowIndex: number | null;
  dateValue: string;
  sortValue: number;
  hourValue: string;
  ump: string;
  rawUmp: string;
  manzana: string;
  manzanaHint: string;
  district: string;
  districtHint: string;
  responsible: string;
  responsibleHint: string;
  submittedBy: string;
  sex: string;
  age: number | null;
  durationSeconds: number | null;
  durationStatus?: string;
  durationOperationalStatus?: string;
  durationOperationalLabel?: string;
  geoEstado: string;
  distanceM: number | null;
  gpsTrace: string;
  state: "sin_observacion" | "pendiente" | "en_observacion";
  type: TerritorialReviewRowType;
  gpsReview: boolean;
  durationReview: boolean;
  responsibleReview: boolean;
  unassignedReview: boolean;
  issues: string;
  searchText: string;
};

const EMPTY_TERRITORIAL_REVIEW_FILTERS: TerritorialReviewFilters = {
  type: "all",
  district: "",
  responsible: "",
  ump: "",
  state: "all",
  search: "",
};

const DEFAULT_DURATION_CONFIG = {
  min_duration_seconds: 60,
  max_duration_seconds: 7200,
};

export function TerritorialReviewCasesWorkbench({
  activeLocalTab,
  busy = false,
  config,
  phase,
  reports,
  onOperationalAdjustmentApply,
  onOperationalAdjustmentRevert,
  onOperationalAdjustmentsReset,
  onOpenValidationCase,
}: {
  activeLocalTab?: string;
  busy?: boolean;
  config?: MonitoreoTerritorialConfig | null;
  phase?: MonitoreoTerritorialPhase;
  reports: MonitoreoTerritorialDashboard | null;
  onOperationalAdjustmentApply?: (adjustment: MonitoreoTerritorialOperationalAdjustment) => Promise<MonitoreoTerritorialOperationalAdjustment>;
  onOperationalAdjustmentRevert?: (id: string, reason?: string) => Promise<string>;
  onOperationalAdjustmentsReset?: () => Promise<number>;
  onOpenValidationCase?: (tab: TerritorialValidationTab, responseId?: string) => void;
}) {
  const [filters, setFilters] = useState<TerritorialReviewFilters>(EMPTY_TERRITORIAL_REVIEW_FILTERS);
  const [copiedCaseId, setCopiedCaseId] = useState("");
  const durationConfig = useMemo(() => ({
    min_duration_seconds: numberOrFallback(config?.min_duration_seconds, DEFAULT_DURATION_CONFIG.min_duration_seconds),
    max_duration_seconds: numberOrFallback(config?.max_duration_seconds, DEFAULT_DURATION_CONFIG.max_duration_seconds),
  }), [config?.max_duration_seconds, config?.min_duration_seconds]);
  const rows = useMemo(() => (reports ? buildTerritorialReviewRows(reports, durationConfig) : []), [durationConfig, reports]);
  const options = useMemo(() => territorialReviewFilterOptions(rows), [rows]);
  const summary = useMemo(() => summarizeTerritorialReviewRows(rows), [rows]);
  const filteredRows = useMemo(() => filterTerritorialReviewRows(rows, filters), [filters, rows]);
  const visibleSummary = useMemo(() => summarizeTerritorialReviewRows(filteredRows), [filteredRows]);
  const showingOperationalAdjustments = filters.type === "subsanacion";
  const canClear = !isEmptyTerritorialReviewFilters(filters);

  useEffect(() => {
    const type = territorialReviewTypeFromLocalTab(activeLocalTab);
    if (!type || filters.type === type) return;
    setFilters((current) => ({ ...current, type }));
  }, [activeLocalTab, filters.type]);

  const patchFilters = (patch: Partial<TerritorialReviewFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
  };

  const copyUuid = (id: string, responseIdValue: string) => {
    const responseId = responseIdValue.trim();
    if (!responseId || !navigator.clipboard) return;
    void navigator.clipboard.writeText(responseId).then(() => {
      setCopiedCaseId(id);
      window.setTimeout(() => setCopiedCaseId((current) => (current === id ? "" : current)), 1200);
    }).catch(() => undefined);
  };

  if (!reports) {
    return (
      <div className="mon-stage mon-stage--consultas">
        <section className="mon-territorial-panel mon-territorial-review-panel">
          <div className="mon-territorial-audit-empty">Sin consultas territoriales hidratadas para este corte.</div>
        </section>
      </div>
    );
  }

  return (
    <div className="mon-stage mon-stage--consultas">
      <section className="mon-territorial-panel mon-territorial-review-panel" aria-label="Consultas internas territoriales">
        {!showingOperationalAdjustments ? (
          <section className="mon-territorial-review-hero" aria-label="Resumen de registros consultables">
            <div>
              <span>Después de Validación · {territorialPhaseLabel(reports.active_route_phase)}</span>
              <strong>{formatMetric(summary.total)} registros del corte</strong>
              <p>Una fila por respuesta, con identidad operativa, clasificación final de tiempo/GPS y acceso directo a las validaciones. Las alertas agregadas de UMP quedan visibles como filtro de cruce responsable.</p>
            </div>
            <div className="mon-territorial-review-metrics">
              <TerritorialReviewMetric icon={FileCheck2} label="Sin observación" value={summary.clean} tone="ready" />
              <TerritorialReviewMetric icon={MapPin} label="GPS por revisar" value={summary.gps} tone={summary.gps ? "warning" : "ready"} />
              <TerritorialReviewMetric icon={Clock} label="Duración por revisar" value={summary.duration} tone={summary.duration ? "warning" : "ready"} />
              <TerritorialReviewMetric icon={ContactRound} label="Cruce responsable" value={summary.unassigned} tone={summary.unassigned ? "warning" : "ready"} hint={summary.unassigned ? "sin responsable" : "resuelto"} />
            </div>
          </section>
        ) : (
          <TerritorialOperationalAdjustmentsWorkspace
            model={reports.operational_adjustments ?? null}
            phaseLabel={territorialPhaseLabel(phase ?? reports.active_route_phase)}
            saving={busy}
            onApply={onOperationalAdjustmentApply}
            onRevert={onOperationalAdjustmentRevert}
            onReset={onOperationalAdjustmentsReset}
          />
        )}

        {!showingOperationalAdjustments ? (
          <>
            <div className="mon-territorial-review-filterbar" aria-label="Filtros de registros por validar">
              <label className="mon-query-search">
                <Search size={14} />
                <input
                  value={filters.search}
                  onChange={(event) => patchFilters({ search: event.target.value })}
                  placeholder="Buscar UUID, UMP, distrito, manzana o encuestador..."
                />
              </label>
              <TerritorialReviewSelect label="Distrito" value={filters.district} options={options.districts} onChange={(district) => patchFilters({ district })} />
              <TerritorialReviewSelect label="Responsable" value={filters.responsible} options={options.responsibles} onChange={(responsible) => patchFilters({ responsible })} />
              <TerritorialReviewSelect label="UMP" value={filters.ump} options={options.umps} onChange={(ump) => patchFilters({ ump })} />
              <TerritorialReviewSelect
                label="Estado"
                value={filters.state}
                options={["all", "sin_observacion", "pendiente", "en_observacion"]}
                formatOption={territorialReviewStateFilterLabel}
                onChange={(state) => patchFilters({ state: state as TerritorialReviewStateFilter })}
              />
              <button type="button" onClick={() => setFilters(EMPTY_TERRITORIAL_REVIEW_FILTERS)} disabled={!canClear} title="Limpiar filtros">
                <XCircle size={14} />
                <span>Limpiar</span>
              </button>
            </div>

            <div className="mon-territorial-review-batchslot" />

            <div className="mon-territorial-review-workbench">
              <section className="mon-territorial-review-table-shell" aria-label="Tabla principal de registros por validar">
                <header>
                  <div>
                    <span>Tabla principal</span>
                    <strong>{formatMetric(visibleSummary.total)} visibles de {formatMetric(summary.total)}</strong>
                  </div>
                  <div className="mon-territorial-review-table-tools">
                    <em>{formatMetric(visibleSummary.clean)} sin observación · {formatMetric(visibleSummary.review)} por revisar · {formatMetric(visibleSummary.gps)} GPS · {formatMetric(visibleSummary.duration)} duración</em>
                  </div>
                </header>
                {filteredRows.length ? (
                  <div className="mon-territorial-review-table-scroll">
                    <table className="mon-territorial-review-table">
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Hora</th>
                          <th>UMP</th>
                          <th>Manzana</th>
                          <th>Distrito</th>
                          <th>Encuestador</th>
                          <th>Sexo</th>
                          <th>Edad</th>
                          <th>Duración</th>
                          <th>Clasificación tiempo</th>
                          <th>Clasificación GPS</th>
                          <th>UUID</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRows.map((row) => {
                          const durationBand = territorialDurationBand(row, durationConfig);
                          const gpsBand = territorialDistanceBand(row);
                          const hour = normalizeTerritorialHourLabel(row.hourValue);
                          const hourLabel = hour && !isTerritorialMidnightLabel(hour) ? hour : "sin hora";
                          const durationLabel = durationBand.hasDuration ? formatDurationLabel(row.durationSeconds) : "No registrada";
                          const durationClass = durationBand.hasDuration ? durationBand.className : "is-duration-none";
                          const durationStatusLabel = durationBand.hasDuration ? durationBand.label : "No registrada";
                          return (
                            <tr key={row.id} data-response-id={row.responseId || undefined} className={`is-master-record is-${row.state}`}>
                              <td><strong>{row.dateValue ? formatInternalQueryDateAxisLabel(row.dateValue) : "S/D"}</strong><small>{row.rowIndex ? `fila ${formatMetric(row.rowIndex)}` : "respuesta"}</small></td>
                              <td><strong>{hourLabel}</strong><small>hora reportada</small></td>
                              <td><strong>{/^ump\b/i.test(row.ump) || row.ump === "S/D" ? row.ump : `UMP ${row.ump}`}</strong><small>{row.rawUmp ? `declarada ${row.rawUmp}` : "UMP del corte"}</small></td>
                              <td><strong>{row.manzana}</strong><small>{row.manzanaHint}</small></td>
                              <td><strong>{row.district}</strong><small>{row.districtHint}</small></td>
                              <td><strong>{row.responsible}</strong><small>{row.responsibleHint}</small></td>
                              <td><span className="mon-territorial-review-demo is-sex">{territorialReviewSexLabel(row.sex)}</span></td>
                              <td><span className="mon-territorial-review-demo is-age">{row.age == null ? "S/D" : formatMetric(row.age)}</span></td>
                              <td><span className={`mon-territorial-review-observed is-duration ${durationClass}`}>{durationLabel}</span></td>
                              <td><span className={`mon-territorial-review-time ${durationClass}`}>{durationStatusLabel}</span><small>{durationBand.detail}</small></td>
                              <td>
                                <span className={`mon-territorial-review-gps is-${gpsBand.key}`}>{gpsBand.label}</span>
                                <small title={row.gpsTrace ? `${gpsBand.detail} · ${row.gpsTrace}` : gpsBand.detail}>{[gpsBand.detail, row.gpsTrace].filter(Boolean).join(" · ")}</small>
                              </td>
                              <td>
                                {row.responseId ? (
                                  <button type="button" className="mon-territorial-review-copy" title={row.responseId} onClick={() => copyUuid(row.id, row.responseId)}>
                                    <span>{copiedCaseId === row.id ? "Copiado" : shortenMiddle(row.responseId, 18)}</span>
                                    <Copy size={12} />
                                  </button>
                                ) : (
                                  <span className="mon-territorial-review-no-uuid">Sin UUID</span>
                                )}
                              </td>
                              <td>
                                <div className="mon-territorial-review-actions">
                                  <button
                                    type="button"
                                    className="mon-territorial-review-action is-duration"
                                    disabled={!row.responseId}
                                    onClick={() => onOpenValidationCase?.("duracion", row.responseId || undefined)}
                                  >
                                    <Clock size={13} />
                                    <span>Tiempo</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="mon-territorial-review-action is-gps"
                                    disabled={!row.responseId}
                                    onClick={() => onOpenValidationCase?.("geolocalizacion", row.responseId || undefined)}
                                  >
                                    <MapPin size={13} />
                                    <span>GPS</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="mon-territorial-audit-empty">Sin registros con esos filtros.</div>
                )}
              </section>
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}

function TerritorialReviewMetric({
  icon: Icon,
  label,
  value,
  tone,
  hint,
}: {
  icon: typeof FileCheck2;
  label: string;
  value: number;
  tone: "ready" | "warning";
  hint?: string;
}) {
  return (
    <span className={`is-${tone}`}>
      <Icon size={15} />
      <em>{label}</em>
      <strong>{formatMetric(value)}</strong>
      <small>{hint ?? (value ? "revisar" : "sin alerta")}</small>
    </span>
  );
}

function TerritorialReviewSelect({
  label,
  value,
  options,
  onChange,
  formatOption,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  formatOption?: (value: string) => string;
}) {
  return (
    <label className="mon-territorial-review-select">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option || "all"} value={option}>{formatOption ? formatOption(option) : (option || "Todos")}</option>
        ))}
      </select>
    </label>
  );
}

function territorialReviewTypeFromLocalTab(key: unknown): TerritorialReviewTypeFilter | null {
  if (key === "registro") return "all";
  if (key === "gps") return "gps";
  if (key === "duracion") return "duration";
  if (key === "responsable") return "ump";
  if (key === "subsanaciones") return "subsanacion";
  return null;
}

function buildTerritorialReviewRows(
  reports: MonitoreoTerritorialDashboard,
  config: Pick<MonitoreoTerritorialConfig, "min_duration_seconds" | "max_duration_seconds">,
): TerritorialReviewRow[] {
  const auditRows = reports.response_audit ?? [];
  if (auditRows.length) {
    return auditRows.map((row, index) => territorialReviewRowFromAudit(row, index, config));
  }
  const direct = reports.internal_queries?.review_cases ?? reports.route_sheet?.review_cases ?? [];
  if (direct.length) {
    return direct.map((item, index) => territorialReviewRowFromCase(item, index, config));
  }
  return [
    ...(reports.internal_queries?.far_gps ?? []).map((row, index) => territorialReviewRowFromAudit(row as TerritorialResponseAuditRow, index, config, "gps")),
    ...(reports.internal_queries?.duration_review ?? []).map((row, index) => territorialReviewRowFromAudit(row as TerritorialResponseAuditRow, index, config, "duration")),
    ...(reports.internal_queries?.incomplete_blocks ?? []).map((block, index) => territorialReviewRowFromBlock(block, index)),
  ];
}

function territorialReviewRowFromAudit(
  row: TerritorialResponseAuditRow,
  index: number,
  config: Pick<MonitoreoTerritorialConfig, "min_duration_seconds" | "max_duration_seconds">,
  forcedType?: TerritorialReviewRowType,
): TerritorialReviewRow {
  const responsible = stringOrEmpty(row.responsible_display).trim()
    || stringOrEmpty(row.enumerator_assigned).trim()
    || stringOrEmpty(row.submitted_by).trim()
    || "Sin responsable asignado";
  const pulsoCode = stringOrEmpty(row.pulso_code_normalized || row.pulso_code || row.pulso_code_raw).trim();
  const submittedBy = stringOrEmpty(row.submitted_by).trim();
  const gpsReview = rowMatchesGpsReview(row);
  const durationReview = rowHasDurationObservation(row, config);
  const responsibleReview = rowMatchesResponsibleReview(row, responsible);
  const unassignedReview = rowCountsAsUnassigned(responsible);
  const geoType = gpsReview ? "gps" : "record";
  const durationType = durationReview ? "duration" : geoType;
  const responsibleType = responsibleReview ? "ump" : durationType;
  const type = forcedType ?? responsibleType;
  const searchText = normalizeMatch([
    row.response_id,
    row.distrito,
    row.ubigeo,
    row.declared_ump_normalized,
    row.declared_ump_raw,
    row.advance_block_id,
    row.nearest_block_id,
    responsible,
    submittedBy,
    pulsoCode,
    row.issues,
    row.observation_reasons,
  ].filter(Boolean).join(" "));
  return {
    id: row.response_id || `audit-${index}`,
    responseId: stringOrEmpty(row.response_id).trim(),
    rowIndex: numberOrNull(row.row_index),
    dateValue: stringOrEmpty(row.submission_date_iso || row.submission_date || row.submission_datetime || row.submission_time),
    sortValue: territorialReviewSortValueFromAudit(row),
    hourValue: stringOrEmpty(row.submission_hour || row.submission_time),
    ump: stringOrEmpty(row.declared_ump_normalized || row.advance_block_ump || row.declared_ump_raw).trim() || "S/D",
    rawUmp: stringOrEmpty(row.declared_ump_raw).trim(),
    manzana: stringOrEmpty(row.advance_block_manzana || row.nearest_block_id || row.advance_block_id).trim() || "S/D",
    manzanaHint: row.advance_block_zona ? `Zona ${row.advance_block_zona}` : row.advance_block_type || row.nearest_block_type || "referencia territorial",
    district: stringOrEmpty(row.distrito || row.advance_block_distrito).trim() || "Sin distrito",
    districtHint: stringOrEmpty(row.ubigeo || row.advance_block_ubigeo).trim() || "sin ubigeo",
    responsible,
    responsibleHint: pulsoCode ? `Código ${pulsoCode}` : submittedBy || "sin código visible",
    submittedBy,
    sex: stringOrEmpty(row.sex).trim(),
    age: numberOrNull(row.age),
    durationSeconds: numberOrNull(row.duration_seconds),
    durationStatus: row.duration_status,
    durationOperationalStatus: row.duration_operational_status,
    durationOperationalLabel: row.duration_operational_label,
    geoEstado: stringOrEmpty(row.geo_estado || row.gps_effective_estado || row.gps_primary_estado).trim() || "geo_sin_gps",
    distanceM: numberOrNull(row.distance_m ?? row.gps_effective_distance_m ?? row.gps_primary_distance_m),
    gpsTrace: gpsTraceLabel(row),
    state: reviewStateFromAudit(row, type),
    type,
    gpsReview,
    durationReview,
    responsibleReview,
    unassignedReview,
    issues: stringOrEmpty(row.issues || row.observation_reasons),
    searchText,
  };
}

function territorialReviewRowFromCase(
  item: TerritorialInternalReviewCase,
  index: number,
  config: Pick<MonitoreoTerritorialConfig, "min_duration_seconds" | "max_duration_seconds">,
): TerritorialReviewRow {
  const type = reviewTypeKey(item);
  const responsible = stringOrEmpty(item.responsible || item.submitted_by).trim() || "Sin responsable asignado";
  const durationReview = type === "duration" || rowHasDurationObservation(item, config);
  const responsibleReview = type === "ump" || rowCountsAsUnassigned(responsible);
  const geoEstado = stringOrEmpty(item.geo_estado).trim() || (type === "gps" ? "geo_revision" : "geo_ok");
  const gpsReview = type === "gps" || geoEstadoCountsAsGpsReview(geoEstado);
  const unassignedReview = rowCountsAsUnassigned(responsible);
  const searchText = normalizeMatch([
    item.response_id,
    item.district,
    item.ubigeo,
    item.ump,
    item.block_id,
    responsible,
    item.submitted_by,
    item.pulso_code,
    item.reason,
    item.issues,
  ].filter(Boolean).join(" "));
  return {
    id: item.id || item.response_id || `review-${index}`,
    responseId: stringOrEmpty(item.response_id).trim(),
    rowIndex: numberOrNull(item.row_index) ?? index + 1,
    dateValue: stringOrEmpty(item.submission_date_iso || item.submission_date || item.submission_datetime),
    sortValue: territorialReviewSortValueFromCase(item, index),
    hourValue: stringOrEmpty(item.submission_hour),
    ump: stringOrEmpty(item.ump).trim() || "S/D",
    rawUmp: "",
    manzana: stringOrEmpty(item.manzana || item.block_id).trim() || "S/D",
    manzanaHint: [item.block_type, item.zona ? `Zona ${item.zona}` : ""].filter(Boolean).join(" · ") || "referencia territorial",
    district: stringOrEmpty(item.district).trim() || "Sin distrito",
    districtHint: stringOrEmpty(item.ubigeo).trim() || "sin ubigeo",
    responsible,
    responsibleHint: item.pulso_code || item.submitted_by || "responsable",
    submittedBy: stringOrEmpty(item.submitted_by).trim(),
    sex: stringOrEmpty(item.sex).trim(),
    age: numberOrNull(item.age),
    durationSeconds: numberOrNull(item.duration_seconds),
    durationStatus: item.duration_status,
    durationOperationalStatus: item.duration_operational_status,
    durationOperationalLabel: item.duration_operational_label,
    geoEstado,
    distanceM: numberOrNull(item.distance_m),
    gpsTrace: "",
    state: reviewStateFromCase(item),
    type: type === "duration" && !hasEvaluableDuration(item) ? durationTypeFromCase(item, config) : type,
    gpsReview,
    durationReview,
    responsibleReview,
    unassignedReview,
    issues: stringOrEmpty(item.issues || item.reason),
    searchText,
  };
}

function territorialReviewRowFromBlock(block: TerritorialBlockProgress, index: number): TerritorialReviewRow {
  const blockId = stringOrEmpty(block.id_manzana || `${block.ubigeo}-${block.zona}-${block.manzana}`);
  const responsible = stringOrEmpty(block.responsable).trim() || "Sin responsable asignado";
  const ump = stringOrEmpty(block.ump).trim() || "S/D";
  const searchText = normalizeMatch([blockId, block.distrito, block.ubigeo, ump, responsible, block.zona, block.manzana].filter(Boolean).join(" "));
  return {
    id: `ump:${blockId || index}`,
    responseId: "",
    rowIndex: null,
    dateValue: stringOrEmpty((block as { last_response?: string }).last_response),
    sortValue: territorialReviewSortValueFromBlock(block, index),
    hourValue: "",
    ump,
    rawUmp: "",
    manzana: stringOrEmpty(block.manzana || blockId).trim() || "S/D",
    manzanaHint: [block.tipo_manzana, block.zona ? `Zona ${block.zona}` : ""].filter(Boolean).join(" · ") || "referencia territorial",
    district: stringOrEmpty(block.distrito).trim() || "Sin distrito",
    districtHint: stringOrEmpty(block.ubigeo).trim() || "sin ubigeo",
    responsible,
    responsibleHint: "ruta/UMP",
    submittedBy: "",
    sex: "",
    age: null,
    durationSeconds: null,
    geoEstado: "geo_sin_gps",
    distanceM: null,
    gpsTrace: "",
    state: "pendiente",
    type: "ump",
    gpsReview: false,
    durationReview: false,
    responsibleReview: true,
    unassignedReview: false,
    issues: "ump_iniciada_incompleta",
    searchText,
  };
}

function filterTerritorialReviewRows(rows: TerritorialReviewRow[], filters: TerritorialReviewFilters) {
  const query = normalizeMatch(filters.search);
  return rows.filter((row) => {
    if (!territorialReviewRowMatchesType(row, filters.type)) return false;
    if (filters.state !== "all" && row.state !== filters.state) return false;
    if (filters.district && row.district !== filters.district) return false;
    if (filters.responsible && row.responsible !== filters.responsible) return false;
    if (filters.ump && row.ump !== filters.ump) return false;
    if (!query) return true;
    return row.searchText.includes(query);
  }).sort(compareReviewRows);
}

function summarizeTerritorialReviewRows(rows: TerritorialReviewRow[]) {
  return rows.reduce((summary, row) => {
    summary.total += 1;
    if (row.type === "record") summary.record += 1;
    if (row.gpsReview) summary.gps += 1;
    if (row.durationReview) summary.duration += 1;
    if (row.type === "ump") summary.ump += 1;
    if (row.state === "sin_observacion") summary.clean += 1;
    if (row.state === "pendiente" || row.state === "en_observacion") summary.review += 1;
    if (row.unassignedReview) summary.unassigned += 1;
    return summary;
  }, { total: 0, record: 0, gps: 0, duration: 0, ump: 0, clean: 0, review: 0, unassigned: 0 });
}

function territorialReviewRowMatchesType(row: TerritorialReviewRow, type: TerritorialReviewTypeFilter) {
  if (type === "subsanacion") return true;
  if (type === "all" || type === "record") return true;
  if (type === "gps") return row.gpsReview;
  if (type === "duration") return row.durationReview;
  return row.responsibleReview;
}

function territorialReviewFilterOptions(rows: TerritorialReviewRow[]) {
  return {
    districts: ["", ...uniqueNonEmpty(rows.map((row) => row.district)).sort((a, b) => a.localeCompare(b, "es"))],
    responsibles: ["", ...uniqueNonEmpty(rows.map((row) => row.responsible)).sort((a, b) => a.localeCompare(b, "es"))],
    umps: ["", ...uniqueNonEmpty(rows.map((row) => row.ump)).sort((a, b) => a.localeCompare(b, "es", { numeric: true }))],
  };
}

function compareReviewRows(a: TerritorialReviewRow, b: TerritorialReviewRow) {
  if (b.sortValue !== a.sortValue) return b.sortValue - a.sortValue;
  const indexDelta = (b.rowIndex ?? 0) - (a.rowIndex ?? 0);
  if (indexDelta !== 0) return indexDelta;
  const stateRank: Record<string, number> = { pendiente: 0, en_observacion: 1, sin_observacion: 2 };
  const typeRank: Record<string, number> = { gps: 0, duration: 1, ump: 2, record: 3 };
  const stateDelta = (stateRank[a.state] ?? 9) - (stateRank[b.state] ?? 9);
  if (stateDelta !== 0) return stateDelta;
  const typeDelta = (typeRank[a.type] ?? 9) - (typeRank[b.type] ?? 9);
  if (typeDelta !== 0) return typeDelta;
  return `${a.district} ${a.ump} ${a.id}`.localeCompare(`${b.district} ${b.ump} ${b.id}`, "es");
}

function territorialReviewSortValueFromAudit(row: TerritorialResponseAuditRow) {
  return territorialReviewSortValue([
    row.submission_datetime,
    row.submission_time,
    row.submission_date_iso,
    row.advance_date,
    row.submission_date,
  ], row.row_index);
}

function territorialReviewSortValueFromCase(item: TerritorialInternalReviewCase, index: number) {
  const withSubmissionTime = item as TerritorialInternalReviewCase & { submission_time?: unknown };
  return territorialReviewSortValue([
    item.submission_datetime,
    withSubmissionTime.submission_time,
    item.submission_date_iso,
    item.submission_date,
  ], numberOrNull(item.row_index) ?? index + 1);
}

function territorialReviewSortValueFromBlock(block: TerritorialBlockProgress, index: number) {
  return territorialReviewSortValue([(block as { last_response?: unknown }).last_response], index);
}

function territorialReviewSortValue(candidates: unknown[], fallback: unknown) {
  for (const candidate of candidates) {
    const raw = stringOrEmpty(candidate).trim();
    if (!raw) continue;
    const parsed = Date.parse(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  return numberOrNull(fallback) ?? 0;
}

function isEmptyTerritorialReviewFilters(filters: TerritorialReviewFilters) {
  return filters.type === "all"
    && !filters.district
    && !filters.responsible
    && !filters.ump
    && filters.state === "all"
    && !filters.search.trim();
}

function reviewTypeKey(item: Partial<TerritorialInternalReviewCase>): TerritorialReviewRowType {
  const type = normalizeCode(item.type);
  const reason = normalizeCode(item.reason);
  if (type.includes("record") || type.includes("registro") || reason === "sin_observacion" || reason.includes("registro")) return "record";
  if (type.includes("dur") || reason.includes("duracion")) return "duration";
  if (type.includes("ump") || reason.includes("ump")) return "ump";
  return "gps";
}

function reviewStateFromAudit(row: TerritorialResponseAuditRow, type: TerritorialReviewRowType) {
  const observation = normalizeCode(row.observation_status);
  const validation = normalizeCode(row.validation_status);
  const decision = normalizeCode(row.validation_decision);
  if (observation === "en_observacion" || observation === "aprobada" || validation === "revision" || decision === "visto_bueno") return "en_observacion";
  if (type === "record") return "sin_observacion";
  return "pendiente";
}

function reviewStateFromCase(item: Partial<TerritorialInternalReviewCase>) {
  const status = normalizeCode(item.status);
  const observation = normalizeCode(item.observation_status);
  const validation = normalizeCode(item.validation_status);
  const decision = normalizeCode(item.validation_decision);
  const reason = normalizeCode(item.reason);
  if (status === "en_observacion" || status === "revision" || observation === "en_observacion" || observation === "aprobada" || validation === "revision" || decision === "visto_bueno") return "en_observacion";
  if (status === "sin_observacion" || reason === "sin_observacion" || reviewTypeKey(item) === "record") return "sin_observacion";
  return "pendiente";
}

function territorialReviewStateFilterLabel(value: string) {
  if (value === "sin_observacion") return "Sin observación";
  if (value === "pendiente") return "Pendiente";
  if (value === "en_observacion") return "En observación";
  return "Todos";
}

function territorialDistanceBand(row: TerritorialReviewRow) {
  const geoEstado = normalizeCode(row.geoEstado);
  const distance = numberOrNull(row.distanceM);
  if (geoEstado === "geo_ok") return { key: "geo_ok", label: "Dentro", detail: "en manzana" };
  if (geoEstado === "geo_cerca") return { key: "geo_cerca", label: "Cerca", detail: "<=150 m" };
  if (geoEstado === "geo_revision") return { key: "geo_revision", label: "Revisión", detail: "150-300 m" };
  if (geoEstado === "geo_no_defendible") return { key: "geo_no_defendible", label: "Lejos", detail: distance == null ? ">300 m" : formatDistanceLabel(distance) };
  if (geoEstado === "geo_sin_cruce") return { key: "geo_sin_cruce", label: "Sin cruce", detail: "sin ruta/crosswalk" };
  if (geoEstado === "geo_sin_gps") return { key: "geo_sin_gps", label: "Sin GPS", detail: "sin coordenada" };
  return { key: "geo_sin_gps", label: "S/D", detail: "sin dato" };
}

type TerritorialDurationOperationalKey = "normal" | "corto" | "muy_corto";

function territorialDurationBand(
  row: TerritorialReviewRow,
  config: Pick<MonitoreoTerritorialConfig, "min_duration_seconds" | "max_duration_seconds">,
) {
  if (!hasEvaluableDuration(row)) {
    return { key: "none", label: "", detail: "sin duración registrada", className: "is-duration-none", hasDuration: false };
  }
  const key = durationOperationalStatus(row, config);
  if (key === "muy_corto") {
    return { key, label: "Muy corto", detail: `< ${formatDurationLabel(config.min_duration_seconds)}`, className: "is-duration-muy-corto", hasDuration: true };
  }
  if (key === "corto") {
    return { key, label: "Corto", detail: `< ${formatDurationLabel(shortDurationSeconds(config))}`, className: "is-duration-corto", hasDuration: true };
  }
  return { key, label: "Normal", detail: "sin alerta operativa", className: "is-duration-normal", hasDuration: true };
}

function rowHasGeoObservation(row: TerritorialResponseAuditRow) {
  const reasons = observationReasonParts(row);
  return reasons.some((reason) => reason.startsWith("gps_"))
    || ["geo_revision", "geo_no_defendible", "geo_sin_cruce", "geo_sin_gps"].includes(row.geo_estado);
}

function rowMatchesGpsReview(row: TerritorialResponseAuditRow) {
  return rowHasGeoObservation(row) || row.gps_nearest_differs_operational === true;
}

function geoEstadoCountsAsGpsReview(value: unknown) {
  return ["geo_revision", "geo_no_defendible", "geo_sin_cruce", "geo_sin_gps"].includes(normalizeCode(value));
}

function rowMatchesResponsibleReview(row: TerritorialResponseAuditRow, responsible: string) {
  return rowCountsAsUnassigned(responsible)
    || row.gps_nearest_differs_operational === true
    || Boolean(stringOrEmpty(row.nearest_block_id) && stringOrEmpty(row.advance_block_id) && row.nearest_block_id !== row.advance_block_id);
}

function rowCountsAsUnassigned(value: unknown) {
  return normalizeMatch(value).includes("sin responsable");
}

function rowHasDurationObservation(
  row: Partial<TerritorialResponseAuditRow | TerritorialInternalReviewCase>,
  config: Pick<MonitoreoTerritorialConfig, "min_duration_seconds" | "max_duration_seconds">,
) {
  const reasons = observationReasonParts(row);
  if (!hasEvaluableDuration(row)) return false;
  const operational = durationOperationalStatus(row, config);
  return reasons.includes("duracion_muy_corta")
    || reasons.includes("duracion_corta")
    || operational === "muy_corto"
    || operational === "corto";
}

function durationTypeFromCase(
  item: Partial<TerritorialInternalReviewCase>,
  config: Pick<MonitoreoTerritorialConfig, "min_duration_seconds" | "max_duration_seconds">,
): TerritorialReviewRowType {
  return rowHasDurationObservation(item, config) ? "duration" : reviewTypeKey(item);
}

function hasEvaluableDuration(row: Partial<TerritorialReviewRow | TerritorialResponseAuditRow | TerritorialInternalReviewCase>) {
  const seconds = numberOrNull((row as TerritorialReviewRow).durationSeconds ?? (row as TerritorialResponseAuditRow).duration_seconds);
  if (seconds != null && Number.isFinite(seconds) && seconds >= 0) return true;
  const direct = normalizeCode((row as TerritorialReviewRow).durationOperationalStatus ?? (row as TerritorialResponseAuditRow).duration_operational_status);
  if (direct === "corto" || direct === "muy_corto") return true;
  const raw = normalizeCode((row as TerritorialReviewRow).durationStatus ?? (row as TerritorialResponseAuditRow).duration_status);
  return ["muy_corta", "muy_corto", "corta", "corto", "esperada", "larga", "extrema"].includes(raw);
}

function durationOperationalStatus(
  row: Partial<TerritorialReviewRow | TerritorialResponseAuditRow | TerritorialInternalReviewCase>,
  config: Pick<MonitoreoTerritorialConfig, "min_duration_seconds" | "max_duration_seconds">,
): TerritorialDurationOperationalKey {
  const seconds = numberOrNull((row as TerritorialReviewRow).durationSeconds ?? (row as TerritorialResponseAuditRow).duration_seconds);
  const direct = normalizeCode((row as TerritorialReviewRow).durationOperationalStatus ?? (row as TerritorialResponseAuditRow).duration_operational_status);
  if (direct === "corto" || direct === "muy_corto") return direct;
  const label = normalizeMatch((row as TerritorialReviewRow).durationOperationalLabel ?? (row as TerritorialResponseAuditRow).duration_operational_label);
  if (label === "muy corto") return "muy_corto";
  if (label === "corto") return "corto";
  const raw = normalizeCode((row as TerritorialReviewRow).durationStatus ?? (row as TerritorialResponseAuditRow).duration_status);
  if (raw === "muy_corta" || raw === "muy_corto") return "muy_corto";
  if (raw === "corta" || raw === "corto") return "corto";
  if (seconds != null) {
    if (seconds < config.min_duration_seconds) return "muy_corto";
    if (seconds < shortDurationSeconds(config)) return "corto";
  }
  return "normal";
}

function shortDurationSeconds(config: Pick<MonitoreoTerritorialConfig, "min_duration_seconds" | "max_duration_seconds">) {
  return Math.max(300, config.min_duration_seconds * 5);
}

function observationReasonParts(row: Partial<TerritorialResponseAuditRow | TerritorialInternalReviewCase>) {
  return [
    stringOrEmpty((row as TerritorialResponseAuditRow).observation_reasons),
    stringOrEmpty(row.issues),
  ].flatMap((value) => value.split(/[;,]/).map((item) => normalizeCode(item)).filter(Boolean));
}

function gpsTraceLabel(row: Partial<TerritorialResponseAuditRow>) {
  const source = gpsSourceLabel(row.gps_effective_source);
  const primary = gpsSourceLabel(row.gps_primary_source);
  const accuracy = numberOrNull(row.gps_effective_accuracy_m);
  const parts = [
    source ? `fuente ${source}` : "",
    row.gps_reclassified && primary && source && primary !== source ? `reemplaza ${primary}` : "",
    accuracy != null ? `prec. ${formatDistanceLabel(accuracy)}` : "",
  ].filter(Boolean);
  return parts.join(" · ");
}

function gpsSourceLabel(value: unknown) {
  const raw = stringOrEmpty(value).trim();
  const key = normalizeCode(raw);
  if (!raw) return "";
  if (key === "_geolocation" || key === "geolocation") return "Kobo";
  if (key === "gps_inicio") return "GPS inicio";
  if (key === "gps_background") return "GPS fondo";
  return raw;
}

function territorialReviewSexLabel(value: unknown) {
  const key = normalizeMatch(value);
  if (["1", "h", "hombre", "masculino", "male", "varon"].includes(key)) return "H";
  if (["2", "m", "mujer", "femenino", "female", "f"].includes(key)) return "M";
  const raw = stringOrEmpty(value).trim();
  return raw || "S/D";
}

function territorialPhaseLabel(value: unknown) {
  return value === "pilot" ? "Piloto" : "Campo";
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

function isTerritorialMidnightLabel(value: string) {
  return /^12:00\s*a\.?m\.?$/i.test(value.trim());
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

function formatDistanceLabel(value: number | null | undefined) {
  const meters = numberOrNull(value);
  if (meters == null) return "S/D";
  if (Math.abs(meters) >= 1000) return `${(meters / 1000).toFixed(meters >= 10000 ? 1 : 2)} km`;
  return `${Math.round(meters)} m`;
}

function formatMetric(value: unknown, fallback = "0") {
  const number = numberOrNull(value);
  if (number == null) return fallback;
  return new Intl.NumberFormat("es-PE", { maximumFractionDigits: 0 }).format(number);
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

function normalizeCode(value: unknown) {
  return normalizeMatch(value).replace(/\s+/g, "_");
}

function shortenMiddle(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  const side = Math.max(3, Math.floor((maxLength - 1) / 2));
  return `${value.slice(0, side)}...${value.slice(-side)}`;
}

function uniqueNonEmpty(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}
