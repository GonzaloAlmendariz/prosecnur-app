import { memo, useMemo, useState } from "react";
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

function TerritorialQuotaConsistencyPanelImpl({ reports }: { reports: MonitoreoTerritorialDashboard }) {
  const quota = reports.route_quota_progress ?? null;
  const blocks = quota?.blocks ?? [];
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<TerritorialQuotaConsistencyFilter | null>(null);
  const [showReplacements, setShowReplacements] = useState(true);
  const hasUmpSummary = Boolean(quota?.ump_summary);
  const replacementCount = useMemo(
    () => blocks.filter(territorialQuotaBlockIsReplacement).length,
    [blocks],
  );
  const visibleBlocks = useMemo(
    () => blocks.filter((block) => showReplacements || !territorialQuotaBlockIsReplacement(block)),
    [blocks, showReplacements],
  );
  const listBlocks = useMemo(
    () => blocks.filter((block) => (
      filter && hasUmpSummary
        ? territorialQuotaOperationalGroupSelected(block)
        : showReplacements || !territorialQuotaBlockIsReplacement(block)
    )),
    [blocks, filter, hasUmpSummary, showReplacements],
  );
  const rowSummary = useMemo(() => summarizeTerritorialQuotaProgressBlocks(visibleBlocks), [visibleBlocks]);
  const summary = useMemo(
    () => quota?.ump_summary
      ? normalizeTerritorialQuotaSummary(quota.ump_summary, rowSummary)
      : rowSummary,
    [quota?.ump_summary, rowSummary],
  );
  const orderedBlocks = useMemo(() => {
    const query = normalizeMatch(search);
    return [...listBlocks]
      .filter((block) => block.configured || territorialQuotaStatus(block.status) !== "not_configured")
      .filter((block) => {
        const status = territorialQuotaBlockOperationalStatus(block);
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
          territorialQuotaReplacementShortLabel(block),
          territorialQuotaBlockTypeLabel(block),
          territorialQuotaStatusLabel(status),
          territorialQuotaStatusLabel(territorialQuotaStatus(block.status)),
          ...(block.sex ?? []).map((item) => item.label),
          ...(block.age ?? []).map((item) => item.label),
        ].join(" "));
        return haystack.includes(query);
      })
      .sort(compareTerritorialQuotaBlocks);
  }, [filter, listBlocks, search]);

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
          <strong>{quota?.configured ? `${formatMetric(summary.total)} UMP · ${formatMetric(visibleBlocks.length)} ${showReplacements ? "manzanas" : "titulares"}` : "Cuotas no disponibles"}</strong>
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
  const status = territorialQuotaBlockOperationalStatus(block);
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
      <TerritorialQuotaObservedCrossMatrix block={block} />
    </article>
  );
}

