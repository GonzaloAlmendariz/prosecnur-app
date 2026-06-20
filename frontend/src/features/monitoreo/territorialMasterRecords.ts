import type { TerritorialResponseAuditRow } from "../../api/client";

export type TerritorialMasterRecordState = "sin_observacion" | "pendiente" | "en_observacion";

export type TerritorialMasterRecordFilters = {
  search: string;
  district: string;
  responsible: string;
  ump: string;
  state: "all" | TerritorialMasterRecordState;
};

export type TerritorialMasterRecordRow = {
  id: string;
  responseId: string;
  source: TerritorialResponseAuditRow;
  rowIndex: number | null;
  dateValue: string;
  hourValue: string;
  district: string;
  ubigeo: string;
  ump: string;
  manzana: string;
  responsible: string;
  submittedBy: string;
  state: TerritorialMasterRecordState;
  sortValue: number;
  searchText: string;
};

function text(value: unknown, fallback = "") {
  if (value == null) return fallback;
  const out = String(value).trim();
  return out || fallback;
}

function normalized(value: unknown) {
  return text(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stableNumber(value: unknown) {
  const out = Number(value);
  return Number.isFinite(out) ? out : null;
}

function normalizedToken(value: unknown) {
  return normalized(value).replace(/\s+/g, "_");
}

function recordSortValue(row: TerritorialResponseAuditRow) {
  const raw = text(row.submission_datetime)
    || text(row.submission_time)
    || text(row.submission_date_iso)
    || text(row.advance_date)
    || text(row.submission_date);
  const parsed = Date.parse(raw);
  if (Number.isFinite(parsed)) return parsed;
  const rowIndex = stableNumber(row.row_index);
  return rowIndex == null ? 0 : rowIndex;
}

function masterRecordState(row: TerritorialResponseAuditRow): TerritorialMasterRecordState {
  const status = normalized(row.status);
  const observation = normalized(row.observation_status);
  const validation = normalized(row.validation_status);
  const decision = normalized(row.validation_decision);
  const geo = normalized(row.geo_estado);
  if (status === "en observacion" || status === "revision" || observation === "en observacion" || observation === "aprobada" || validation === "revision" || decision === "visto bueno") return "en_observacion";
  if (geo === "geo revision" || geo === "geo no defendible" || geo === "geo sin gps") return "pendiente";
  if (masterRecordHasDurationReview(row)) return "pendiente";
  return "sin_observacion";
}

function masterRecordDurationReviewKey(row: TerritorialResponseAuditRow) {
  for (const value of [row.duration_operational_status, row.duration_operational_label, row.duration_status]) {
    const key = normalizedToken(value);
    if (key === "muy_corta" || key === "muy_corto") return "muy_corto";
    if (key === "corta" || key === "corto") return "corto";
  }
  return "";
}

function masterRecordHasDurationReview(row: TerritorialResponseAuditRow) {
  return Boolean(masterRecordDurationReviewKey(row));
}

function masterRecordUmp(row: TerritorialResponseAuditRow) {
  return text(row.advance_block_ump)
    || text(row.declared_ump_normalized)
    || text(row.declared_ump_raw)
    || text(row.nearest_block_id)
    || "S/D";
}

function masterRecordManzana(row: TerritorialResponseAuditRow) {
  return text(row.advance_block_manzana)
    || text(row.advance_block_id)
    || text(row.nearest_block_id)
    || "S/D";
}

function masterRecordResponsible(row: TerritorialResponseAuditRow) {
  return text(row.responsible_display)
    || text(row.enumerator_assigned)
    || text(row.submitted_by)
    || "Sin responsable asignado";
}

export function buildTerritorialMasterRecordRows(rows: TerritorialResponseAuditRow[]): TerritorialMasterRecordRow[] {
  return (Array.isArray(rows) ? rows : [])
    .map((row, index) => {
      const responseId = text(row.response_id);
      const rowIndex = stableNumber(row.row_index);
      const district = text(row.distrito) || text(row.advance_block_distrito) || text(row.district_code) || "Sin distrito";
      const ubigeo = text(row.ubigeo) || text(row.district_code);
      const ump = masterRecordUmp(row);
      const manzana = masterRecordManzana(row);
      const responsible = masterRecordResponsible(row);
      const submittedBy = text(row.submitted_by);
      const dateValue = text(row.submission_date) || text(row.submission_date_iso) || text(row.submission_datetime) || text(row.advance_date);
      const hourValue = text(row.submission_hour);
      const state = masterRecordState(row);
      const id = responseId || `row-${rowIndex ?? index + 1}`;
      const searchText = normalized([
        responseId,
        district,
        ubigeo,
        ump,
        manzana,
        responsible,
        submittedBy,
        row.sex,
        row.age,
        row.duration_operational_label,
        row.duration_operational_status,
        row.duration_status,
        row.geo_estado,
        row.submission_date,
        row.submission_date_iso,
        row.submission_hour,
        row.submission_datetime,
        row.issues,
        row.observation_reasons,
      ].filter(Boolean).join(" "));
      return {
        id,
        responseId,
        source: row,
        rowIndex,
        dateValue,
        hourValue,
        district,
        ubigeo,
        ump,
        manzana,
        responsible,
        submittedBy,
        state,
        sortValue: recordSortValue(row),
        searchText,
      };
    })
    .sort((a, b) => {
      if (b.sortValue !== a.sortValue) return b.sortValue - a.sortValue;
      return (b.rowIndex ?? 0) - (a.rowIndex ?? 0);
    });
}

export function territorialMasterRecordOptions(rows: TerritorialMasterRecordRow[]) {
  const unique = (values: string[]) => ["", ...Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, "es"))];
  return {
    districts: unique(rows.map((item) => item.district)),
    responsibles: unique(rows.map((item) => item.responsible)),
    umps: unique(rows.map((item) => item.ump)),
  };
}

export function filterTerritorialMasterRecordRows(rows: TerritorialMasterRecordRow[], filters: TerritorialMasterRecordFilters) {
  const query = normalized(filters.search);
  return rows.filter((item) => {
    if (filters.state !== "all" && item.state !== filters.state) return false;
    if (filters.district && item.district !== filters.district) return false;
    if (filters.responsible && item.responsible !== filters.responsible) return false;
    if (filters.ump && item.ump !== filters.ump) return false;
    if (!query) return true;
    return item.searchText.includes(query);
  });
}

export function summarizeTerritorialMasterRecordRows(rows: TerritorialMasterRecordRow[]) {
  return rows.reduce((summary, item) => {
    summary.total += 1;
    if (item.state === "sin_observacion") summary.clean += 1;
    if (item.state === "pendiente" || item.state === "en_observacion") summary.review += 1;
    const geo = normalized(item.source.geo_estado);
    if (geo === "geo revision" || geo === "geo no defendible" || geo === "geo sin gps") summary.gps += 1;
    if (masterRecordHasDurationReview(item.source)) summary.duration += 1;
    if (normalized(item.responsible).includes("sin responsable")) summary.unassigned += 1;
    return summary;
  }, { total: 0, clean: 0, review: 0, gps: 0, duration: 0, unassigned: 0 });
}
