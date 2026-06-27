import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { AlertCircle, CheckCircle2, ClipboardCheck, Download, Filter, KeyRound, PhoneCall, RefreshCw, Search, ShieldAlert, Table2 } from "lucide-react";
import {
  apiMonitoreoState,
  type MonitoreoAcreditacionReports,
  type MonitoreoInternalQueryCase,
  type MonitoreoReportSheet,
  type MonitoreoRow,
  type MonitoreoState,
} from "../../../../api/client";
import { MODULE_TONES } from "../../../../lib/modules";
import { WORKBENCH_VIEWS, type WorkbenchView } from "../../core/monitoreoRegistry";
import {
  internalCaseCrossingLabel,
  internalCaseCrossingValue,
  internalCaseResponseStateLabel,
  internalCaseResponseStateValue,
  internalQueryCollectorDisplayLabel,
  normalizeInternalQueries,
  summarizeInternalCases,
} from "../../internalQueries";
import { MonitoreoOutputsWorkbench } from "../../salidas/MonitoreoOutputsWorkbench";
import type { MonitoreoReportScope } from "../types";
import "../profilePage.css";

const ACREDITACION_VIEWS: WorkbenchView[] = ["fuentes", "modelo", "consultas", "telefonico", "avance"];
const TELEFONICO_VIEWS: WorkbenchView[] = ["telefonico", "fuentes", "modelo", "avance", "consultas"];
const ACREDITACION_ADVANCE_TABS = [
  { key: "resumen", label: "Resumen", detail: "Avance general", icon: ClipboardCheck },
  { key: "actores", label: "Actores", detail: "Brechas por unidad", icon: CheckCircle2 },
  { key: "encuestas", label: "Encuestas", detail: "Fuentes y canales", icon: ClipboardCheck },
  { key: "detalle", label: "Detalle", detail: "Controles", icon: AlertCircle },
  { key: "salidas", label: "Salidas", detail: "PDF y Sheets", icon: Download },
] as const;
type AcreditacionAdvanceTab = typeof ACREDITACION_ADVANCE_TABS[number]["key"];
const ACREDITACION_CONSULTA_TABS = [
  { key: "casos", label: "Casos", detail: "Persona y respuesta", icon: Table2 },
  { key: "cruces", label: "Cruces", detail: "Llave y base", icon: KeyRound },
  { key: "auditoria", label: "Auditoría", detail: "Diferencias y alertas", icon: ShieldAlert },
] as const;
type AcreditacionConsultaTab = typeof ACREDITACION_CONSULTA_TABS[number]["key"];
export type AcreditacionProfileMode = "acreditacion" | "telefonico";

function fmt(value: unknown, fallback = "0") {
  if (value == null || value === "") return fallback;
  const n = Number(value);
  if (Number.isFinite(n)) return new Intl.NumberFormat("es-PE").format(n);
  return String(value);
}

function pct(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "S/D";
  return `${Math.round(n)}%`;
}

function pctFrom(value: number, total: number) {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) return "S/D";
  return `${((value / total) * 100).toLocaleString("es-PE", { maximumFractionDigits: 1 })}%`;
}