function TerritorialQuotaObservedCrossMatrix({ block }: { block: TerritorialQuotaProgressBlock }) {
  const cross = block.observed_cross ?? null;
  const rows = cross?.rows ?? [];
  const columns = cross?.columns ?? [];
  const total = Math.max(0, Math.round(numberOrNull(cross?.total_consentido ?? cross?.total) ?? 0));
  const layers = territorialQuotaBlockLayers(block, total);
  const adjustmentLabels = territorialQuotaAdjustmentTargetLabels(block);
  const adjustmentClass = layers.adjustment > 0
    ? "is-subsanado has-value"
    : layers.adjustment < 0
      ? "is-reassigned has-value"
      : "is-subsanado";
  const hasMatrix = rows.length > 0 && columns.length > 0;
  return (
    <section className="mon-territorial-quota-observed" aria-label="Llenado observado por sexo y edad">
      <header>
        <span><Table2 size={13} /> Encuestadores</span>
        <strong>{formatMetric(layers.observed)} consentidos observados</strong>
      </header>
      <div className="mon-territorial-quota-layer-strip" aria-label="Capas operativas de cuota">
        <span className="is-field">
          <b>Encuestadores</b>
          <strong>{formatMetric(layers.observed)}</strong>
          <em>levantado en campo</em>
        </span>
        <span className={adjustmentClass}>
          <b>{layers.adjustment < 0 ? "Ajuste" : "Subsanado"}</b>
          <strong>{formatSignedMetric(layers.adjustment)}</strong>
          <em>{adjustmentLabels.length ? `${layers.adjustment < 0 ? "Resta de" : "Aporta a"} ${adjustmentLabels.join(" · ")}` : "sin ajuste aplicado"}</em>
        </span>
        <span className={layers.realMissing > 0 ? "is-real-missing" : "is-real-ready"}>
          <b>Falta real</b>
          <strong>{formatMetric(layers.realMissing)}</strong>
          <em>{territorialQuotaRealMissingLabel(block, layers.realMissing)}</em>
        </span>
      </div>
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
                      const cell = (row.cells ?? []).find((item) => stringOrEmpty(item.label || item.age) === column.label);
                      const value = Math.max(0, Math.round(numberOrNull(cell?.value) ?? cells.get(column.label) ?? 0));
                      const adjustmentDelta = Math.round(numberOrNull(cell?.adjustment_delta) ?? 0);
                      const adjustedValue = Math.max(0, value + adjustmentDelta);
                      return (
                        <td
                          key={`${row.label}-${column.label}`}
                          className={`${value > 0 || adjustmentDelta !== 0 ? "" : "is-empty"} ${territorialQuotaAdjustmentClass(adjustmentDelta)}`}
                          title={adjustmentDelta !== 0 ? `${row.label} ${column.label}: ${formatMetric(value)} observado · ajuste ${formatSignedMetric(adjustmentDelta)} · efectivo ${formatMetric(adjustedValue)}` : undefined}
                        >
                          {value > 0 ? <strong>{formatMetric(value)}</strong> : adjustmentDelta === 0 ? formatMetric(value) : null}
                          {adjustmentDelta !== 0 ? <QuotaAdjustmentPill value={adjustmentDelta} compact /> : null}
                        </td>
                      );
                    })}
                    <td className="is-total">
                      <strong>{formatMetric(rowTotal)}</strong>
                      <QuotaAdjustmentPill value={numberOrNull(row.adjustment_delta) ?? 0} />
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
                  const columnAdjustment = Math.round(numberOrNull(column.adjustment_delta) ?? 0);
                  return (
                    <td key={`total-${column.label}`} className={territorialQuotaAdjustmentClass(columnAdjustment)}>
                      <strong>{formatMetric(columnTotal)}</strong>
                      <QuotaAdjustmentPill value={columnAdjustment} />
                      {columnTarget > 0 ? <em>/ {formatMetric(columnTarget)}</em> : null}
                    </td>
                  );
                })}
                <td className="is-total">
                  <strong>{formatMetric(total)}</strong>
                  <QuotaAdjustmentPill value={numberOrNull(cross?.adjustment_delta) ?? 0} />
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <p className="mon-territorial-quota-observed-empty">Sin registros consentidos asociados a esta UMP.</p>
      )}
      <p>La matriz separa lo levantado por encuestadores y los ajustes operativos; la falta real se calcula después de aplicarlos.</p>
    </section>
  );
}

