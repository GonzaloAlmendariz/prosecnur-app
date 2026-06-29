import { useMemo, useState } from "react";
import { CalendarRange, Clock, ContactRound, ListChecks, Search, Table2, Target, XCircle } from "lucide-react";
import type {
  MonitoreoTerritorialDashboard,
  TerritorialQuotaProgressBlock,
} from "../../../../api/client";

type TerritorialQuotaConsistencyFilter = "complete" | "subsanada" | "pending" | "in_field" | "missing";
type TerritorialQuotaStatus = "complete" | "subsanada" | "in_field" | "pending" | "missing" | "not_configured";
type TerritorialQuotaSummary = {
  total: number;
  complete: number;
  subsanada: number;
  in_field: number;
  pending: number;
  partial: number;
  missing: number;
  exceeded: number;
  not_configured: number;
  sex_missing_total: number;
  age_missing_total: number;
  demographic_missing_total: number;
  districts_with_gap: number;
};

export function TerritorialQuotaConsistencyPanel({ reports }: { reports: MonitoreoTerritorialDashboard }) {
  const quota = reports.route_quota_progress ?? null;
  const blocks = quota?.blocks ?? [];
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<TerritorialQuotaConsistencyFilter | null>(null);
  const [showReplacements, setShowReplacements] = useState(true);
  const replacementCount = useMemo(
    () => blocks.filter((block) => stringOrEmpty(block.tipo_manzana).toLowerCase() === "reemplazo").length,
    [blocks],
  );
  const visibleBlocks = useMemo(
    () => blocks.filter((block) => showReplacements || stringOrEmpty(block.tipo_manzana).toLowerCase() !== "reemplazo"),
    [blocks, showReplacements],
  );
  const summary = useMemo(() => summarizeTerritorialQuotaProgressBlocks(visibleBlocks), [visibleBlocks]);
  const orderedBlocks = useMemo(() => {
    const query = normalizeMatch(search);
    return [...visibleBlocks]
      .filter((block) => block.configured || territorialQuotaStatus(block.status) !== "not_configured")
      .filter((block) => {
        const status = territorialQuotaStatus(block.status);
        if (filter && status !== filter) return false;
        if (!query) return true;
        const haystack = normalizeMatch([
          block.id_manzana,
          block.distrito,
          block.ubigeo,
          block.zona,
          block.manzana,
          block.ump,
          block.responsable,
          block.responsible,
          territorialQuotaStatusLabel(status),
          ...(block.sex ?? []).map((item) => item.label),
          ...(block.age ?? []).map((item) => item.label),
        ].join(" "));
        return haystack.includes(query);
      })
      .sort(compareTerritorialQuotaBlocks);
  }, [filter, search, visibleBlocks]);

  const filterOptions: Array<{ key: TerritorialQuotaConsistencyFilter | "all"; label: string; value: number }> = [
    { key: "complete", label: "Completas", value: summary.complete },
    { key: "subsanada", label: "Subsanadas", value: summary.subsanada },
    { key: "pending", label: "Cuota pendiente", value: summary.pending },
    { key: "in_field", label: "En campo", value: summary.in_field },
    { key: "missing", label: "No iniciadas", value: summary.missing },
    { key: "all", label: "Todas", value: summary.total },
  ];

  return (
    <section className="mon-territorial-quota-consistency" aria-label="Consistencia de cuotas por manzana">
      <header className="mon-territorial-quota-commandbar">
        <div className="mon-territorial-quota-command-title">
          <span><Target size={14} /> Cuotas por manzana</span>
          <strong>{quota?.configured ? `${formatMetric(summary.total)} ${showReplacements ? "manzanas evaluadas" : "titulares evaluadas"}` : "Cuotas no disponibles"}</strong>
        </div>
        <label className="mon-territorial-quota-search">
          <Search size={13} />
          <input
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
            placeholder="Buscar UMP, distrito, responsable o rango"
          />
        </label>
        <div className="mon-territorial-quota-command-actions">
          <label
            className={`mon-territorial-quota-replacement-toggle ${showReplacements ? "is-active" : ""}`}
            title={showReplacements ? "Ocultar manzanas de reemplazo" : "Incluir manzanas de reemplazo"}
          >
            <input
              type="checkbox"
              checked={showReplacements}
              onChange={(event) => setShowReplacements(event.currentTarget.checked)}
            />
            <ListChecks size={13} />
            <span>Reemplazos</span>
            <strong>{showReplacements ? "Sí" : formatMetric(replacementCount)}</strong>
          </label>
          <div role="group" aria-label="Filtrar cuotas por estado">
            {filterOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                className={(option.key === "all" ? filter === null : filter === option.key) ? "is-active" : ""}
                aria-pressed={option.key === "all" ? filter === null : filter === option.key}
                onClick={() => setFilter((current) => option.key === "all" ? null : current === option.key ? null : option.key)}
              >
                <span>{option.label}</span>
                <strong>{formatMetric(option.value)}</strong>
              </button>
            ))}
          </div>
          {search ? (
            <button type="button" className="mon-territorial-quota-clear" onClick={() => setSearch("")}>
              <XCircle size={13} />
              <span>Limpiar</span>
            </button>
          ) : null}
        </div>
      </header>

      {quota?.configured && orderedBlocks.length ? (
        <div className="mon-territorial-quota-block-list" aria-label="Manzanas y cumplimiento de cuota">
          {orderedBlocks.map((block) => (
            <TerritorialQuotaBlockCard key={block.id_manzana || `${block.ubigeo}-${block.zona}-${block.manzana}-${block.ump}`} block={block} />
          ))}
        </div>
      ) : (
        <div className="mon-territorial-quota-empty">
          <Target size={18} />
          <strong>{quota?.configured ? "Sin manzanas con esos filtros" : "Sin cuota territorial configurada"}</strong>
          <span>{quota?.configured ? "Prueba otro distrito, UMP o estado de cuota." : "Cuando Hojas de Ruta tenga sexo y rangos de edad, Monitoreo evaluará los márgenes por manzana."}</span>
        </div>
      )}
    </section>
  );
}