function num(value: unknown, fallback = 0) {
  if (value == null || value === "") return fallback;
  const parsed = Number(String(value).replace(/%/g, "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function rowNumber(row: Record<string, unknown>, keys: string[], fallback = 0) {
  const normalized = new Map(Object.keys(row).map((key) => [
    key.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(),
    key,
  ]));
  for (const key of keys) {
    const hit = normalized.get(key.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase());
    if (hit) return num(row[hit], fallback);
  }
  return fallback;
}

function columnLabel(column: string) {
  const labels: Record<string, string> = {
    "Rechazos plataforma": "Rechazo",
    Rechazos: "Rechazo",
    "Sin respuesta plataforma": "Sin respuesta",
    Validas: "Válidas",
    Universo: "Base reportada",
  };
  return labels[column] ?? column.replaceAll("_", " ");
}

type AcreditacionStateSummary = {
  universe: number;
  effective: number;
  partial: number;
  refusal: number;
  unanswered: number;
  reference: number | null;
  referenceLabel: string;
};

function stateFromActors(actors: MonitoreoRow[] = [], fallbackRows = 0, fallbackValid = 0): AcreditacionStateSummary {
  const totals = actors.reduce<AcreditacionStateSummary>((acc, row) => {
    const record = row as Record<string, unknown>;
    acc.universe += rowNumber(record, ["Universo", "Total"], 0);
    acc.effective += rowNumber(record, ["Efectivas", "Completas", "Validas", "Válidas"], 0);
    acc.partial += rowNumber(record, ["Parciales"], 0);
    acc.refusal += rowNumber(record, ["Rechazo", "Rechazos plataforma", "Rechazos"], 0);
    acc.unanswered += rowNumber(record, ["Sin respuesta"], 0);
    const ref = rowNumber(record, ["Referencia operativa", "Meta", "Mínimo", "Minimo"], Number.NaN);
    if (Number.isFinite(ref) && ref > 0) acc.reference = (acc.reference ?? 0) + ref;
    const label = String(record["Referencia etiqueta"] ?? "").trim();
    if (label) acc.referenceLabel = label;
    return acc;
  }, { universe: 0, effective: 0, partial: 0, refusal: 0, unanswered: 0, reference: null, referenceLabel: "Mínimo a alcanzar" });

  if (!actors.length) {
    totals.universe = Math.max(0, fallbackRows);
    totals.effective = Math.max(0, fallbackValid);
  }
  if (totals.universe > 0 && totals.unanswered <= 0) {
    totals.unanswered = Math.max(0, totals.universe - totals.effective - totals.partial - totals.refusal);
  }
  return totals;
}

function stateFromReports(
  reports: MonitoreoAcreditacionReports | null,
  fallbackRows = 0,
  fallbackValid = 0,
): AcreditacionStateSummary {
  const queries = normalizeInternalQueries(reports?.internal_queries);
  const cases = queries.case_rollup?.length ? queries.case_rollup : [];
  if (cases.length) {
    const summary = summarizeInternalCases(cases);
    return {
      universe: cases.length,
      effective: summary.effective,
      partial: summary.partial,
      refusal: summary.refusal,
      unanswered: summary.pending,
      reference: null,
      referenceLabel: "Casos oficiales",
    };
  }
  return stateFromActors(reports?.client_report?.actors ?? [], fallbackRows, fallbackValid);
}

function EstadoProgresoPanel({ summary, label = "Estado + progreso" }: { summary: AcreditacionStateSummary; label?: string }) {
  const total = Math.max(1, summary.universe || summary.effective + summary.partial + summary.refusal + summary.unanswered);
  const progress = summary.universe > 0 ? Math.min(100, Math.max(0, (summary.effective / summary.universe) * 100)) : 0;
  const states = [
    { key: "effective", label: "Efectivas", value: summary.effective },
    { key: "partial", label: "Parciales", value: summary.partial },
    { key: "refusal", label: "Rechazo", value: summary.refusal },
    { key: "unanswered", label: "Sin respuesta", value: summary.unanswered },
  ];
  return (
    <div className="mon-acr-state-panel" aria-label={label}>
      <div className="mon-acr-state-head">
        <span>{label}</span>
        <strong>{pct(progress)}</strong>
      </div>
      <div className="mon-acr-state-grid">
        {states.map((item) => (
          <div key={item.key} className={`mon-acr-state mon-acr-state--${item.key}`}>
            <span>{item.label}</span>
            <strong>{fmt(item.value)} <small>({pctFrom(item.value, total)})</small></strong>
          </div>
        ))}
      </div>
      <div className="mon-acr-state-meter" aria-label={`Base reportada ${fmt(summary.universe)}`}>
        {states.map((item) => {
          const share = total > 0 ? Math.max(0, (item.value / total) * 100) : 0;
          return (
            <i key={item.key} className={`is-${item.key}`} style={{ width: `${share}%` }}>
              {share >= 3 ? <span>{share >= 8 ? `${item.label} ${pctFrom(item.value, total)}` : pctFrom(item.value, total)}</span> : null}
            </i>
          );
        })}
      </div>
      <div className="mon-acr-state-foot">
        <span>Base reportada: {fmt(summary.universe)}</span>
        {summary.reference ? <em>{summary.referenceLabel}: {fmt(summary.reference)}</em> : null}
      </div>
    </div>
  );
}

function scopeForView(view: WorkbenchView): MonitoreoReportScope {
  if (view === "telefonico") return "full";
  if (view === "consultas" || view === "modelo") return "queries_summary";
  if (view === "fuentes") return "source";
  return "advance_summary";
}

function reportsFromState(state: MonitoreoState | null) {
  return state?.dashboard?.acreditacion_reports ?? null;
}

function rowValue(row: Record<string, unknown>, key: string) {
  const value = row[key];
  if (value == null) return "";
  if (typeof value === "boolean") return value ? "Si" : "No";
  return String(value);
}

function compactColumns(rows: Array<Record<string, unknown>>, preferred: string[] = []) {
  const seen = new Set<string>();
  const keys = [...preferred, ...rows.flatMap((row) => Object.keys(row))]
    .filter((key) => key && !key.startsWith("_") && !seen.has(key) && (seen.add(key), true));
  return keys.slice(0, 8);
}

function rowsFromSheets(sheets: MonitoreoReportSheet[] = [], terms: string[] = []) {
  const filters = terms.map((term) => term.toLowerCase());
  return sheets.flatMap((sheet) => (
    sheet.blocks.flatMap((block) => {
      const haystack = `${sheet.id} ${sheet.title} ${block.id} ${block.title}`.toLowerCase();
      if (filters.length && !filters.some((term) => haystack.includes(term))) return [];
      return block.rows.map((row) => ({
        _sheet: sheet.title,
        _block: block.title,
        ...row,
      }));
    })
  ));
}

function rowsForSheetBlock(
  reports: MonitoreoAcreditacionReports,
  sheetId: string,
  blockIds: string[] = [],
) {
  const sheet = reports.sheets.find((item) => item.id === sheetId) ?? null;
  if (!sheet) return [];
  const wanted = new Set(blockIds.map((id) => id.toLowerCase()));
  return sheet.blocks.flatMap((block) => {
    if (wanted.size && !wanted.has(String(block.id).toLowerCase())) return [];
    return block.rows.map((row) => ({
      _block: block.title,
      ...row,
    }));
  }) as Array<Record<string, unknown>>;
}

function renderPhoneView(reports: MonitoreoAcreditacionReports) {
  const summaryRows = rowsForSheetBlock(reports, "monitoreo_telefonico", ["resumen_telefonico"]);
  const statusRows = rowsForSheetBlock(reports, "monitoreo_telefonico", ["estatus_telefonico"]);
  const responsibleRows = [
    ...rowsForSheetBlock(reports, "monitoreo_telefonico", ["responsables_barrido"]),
    ...rowsForSheetBlock(reports, "monitoreo_telefonico", ["operacion_responsable"]),
    ...rowsForSheetBlock(reports, "monitoreo_telefonico", ["efectivos_responsable"]),
  ];
  const pendingRows = [
    ...rowsForSheetBlock(reports, "monitoreo_telefonico", ["insistencia_no_contesta"]),
    ...rowsForSheetBlock(reports, "monitoreo_telefonico", ["detalle_no_contesta"]),
    ...rowsForSheetBlock(reports, "monitoreo_telefonico", ["no_barridos_responsable"]),
  ];
  const phoneRows = rowsFromSheets(reports.sheets, ["telefono", "telefon", "llamada", "responsable"]);

  return (
    <div className="mon-profile-stack">
      <div className="mon-profile-stat-row mon-profile-stat-row--phone">
        <StatTile label="Resumen" value={fmt(summaryRows.length)} tone={summaryRows.length ? "good" : "neutral"} />
        <StatTile label="Estados" value={fmt(statusRows.length)} />
        <StatTile label="Responsables" value={fmt(responsibleRows.length)} />
        <StatTile label="Pendientes" value={fmt(pendingRows.length)} tone={pendingRows.length ? "warn" : "good"} />
      </div>
      <div className="mon-profile-grid">
        <section className="mon-profile-panel mon-profile-panel--compact-table">
          <div className="mon-profile-panel-head">
            <h3>Resumen telefónico</h3>
            <span>{fmt(summaryRows.length || phoneRows.length)} filas</span>
          </div>
          <DataTable
            rows={summaryRows.length ? summaryRows : phoneRows}
            empty="No hay bloque telefónico preparado en el resumen local."
          />
        </section>
        <section className="mon-profile-panel mon-profile-panel--compact-table">
          <div className="mon-profile-panel-head">
            <h3>Distribución por estado</h3>
            <span>{fmt(statusRows.length)} estados</span>
          </div>
          <DataTable rows={statusRows} empty="No hay distribución de estados telefónicos para este corte." />
        </section>
      </div>
      <section className="mon-profile-panel">
        <div className="mon-profile-panel-head">
          <h3>Responsables e insistencia</h3>
          <span>{fmt(responsibleRows.length + pendingRows.length)} filas</span>
        </div>
        <DataTable
          rows={[...responsibleRows, ...pendingRows]}
          empty="No hay seguimiento por responsable o pendientes de insistencia."
        />
      </section>
    </div>
  );
}

function StatTile({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "good" | "warn" }) {
  return (
    <div className={`mon-profile-stat mon-profile-stat--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function DataTable({
  rows,
  empty,
  preferredColumns = [],
}: {
  rows: Array<Record<string, unknown>>;
  empty: string;
  preferredColumns?: string[];
}) {
  if (!rows.length) return <p className="mon-profile-muted">{empty}</p>;
  const columns = compactColumns(rows, preferredColumns);
  return (
    <div className="mon-profile-table-wrap">
      <table className="mon-profile-table">
        <thead>
          <tr>{columns.map((column) => <th key={column}>{columnLabel(column)}</th>)}</tr>
        </thead>
        <tbody>
          {rows.slice(0, 80).map((row, index) => (
            <tr key={index}>
              {columns.map((column) => <td key={column}>{rowValue(row, column)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type AcreditacionCaseFilters = {
  search: string;
  actor: string;
  response: string;
  crossing: string;
};

const EMPTY_CASE_FILTERS: AcreditacionCaseFilters = {
  search: "",
  actor: "",
  response: "",
  crossing: "",
};

const RESPONSE_FILTER_ORDER = ["complete", "partial", "refusal", "pending"];

function normalizeCaseSearch(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9@.]+/g, " ")
    .trim();
}

function caseIdentity(item: MonitoreoInternalQueryCase) {
  return item.response_id || item.case_key || `${item.actor}-${item.response_row}-${item.person_label}`;
}

function caseDisplayName(item: MonitoreoInternalQueryCase) {
  return String(item.person_label || item.case_key || item.response_id || "Caso sin llave")
    .toLocaleLowerCase("es-PE")
    .replace(/(^|[\s,.'’()-])(\p{L})/gu, (_match, prefix: string, letter: string) => `${prefix}${letter.toLocaleUpperCase("es-PE")}`);
}

function caseMatchesFilters(item: MonitoreoInternalQueryCase, filters: AcreditacionCaseFilters) {
  if (filters.actor && item.actor !== filters.actor) return false;
  if (filters.response && internalCaseResponseStateValue(item) !== filters.response) return false;
  if (filters.crossing && internalCaseCrossingValue(item) !== filters.crossing) return false;
  const query = normalizeCaseSearch(filters.search);
  if (!query) return true;
  const haystack = normalizeCaseSearch([
    item.actor,
    item.person_label,
    item.case_key,
    item.response_id,
    item.date,
    item.source_label,
    item.channel,
    item.collector_name,
    item.collector_id,
    item.base_result,
    item.base_record,
    item.base_source,
    item.decision,
    item.decision_reason,
    item.issue_type,
  ].join(" "));
  return query.split(/\s+/).filter(Boolean).every((token) => haystack.includes(token));
}

function countCaseOptions(
  cases: MonitoreoInternalQueryCase[],
  valueForCase: (item: MonitoreoInternalQueryCase) => string,
  labelForValue: (value: string) => string = (value) => value,
  order: string[] = [],
) {
  const counts = new Map<string, number>();
  cases.forEach((item) => {
    const value = valueForCase(item);
    if (!value) return;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  });
  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, label: labelForValue(value), count }))
    .sort((a, b) => {
      const aIndex = order.indexOf(a.value);
      const bIndex = order.indexOf(b.value);
      if (aIndex !== -1 || bIndex !== -1) return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
      return a.label.localeCompare(b.label, "es");
    });
}

function caseToneClass(item: MonitoreoInternalQueryCase) {
  const response = internalCaseResponseStateValue(item);
  if (response === "complete") return "is-effective";
  if (response === "partial") return "is-partial";
  if (response === "refusal") return "is-refusal";
  return "is-muted";
}

function caseWithoutCrossing(item: MonitoreoInternalQueryCase) {
  const crossing = internalCaseCrossingValue(item);
  return crossing === "sin_cruce" || crossing === "sin_llave" || crossing === "sin_base";
}

function caseIsAuditable(item: MonitoreoInternalQueryCase) {
  return (
    item.advancement !== "effective" ||
    caseWithoutCrossing(item) ||
    Number(item.duplicate_count ?? item.duplicate_group_size ?? 0) > 1 ||
    Boolean(String(item.issue_type || "").trim())
  );
}

function responseCounts(cases: MonitoreoInternalQueryCase[]) {
  return cases.reduce(
    (acc, item) => {
      const response = internalCaseResponseStateValue(item);
      acc.total += 1;
      if (response === "complete") acc.complete += 1;
      else if (response === "partial") acc.partial += 1;
      else if (response === "refusal") acc.refusal += 1;
      else acc.pending += 1;
      if (caseWithoutCrossing(item)) acc.withoutCrossing += 1;
      return acc;
    },
    { total: 0, complete: 0, partial: 0, refusal: 0, pending: 0, withoutCrossing: 0 },
  );
}

function groupedCaseRows(
  cases: MonitoreoInternalQueryCase[],
  groupValue: (item: MonitoreoInternalQueryCase) => string,
  groupLabel: (value: string) => string,
) {
  const groups = new Map<string, MonitoreoInternalQueryCase[]>();
  cases.forEach((item) => {
    const value = groupValue(item) || "Sin dato";
    const bucket = groups.get(value) ?? [];
    bucket.push(item);
    groups.set(value, bucket);
  });
  return Array.from(groups.entries())
    .map(([value, rows]) => {
      const counts = responseCounts(rows);
      return {
        Grupo: groupLabel(value),
        Casos: counts.total,
        Completas: counts.complete,
        Parciales: counts.partial,
        Rechazos: counts.refusal,
        "Sin respuesta": counts.pending,
        "Sin cruce": counts.withoutCrossing,
      };
    })
    .sort((a, b) => Number(b.Casos) - Number(a.Casos) || String(a.Grupo).localeCompare(String(b.Grupo), "es"));
}

function caseAuditRows(cases: MonitoreoInternalQueryCase[]) {
  return cases.filter(caseIsAuditable).map((item) => ({
    Actor: item.actor || "Sin actor",
    Persona: caseDisplayName(item),
    "Estado respuesta": internalCaseResponseStateLabel(internalCaseResponseStateValue(item)),
    Cruce: internalCaseCrossingLabel(internalCaseCrossingValue(item)),
    Decisión: item.decision || advancementLabel(item.advancement),
    Motivo: item.decision_reason || item.rule || item.issue_type || "Regla estándar",
    Duplicados: Number(item.duplicate_count ?? item.duplicate_group_size ?? 0) > 1 ? fmt(item.duplicate_count ?? item.duplicate_group_size) : "",
    "Response ID": item.response_id || "",
  }));
}

function advancementLabel(value: string) {
  if (value === "effective") return "Efectiva";
  if (value === "included_review") return "Incluida auditada";
  if (value === "partial") return "Parcial";
  if (value === "refusal") return "Rechazo";
  if (value === "pending") return "Sin respuesta";
  if (value === "excluded") return "Excluida";
  return value || "Revisión";
}

function AcreditacionCaseFilterChips({
  label,
  value,
  allLabel,
  allCount,
  options,
  onChange,
}: {
  label: string;
  value: string;
  allLabel: string;
  allCount: number;
  options: Array<{ value: string; label: string; count: number }>;
  onChange: (value: string) => void;
}) {
  return (
    <section className="mon-acr-case-chip-filter" aria-label={`Filtro por ${label}`}>
      <span>{label}</span>
      <div>
        <button type="button" className={!value ? "is-active" : ""} aria-pressed={!value} onClick={() => onChange("")}>
          <strong>{allLabel}</strong>
          <em>{fmt(allCount)}</em>
        </button>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={[value === option.value ? "is-active" : "", `is-${option.value}`].filter(Boolean).join(" ")}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            <strong>{option.label}</strong>
            <em>{fmt(option.count)}</em>
          </button>
        ))}
      </div>
    </section>
  );
}

function CaseStatusPill({ value }: { value: string }) {
  return (
    <span className={`mon-acr-status-pill is-${value}`}>
      {internalCaseResponseStateLabel(value)}
    </span>
  );
}

function CaseCrossingPill({ value }: { value: string }) {
  return (
    <span className={`mon-acr-cross-pill is-${value}`}>
      {internalCaseCrossingLabel(value)}
    </span>
  );
}

function AcreditacionCaseDonut({ summary }: { summary: ReturnType<typeof summarizeInternalCases> }) {
  const total = Math.max(1, summary.total);
  const effective = (summary.effective / total) * 360;
  const partial = effective + (summary.partial / total) * 360;
  const refusal = partial + (summary.refusal / total) * 360;
  const style = {
    "--donut-effective": `${effective}deg`,
    "--donut-partial": `${partial}deg`,
    "--donut-refusal": `${refusal}deg`,
  } as CSSProperties;

  return (
    <div className="mon-acr-case-donut" style={style} aria-label={`Resumen de ${fmt(summary.total)} casos`}>
      <div className="mon-acr-case-donut-ring" aria-hidden="true">
        <span>
          <strong>{fmt(summary.effective)}</strong>
          <em>completas</em>
        </span>
      </div>
      <div className="mon-acr-case-donut-caption">
        <span>Respuesta validada</span>
        <strong>{pctFrom(summary.effective, summary.total || 1)}</strong>
      </div>
    </div>
  );
}

function AcreditacionCaseOverview({
  summary,
  allSummary,
  filteredCount,
  totalCount,
}: {
  summary: ReturnType<typeof summarizeInternalCases>;
  allSummary: ReturnType<typeof summarizeInternalCases>;
  filteredCount: number;
  totalCount: number;
}) {
  return (
    <section className="mon-acr-case-overview" aria-label="Resumen de consultas">
      <AcreditacionCaseDonut summary={summary.total ? summary : allSummary} />
      <div className="mon-acr-case-kpis">
        <StatTile label="Casos visibles" value={`${fmt(filteredCount)} / ${fmt(totalCount)}`} tone={filteredCount ? "good" : "neutral"} />
        <StatTile label="Completas" value={fmt(summary.effective)} tone="good" />
        <StatTile label="Parciales" value={fmt(summary.partial)} tone={summary.partial ? "warn" : "neutral"} />
        <StatTile label="Rechazos / sin respuesta" value={`${fmt(summary.refusal)} / ${fmt(summary.pending)}`} tone={summary.refusal || summary.pending ? "warn" : "neutral"} />
      </div>
    </section>
  );
}

function AcreditacionConsultaTabs({
  active,
  counts,
  onChange,
}: {
  active: AcreditacionConsultaTab;
  counts: Record<AcreditacionConsultaTab, number>;
  onChange: (tab: AcreditacionConsultaTab) => void;
}) {
  return (
    <nav className="mon-acr-query-tabs" role="tablist" aria-label="Pestañas de consultas internas">
      {ACREDITACION_CONSULTA_TABS.map((tab) => {
        const Icon = tab.icon;
        const selected = active === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={selected}
            className={selected ? "is-active" : ""}
            onClick={() => onChange(tab.key)}
          >
            <Icon size={14} />
            <span>
              <strong>{tab.label}</strong>
              <em>{tab.detail}</em>
            </span>
            <small>{fmt(counts[tab.key])}</small>
          </button>
        );
      })}
    </nav>
  );
}

function AcreditacionCrucesView({ cases }: { cases: MonitoreoInternalQueryCase[] }) {
  const crossingRows = groupedCaseRows(cases, internalCaseCrossingValue, internalCaseCrossingLabel);
  const actorRows = groupedCaseRows(cases, (item) => item.actor || "Sin actor", (value) => value);
  const sourceRows = groupedCaseRows(cases, (item) => item.source_label || item.channel || "Sin fuente", (value) => value);
  return (
    <div className="mon-acr-insight-grid">
      <section className="mon-profile-panel">
        <div className="mon-profile-panel-head">
          <h3>Cruce por llave</h3>
          <span>{fmt(crossingRows.length)} tipos</span>
        </div>
        <DataTable rows={crossingRows} empty="No hay cruces para los filtros activos." />
      </section>
      <section className="mon-profile-panel">
        <div className="mon-profile-panel-head">
          <h3>Actor y estado</h3>
          <span>{fmt(actorRows.length)} actores</span>
        </div>
        <DataTable rows={actorRows} empty="No hay actores para los filtros activos." />
      </section>
      <section className="mon-profile-panel mon-acr-insight-wide">
        <div className="mon-profile-panel-head">
          <h3>Fuente y respuesta</h3>
          <span>{fmt(sourceRows.length)} fuentes</span>
        </div>
        <DataTable rows={sourceRows} empty="No hay fuentes para los filtros activos." />
      </section>
    </div>
  );
}

function AcreditacionAuditoriaView({
  cases,
  issues,
}: {
  cases: MonitoreoInternalQueryCase[];
  issues: Array<Record<string, unknown>>;
}) {
  const auditRows = caseAuditRows(cases);
  const noCrossing = cases.filter(caseWithoutCrossing).length;
  const duplicates = cases.filter((item) => Number(item.duplicate_count ?? item.duplicate_group_size ?? 0) > 1).length;
  const partials = cases.filter((item) => internalCaseResponseStateValue(item) === "partial").length;
  return (
    <div className="mon-profile-stack">
      <div className="mon-profile-stat-row">
        <StatTile label="Casos auditables" value={fmt(auditRows.length)} tone={auditRows.length ? "warn" : "good"} />
        <StatTile label="Sin cruce" value={fmt(noCrossing)} tone={noCrossing ? "warn" : "good"} />
        <StatTile label="Duplicados" value={fmt(duplicates)} tone={duplicates ? "warn" : "neutral"} />
        <StatTile label="Parciales" value={fmt(partials)} tone={partials ? "warn" : "neutral"} />
      </div>
      <section className="mon-profile-panel">
        <div className="mon-profile-panel-head">
          <h3>Casos que explican diferencias</h3>
          <span>{fmt(auditRows.length)} filas</span>
        </div>
        <DataTable rows={auditRows} empty="No hay casos auditables con los filtros activos." />
      </section>
      <section className="mon-profile-panel">
        <div className="mon-profile-panel-head">
          <h3>Alertas internas</h3>
          <span>{fmt(issues.length)} alertas</span>
        </div>
        <DataTable rows={issues} empty="No hay alertas internas para este corte." />
      </section>
    </div>
  );
}

function AcreditacionConsultasPanel({ reports }: { reports: MonitoreoAcreditacionReports }) {
  const model = useMemo(() => normalizeInternalQueries(reports.internal_queries), [reports.internal_queries]);
  const officialCases = useMemo(() => (
    model.case_rollup?.length ? model.case_rollup : model.cases
  ), [model.case_rollup, model.cases]);
  const [activeTab, setActiveTab] = useState<AcreditacionConsultaTab>("casos");
  const [filters, setFilters] = useState<AcreditacionCaseFilters>({ ...EMPTY_CASE_FILTERS });
  const [selectedId, setSelectedId] = useState("");
  const filteredCases = useMemo(() => officialCases.filter((item) => caseMatchesFilters(item, filters)), [filters, officialCases]);
  const actorFacetCases = useMemo(() => officialCases.filter((item) => caseMatchesFilters(item, { ...filters, actor: "" })), [filters, officialCases]);
  const responseFacetCases = useMemo(() => officialCases.filter((item) => caseMatchesFilters(item, { ...filters, response: "" })), [filters, officialCases]);
  const crossingFacetCases = useMemo(() => officialCases.filter((item) => caseMatchesFilters(item, { ...filters, crossing: "" })), [filters, officialCases]);
  const actorOptions = useMemo(
    () => countCaseOptions(actorFacetCases, (item) => item.actor),
    [actorFacetCases],
  );
  const responseOptions = useMemo(
    () => countCaseOptions(responseFacetCases, internalCaseResponseStateValue, internalCaseResponseStateLabel, RESPONSE_FILTER_ORDER),
    [responseFacetCases],
  );
  const crossingChipOptions = useMemo(
    () => countCaseOptions(crossingFacetCases, internalCaseCrossingValue, internalCaseCrossingLabel),
    [crossingFacetCases],
  );
  const summary = useMemo(() => summarizeInternalCases(filteredCases), [filteredCases]);
  const allSummary = useMemo(() => summarizeInternalCases(officialCases), [officialCases]);
  const selectedCase = filteredCases.find((item) => caseIdentity(item) === selectedId) ?? filteredCases[0] ?? null;
  const visibleCases = filteredCases.slice(0, 180);
  const queryTabCounts = useMemo<Record<AcreditacionConsultaTab, number>>(() => ({
    casos: filteredCases.length,
    cruces: groupedCaseRows(filteredCases, internalCaseCrossingValue, internalCaseCrossingLabel).length,
    auditoria: caseAuditRows(filteredCases).length + model.issues.length,
  }), [filteredCases, model.issues.length]);
  const patchFilters = (patch: Partial<AcreditacionCaseFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
    setSelectedId("");
  };
  const clearFilters = () => {
    setFilters({ ...EMPTY_CASE_FILTERS });
    setSelectedId("");
  };
  return (
    <div className="mon-acr-cases">
      <AcreditacionCaseOverview
        summary={summary}
        allSummary={allSummary}
        filteredCount={filteredCases.length}
        totalCount={officialCases.length}
      />
      <AcreditacionConsultaTabs active={activeTab} counts={queryTabCounts} onChange={setActiveTab} />

      <div className="mon-acr-case-filter-board" aria-label="Filtros principales de casos">
        <AcreditacionCaseFilterChips
          label="Actor"
          value={filters.actor}
          allLabel="Todos"
          allCount={actorFacetCases.length}
          options={actorOptions}
          onChange={(actor) => patchFilters({ actor })}
        />
        <AcreditacionCaseFilterChips
          label="Estado de respuesta"
          value={filters.response}
          allLabel="Todas"
          allCount={responseFacetCases.length}
          options={responseOptions}
          onChange={(response) => patchFilters({ response })}
        />
        <AcreditacionCaseFilterChips
          label="Cruce"
          value={filters.crossing}
          allLabel="Todos"
          allCount={crossingFacetCases.length}
          options={crossingChipOptions}
          onChange={(crossing) => patchFilters({ crossing })}
        />
      </div>

      <section className="mon-acr-case-toolbar" aria-label="Filtros de casos de acreditación">
        <label>
          <span><Search size={12} /> Buscar</span>
          <input
            value={filters.search}
            onChange={(event) => patchFilters({ search: event.target.value })}
            placeholder="Nombre, código, correo o response_id..."
          />
        </label>
        <div className="mon-acr-case-toolbar__status">
          <Filter size={13} />
          <span>{Object.values(filters).some(Boolean) ? `${fmt(filteredCases.length)} casos filtrados` : "Sin filtros activos"}</span>
        </div>
        <button type="button" onClick={clearFilters} disabled={!Object.values(filters).some(Boolean)}>Limpiar filtros</button>
      </section>

      {activeTab === "casos" ? <div className="mon-acr-case-grid">
        <section className="mon-profile-panel mon-acr-case-table-panel">
          <div className="mon-profile-panel-head">
            <h3>Casos, respuesta y cruce</h3>
            <span>{fmt(filteredCases.length)} de {fmt(officialCases.length)} personas</span>
          </div>
          {visibleCases.length ? (
            <div className="mon-acr-case-table-wrap">
              <table className="mon-acr-case-table">
                <thead>
                  <tr>
                    <th>Persona / llave</th>
                    <th>Respuesta</th>
                    <th>Cruce</th>
                    <th>Response ID</th>
                    <th>Canal / responsable</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleCases.map((item) => {
                    const id = caseIdentity(item);
                    const selected = selectedCase && id === caseIdentity(selectedCase);
                    const response = internalCaseResponseStateValue(item);
                    const crossing = internalCaseCrossingValue(item);
                    return (
                      <tr key={id} className={`${caseToneClass(item)}${selected ? " is-selected" : ""}`}>
                        <td>
                          <button type="button" aria-pressed={selected} onClick={() => setSelectedId(id)}>
                            <strong>{caseDisplayName(item)}</strong>
                            <small>{item.actor || "Sin actor"} · {item.case_key || "sin llave"}</small>
                          </button>
                        </td>
                        <td>
                          <CaseStatusPill value={response} />
                          <small>Avance: {advancementLabel(item.advancement)}</small>
                        </td>
                        <td>
                          <CaseCrossingPill value={crossing} />
                          <small>{item.base_record || item.base_source || item.base_result || "Sin base"}</small>
                        </td>
                        <td>
                          <span>{item.response_id || "sin response_id"}</span>
                          <small>{item.date || "sin fecha"} · {item.source_label || "SurveyMonkey"}</small>
                        </td>
                        <td>
                          <span>{internalQueryCollectorDisplayLabel(item)}</span>
                          <small>{item.channel || "Sin canal"}</small>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mon-profile-muted">No hay casos con los filtros activos.</p>
          )}
        </section>

        <aside className="mon-acr-case-detail" aria-label="Detalle del caso seleccionado">
          {selectedCase ? (
            <>
              <span>Detalle del caso</span>
              <strong>{caseDisplayName(selectedCase)}</strong>
              <dl>
                <div><dt>Respuesta</dt><dd>{internalCaseResponseStateLabel(internalCaseResponseStateValue(selectedCase))}</dd></div>
                <div><dt>Cruce</dt><dd>{internalCaseCrossingLabel(internalCaseCrossingValue(selectedCase))}</dd></div>
                <div><dt>Decisión</dt><dd>{selectedCase.decision || advancementLabel(selectedCase.advancement)}</dd></div>
                <div><dt>Motivo</dt><dd>{selectedCase.decision_reason || selectedCase.rule || selectedCase.issue_type || "Regla estándar"}</dd></div>
                <div><dt>Llave</dt><dd>{selectedCase.case_key || "Sin llave"}</dd></div>
                <div><dt>Response ID</dt><dd>{selectedCase.response_id || "Sin response_id"}</dd></div>
                <div><dt>Base</dt><dd>{selectedCase.base_record || selectedCase.base_source || selectedCase.base_result || "Sin base"}</dd></div>
                <div><dt>Responsable</dt><dd>{internalQueryCollectorDisplayLabel(selectedCase)}</dd></div>
              </dl>
            </>
          ) : (
            <p className="mon-profile-muted">Selecciona una fila para revisar decisión, llave y fuente.</p>
          )}
        </aside>
      </div> : null}

      {visibleCases.length < filteredCases.length && activeTab === "casos" ? (
        <p className="mon-acr-case-note">Mostrando las primeras {fmt(visibleCases.length)} filas para mantener la consulta ágil. Usa búsqueda o filtros para acotar.</p>
      ) : null}
      {activeTab === "cruces" ? <AcreditacionCrucesView cases={filteredCases} /> : null}
      {activeTab === "auditoria" ? (
        <AcreditacionAuditoriaView
          cases={filteredCases}
          issues={model.issues as unknown as Array<Record<string, unknown>>}
        />
      ) : null}
    </div>
  );
}

function EmptyPanel({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="mon-profile-empty">
      <span className="mon-profile-empty__icon"><ClipboardCheck size={18} /></span>
      <strong>{title}</strong>
      <p>{detail}</p>
    </div>
  );
}

function renderAcreditacionView(
  view: WorkbenchView,
  reports: MonitoreoAcreditacionReports | null,
  options: {
    activeAdvanceTab?: AcreditacionAdvanceTab;
    state?: MonitoreoState | null;
    onPublished?: () => void;
    routeLabel?: string;
  } = {},
) {
  if (view === "avance" && options.activeAdvanceTab === "salidas") {
    const state = options.state;
    return (
      <MonitoreoOutputsWorkbench
        family="acreditacion"
        routeLabel={options.routeLabel ?? "Acreditación"}
        defaultTitle={state?.config?.acreditacion?.estudio?.titulo || "reporte-monitoreo"}
        config={state?.config}
        clientSheets={state?.publication?.client_last_sheets ?? null}
        internalSheets={state?.publication?.internal_last_sheets ?? null}
        hasSnapshot={Boolean(state?.has_snapshot)}
        nRows={state?.n_rows ?? 0}
        syncedAt={state?.synced_at ?? ""}
        onPublished={options.onPublished}
      />
    );
  }
  if (!reports) {
    return <EmptyPanel title="Resumen pendiente" detail="Todavia no hay reporte local preparado para esta vista." />;
  }
  const client = reports.client_report;
  if (view === "fuentes") {
    const sourceRows = client?.sources?.length ? client.sources : rowsFromSheets(reports.sheets, ["fuente", "source"]);
    return (
      <section className="mon-profile-panel">
        <div className="mon-profile-panel-head">
          <h3>Fuentes configuradas</h3>
          <span>{fmt(sourceRows.length)} filas</span>
        </div>
        <DataTable rows={sourceRows as Array<Record<string, unknown>>} empty="No hay fuentes en el resumen local." />
      </section>
    );
  }
  if (view === "consultas" || view === "modelo") {
    return <AcreditacionConsultasPanel reports={reports} />;
  }
  if (view === "telefonico") {
    return renderPhoneView(reports);
  }
  const actorRows = client?.actors?.length ? client.actors : rowsFromSheets(reports.sheets, ["actor", "avance", "brecha"]);
  const dailyRows = client?.daily_general ?? [];
  return (
    <div className="mon-profile-stack">
      <div className="mon-profile-grid">
        <section className="mon-profile-panel">
          <div className="mon-profile-panel-head">
            <h3>Avance por actor</h3>
            <span>{fmt(actorRows.length)} filas</span>
          </div>
          <DataTable rows={actorRows as Array<Record<string, unknown>>} empty="No hay avance por actor preparado." />
        </section>
        <section className="mon-profile-panel">
          <div className="mon-profile-panel-head">
            <h3>Ritmo diario</h3>
            <span>{fmt(dailyRows.length)} dias</span>
          </div>
          <DataTable rows={dailyRows as Array<Record<string, unknown>>} empty="No hay serie diaria preparada." />
        </section>
      </div>
    </div>
  );
}

export function AcreditacionProfilePage({ mode = "acreditacion" }: { mode?: AcreditacionProfileMode }) {
  const isPhone = mode === "telefonico";
  const profileLabel = isPhone ? "Monitoreo telefónico" : "Acreditación";
  const contextLabel = isPhone ? "Telefónico" : "Acreditación";
  const activeFlowLabel = isPhone ? "Telefónico · flujo actual" : "Acreditación · flujo actual";
  const railLabel = isPhone ? "Secciones de monitoreo telefónico" : "Secciones de monitoreo de acreditación";
  const statusLabel = isPhone ? "Estado telefónico" : "Estado + progreso";
  const BrandIcon = isPhone ? PhoneCall : ClipboardCheck;
  const views = isPhone ? TELEFONICO_VIEWS : ACREDITACION_VIEWS;
  const [state, setState] = useState<MonitoreoState | null>(null);
  const [activeView, setActiveView] = useState<WorkbenchView>(isPhone ? "telefonico" : "fuentes");
  const [activeAdvanceTab, setActiveAdvanceTab] = useState<AcreditacionAdvanceTab>("resumen");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const activeViewRef = useRef<WorkbenchView>(activeView);
  const loadSeqRef = useRef(0);

  const activeDef = useMemo(
    () => WORKBENCH_VIEWS.find((item) => item.key === activeView) ?? WORKBENCH_VIEWS[0],
    [activeView],
  );
  const reports = reportsFromState(state);
  const kpis = state?.dashboard?.kpis ?? null;
  const acreditacionState = useMemo(
    () => stateFromReports(reports, num(kpis?.total ?? state?.n_rows, 0), num(kpis?.valid, 0)),
    [kpis?.total, kpis?.valid, reports, state?.n_rows],
  );

  const loadView = useCallback(async (view: WorkbenchView, force = false) => {
    const seq = ++loadSeqRef.current;
    setLoading(true);
    try {
      const next = await apiMonitoreoState({
        includeReports: true,
        reportScope: scopeForView(view),
        warmupCache: !force,
        force,
      });
      if (seq !== loadSeqRef.current || view !== activeViewRef.current) return;
      setState(next);
      setError("");
    } catch (e) {
      if (seq !== loadSeqRef.current || view !== activeViewRef.current) return;
      setError((e as Error).message);
    } finally {
      if (seq === loadSeqRef.current && view === activeViewRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    activeViewRef.current = activeView;
  }, [activeView]);

  useEffect(() => {
    void loadView(activeView);
  }, [activeView, loadView]);
  const refreshCurrentView = useCallback(() => {
    void loadView(activeView, true);
  }, [activeView, loadView]);

  return (
    <div className="mon-profile-page" style={MODULE_TONES.monitoreo as CSSProperties}>
      <header className="mon-profile-topbar">
        <div className="mon-profile-brand">
          <span className="mon-profile-brand__icon"><BrandIcon size={18} /></span>
          <div>
            <strong>{profileLabel}</strong>
            <span>{fmt(state?.n_rows)} registros</span>
          </div>
        </div>
        <nav className="mon-profile-rail" aria-label={railLabel}>
          {views.map((view, index) => {
            const def = WORKBENCH_VIEWS.find((item) => item.key === view);
            const Icon = def?.icon ?? BrandIcon;
            return (
              <button key={view} type="button" className={view === activeView ? "is-active" : ""} onClick={() => setActiveView(view)}>
                <span>{index + 1}</span>
                <Icon size={14} />
                {def?.shortLabel ?? def?.label ?? view}
              </button>
            );
          })}
        </nav>
        <div className="mon-profile-actions">
          <button type="button" onClick={() => void loadView(activeView, true)}>
            <RefreshCw size={14} />
            Actualizar vista
          </button>
        </div>
      </header>

      <main className="mon-profile-workbench">
        <aside className="mon-profile-sidebar">
          <div className="mon-profile-context">
            <span>PATH ACTIVO</span>
            <strong>{contextLabel}</strong>
            <small>{activeDef.label}</small>
          </div>
          <div className="mon-profile-readiness">
            <span>{reports ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}</span>
            <div>
              <strong>{reports ? "Vista lista" : "Preparando vista"}</strong>
              <small>{reports?.report_scope ?? "Memoria local"}</small>
            </div>
          </div>
        </aside>

        <section className="mon-profile-content">
          <div className="mon-profile-head">
            <div>
              <span>{activeFlowLabel}</span>
              <h2>{activeDef.label}</h2>
              <p>{activeDef.desc}</p>
            </div>
            <EstadoProgresoPanel summary={acreditacionState} label={statusLabel} />
          </div>
          {activeView === "avance" ? (
            <div className="mon-profile-local-tabs" role="tablist" aria-label="Pestañas de avance de acreditación">
              {ACREDITACION_ADVANCE_TABS.map((tab) => {
                const Icon = tab.icon;
                const active = activeAdvanceTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className={active ? "is-active" : ""}
                    onClick={() => setActiveAdvanceTab(tab.key)}
                  >
                    <Icon size={14} />
                    <span>
                      <strong>{tab.label}</strong>
                      <em>{tab.detail}</em>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
          {error ? <div className="mon-profile-error"><AlertCircle size={16} /> {error}</div> : null}
          {loading ? (
            <EmptyPanel title="Preparando vista" detail="Leyendo cache local del proyecto..." />
          ) : renderAcreditacionView(activeView, reports, {
            activeAdvanceTab,
            state,
            onPublished: refreshCurrentView,
            routeLabel: profileLabel,
          })}
        </section>
      </main>
    </div>
  );
}

export default function AcreditacionMonitoreoPage() {
  return <AcreditacionProfilePage mode="acreditacion" />;
}