function QuotaAdjustmentPill({ value, compact = false }: { value: number; compact?: boolean }) {
  const delta = Math.round(numberOrNull(value) ?? 0);
  if (delta === 0) return null;
  return (
    <span className={`mon-territorial-quota-cell-adjustment ${delta > 0 ? "is-subsanado" : "is-reassigned"} ${compact ? "is-compact" : ""}`}>
      {formatSignedMetric(delta)}
    </span>
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
  const adjustmentDelta = territorialQuotaItemAdjustmentDelta(item);
  const observed = Math.max(0, achieved - adjustmentDelta);
  const pct = territorialQuotaItemPercent(item);
  const tone = territorialQuotaItemTone(item);
  return (
    <span className={`mon-territorial-quota-margin-row is-${tone} ${adjustmentDelta !== 0 ? "has-adjustment" : ""}`}>
      <strong title={item.label}>{item.label}</strong>
      <em>{formatMetric(achieved)} / {formatMetric(target)}</em>
      <i><b style={{ width: `${Math.min(100, pct)}%` }} /></i>
      <small>{missing > 0 ? `faltan ${formatMetric(missing)}` : achieved > target ? `+${formatMetric(achieved - target)}` : "ok"}</small>
      {adjustmentDelta !== 0 ? (
        <span className="mon-territorial-quota-margin-adjustment">
          <b>Encuestadores {formatMetric(observed)}</b>
          <b className={adjustmentDelta > 0 ? "is-subsanado" : "is-reassigned"}>
            {adjustmentDelta > 0 ? `Subsanado +${formatMetric(adjustmentDelta)}` : `Ajuste ${formatSignedMetric(adjustmentDelta)}`}
          </b>
        </span>
      ) : null}
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

function territorialQuotaBlockOperationalStatus(block: TerritorialQuotaProgressBlock) {
  return territorialQuotaStatus(block.operational_group_status || block.status);
}

function territorialQuotaOperationalGroupSelected(block: TerritorialQuotaProgressBlock) {
  return block.operational_group_selected === true || String(block.operational_group_selected ?? "").toLowerCase() === "true";
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
    || (territorialQuotaBlockIsReplacement(a) ? 1 : 0) - (territorialQuotaBlockIsReplacement(b) ? 1 : 0)
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

function normalizeTerritorialQuotaSummary(value: Partial<TerritorialQuotaSummary> | null | undefined, fallback: TerritorialQuotaSummary) {
  if (!value) return fallback;
  const summary = emptyTerritorialQuotaSummary();
  summary.total = Math.max(0, Math.round(numberOrNull(value.total) ?? fallback.total));
  summary.complete = Math.max(0, Math.round(numberOrNull(value.complete) ?? fallback.complete));
  summary.subsanada = Math.max(0, Math.round(numberOrNull(value.subsanada) ?? fallback.subsanada));
  summary.in_field = Math.max(0, Math.round(numberOrNull(value.in_field) ?? fallback.in_field));
  summary.pending = Math.max(0, Math.round(numberOrNull(value.pending) ?? fallback.pending));
  summary.partial = Math.max(0, Math.round(numberOrNull(value.partial) ?? fallback.partial));
  summary.missing = Math.max(0, Math.round(numberOrNull(value.missing) ?? fallback.missing));
  summary.exceeded = Math.max(0, Math.round(numberOrNull(value.exceeded) ?? fallback.exceeded));
  summary.not_configured = Math.max(0, Math.round(numberOrNull(value.not_configured) ?? fallback.not_configured));
  summary.sex_missing_total = Math.max(0, Math.round(numberOrNull(value.sex_missing_total) ?? fallback.sex_missing_total));
  summary.age_missing_total = Math.max(0, Math.round(numberOrNull(value.age_missing_total) ?? fallback.age_missing_total));
  summary.demographic_missing_total = Math.max(0, Math.round(numberOrNull(value.demographic_missing_total) ?? fallback.demographic_missing_total));
  summary.districts_with_gap = Math.max(0, Math.round(numberOrNull(value.districts_with_gap) ?? fallback.districts_with_gap));
  return summary;
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

function territorialQuotaBlockRealMissingTotal(block: TerritorialQuotaProgressBlock) {
  return Math.max(
    0,
    Math.round(numberOrNull(block.missing_total) ?? 0),
    territorialQuotaBlockSexMissingTotal(block),
    territorialQuotaBlockAgeMissingTotal(block),
  );
}

function territorialQuotaBlockLayers(block: TerritorialQuotaProgressBlock, observedFallback = 0) {
  const validas = Math.max(0, Math.round(numberOrNull(block.validas) ?? 0));
  const delta = Math.round(numberOrNull(block.operational_adjustment_delta) ?? 0);
  const observedBase = numberOrNull(block.observed_validas) ?? (validas || delta ? validas - delta : observedFallback);
  const observed = Math.max(0, Math.round(observedBase));
  return {
    observed,
    adjustment: delta,
    realMissing: territorialQuotaBlockRealMissingTotal(block),
  };
}

function territorialQuotaAdjustmentTargetLabels(block: TerritorialQuotaProgressBlock) {
  const labels = [...(block.sex ?? []), ...(block.age ?? [])]
    .filter((item) => territorialQuotaItemAdjustmentDelta(item) !== 0)
    .map((item) => stringOrEmpty(item.label).trim())
    .filter(Boolean);
  return Array.from(new Set(labels));
}

function territorialQuotaAdjustmentClass(delta: number) {
  if (delta === 0) return "";
  return `has-adjustment ${delta < 0 ? "is-negative-adjustment" : "is-positive-adjustment"}`;
}

function territorialQuotaRealMissingLabel(block: TerritorialQuotaProgressBlock, realMissing: number) {
  if (realMissing <= 0) return "sin faltantes después de subsanar";
  const sexMissing = territorialQuotaMissingItemLabels(block.sex);
  const ageMissing = territorialQuotaMissingItemLabels(block.age);
  if (!sexMissing.length && ageMissing.length) {
    return `${formatMetric(realMissing)} encuesta${realMissing === 1 ? "" : "s"} por completar en edad ${ageMissing.join(", ")}; sexo cubierto`;
  }
  if (sexMissing.length && !ageMissing.length) {
    return `${formatMetric(realMissing)} encuesta${realMissing === 1 ? "" : "s"} por completar en sexo ${sexMissing.join(", ")}; edad cubierta`;
  }
  if (sexMissing.length && ageMissing.length) {
    return `${formatMetric(realMissing)} encuesta${realMissing === 1 ? "" : "s"} por completar: ${sexMissing.join(", ")}; edad ${ageMissing.join(", ")}`;
  }
  return `${formatMetric(realMissing)} encuesta${realMissing === 1 ? "" : "s"} por completar`;
}

function territorialQuotaMissingItemLabels(rows: TerritorialQuotaProgressBlock["sex"] | undefined) {
  return (rows ?? [])
    .filter((item) => Math.max(0, Math.round(numberOrNull(item.missing) ?? 0)) > 0)
    .map((item) => stringOrEmpty(item.label).trim())
    .filter(Boolean);
}

function territorialQuotaItemMissingTotal(rows: TerritorialQuotaProgressBlock["sex"] | undefined) {
  return (rows ?? []).reduce((sum, item) => (
    sum + Math.max(0, Math.round(numberOrNull(item.missing) ?? Math.max(0, (numberOrNull(item.target) ?? 0) - (numberOrNull(item.achieved) ?? 0))))
  ), 0);
}

function territorialQuotaBlockPrimaryLabel(block: TerritorialQuotaProgressBlock) {
  const ump = territorialQuotaPrimaryUmpLabel(block);
  const replacementLabel = territorialQuotaBlockIsReplacement(block) ? territorialQuotaReplacementShortLabel(block) : "";
  if (replacementLabel) return ump ? `${ump} · ${replacementLabel}` : replacementLabel;
  if (ump) return ump;
  if (block.zona || block.manzana) return `Z${block.zona || "S/D"} · M${block.manzana || "S/D"}`;
  return block.id_manzana || "Manzana sin código";
}

function territorialQuotaBlockSecondaryLabel(block: TerritorialQuotaProgressBlock) {
  const blockLabel = territorialQuotaBlockIsReplacement(block)
    ? territorialQuotaReplacementShortLabel(block) || territorialQuotaPhysicalBlockLabel(block)
    : territorialQuotaPhysicalBlockLabel(block);
  const parts = [
    block.distrito || "Sin distrito",
    block.zona ? `Zona ${block.zona}` : "",
    blockLabel,
    territorialQuotaBlockTypeLabel(block),
  ].filter(Boolean);
  return parts.join(" · ");
}

function territorialQuotaBlockIsReplacement(block: TerritorialQuotaProgressBlock) {
  return normalizeMatch(block.tipo_manzana) === "reemplazo";
}

function territorialQuotaBlockTypeLabel(block: TerritorialQuotaProgressBlock) {
  return territorialQuotaBlockIsReplacement(block) ? "Reemplazo" : "Titular";
}

function territorialQuotaPhysicalBlockLabel(block: TerritorialQuotaProgressBlock) {
  if (block.manzana) return `Mz ${block.manzana}`;
  if (block.id_manzana) return `Mz ${block.id_manzana}`;
  return "Mz S/D";
}

function territorialQuotaPrimaryUmpLabel(block: TerritorialQuotaProgressBlock) {
  const raw = stringOrEmpty(block.ump).trim();
  if (!raw) return "";
  if (!territorialQuotaBlockIsReplacement(block)) return `UMP ${raw.replace(/^UMP\s+/i, "")}`;
  const titular = raw
    .replace(/^UMP\s+/i, "")
    .split(/\s*·\s*/)
    .find((part) => !/^R\s*[0-9]/i.test(part))
    ?.trim();
  return titular ? `UMP ${titular.replace(/^UMP\s+/i, "")}` : "";
}

function territorialQuotaReplacementShortLabel(block: TerritorialQuotaProgressBlock) {
  const order = numberOrNull(block.replacement_order);
  const unit = territorialQuotaReplacementUnitLabel(block);
  if (unit) {
    if (order != null && order > 1) return `R ${unit}.${formatReplacementOrder(order)}`;
    return `R ${unit}`;
  }
  const values = [block.replacement_label, block.ump];
  for (const value of values) {
    const raw = stringOrEmpty(value).trim();
    const match = raw.match(/\b(?:R|Reemplazo)\s*([0-9]+(?:[.,][0-9]+)?)/i);
    if (match) return `R ${match[1].replace(",", ".")}`;
  }
  return stringOrEmpty(block.replacement_label).trim();
}

function territorialQuotaReplacementUnitLabel(block: TerritorialQuotaProgressBlock) {
  const values = [block.titular_hoja_num, block.ump];
  for (const value of values) {
    const raw = stringOrEmpty(value).trim();
    if (!raw) continue;
    const cleaned = raw
      .replace(/^UMP\s+/i, "")
      .split(/\s*·\s*/)
      .find((part) => !/^R\s*[0-9]/i.test(part))
      ?.replace(/^R\s*/i, "")
      .trim();
    if (cleaned) return cleaned;
  }
  const fallback = stringOrEmpty(block.replacement_label).trim();
  const match = fallback.match(/\bR\s*([0-9]+(?:[.,][0-9]+)?)/i);
  return match ? match[1].replace(",", ".") : "";
}

function formatReplacementOrder(value: unknown) {
  const number = numberOrNull(value);
  if (number == null) return stringOrEmpty(value).trim();
  return new Intl.NumberFormat("es-PE", { maximumFractionDigits: 1 }).format(number);
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

function territorialQuotaItemAdjustmentDelta(item: TerritorialQuotaProgressBlock["sex"][number]) {
  return Math.round(numberOrNull(item.operational_adjustment_delta) ?? 0);
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

function formatSignedMetric(value: unknown) {
  const number = Math.round(numberOrNull(value) ?? 0);
  return `${number > 0 ? "+" : ""}${formatMetric(number)}`;
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

// React.memo (unidad 3.6): la página re-renderiza en cada poll de sync y
// transición de scopes; con props estabilizadas en el caller, este workbench
// solo se re-renderiza cuando cambian sus datos reales.
export const TerritorialQuotaConsistencyPanel = memo(TerritorialQuotaConsistencyPanelImpl);