function TerritorialQuotaBlockCard({ block }: { block: TerritorialQuotaProgressBlock }) {
  const status = territorialQuotaStatus(block.status);
  const target = Math.max(0, numberOrNull(block.target) ?? 0);
  const validas = Math.max(0, numberOrNull(block.validas) ?? 0);
  const progressPct = target > 0 ? Math.min(140, Math.max(0, (validas / target) * 100)) : 0;
  const responsible = territorialQuotaBlockResponsibleLabel(block);
  const activity = territorialQuotaBlockActivityLabel(block);
  return (
    <article className={`mon-territorial-quota-block-card is-${status}`}>
      <header>
        <div>
          <span>{territorialQuotaBlockSecondaryLabel(block)}</span>
          <strong>{territorialQuotaBlockPrimaryLabel(block)}</strong>
        </div>
        <b>{territorialQuotaStatusLabel(status)}</b>
      </header>
      <div className="mon-territorial-quota-block-meta">
        <span title={responsible}><ContactRound size={12} /><strong>Responsable</strong><em>{responsible}</em></span>
        <span title={activity}><Clock size={12} /><strong>Actividad</strong><em>{activity}</em></span>
      </div>
      <div className="mon-territorial-quota-total-meter" aria-label={`Avance total ${formatPercentLabel(progressPct)}`}>
        <i style={{ width: `${Math.min(100, progressPct)}%` }} />
      </div>
      <div className="mon-territorial-quota-margins">
        <TerritorialQuotaMarginGroup title="Sexo" icon={ContactRound} rows={block.sex ?? []} empty="Sin cuota por sexo" />
        <TerritorialQuotaMarginGroup title="Edad" icon={CalendarRange} rows={block.age ?? []} empty="Sin cuota por edad" />
      </div>
      <TerritorialQuotaObservedCrossMatrix cross={block.observed_cross ?? null} />
    </article>
  );
}

function TerritorialQuotaObservedCrossMatrix({ cross }: { cross: TerritorialQuotaProgressBlock["observed_cross"] | null | undefined }) {
  const rows = cross?.rows ?? [];
  const columns = cross?.columns ?? [];
  const total = Math.max(0, Math.round(numberOrNull(cross?.total_consentido ?? cross?.total) ?? 0));
  const hasMatrix = rows.length > 0 && columns.length > 0;
  return (
    <section className="mon-territorial-quota-observed" aria-label="Llenado observado por sexo y edad">
      <header>
        <span><Table2 size={13} /> Llenado observado</span>
        <strong>{formatMetric(total)} consentidos</strong>
      </header>
      {hasMatrix ? (
        <div className="mon-territorial-quota-observed-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Sexo</th>
                {columns.map((column) => (
                  <th key={column.label} scope="col">{column.label}</th>
                ))}
                <th scope="col">Total sexo</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const cells = new Map((row.cells ?? []).map((cell) => [stringOrEmpty(cell.label || cell.age), Math.max(0, Math.round(numberOrNull(cell.value) ?? 0))]));
                const rowTotal = Math.max(0, Math.round(numberOrNull(row.total) ?? 0));
                const rowTarget = Math.max(0, Math.round(numberOrNull(row.target) ?? 0));
                return (
                  <tr key={row.label}>
                    <th scope="row">{row.label}</th>
                    {columns.map((column) => {
                      const value = cells.get(column.label) ?? 0;
                      return (
                        <td key={`${row.label}-${column.label}`} className={value > 0 ? "" : "is-empty"}>
                          {formatMetric(value)}
                        </td>
                      );
                    })}
                    <td className="is-total">
                      <strong>{formatMetric(rowTotal)}</strong>
                      {rowTarget > 0 ? <em>/ {formatMetric(rowTarget)}</em> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Total edad</th>
                {columns.map((column) => {
                  const columnTotal = Math.max(0, Math.round(numberOrNull(column.total) ?? 0));
                  const columnTarget = Math.max(0, Math.round(numberOrNull(column.target) ?? 0));
                  return (
                    <td key={`total-${column.label}`}>
                      <strong>{formatMetric(columnTotal)}</strong>
                      {columnTarget > 0 ? <em>/ {formatMetric(columnTarget)}</em> : null}
                    </td>
                  );
                })}
                <td className="is-total">
                  <strong>{formatMetric(total)}</strong>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <p className="mon-territorial-quota-observed-empty">Sin registros consentidos asociados a esta UMP.</p>
      )}
      <p>El cruce es descriptivo; la cuota se evalúa por totales de sexo y edad.</p>
    </section>
  );
}

function TerritorialQuotaMarginGroup({
  title,
  icon: Icon,
  rows,
  empty,
}: {
  title: string;
  icon: typeof ContactRound | typeof CalendarRange;
  rows: TerritorialQuotaProgressBlock["sex"];
  empty: string;
}) {
  const target = rows.reduce((sum, item) => sum + Math.max(0, numberOrNull(item.target) ?? 0), 0);
  const achieved = rows.reduce((sum, item) => sum + Math.max(0, numberOrNull(item.achieved) ?? 0), 0);
  return (
    <section className="mon-territorial-quota-margin-group">
      <header>
        <span><Icon size={13} /> {title}</span>
        <strong>{rows.length ? `${formatMetric(achieved)} / ${formatMetric(target)}` : empty}</strong>
      </header>
      {rows.length ? (
        <div>
          {rows.map((item) => (
            <TerritorialQuotaMarginRow key={`${title}-${item.label}`} item={item} />
          ))}
        </div>
      ) : (
        <p>{empty}</p>
      )}
    </section>
  );
}

function TerritorialQuotaMarginRow({ item }: { item: TerritorialQuotaProgressBlock["sex"][number] }) {
  const target = Math.max(0, numberOrNull(item.target) ?? 0);
  const achieved = Math.max(0, numberOrNull(item.achieved) ?? 0);
  const missing = Math.max(0, numberOrNull(item.missing) ?? Math.max(0, target - achieved));
  const pct = territorialQuotaItemPercent(item);
  const tone = territorialQuotaItemTone(item);
  return (
    <span className={`mon-territorial-quota-margin-row is-${tone}`}>
      <strong title={item.label}>{item.label}</strong>
      <em>{formatMetric(achieved)} / {formatMetric(target)}</em>
      <i><b style={{ width: `${Math.min(100, pct)}%` }} /></i>
      <small>{missing > 0 ? `faltan ${formatMetric(missing)}` : achieved > target ? `+${formatMetric(achieved - target)}` : "ok"}</small>
    </span>
  );
}

function territorialQuotaStatus(value: string | undefined | null): TerritorialQuotaStatus {
  const status = stringOrEmpty(value);
  if (status === "exceeded") return "complete";
  if (status === "subsanada" || status === "subsanado" || status === "subsanacion" || status === "subsanacion_operativa") return "subsanada";
  if (status === "partial") return "pending";
  return status === "complete" || status === "subsanada" || status === "in_field" || status === "pending" || status === "missing" || status === "not_configured"
    ? status
    : "not_configured";
}

function territorialQuotaStatusLabel(status: TerritorialQuotaStatus) {
  const labels: Record<TerritorialQuotaStatus, string> = {
    complete: "Completa",
    subsanada: "Subsanada",
    in_field: "En campo",
    pending: "Cuota pendiente",
    missing: "No iniciada",
    not_configured: "Sin cuota",
  };
  return labels[status];
}

function territorialQuotaBlockResponsibleLabel(block: TerritorialQuotaProgressBlock) {
  const label = stringOrEmpty(block.responsable || block.responsible).trim();
  if (label && !territorialMissingResponsibleLabel(label)) return label;
  return "-";
}

function territorialQuotaCompactActivityLabel(value: string) {
  return value
    .replace(/^(?:hoy|ultimo registro|último registro)\s*·\s*/i, "")
    .replace(/\s*,\s*/g, " ")
    .replace(/\b0(?=\d:\d{2}(?:am|pm)\b)/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function territorialQuotaBlockActivityLabel(block: TerritorialQuotaProgressBlock) {
  const date = territorialQuotaCompactActivityLabel(stringOrEmpty(block.last_response_date_label || block.last_response_date_iso));
  if (date) return date;
  return "Sin registro Kobo";
}

function compareTerritorialQuotaBlocks(a: TerritorialQuotaProgressBlock, b: TerritorialQuotaProgressBlock) {
  return compareTerritorialUmpValues(a.ump, b.ump)
    || (stringOrEmpty(a.tipo_manzana) === "reemplazo" ? 1 : 0) - (stringOrEmpty(b.tipo_manzana) === "reemplazo" ? 1 : 0)
    || stringOrEmpty(a.id_manzana).localeCompare(stringOrEmpty(b.id_manzana), "es-PE", { numeric: true });
}

function compareTerritorialUmpValues(a: unknown, b: unknown) {
  const numberDiff = territorialUmpNumber(a) - territorialUmpNumber(b);
  if (numberDiff !== 0) return numberDiff;
  return stringOrEmpty(a).trim().localeCompare(stringOrEmpty(b).trim(), "es-PE", { numeric: true });
}

function territorialUmpNumber(value: unknown) {
  const raw = stringOrEmpty(value).trim();
  const match = raw.match(/\d+/);
  if (!match) return Number.POSITIVE_INFINITY;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

function emptyTerritorialQuotaSummary(): TerritorialQuotaSummary {
  return {
    total: 0,
    complete: 0,
    subsanada: 0,
    in_field: 0,
    pending: 0,
    partial: 0,
    missing: 0,
    exceeded: 0,
    not_configured: 0,
    sex_missing_total: 0,
    age_missing_total: 0,
    demographic_missing_total: 0,
    districts_with_gap: 0,
  };
}

function summarizeTerritorialQuotaProgressBlocks(blocks: TerritorialQuotaProgressBlock[]) {
  return blocks.reduce((acc, row) => {
    acc.total += 1;
    const status = territorialQuotaStatus(row.status);
    if (status === "subsanada") {
      acc.subsanada += 1;
      acc.complete += 1;
    } else {
      acc[status] += 1;
    }
    acc.sex_missing_total += territorialQuotaBlockSexMissingTotal(row);
    acc.age_missing_total += territorialQuotaBlockAgeMissingTotal(row);
    acc.demographic_missing_total += territorialQuotaBlockDemographicMissingTotal(row);
    return acc;
  }, emptyTerritorialQuotaSummary());
}

function territorialQuotaBlockSexMissingTotal(block: TerritorialQuotaProgressBlock) {
  return Math.max(0, Math.round(numberOrNull(block.sex_missing_total) ?? territorialQuotaItemMissingTotal(block.sex)));
}

function territorialQuotaBlockAgeMissingTotal(block: TerritorialQuotaProgressBlock) {
  return Math.max(0, Math.round(numberOrNull(block.age_missing_total) ?? territorialQuotaItemMissingTotal(block.age)));
}

function territorialQuotaBlockDemographicMissingTotal(block: TerritorialQuotaProgressBlock) {
  return Math.max(0, Math.round(numberOrNull(block.demographic_missing_total) ?? (territorialQuotaBlockSexMissingTotal(block) + territorialQuotaBlockAgeMissingTotal(block))));
}

function territorialQuotaItemMissingTotal(rows: TerritorialQuotaProgressBlock["sex"] | undefined) {
  return (rows ?? []).reduce((sum, item) => (
    sum + Math.max(0, Math.round(numberOrNull(item.missing) ?? Math.max(0, (numberOrNull(item.target) ?? 0) - (numberOrNull(item.achieved) ?? 0))))
  ), 0);
}

function territorialQuotaBlockPrimaryLabel(block: TerritorialQuotaProgressBlock) {
  const ump = stringOrEmpty(block.ump).trim();
  if (ump) return `UMP ${ump}`;
  if (block.zona || block.manzana) return `Z${block.zona || "S/D"} · M${block.manzana || "S/D"}`;
  return block.id_manzana || "Manzana sin código";
}

function territorialQuotaBlockSecondaryLabel(block: TerritorialQuotaProgressBlock) {
  const parts = [
    block.distrito || "Sin distrito",
    block.zona ? `Zona ${block.zona}` : "",
    block.manzana ? `Mz ${block.manzana}` : "",
    block.tipo_manzana === "reemplazo" ? "Reemplazo" : "Titular",
  ].filter(Boolean);
  return parts.join(" · ");
}

function territorialQuotaItemTone(item: TerritorialQuotaProgressBlock["sex"][number]) {
  const target = Math.max(0, numberOrNull(item.target) ?? 0);
  const achieved = Math.max(0, numberOrNull(item.achieved) ?? 0);
  const missing = Math.max(0, numberOrNull(item.missing) ?? Math.max(0, target - achieved));
  if (target > 0 && achieved === 0) return "not_started";
  if (missing > 0) return "warning";
  return "ready";
}

function territorialQuotaItemPercent(item: TerritorialQuotaProgressBlock["sex"][number]) {
  const target = Math.max(0, numberOrNull(item.target) ?? 0);
  const achieved = Math.max(0, numberOrNull(item.achieved) ?? 0);
  return target > 0 ? Math.min(140, Math.max(0, (achieved / target) * 100)) : 0;
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

function formatMetric(value: unknown, fallback = "0") {
  const number = numberOrNull(value);
  if (number == null) return fallback;
  return new Intl.NumberFormat("es-PE", { maximumFractionDigits: 0 }).format(number);
}

function formatPercentLabel(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "S/D";
  return `${Math.round(value)}%`;
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
