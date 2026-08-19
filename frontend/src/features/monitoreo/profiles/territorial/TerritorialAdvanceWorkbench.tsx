import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import {
  AlertTriangle,
  CalendarRange,
  CheckCircle2,
  ContactRound,
  FileCheck2,
  Layers3,
  ListChecks,
  Loader2,
  MapPin,
  Maximize2,
  Minus,
  Plus,
  Route,
  Search,
} from "lucide-react";
import { apiMonitoreoTerritorialMap } from "../../../../api/client";
import type {
  HojasRutaContextMapFeature,
  HojasRutaBlockMapFeature,
  HojasRutaStreetMapFeature,
  HojasRutaZoneMapFeature,
  MonitoreoTerritorialDashboard,
  MonitoreoTerritorialMapPhaseCacheMeta,
  TerritorialBlockProgress,
  TerritorialDistrictProgress,
  TerritorialQuotaProgressBlock,
  TerritorialQuotaProgressDistrict,
  TerritorialQuotaProgressItem,
  TerritorialResponseAuditRow,
} from "../../../../api/client";
import { EmptyState } from "../../../../components/States";
import { PlotlyChart } from "../../../../lib/PlotlyChart";
import { textoAvance, textoSobrecumplimiento } from "../../corte/corteContract";
import {
  buildTerritorialRouteCoverageModel,
} from "../../routeCoverageModel";
import {
  LIMA_DISTRICT_FEATURES,
  LIMA_MAP_HEIGHT,
  LIMA_MAP_WIDTH,
  TerritorialRouteCoverageMap,
  buildTerritorialMapProjection,
  buildDistrictShapePath,
  loadTerritorialRouteCartography,
  sampleTerritorialContextFeatures,
  sampleTerritorialStreetFeatures,
  selectTerritorialMapFeatures,
  territorialBlockZoneKey,
  territorialContextClass,
  territorialContextFeaturePath,
  territorialBlockStableKey,
  territorialDistrictPath,
  territorialFeatureZoneKey,
  territorialFeaturePath,
  territorialStreetPath,
  territorialZoneFeatureKey,
  territorialZonePath,
  territorialEffectiveRouteBlocks,
  territorialRouteBlockIsReplacement,
  type TerritorialSelectedMapFeature,
} from "./TerritorialRouteCoverageAtlas";

type TerritorialAdvanceTab = "resumen" | "distritos" | "ump" | "ritmo";

type AdvanceSummary = {
  total: number;
  validas: number;
  observacion: number;
  noValidas: number;
  meta: number | null;
  brecha: number;
  avancePct: number | null;
};

type DistributionItem = {
  key: string;
  label: string;
  value: number;
  pct: number;
  tone: "ready" | "warning" | "muted";
};

type DemographicQuotaBucket = {
  key: string;
  label: string;
  target: number;
  achieved: number;
  missing: number;
  pct: number | null;
  tone: "ready" | "warning" | "muted";
};

type DemographicQuotaDistrict = {
  key: string;
  label: string;
  target: number;
  achieved: number;
  missing: number;
  pct: number | null;
  sexMissing: number;
  ageMissing: number;
  demographicMissing: number;
  sex: DemographicQuotaBucket[];
  age: DemographicQuotaBucket[];
};

type DemographicQuotaProgress = {
  configured: boolean;
  summary: {
    target: number;
    achieved: number;
    missing: number;
    pct: number | null;
    completeBuckets: number;
    totalBuckets: number;
    districtsWithGap: number;
    districtCount: number;
  };
  sex: DemographicQuotaBucket[];
  age: DemographicQuotaBucket[];
  districts: DemographicQuotaDistrict[];
};

type TerritorialDailyDashboardRow = MonitoreoTerritorialDashboard["daily"][number] & {
  no_validas: number;
  cumulative_valid: number;
  cumulative_progress_pct: number | null;
  cumulative_gap: number;
  new_complete_ump: number;
  cumulative_complete_ump: number;
  cumulative_complete_ump_pct: number | null;
};

type TerritorialAdvanceGeoDisposition = "en_zona" | "en_distrito" | "fuera_distrito" | "sin_cruce" | "sin_gps";
type TerritorialAdvanceUmpStatus = "complete" | "incomplete" | "none";
type TerritorialAdvanceQuotaStatus = "complete" | "in_field" | "pending" | "missing" | "not_configured";
type TerritorialExecutiveUmpStack = {
  total: number;
  complete: number;
  incomplete: number;
  none: number;
  subsanada: number;
  inField: number;
  notConfigured: number;
  source: "operational_quota" | "raw_progress";
};

type TerritorialAdvanceKoboPoint = MonitoreoTerritorialDashboard["map"]["points"][number] & {
  latValue: number;
  lonValue: number;
  geoDisposition: TerritorialAdvanceGeoDisposition;
};

type TerritorialAdvanceBlockMatchIndex = {
  exact: Set<string>;
  district: Set<string>;
};

const ADVANCE_TAB_FALLBACK: TerritorialAdvanceTab = "resumen";
const ADVANCE_GPS_LEGEND = [
  { key: "geo_ok", label: "Dentro" },
  { key: "geo_cerca", label: "Cerca" },
  { key: "geo_revision", label: "Revisión" },
  { key: "geo_no_defendible", label: "Lejos" },
  { key: "geo_sin_cruce", label: "Sin cruce" },
  { key: "geo_sin_gps", label: "Sin GPS" },
] as const;

/**
 * Etiqueta corta del criterio de validez.
 *
 * `field_label` trae el enunciado literal del XLSForm, y en estudios reales eso
 * es una frase completa ("Si está de acuerdo con continuar con la encuesta, por
 * favor, confirmar") que inunda una tarjeta de KPI. Se prefiere el nombre de la
 * variable cuando el enunciado no cabe: es corto, trazable y no compite con el
 * dato. El enunciado íntegro sigue disponible en el `title`.
 */
export function etiquetaCriterio(fieldLabel?: string | null, field?: string | null) {
  const label = (fieldLabel ?? "").trim();
  const nombre = (field ?? "").trim();
  if (label && label.length <= 44) return label;
  if (nombre) return nombre;
  if (label) return `${label.slice(0, 41).trimEnd()}…`;
  return "criterio configurado";
}

function TerritorialAdvanceWorkbenchImpl({
  pestanaActiva,
  reports,
  syncedAt,
  onCambioPestana,
}: {
  pestanaActiva?: string;
  reports: MonitoreoTerritorialDashboard | null;
  syncedAt?: string;
  onCambioPestana?: (tab: string) => void;
}) {
  const [districtFilter, setDistrictFilter] = useState("todos");
  const [focusedUmp, setFocusedUmp] = useState("");
  const tab = isAdvanceTab(pestanaActiva) ? pestanaActiva : ADVANCE_TAB_FALLBACK;
  const blocks = useMemo(() => blockRows(reports), [reports]);
  const dailyTargetTotal = useMemo(() => advanceObjectiveTotal(reports), [reports]);
  const dailyRows = useMemo(() => buildTerritorialDailyRows(reports, dailyTargetTotal, blocks), [blocks, dailyTargetTotal, reports]);
  const advance = useMemo(() => buildAdvanceSummary(reports), [reports]);
  const districts = useMemo(() => districtRows(reports), [reports]);
  const umpStack = useMemo(() => summarizeOperationalUmp(reports, blocks), [blocks, reports]);
  const mapLayers = useTerritorialAdvanceMapLayers(reports, blocks);
  const distributions = useMemo(() => buildAdvanceDistributions(reports), [reports]);
  const demographicQuota = useMemo(() => buildDemographicQuotaProgress(reports), [reports]);
  const criterionLabel = etiquetaCriterio(reports?.source_validity?.field_label, reports?.source_validity?.field);
  const criterionTitle = reports?.source_validity?.field_label || reports?.source_validity?.field || "";
  const phaseLabel = reports?.active_route_phase === "pilot" ? "Piloto operativo" : "Campo real";
  const cutLabel = syncedAt || reports?.generated_at ? formatDate(syncedAt || reports?.generated_at || "") : "Sin corte";

  if (!reports) {
    return (
      <div className="mon-stage mon-stage--avance">
        <section className="mon-territorial-panel mon-territorial-review-panel">
          <div className="mon-territorial-audit-empty">Sin avance territorial hidratado para este corte.</div>
        </section>
      </div>
    );
  }

  return (
    <div className="mon-stage mon-stage--avance">
      <div className="mon-stage-stack mon-stage-stack--dashboard">
        <section className="mon-advance-panel mon-territorial-panel" aria-label="Tablero de campo territorial">
          {tab === "resumen" || tab === "distritos" ? (
            <TerritorialAdvanceSummary
              vista={tab === "distritos" ? "distritos" : "resumen"}
              advance={advance}
              blocks={blocks}
              criterionLabel={criterionLabel}
              criterionTitle={criterionTitle}
              cutLabel={cutLabel}
              districts={districts}
              umpStack={umpStack}
              distributions={distributions}
              demographicQuota={demographicQuota}
              phaseLabel={phaseLabel}
              selectedDistrict={districtFilter}
              onOpenDistrict={(key) => {
                setDistrictFilter(key);
                setFocusedUmp("");
                onCambioPestana?.("ump");
              }}
              onOpenUmp={(districtKey, umpKey) => {
                setDistrictFilter(districtKey || "todos");
                setFocusedUmp(umpKey);
                onCambioPestana?.("ump");
              }}
            />
          ) : null}

          {tab === "ump" ? (
            <TerritorialAdvanceUmpSection
              reports={reports}
              blocks={blocks}
              mapReports={mapLayers.reports ?? reports}
              gpsLayerLoading={mapLayers.loading}
              gpsLayerError={mapLayers.error}
              districtFilter={districtFilter}
              focusedUmp={focusedUmp}
              onDistrictFilterChange={setDistrictFilter}
            />
          ) : null}

          {tab === "ritmo" ? (
            <TerritorialAdvanceRhythmSection
              rows={dailyRows}
              targetTotal={dailyTargetTotal || advance.meta || advance.validas + advance.brecha}
              umpTotal={blocks.length}
            />
          ) : null}
        </section>
      </div>
    </div>
  );
}

function TerritorialAdvanceSummary({
  vista,
  advance,
  blocks,
  criterionLabel,
  criterionTitle,
  cutLabel,
  districts,
  umpStack,
  demographicQuota,
  distributions,
  phaseLabel,
  selectedDistrict,
  onOpenDistrict,
  onOpenUmp,
}: {
  /** «resumen» = cómo vamos; «distritos» = dónde estamos. */
  vista: "resumen" | "distritos";
  advance: AdvanceSummary;
  blocks: TerritorialBlockProgress[];
  criterionLabel: string;
  criterionTitle?: string;
  cutLabel: string;
  districts: TerritorialDistrictProgress[];
  umpStack: TerritorialExecutiveUmpStack;
  demographicQuota: DemographicQuotaProgress;
  distributions: { sex: DistributionItem[]; age: DistributionItem[] };
  phaseLabel: string;
  selectedDistrict: string;
  onOpenDistrict: (districtKey: string) => void;
  onOpenUmp: (districtKey: string, umpKey: string) => void;
}) {
  const priorities = buildAdvancePriorities(districts, blocks);
  const activeDistricts = districts.filter((row) => numberOrZero(row.validas) > 0).length;
  return (
    <section className="mon-territorial-tab-panel mon-territorial-exec mon-territorial-tab-panel--summary" aria-label={vista === "resumen" ? "Resumen ejecutivo de avance territorial" : "Cobertura y cuotas por distrito"}>
      <header className="mon-territorial-exec-commandbar">
        <div>
          <span><MapPin size={14} /> Corte territorial</span>
          <strong>{phaseLabel} · {cutLabel}</strong>
        </div>
        {/* La banda de corte es común a las dos vistas: sin ella, «Distritos»
            perdería de qué corte está hablando. */}
        {/* Válidas y avance ya viven en la banda del módulo (arriba) y en el KPI
            (abajo): repetirlos acá hacía que 107% apareciera cinco veces y
            1.283 cuatro en la misma pantalla. Esta banda se queda solo con lo
            que no está en ninguna otra parte. */}
        <div className="mon-territorial-exec-commandbar-meta" aria-label="Contexto del corte">
          <span>{formatMetric(activeDistricts)} distritos con avance</span>
          {selectedDistrict !== "todos" ? <span>Distrito filtrado</span> : null}
        </div>
      </header>
      <div className={`mon-territorial-exec-canvas is-${vista}`}>
        {vista === "resumen" ? (
          <>
            <div className="mon-territorial-exec-side">
              <TerritorialExecutiveProgressPanel advance={advance} criterionLabel={criterionLabel} criterionTitle={criterionTitle} cutLabel={cutLabel} districtCount={districts.length} />
              <TerritorialExecutiveUmpPanel stack={umpStack} />
            </div>
            <TerritorialExecutivePriorities groups={priorities} onOpenDistrict={onOpenDistrict} onOpenUmp={onOpenUmp} />
            <TerritorialExecutiveOperationalCut advance={advance} criterionLabel={criterionLabel} />
          </>
        ) : (
          <>
            <TerritorialExecutiveDistrictBoard
              rows={districts}
              selectedDistrict={selectedDistrict}
              onOpenDistrict={onOpenDistrict}
            />
            <TerritorialExecutiveDemographics sex={distributions.sex} age={distributions.age} quotaProgress={demographicQuota} />
          </>
        )}
      </div>
    </section>
  );
}

function TerritorialExecutiveProgressPanel({
  advance,
  criterionLabel,
  criterionTitle,
  cutLabel,
  districtCount,
}: {
  advance: AdvanceSummary;
  criterionLabel: string;
  criterionTitle?: string;
  cutLabel: string;
  districtCount: number;
}) {
  const pct = clamp(advance.avancePct ?? 0, 0, 100);
  // La barra se recortaba a 100 pero el número seguía imprimiendo el valor real,
  // así que un 107% aparecía sin explicación. Sobre-cumplir es una noticia y se
  // dice con palabras, no dejando que el usuario deduzca la diferencia.
  const sobrecumplimiento = textoSobrecumplimiento(advance.validas, advance.meta);
  return (
    <section className="mon-territorial-exec-progress" aria-label="Estado general del campo">
      <div className="mon-territorial-exec-progress-main">
        <div>
          <span>Estado general del campo</span>
          {/* El número nunca viaja sin su denominador: "1.283 válidas" a secas
              es lo que permitía que cada superficie mostrara un total distinto. */}
          <strong>{textoAvance(advance.validas, advance.meta)}</strong>
          <em>{advance.meta != null ? "válidas sobre la meta" : "válidas actuales · sin meta declarada"}</em>
        </div>
        <figure
          className="mon-territorial-exec-ring"
          style={{ "--exec-ring": `${pct * 3.6}deg` } as CSSProperties}
          aria-label={`${formatPercentLabel(advance.avancePct)} de avance territorial`}
        >
          <strong>{formatPercentLabel(advance.avancePct)}</strong>
          <span>avance</span>
        </figure>
      </div>
      {sobrecumplimiento ? (
        <p className="mon-territorial-exec-progress-overshoot">{sobrecumplimiento}</p>
      ) : null}
      <div className="mon-territorial-exec-progress-track">
        <i style={{ width: `${pct}%` }} />
      </div>
      <dl className="mon-territorial-exec-progress-facts">
        <div><dt>Objetivo</dt><dd>{formatMetric(advance.meta)}</dd></div>
        <div><dt>Pendientes</dt><dd>{formatMetric(advance.brecha)}</dd></div>
        <div><dt>Distritos</dt><dd>{formatMetric(districtCount)}</dd></div>
        <div className="is-cutoff"><dt>Corte</dt><dd>{cutLabel}</dd></div>
      </dl>
      {/* El párrafo largo se comió el espacio del bloque de hechos hasta hacerlo
          desaparecer bajo el recorte. Dice lo mismo en una línea. */}
      <p title={criterionTitle || undefined}>Criterio de válidas: {criterionLabel}</p>
    </section>
  );
}

function TerritorialExecutiveUmpPanel({ stack }: { stack: TerritorialExecutiveUmpStack }) {
  const pending = Math.max(0, stack.incomplete + stack.none);
  const operational = stack.source === "operational_quota";
  const incompleteLabel = operational
    ? stack.inField > 0 ? "Pendientes" : "Cuota pendiente"
    : "Incompletas";
  const noneLabel = operational ? "No iniciadas" : "Sin avance";
  const completeDetail = operational && stack.subsanada > 0
    ? ` · ${formatMetric(stack.subsanada)} subsanadas`
    : "";
  const segments = [
    { key: "complete", label: "Completas", value: stack.complete, tone: "ready" },
    { key: "incomplete", label: incompleteLabel, value: stack.incomplete, tone: "warning" },
    { key: "none", label: noneLabel, value: stack.none, tone: "muted" },
  ];
  const segmentWidths = stackedWidths(segments.map((segment) => segment.value));
  return (
    <section className="mon-territorial-exec-ump" aria-label="Estado de UMP y manzanas">
      <header>
        {/* De qué UMP habla: las de la cuota operativa. En la misma pantalla,
            «Prioridades» cuenta las de la hoja de ruta, y sobre el corte real las
            dos cifras eran 3 y 21 bajo el mismo rótulo «UMP». */}
        <span><Route size={14} /> Estado UMP {operational ? "· cuota operativa" : ""}</span>
        <strong>{formatMetric(stack.complete)} completas · {formatMetric(pending)} faltan{completeDetail}</strong>
      </header>
      <div className="mon-territorial-exec-ump-stack" role="list" aria-label="Distribución de UMP completas, incompletas y sin avance">
        {segments.map((segment, index) => {
          const pct = safePercent(segment.value, stack.total) ?? 0;
          const width = segmentWidths[index];
          const className = [
            `is-${segment.key}`,
            pct < 18 ? "is-compact" : "",
            pct < 8 ? "is-tiny" : "",
          ].filter(Boolean).join(" ");
          return (
            <span
              key={segment.key}
              className={className}
              role="listitem"
              style={{ "--exec-stack-size": `${width}%` } as CSSProperties}
              title={`${segment.label}: ${formatMetric(segment.value)} · ${formatPercentLabel(pct)}`}
            >
              <strong>{formatMetric(segment.value)}</strong>
              <em>{segment.label}</em>
            </span>
          );
        })}
      </div>
      <div className="mon-territorial-exec-ump-grid">
        {segments.map((segment) => (
          <span key={segment.key} className={`is-${segment.tone}`}>
            <strong>{formatMetric(segment.value)}</strong>
            <em>{segment.label}</em>
          </span>
        ))}
      </div>
      <div className="mon-territorial-exec-ump-state-list" aria-label="Detalle porcentual por estado UMP">
        {segments.map((segment) => {
          const pct = safePercent(segment.value, stack.total) ?? 0;
          return (
            <div key={segment.key} className={`is-${segment.tone}`}>
              <header>
                <span>{segment.label}</span>
                <strong>{formatMetric(segment.value)} · {formatPercentLabel(pct)}</strong>
              </header>
              <i aria-hidden="true"><em style={{ width: `${pct}%` }} /></i>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TerritorialExecutiveDistrictBoard({
  rows,
  selectedDistrict,
  onOpenDistrict,
}: {
  rows: TerritorialDistrictProgress[];
  selectedDistrict: string;
  onOpenDistrict: (districtKey: string) => void;
}) {
  const ordered = [...rows].sort((a, b) => (
    numberOrZero(a.avance_pct) - numberOrZero(b.avance_pct)
    || numberOrZero(b.brecha) - numberOrZero(a.brecha)
    || stringOrEmpty(a.distrito).localeCompare(stringOrEmpty(b.distrito), "es-PE")
  ));
  return (
    <section className="mon-territorial-exec-districts" aria-label="Avance por distrito">
      <div className="mon-territorial-exec-district-grid">
        {ordered.map((row) => {
          const key = districtKey(row);
          const selected = selectedDistrict !== "todos" && key === selectedDistrict;
          return (
            <button
              key={key || row.distrito}
              type="button"
              className={`mon-territorial-exec-district-card is-${districtTone(row)}${selected ? " is-selected" : ""}`}
              aria-pressed={selected}
              onClick={() => key && onOpenDistrict(key)}
            >
              <DistrictShapeIcon
                ubigeo={row.ubigeo}
                label={row.distrito}
                active={selected || districtTone(row) === "ready"}
                warning={districtTone(row) === "open"}
              />
              <div className="mon-territorial-exec-district-body">
                <header>
                  <span>{row.ubigeo || "S/U"}</span>
                  <strong>{row.distrito || "Sin distrito"}</strong>
                </header>
                <div className="mon-territorial-exec-district-metrics">
                  <dl>
                    <div><dt>Válidas</dt><dd>{formatMetric(row.validas)} / {formatMetric(row.meta)}</dd></div>
                    <div><dt>Brecha</dt><dd>{formatMetric(row.brecha)}</dd></div>
                    <div><dt>Revisión</dt><dd>{formatMetric(row.revision)}</dd></div>
                  </dl>
                  <i aria-hidden="true"><em style={{ width: `${clamp(row.avance_pct ?? 0, 0, 100)}%` }} /></i>
                </div>
                <b className="mon-territorial-exec-district-pct">{formatPercentLabel(row.avance_pct)}</b>
                <footer>
                  <span className="is-ready">{formatMetric(row.validas)} válidas</span>
                  <span className="is-warning">{formatMetric(row.brecha)} brecha</span>
                  <span>{formatMetric(row.total)} total</span>
                </footer>
              </div>
            </button>
          );
        })}
        {!ordered.length ? <p className="mon-territorial-audit-empty">Sin distritos en el corte de avance.</p> : null}
      </div>
    </section>
  );
}

function TerritorialExecutiveDemographics({
  sex,
  age,
  quotaProgress,
}: {
  sex: DistributionItem[];
  age: DistributionItem[];
  quotaProgress: DemographicQuotaProgress;
}) {
  if (quotaProgress.configured) {
    const summary = quotaProgress.summary;
    // Con las cuotas cerradas, este bloque ocupaba 538px para repetir "0 brecha"
    // en cuatro sub-bloques, y empujaba Prioridades y Corte operativo fuera del
    // pliegue —justo lo que sí requiere decisión—. El espacio debe ser
    // proporcional a la información: sin brecha, una franja; con brecha, el
    // detalle completo de dónde está.
    const sinBrecha = (summary.missing ?? 0) === 0
      && summary.completeBuckets === summary.totalBuckets;

    if (sinBrecha) {
      return (
        <section
          className="mon-territorial-exec-demographics is-cerrada"
          aria-label="Cuotas de sexo y edad cerradas"
        >
          <span><Layers3 size={14} /> Cuotas sexo/edad</span>
          <strong>Cerradas</strong>
          <em>
            {formatMetric(summary.completeBuckets)}/{formatMetric(summary.totalBuckets)} segmentos ·
            {" "}{formatMetric(summary.achieved)} de {formatMetric(summary.target)} casos ·
            {" "}sin brecha en {formatMetric(summary.districtCount)} distritos
          </em>
        </section>
      );
    }

    return (
      <section className="mon-territorial-exec-demographics" aria-label="Avance agregado por cuotas de sexo y edad">
        <header>
          <span><Layers3 size={14} /> Cuotas agregadas sexo/edad</span>
          <strong>{formatMetric(summary.achieved)} / {formatMetric(summary.target)} meta sexo/edad · {formatMetric(summary.missing)} brecha</strong>
        </header>
        <div className="mon-territorial-exec-demographics-grid">
          <article className="mon-territorial-demographic-summary" aria-label="Meta demográfica agregada">
            <header>
              <span>Meta sexo/edad</span>
              <em>{formatMetric(summary.districtCount)} distritos</em>
            </header>
            <div className="mon-territorial-demographic-summary-main">
              <strong>{formatPercentLabel(summary.pct)}</strong>
              <span>{formatMetric(summary.achieved)} de {formatMetric(summary.target)} casos</span>
              <i aria-hidden="true"><em style={{ width: `${clamp(summary.pct ?? 0, 0, 100)}%` }} /></i>
            </div>
            <dl>
              <div><dt>Brecha total</dt><dd>{formatMetric(summary.missing)}</dd></div>
              <div><dt>Segmentos cerrados</dt><dd>{formatMetric(summary.completeBuckets)} / {formatMetric(summary.totalBuckets)}</dd></div>
              <div><dt>Distritos con brecha</dt><dd>{formatMetric(summary.districtsWithGap)}</dd></div>
            </dl>
          </article>
          <div className="mon-territorial-demographic-panels">
            <DemographicQuotaPanel title="Hombres y mujeres" items={quotaProgress.sex} />
            <DemographicQuotaPanel title="Rangos de edad" items={quotaProgress.age} />
          </div>
          <DemographicDistrictPanel rows={quotaProgress.districts} />
        </div>
      </section>
    );
  }

  return (
    <section className="mon-territorial-exec-demographics" aria-label="Distribución del campo válido por sexo y edad">
      <header>
        <span><Layers3 size={14} /> Distribución del campo válido</span>
        <strong>Solo respuestas que cuentan en avance</strong>
      </header>
      <div className="mon-territorial-exec-demographics-grid is-distribution">
        <DistributionPanel title="Distribución por sexo" items={sex} mode="donut" />
        <DistributionPanel title="Distribución por edad" items={age} mode="bars" />
      </div>
    </section>
  );
}

function DemographicQuotaPanel({ title, items }: { title: string; items: DemographicQuotaBucket[] }) {
  const missing = items.reduce((sum, item) => sum + item.missing, 0);
  return (
    <article className="mon-territorial-demographic-quota">
      <header>
        <span>{title}</span>
        <em>{formatMetric(missing)} faltan</em>
      </header>
      <div className="mon-territorial-demographic-quota-list">
        {items.length ? items.map((item) => (
          <span key={item.key} className={`is-${item.tone}`}>
            <i aria-hidden="true"><em style={{ width: `${clamp(item.pct ?? 0, 0, 100)}%` }} /></i>
            <strong>{item.label}</strong>
            <em>{formatMetric(item.achieved)} / {formatMetric(item.target)} · faltan {formatMetric(item.missing)}</em>
          </span>
        )) : (
          <span className="is-muted">
            <strong>Sin metas</strong>
            <em>No hay cuotas para esta dimensión</em>
          </span>
        )}
      </div>
    </article>
  );
}

function DemographicDistrictPanel({ rows }: { rows: DemographicQuotaDistrict[] }) {
  const ordered = [...rows].sort((a, b) => (
    b.demographicMissing - a.demographicMissing
    || b.missing - a.missing
    || a.label.localeCompare(b.label, "es-PE")
  ));
  return (
    <article className="mon-territorial-demographic-districts" aria-label="Cuotas agregadas por distrito">
      <header>
        <span>Distritos</span>
        <em>{formatMetric(ordered.length)} con cuota</em>
      </header>
      <div>
        {ordered.length ? ordered.map((row) => (
          <article key={row.key} className={row.demographicMissing > 0 ? "is-warning" : "is-ready"}>
            <header>
              <strong>{row.label}</strong>
              <em>{formatPercentLabel(row.pct)}</em>
            </header>
            <i aria-hidden="true"><em style={{ width: `${clamp(row.pct ?? 0, 0, 100)}%` }} /></i>
            <footer>
              <span>{formatMetric(row.achieved)} / {formatMetric(row.target)}</span>
              <span>Sexo {formatMetric(row.sexMissing)}</span>
              <span>Edad {formatMetric(row.ageMissing)}</span>
            </footer>
          </article>
        )) : (
          <span className="mon-territorial-audit-empty">Sin cuotas distritales disponibles.</span>
        )}
      </div>
    </article>
  );
}

function DistributionPanel({ title, items, mode }: { title: string; items: DistributionItem[]; mode: "donut" | "bars" }) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const first = items[0];
  return (
    <article className={`mon-territorial-exec-distribution is-${items.length ? "ready" : "empty"}`}>
      <header>
        <span>{title}</span>
        <em>{items.length ? "Kobo válido" : "Sin variable"}</em>
      </header>
      {items.length && mode === "donut" ? (
        <div className="mon-territorial-exec-sex-chart">
          <figure
            className="mon-territorial-exec-sex-ring"
            style={{ "--exec-ring": `${(first?.pct ?? 0) * 3.6}deg` } as CSSProperties}
            aria-label={`${formatMetric(total)} respuestas válidas`}
          >
            <strong>{formatMetric(total)}</strong>
            <span>válidas</span>
          </figure>
          <DistributionList items={items} />
        </div>
      ) : items.length ? (
        <DistributionList items={items} bars />
      ) : (
        <div className="mon-territorial-exec-empty">
          <strong>Sin distribución disponible</strong>
          <span>La distribución aparecerá cuando existan respuestas válidas con sexo/edad.</span>
        </div>
      )}
    </article>
  );
}

function DistributionList({ items, bars = false }: { items: DistributionItem[]; bars?: boolean }) {
  return (
    <div className={`mon-territorial-exec-distribution-list${bars ? " is-bars" : ""}`}>
      {items.map((item) => (
        <span key={item.key} className={`is-${item.tone}`}>
          <i style={{ width: `${Math.max(item.value ? 5 : 0, item.pct)}%` }} />
          <strong>{item.label}</strong>
          <em>{formatMetric(item.value)} · {formatPercentLabel(item.pct)}</em>
        </span>
      ))}
    </div>
  );
}

function TerritorialExecutivePriorities({
  groups,
  onOpenDistrict,
  onOpenUmp,
}: {
  groups: ReturnType<typeof buildAdvancePriorities>;
  onOpenDistrict: (districtKey: string) => void;
  onOpenUmp: (districtKey: string, umpKey: string) => void;
}) {
  return (
    <section className="mon-territorial-exec-priorities" aria-label="Prioridades de avance">
      <header>
        <span><AlertTriangle size={14} /> Prioridades de avance</span>
        <strong>UMP de la hoja de ruta y distritos, ordenados por brecha</strong>
      </header>
      <div className="mon-territorial-exec-priority-groups">
        {groups.map((group) => (
          <article key={group.key} className={`is-${group.key}`}>
            <header>
              <strong>{group.label}</strong>
              <em>{group.total ? formatMetric(group.total) : "0"}</em>
            </header>
            <div>
              {group.items.length ? group.items.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={`mon-territorial-exec-priority is-${item.tone}`}
                  onClick={() => {
                    if (item.type === "district") onOpenDistrict(item.districtKey);
                    else onOpenUmp(item.districtKey, item.umpKey);
                  }}
                >
                  <span>
                    <strong>{item.title}</strong>
                    <em>{item.detail}</em>
                  </span>
                  <b><small>faltan</small>{formatMetric(item.gap)}</b>
                  <i><small style={{ width: `${Math.max(4, item.progressPct)}%` }} /></i>
                </button>
              )) : (
                <span className="mon-territorial-exec-priority-empty">{group.emptyLabel}</span>
              )}
              {group.total > group.items.length ? (
                <span className="mon-territorial-exec-priority-corte">
                  Los {formatMetric(group.items.length)} de mayor brecha, de {formatMetric(group.total)}.
                </span>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function TerritorialExecutiveOperationalCut({
  advance,
  criterionLabel,
}: {
  advance: AdvanceSummary;
  criterionLabel: string;
}) {
  const items = [
    { key: "valid", label: "Cuentan en avance", value: advance.validas, tone: "ready", hint: "válidas actuales" },
    { key: "review", label: "En observación", value: advance.observacion, tone: "warning", hint: "no bloquea avance" },
    { key: "invalid", label: "No cuentan según criterio", value: advance.noValidas, tone: "muted", hint: criterionLabel },
  ];
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const itemWidths = stackedWidths(items.map((item) => item.value));
  return (
    <section className="mon-territorial-exec-cut" aria-label="Corte operativo">
      <header>
        <span><FileCheck2 size={14} /> Corte operativo</span>
        <strong>Qué entra y qué queda separado</strong>
      </header>
      <div className="mon-territorial-exec-cut-stack" aria-label="Distribución del corte operativo">
        {items.map((item, index) => (
          <i
            key={item.key}
            className={`is-${item.tone}`}
            style={{ "--exec-stack-size": `${itemWidths[index]}%` } as CSSProperties}
            title={`${item.label}: ${formatMetric(item.value)}`}
          />
        ))}
      </div>
      <div>
        {items.map((item) => (
          <span key={item.key} className={`is-${item.tone}`}>
            <strong>{formatMetric(item.value)}</strong>
            <em>{item.label}</em>
            <small>{item.hint}</small>
          </span>
        ))}
      </div>
    </section>
  );
}

function useTerritorialAdvanceMapLayers(
  reports: MonitoreoTerritorialDashboard | null,
  blocks: TerritorialBlockProgress[],
) {
  const [layerState, setLayerState] = useState<{
    points: MonitoreoTerritorialDashboard["map"]["points"];
    loading: boolean;
    error: string;
    cache: MonitoreoTerritorialMapPhaseCacheMeta | null;
  }>({ points: [], loading: false, error: "", cache: null });
  const phase = reports?.active_route_phase === "field" ? "field" : "pilot";
  const reportPointCount = reports?.map?.points?.length ?? 0;

  useEffect(() => {
    let cancelled = false;
    if (!reports) {
      setLayerState({ points: [], loading: false, error: "", cache: null });
      return () => { cancelled = true; };
    }
    if (reportPointCount > 0) {
      setLayerState((current) => ({ ...current, loading: false, error: "" }));
      return () => { cancelled = true; };
    }
    setLayerState((current) => ({ ...current, loading: true, error: "" }));
    const loadGpsPoints = async () => {
      const cached = await apiMonitoreoTerritorialMap({ phase, layer: "gps_points", allowStale: true, prepare: false });
      const status = typeof cached.cache === "object" && cached.cache && "status" in cached.cache
        ? String(cached.cache.status || "")
        : "";
      if (status === "valid" && cached.payload.points?.length) return cached;
      return apiMonitoreoTerritorialMap({ phase, layer: "gps_points", allowStale: true, prepare: true });
    };
    loadGpsPoints()
      .then((gpsLayer) => {
        if (cancelled) return;
        setLayerState({
          points: gpsLayer.payload.points ?? [],
          loading: false,
          error: "",
          cache: gpsLayer.cache as MonitoreoTerritorialMapPhaseCacheMeta | null,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setLayerState((current) => ({
          ...current,
          loading: false,
          error: "No se pudo cargar la capa cacheada de puntos GPS para Avance.",
        }));
      });
    return () => { cancelled = true; };
  }, [phase, reportPointCount, reports]);

  const composedReports = useMemo(() => {
    if (!reports) return null;
    const sourcePoints = reports.map?.points?.length ? reports.map.points : layerState.points;
    return {
      ...reports,
      map: {
        ...(reports.map ?? { phase, blocks: [], points: [], alerts: [], legend: [] }),
        phase,
        blocks: reports.map?.blocks?.length ? reports.map.blocks : blocks,
        points: sourcePoints,
        cache: reports.map?.cache ?? layerState.cache ?? null,
      },
    };
  }, [blocks, layerState.cache, layerState.points, phase, reports]);

  return {
    reports: composedReports,
    loading: layerState.loading,
    error: layerState.error,
    pointsLoaded: composedReports?.map.points.length ?? 0,
  };
}

function TerritorialAdvanceUmpSection({
  reports,
  mapReports,
  gpsLayerLoading,
  gpsLayerError,
  blocks,
  districtFilter,
  focusedUmp,
  onDistrictFilterChange,
}: {
  reports: MonitoreoTerritorialDashboard;
  mapReports: MonitoreoTerritorialDashboard;
  gpsLayerLoading: boolean;
  gpsLayerError: string;
  blocks: TerritorialBlockProgress[];
  districtFilter: string;
  focusedUmp: string;
  onDistrictFilterChange: (value: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<TerritorialAdvanceUmpStatus | "todos">("todos");
  const [quotaFilter, setQuotaFilter] = useState<TerritorialAdvanceQuotaStatus | "todos">("todos");
  const [zoneFilter, setZoneFilter] = useState("todos");
  const [responsibleFilter, setResponsibleFilter] = useState("todos");
  const [selectedKey, setSelectedKey] = useState("");
  const [selectedResponseId, setSelectedResponseId] = useState("");
  const [mapFocusToken, setMapFocusToken] = useState(0);
  // Capa activa del único mapa de la pestaña. Arranca en UMP porque es la capa
  // operativa; "zonas" es la lectura agregada.
  const [mapLayer, setMapLayer] = useState<"ump" | "zonas">("ump");
  const sourceBlocks = useMemo(() => {
    const mapBlocks = Array.isArray(reports.map?.blocks) ? reports.map.blocks : [];
    const source = mapBlocks.length ? mapBlocks : blocks;
    return source.filter((row) => territorialBlockStableKey(row));
  }, [blocks, reports]);
  const districts = useMemo(() => ["todos", ...uniqueNonEmpty(sourceBlocks.map((row) => districtKey(row)))], [sourceBlocks]);
  const zones = useMemo(() => ["todos", ...uniqueNonEmpty(sourceBlocks.map((row) => stringOrEmpty(row.zona)))], [sourceBlocks]);
  const responsibles = useMemo(() => ["todos", ...uniqueNonEmpty(sourceBlocks.map((row) => stringOrEmpty(row.responsable)))], [sourceBlocks]);
  const phaseLabel = reports.active_route_phase === "field" ? "Campo real" : "Piloto operativo";
  const gpsPoints = useMemo(() => territorialAdvanceKoboMapPoints(mapReports), [mapReports]);
  const visible = useMemo(() => {
    const search = normalizeMatch(query);
    return sourceBlocks.filter((row) => {
      if (districtFilter !== "todos" && districtKey(row) !== districtFilter) return false;
      if (statusFilter !== "todos" && blockStatus(row) !== statusFilter) return false;
      if (quotaFilter !== "todos" && blockQuotaStatus(row) !== quotaFilter) return false;
      if (zoneFilter !== "todos" && stringOrEmpty(row.zona) !== zoneFilter) return false;
      if (responsibleFilter !== "todos" && stringOrEmpty(row.responsable) !== responsibleFilter) return false;
      if (!search) return true;
      return normalizeMatch([row.ump, row.distrito, row.zona, row.manzana, row.responsable, row.id_manzana].filter(Boolean).join(" ")).includes(search);
    }).sort(compareBlocks);
  }, [districtFilter, query, quotaFilter, responsibleFilter, sourceBlocks, statusFilter, zoneFilter]);
  useEffect(() => {
    if (!focusedUmp) return;
    setQuery(focusedUmp);
    setStatusFilter("todos");
    setQuotaFilter("todos");
    setZoneFilter("todos");
    setResponsibleFilter("todos");
    const focused = sourceBlocks.find((row) => (
      normalizeMatch(row.ump) === normalizeMatch(focusedUmp)
      || normalizeMatch(row.id_manzana) === normalizeMatch(focusedUmp)
      || advanceBlockStableKey(row) === focusedUmp
    ));
    if (focused) {
      setSelectedKey(advanceBlockStableKey(focused));
      setMapFocusToken((token) => token + 1);
    }
  }, [focusedUmp, sourceBlocks]);
  useEffect(() => {
    if (!visible.length) {
      setSelectedKey("");
      return;
    }
    if (!selectedKey || !visible.some((row) => advanceBlockStableKey(row) === selectedKey)) {
      setSelectedKey(advanceBlockStableKey(visible[0]));
    }
  }, [selectedKey, visible]);
  const selected = visible.find((row) => advanceBlockStableKey(row) === selectedKey) ?? visible[0] ?? null;
  const routeCoverage = useMemo(() => buildTerritorialRouteCoverageModel(sourceBlocks, reports), [sourceBlocks, reports]);
  const effectiveRouteBlocks = useMemo(() => territorialEffectiveRouteBlocks(sourceBlocks, reports), [sourceBlocks, reports]);
  const effectiveRouteZoneCount = useMemo(() => (
    new Set(effectiveRouteBlocks.map((block) => territorialBlockZoneKey(block)).filter(Boolean)).size
  ), [effectiveRouteBlocks]);
  const visibleBlockIndex = useMemo(() => buildAdvanceBlockMatchIndex(visible), [visible]);
  const selectedBlockIndex = useMemo(() => buildAdvanceBlockMatchIndex(selected ? [selected] : []), [selected]);
  const visibleGpsExactPoints = useMemo(() => (
    gpsPoints.filter((point) => territorialAdvancePointMatchesIndex(point, visibleBlockIndex, false))
  ), [gpsPoints, visibleBlockIndex]);
  const visibleGpsPoints = useMemo(() => (
    visibleGpsExactPoints.length
      ? visibleGpsExactPoints
      : gpsPoints.filter((point) => territorialAdvancePointMatchesIndex(point, visibleBlockIndex, true))
  ), [gpsPoints, visibleBlockIndex, visibleGpsExactPoints]);
  const selectedGpsExactPoints = useMemo(() => (
    gpsPoints.filter((point) => territorialAdvancePointMatchesIndex(point, selectedBlockIndex, false))
  ), [gpsPoints, selectedBlockIndex]);
  const selectedGpsPoints = useMemo(() => (
    selectedGpsExactPoints.length
      ? selectedGpsExactPoints
      : gpsPoints.filter((point) => territorialAdvancePointMatchesIndex(point, selectedBlockIndex, true))
  ), [gpsPoints, selectedBlockIndex, selectedGpsExactPoints]);
  const mapGpsPoints = selectedGpsExactPoints.length ? selectedGpsExactPoints : visibleGpsPoints;
  const gpsSummary = useMemo(() => summarizeAdvanceGpsPoints(visibleGpsPoints), [visibleGpsPoints]);
  useEffect(() => {
    const visibleResponseIds = new Set(visibleGpsPoints.map((point) => stringOrEmpty(point.response_id)).filter(Boolean));
    if (selectedResponseId && visibleResponseIds.has(selectedResponseId)) return;
    if (selectedResponseId) setSelectedResponseId("");
  }, [selectedResponseId, visibleGpsPoints]);
  const selectedDistrictLabel = districtFilter === "todos"
    ? "Todos los distritos"
    : visible.find((row) => districtKey(row) === districtFilter)?.distrito || districtFilter;
  const selectBlock = (row: TerritorialBlockProgress, focusMap = true) => {
    setSelectedKey(advanceBlockStableKey(row));
    if (focusMap) setMapFocusToken((token) => token + 1);
  };
  return (
    <section className="mon-territorial-tab-panel mon-territorial-tab-panel--ump-map" aria-label="Mapa y UMP territorial">
      <div className="mon-territorial-ump-toolbar" aria-label="Filtros de UMP">
        <label className="mon-query-search">
          <Search size={14} />
          <input value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder="Buscar UMP, manzana, distrito o responsable..." />
        </label>
        <TerritorialAdvanceUmpSelect
          label="Distrito"
          value={districtFilter}
          options={districts}
          onChange={onDistrictFilterChange}
          formatOption={(value) => value === "todos" ? "Todos" : value}
        />
        <TerritorialAdvanceUmpSelect
          label="Estado"
          value={statusFilter}
          options={["todos", "complete", "incomplete", "none"]}
          onChange={(value) => setStatusFilter(value as TerritorialAdvanceUmpStatus | "todos")}
          formatOption={(value) => value === "todos" ? "Todos" : blockStatusLabel(value)}
        />
        <TerritorialAdvanceUmpSelect
          label="Cuota"
          value={quotaFilter}
          options={["todos", "complete", "in_field", "pending", "missing", "not_configured"]}
          onChange={(value) => setQuotaFilter(value as TerritorialAdvanceQuotaStatus | "todos")}
          formatOption={(value) => value === "todos" ? "Todas" : blockQuotaStatusLabel(value as TerritorialAdvanceQuotaStatus)}
        />
        <TerritorialAdvanceUmpSelect
          label="Zona"
          value={zoneFilter}
          options={zones}
          onChange={setZoneFilter}
          formatOption={(value) => value === "todos" ? "Todas" : `Zona ${value}`}
        />
        <TerritorialAdvanceUmpSelect
          label="Responsable"
          value={responsibleFilter}
          options={responsibles}
          onChange={setResponsibleFilter}
        />
      </div>
      <div className="mon-territorial-ump-map-layout">
        <section className="mon-territorial-ump-map-pane" data-map-layer={mapLayer} aria-label="Mapa territorial interactivo de UMP">
          <header className="mon-territorial-ump-map-head">
            <div>
              <span><MapPin size={14} /> Mapa territorial</span>
              <strong>
                {mapLayer === "zonas"
                  ? `${formatMetric(effectiveRouteZoneCount)} zonas · ${formatMetric(effectiveRouteBlocks.length)} UMP completas`
                  : selected ? advanceBlockLabel(selected) : "Sin UMP seleccionada"}
              </strong>
              <em>
                {mapLayer === "zonas"
                  ? "Cierre por zona, sin puntos GPS"
                  : visible.length
                    ? `${formatMetric(visible.length)} manzanas filtradas · ${formatMetric(visibleGpsPoints.length)} puntos GPS · ${selectedDistrictLabel} · ${phaseLabel}`
                    : "Sin manzanas con los filtros activos"}
              </em>
            </div>
            {/* Antes esta pestaña apilaba dos mapas completos, uno debajo del
                otro, y obligaba a recorrer más de mil píxeles para compararlos.
                Comparten un solo espacio y se conmutan. */}
            <div className="mon-territorial-ump-map-layers" role="group" aria-label="Capa del mapa">
              <button
                type="button"
                aria-pressed={mapLayer === "ump"}
                className={mapLayer === "ump" ? "is-active" : ""}
                onClick={() => setMapLayer("ump")}
              >
                UMP y GPS
              </button>
              <button
                type="button"
                aria-pressed={mapLayer === "zonas"}
                className={mapLayer === "zonas" ? "is-active" : ""}
                onClick={() => setMapLayer("zonas")}
              >
                Zonas con cierre
              </button>
            </div>
          </header>
          {mapLayer === "zonas" ? (
            <TerritorialRouteCoverageMap coverage={routeCoverage} blocks={sourceBlocks} reports={reports} mode="effective-zones" />
          ) : (
            <TerritorialAdvanceUmpMap
              blocks={sourceBlocks}
              visibleBlocks={visible}
              selectedBlock={selected}
              gpsPoints={visibleGpsPoints}
              mapGpsPoints={mapGpsPoints}
              gpsSummary={gpsSummary}
              selectedPointId={selectedResponseId}
              gpsLayerLoading={gpsLayerLoading}
              gpsLayerError={gpsLayerError}
              focusToken={mapFocusToken}
              onSelectBlock={selectBlock}
              onSelectPoint={(point) => {
                setSelectedResponseId(stringOrEmpty(point.response_id));
                const matchingBlock = visible.find((block) => territorialAdvancePointMatchesIndex(point, buildAdvanceBlockMatchIndex([block]), false));
                if (matchingBlock) selectBlock(matchingBlock, false);
              }}
            />
          )}
        </section>
        <TerritorialUmpMapNavigator
          blocks={visible}
          selectedBlockKey={selected ? advanceBlockStableKey(selected) : ""}
          selectedDistrictLabel={selectedDistrictLabel}
          onSelectBlock={selectBlock}
        />
        <section className="mon-territorial-ump-detail" aria-label="Detalle de UMP seleccionada">
          {selected ? (
            <>
              <header>
                <span><MapPin size={14} /> UMP seleccionada</span>
                <strong>{selected.ump || selected.id_manzana || "Sin UMP"}</strong>
                <em>{selected.distrito || "Sin distrito"}{selected.zona ? ` · Zona ${selected.zona}` : ""}</em>
              </header>
              <div className="mon-territorial-ump-detail-status">
                <span className={`mon-territorial-ump-status is-${blockStatus(selected)}`}>{blockStatusLabel(blockStatus(selected))}</span>
                <strong>{formatMetric(selected.validas)} / {formatMetric(selected.meta)} válidas</strong>
              </div>
              <dl className="mon-territorial-ump-detail-grid">
                <div><dt>Responsable</dt><dd>{selected.responsable || "Sin responsable asignado"}</dd></div>
                <div><dt>Manzana</dt><dd>{selected.manzana || selected.id_manzana || "S/D"}</dd></div>
                <div><dt>Brecha</dt><dd>{formatMetric(selected.brecha)}</dd></div>
                <div><dt>Revisión</dt><dd>{formatMetric(selected.revision)}</dd></div>
              </dl>
              <div className="mon-territorial-ump-gps-strip" aria-label="Lectura operativa de manzana seleccionada">
                <span><strong>{formatMetric(selected.validas)}</strong><em>válidas</em></span>
                <span><strong>{formatMetric(selected.meta)}</strong><em>meta</em></span>
                <span><strong>{formatMetric(selected.brecha)}</strong><em>brecha</em></span>
                <span><strong>{formatMetric(selectedGpsPoints.length)}</strong><em>GPS</em></span>
              </div>
              <TerritorialUmpGpsResponses
                rows={selectedGpsPoints}
                selectedResponseId={selectedResponseId}
                loading={gpsLayerLoading}
                onSelect={(point) => setSelectedResponseId(stringOrEmpty(point.response_id))}
              />
            </>
          ) : (
            <div className="mon-territorial-audit-empty">Sin manzanas con esos filtros.</div>
          )}
        </section>
      </div>
      <details className="mon-territorial-ump-table-disclosure">
        <summary>
          <span>Tabla completa de UMP</span>
          <strong>{formatMetric(visible.length)} registros</strong>
        </summary>
        <div className="mon-territorial-ump-table-wrap">
          <table className="mon-territorial-ump-table" aria-label="Tabla operativa de UMP y manzanas">
            <thead>
              <tr>
                <th>UMP / manzana</th>
                <th>Avance</th>
                <th>Estado</th>
                <th>Cuota</th>
                <th>Responsable</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const status = blockStatus(row);
                const quotaStatus = blockQuotaStatus(row);
                const rowKey = advanceBlockStableKey(row);
                const selectedRow = rowKey === selectedKey;
                return (
                  <tr key={rowKey} className={selectedRow ? "is-selected" : ""}>
                    <td>
                      <strong>{row.ump || "S/D"}</strong>
                      <small>{[row.distrito || "Sin distrito", row.zona ? `Zona ${row.zona}` : "", row.manzana ? `Mz ${row.manzana}` : row.id_manzana].filter(Boolean).join(" · ")}</small>
                    </td>
                    <td>
                      <span className="mon-territorial-progress-cell">
                        <strong>{formatMetric(row.validas)} / {formatMetric(row.meta)}</strong>
                        <small>{formatMetric(numberOrZero(row.revision) + numberOrZero(row.no_defendibles))} por revisar/no defendibles</small>
                        <i style={{ width: `${Math.min(100, Math.max(4, numberOrZero(row.avance_pct)))}%` }} />
                      </span>
                    </td>
                    <td><span className={`mon-territorial-ump-status is-${status}`}>{blockStatusLabel(status)}</span></td>
                    <td>
                      <span className={`mon-territorial-ump-status mon-territorial-quota-status is-${quotaStatus}`}>{blockQuotaStatusLabel(quotaStatus)}</span>
                      <small>{blockQuotaHint(row)}</small>
                    </td>
                    <td>{row.responsable || "Sin responsable"}</td>
                    <td>
                      <button
                        type="button"
                        className="mon-territorial-ump-row-action"
                        aria-pressed={selectedRow}
                        onClick={() => selectBlock(row)}
                      >
                        Seleccionar
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!visible.length ? (
                <tr><td colSpan={6}>Sin UMP con esos filtros.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

function TerritorialUmpGpsResponses({
  rows,
  selectedResponseId,
  loading,
  onSelect,
}: {
  rows: TerritorialAdvanceKoboPoint[];
  selectedResponseId: string;
  loading: boolean;
  onSelect: (point: TerritorialAdvanceKoboPoint) => void;
}) {
  const visibleRows = rows.slice(0, 80);
  return (
    <section className="mon-territorial-ump-responses" aria-label="Respuestas GPS de la UMP seleccionada">
      <header>
        <span><MapPin size={14} /> GPS Kobo</span>
        <strong>{loading ? "Cargando puntos..." : `${formatMetric(rows.length)} puntos vinculados`}</strong>
      </header>
      <div>
        {visibleRows.length ? visibleRows.map((point, index) => {
          const responseId = stringOrEmpty(point.response_id) || `gps-${index + 1}`;
          const selected = responseId === selectedResponseId;
          return (
            <button
              key={responseId}
              type="button"
              className={`mon-territorial-ump-response${selected ? " is-selected" : ""}`}
              aria-pressed={selected}
              onClick={() => onSelect(point)}
            >
              <span className={point.geoDisposition === "sin_gps" ? "is-no-gps" : ""}>{geoDispositionShortLabel(point.geoDisposition)}</span>
              <strong>{responseId}</strong>
              <em>{territorialAdvancePointDetail(point)}</em>
              <small>{formatDistanceLabel(point.distance_m)}</small>
            </button>
          );
        }) : (
          <p>{loading ? "Cargando capa cacheada de GPS." : "No hay respuestas GPS vinculadas a la UMP seleccionada."}</p>
        )}
        {rows.length > visibleRows.length ? (
          <p>{formatMetric(rows.length - visibleRows.length)} puntos adicionales ocultos para mantener la lista fluida.</p>
        ) : null}
      </div>
    </section>
  );
}

function TerritorialAdvanceUmpSelect({
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
    <label className="mon-territorial-ump-select">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.currentTarget.value)}>
        {options.map((option) => (
          <option key={option} value={option}>{formatOption ? formatOption(option) : (option === "todos" ? "Todos" : option)}</option>
        ))}
      </select>
    </label>
  );
}

function TerritorialAdvanceUmpMap({
  blocks,
  visibleBlocks,
  selectedBlock,
  gpsPoints,
  mapGpsPoints,
  gpsSummary,
  selectedPointId,
  gpsLayerLoading,
  gpsLayerError,
  focusToken,
  onSelectBlock,
  onSelectPoint,
}: {
  blocks: TerritorialBlockProgress[];
  visibleBlocks: TerritorialBlockProgress[];
  selectedBlock: TerritorialBlockProgress | null;
  gpsPoints: TerritorialAdvanceKoboPoint[];
  mapGpsPoints: TerritorialAdvanceKoboPoint[];
  gpsSummary: ReturnType<typeof summarizeAdvanceGpsPoints>;
  selectedPointId: string;
  gpsLayerLoading: boolean;
  gpsLayerError: string;
  focusToken: number;
  onSelectBlock: (block: TerritorialBlockProgress, focusMap?: boolean) => void;
  onSelectPoint: (point: TerritorialAdvanceKoboPoint) => void;
}) {
  const ubigeos = useMemo(() => uniqueNonEmpty(blocks.map((block) => normalizeMapCode(block.ubigeo))), [blocks]);
  const [blockFeaturesByUbigeo, setBlockFeaturesByUbigeo] = useState<Record<string, HojasRutaBlockMapFeature[]>>({});
  const [zoneFeaturesByUbigeo, setZoneFeaturesByUbigeo] = useState<Record<string, HojasRutaZoneMapFeature[]>>({});
  const [streetFeaturesByUbigeo, setStreetFeaturesByUbigeo] = useState<Record<string, HojasRutaStreetMapFeature[]>>({});
  const [contextFeaturesByUbigeo, setContextFeaturesByUbigeo] = useState<Record<string, HojasRutaContextMapFeature[]>>({});
  const [loading, setLoading] = useState(false);
  const [richLayerLoading, setRichLayerLoading] = useState(false);
  const [mapError, setMapError] = useState("");
  const [richLayerError, setRichLayerError] = useState("");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const suppressMapClickRef = useRef(false);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; panX: number; panY: number; moved: boolean } | null>(null);

  useEffect(() => {
    const missing = ubigeos.filter((ubigeo) => ubigeo && (!blockFeaturesByUbigeo[ubigeo] || !zoneFeaturesByUbigeo[ubigeo]));
    if (!missing.length) return;
    let cancelled = false;
    setLoading(true);
    setMapError("");
    Promise.allSettled(missing.map(async (ubigeo) => [ubigeo, await loadTerritorialRouteCartography(ubigeo)] as const))
      .then((results) => {
        if (cancelled) return;
        const next: Record<string, HojasRutaBlockMapFeature[]> = {};
        const nextZones: Record<string, HojasRutaZoneMapFeature[]> = {};
        results.forEach((result) => {
          if (result.status !== "fulfilled") return;
          const [ubigeo, bundle] = result.value;
          next[ubigeo] = bundle.blockMap?.geojson?.features ?? [];
          nextZones[ubigeo] = bundle.zoneMap?.geojson?.features ?? [];
        });
        if (Object.keys(next).length) setBlockFeaturesByUbigeo((current) => ({ ...current, ...next }));
        if (Object.keys(nextZones).length) setZoneFeaturesByUbigeo((current) => ({ ...current, ...nextZones }));
        if (results.some((result) => result.status === "rejected")) {
          setMapError("No se pudo cargar toda la cartografía de Hojas de Ruta para Avance.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [blockFeaturesByUbigeo, ubigeos, zoneFeaturesByUbigeo]);

  const allBlockFeatures = useMemo(() => (
    ubigeos.flatMap((ubigeo) => blockFeaturesByUbigeo[ubigeo] ?? [])
  ), [blockFeaturesByUbigeo, ubigeos]);
  const allZoneFeatures = useMemo(() => (
    ubigeos.flatMap((ubigeo) => zoneFeaturesByUbigeo[ubigeo] ?? [])
  ), [ubigeos, zoneFeaturesByUbigeo]);
  const selectedFeatures = useMemo(() => selectTerritorialMapFeatures(allBlockFeatures, blocks), [allBlockFeatures, blocks]);
  const visibleKeys = useMemo(() => new Set(visibleBlocks.map(advanceBlockStableKey)), [visibleBlocks]);
  const visibleFeatures = useMemo(() => (
    selectedFeatures.filter((item) => visibleKeys.has(advanceBlockStableKey(item.block)))
  ), [selectedFeatures, visibleKeys]);
  const mapFeatures = visibleFeatures.length ? visibleFeatures : selectedFeatures;
  const activeUbigeos = useMemo(() => new Set((visibleBlocks.length ? visibleBlocks : blocks).map((block) => normalizeMapCode(block.ubigeo)).filter(Boolean)), [blocks, visibleBlocks]);
  const richLayerUbigeos = useMemo(() => {
    const selectedUbigeo = normalizeMapCode(selectedBlock?.ubigeo);
    if (selectedUbigeo) return [selectedUbigeo];
    return Array.from(activeUbigeos).slice(0, 1);
  }, [activeUbigeos, selectedBlock]);
  const activeZoneKeys = useMemo(() => (
    new Set((visibleBlocks.length ? visibleBlocks : blocks).map(territorialBlockZoneKey).filter(Boolean))
  ), [blocks, visibleBlocks]);
  const visibleZoneFeatures = useMemo(() => (
    allZoneFeatures
      .filter((feature) => activeZoneKeys.has(territorialZoneFeatureKey(feature)))
      .slice(0, 90)
  ), [activeZoneKeys, allZoneFeatures]);
  const neighborFeatures = useMemo(() => {
    const selectedFeatureRefs = new Set(mapFeatures.map((item) => item.feature));
    const candidates = allBlockFeatures.filter((feature) => (
      !selectedFeatureRefs.has(feature)
      && activeZoneKeys.has(territorialFeatureZoneKey(feature))
    ));
    if (candidates.length <= 180) return candidates;
    const step = Math.ceil(candidates.length / 180);
    return candidates.filter((_, index) => index % step === 0).slice(0, 180);
  }, [activeZoneKeys, allBlockFeatures, mapFeatures]);
  const visibleStreetFeatures = useMemo(() => (
    sampleTerritorialStreetFeatures(richLayerUbigeos.flatMap((ubigeo) => streetFeaturesByUbigeo[ubigeo] ?? []))
  ), [richLayerUbigeos, streetFeaturesByUbigeo]);
  const visibleContextFeatures = useMemo(() => (
    sampleTerritorialContextFeatures(richLayerUbigeos.flatMap((ubigeo) => contextFeaturesByUbigeo[ubigeo] ?? []))
  ), [contextFeaturesByUbigeo, richLayerUbigeos]);
  const activeDistrictFeatures = useMemo(() => (
    LIMA_DISTRICT_FEATURES.filter((feature) => activeUbigeos.has(normalizeMapCode(feature.properties.ubigeo)))
  ), [activeUbigeos]);
  const projection = useMemo(() => buildTerritorialMapProjection(
    activeDistrictFeatures.length ? activeDistrictFeatures : LIMA_DISTRICT_FEATURES,
    mapFeatures.map((item) => item.feature),
    visibleZoneFeatures,
    28,
    mapGpsPoints.map((point) => ({ lon: point.lonValue, lat: point.latValue })),
  ), [activeDistrictFeatures, mapFeatures, mapGpsPoints, visibleZoneFeatures]);
  const selectedBlockKey = selectedBlock ? advanceBlockStableKey(selectedBlock) : "";
  const selectedFeature = useMemo(() => (
    selectedBlockKey
      ? selectedFeatures.find((item) => advanceBlockStableKey(item.block) === selectedBlockKey) ?? null
      : null
  ), [selectedBlockKey, selectedFeatures]);
  const selectedPoint = useMemo(() => (
    selectedFeature ? featureCentroid(selectedFeature.feature, projection) : null
  ), [projection, selectedFeature]);
  const selectedGpsPoint = useMemo(() => (
    selectedPointId
      ? gpsPoints.find((point) => stringOrEmpty(point.response_id) === selectedPointId) ?? null
      : null
  ), [gpsPoints, selectedPointId]);
  const selectedGpsMapPoint = useMemo(() => (
    selectedGpsPoint ? projection.project(selectedGpsPoint.lonValue, selectedGpsPoint.latValue) : null
  ), [projection, selectedGpsPoint]);
  const completeCount = visibleBlocks.filter((block) => blockStatus(block) === "complete").length;
  const incompleteCount = visibleBlocks.filter((block) => blockStatus(block) === "incomplete").length;
  const transform = `translate(${pan.x.toFixed(1)} ${pan.y.toFixed(1)}) scale(${zoom.toFixed(3)})`;
  const zoomClass = zoom >= 2.4 ? "is-zoom-blocks" : zoom >= 1.5 ? "is-zoom-detail" : "is-zoom-general";
  const pointScale = 1 / Math.max(1, zoom);
  const hasVisibleMapGeometry = mapFeatures.length > 0;
  const hasVisibleRichLayers = visibleStreetFeatures.length > 0 || visibleContextFeatures.length > 0;
  const blockingMapLoading = loading && !hasVisibleMapGeometry;
  const blockingRichLayerLoading = richLayerLoading && !hasVisibleRichLayers;
  const backgroundMapLoading = loading && hasVisibleMapGeometry;
  const backgroundRichLayerLoading = richLayerLoading && hasVisibleRichLayers;

  useEffect(() => {
    const missing = richLayerUbigeos.filter((ubigeo) => ubigeo && (!streetFeaturesByUbigeo[ubigeo] || !contextFeaturesByUbigeo[ubigeo]));
    if (!missing.length) return;
    let cancelled = false;
    setRichLayerLoading(true);
    setRichLayerError("");
    Promise.allSettled(missing.map(async (ubigeo) => [ubigeo, await loadTerritorialRouteCartography(ubigeo, { includeRichLayers: true })] as const))
      .then((results) => {
        if (cancelled) return;
        const nextStreets: Record<string, HojasRutaStreetMapFeature[]> = {};
        const nextContext: Record<string, HojasRutaContextMapFeature[]> = {};
        results.forEach((result) => {
          if (result.status !== "fulfilled") return;
          const [ubigeo, bundle] = result.value;
          nextStreets[ubigeo] = bundle.streetMap?.geojson?.features ?? [];
          nextContext[ubigeo] = bundle.contextMap?.geojson?.features ?? [];
        });
        if (Object.keys(nextStreets).length) setStreetFeaturesByUbigeo((current) => ({ ...current, ...nextStreets }));
        if (Object.keys(nextContext).length) setContextFeaturesByUbigeo((current) => ({ ...current, ...nextContext }));
        if (results.some((result) => result.status === "rejected")) {
          setRichLayerError("No se pudieron cargar todas las capas de calles/contexto para la UMP seleccionada.");
        }
      })
      .finally(() => {
        if (!cancelled) setRichLayerLoading(false);
      });
    return () => { cancelled = true; };
  }, [contextFeaturesByUbigeo, richLayerUbigeos, streetFeaturesByUbigeo]);

  useEffect(() => {
    if (!selectedPoint || !focusToken) return;
    const nextZoom = clamp(Math.max(zoom, 3.1), 1, 7);
    setZoom(nextZoom);
    setPan({
      x: LIMA_MAP_WIDTH / 2 - selectedPoint.x * nextZoom,
      y: LIMA_MAP_HEIGHT / 2 - selectedPoint.y * nextZoom,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusToken, selectedPoint?.x, selectedPoint?.y]);

  useEffect(() => {
    if (!selectedGpsMapPoint || !selectedPointId) return;
    const nextZoom = clamp(Math.max(zoom, 4.2), 1, 7);
    setZoom(nextZoom);
    setPan({
      x: LIMA_MAP_WIDTH / 2 - selectedGpsMapPoint.x * nextZoom,
      y: LIMA_MAP_HEIGHT / 2 - selectedGpsMapPoint.y * nextZoom,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPointId, selectedGpsMapPoint?.x, selectedGpsMapPoint?.y]);

  const resetMap = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };
  const zoomAt = (factor: number, anchor?: { clientX: number; clientY: number }, target?: HTMLDivElement | null) => {
    const nextZoom = clamp(zoom * factor, 0.8, 7);
    if (nextZoom === zoom) return;
    const rect = (target ?? viewportRef.current)?.getBoundingClientRect();
    if (!rect) {
      setZoom(nextZoom);
      return;
    }
    const anchorX = anchor?.clientX ?? rect.left + rect.width / 2;
    const anchorY = anchor?.clientY ?? rect.top + rect.height / 2;
    const svgX = (anchorX - rect.left) * (LIMA_MAP_WIDTH / Math.max(1, rect.width));
    const svgY = (anchorY - rect.top) * (LIMA_MAP_HEIGHT / Math.max(1, rect.height));
    const mapX = (svgX - pan.x) / zoom;
    const mapY = (svgY - pan.y) / zoom;
    setZoom(nextZoom);
    setPan({
      x: svgX - mapX * nextZoom,
      y: svgY - mapY * nextZoom,
    });
  };
  const zoomBy = (factor: number) => {
    zoomAt(factor);
  };
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      panX: pan.x,
      panY: pan.y,
      moved: false,
    };
    suppressMapClickRef.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const scaleX = LIMA_MAP_WIDTH / Math.max(1, rect.width);
    const scaleY = LIMA_MAP_HEIGHT / Math.max(1, rect.height);
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (Math.hypot(deltaX, deltaY) > 3) drag.moved = true;
    setPan({
      x: drag.panX + deltaX * scaleX,
      y: drag.panY + deltaY * scaleY,
    });
  };
  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag?.pointerId !== event.pointerId) return;
    suppressMapClickRef.current = drag.moved;
    dragRef.current = null;
  };
  const onMapClickCapture = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!suppressMapClickRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    suppressMapClickRef.current = false;
  };
  const onWheel = (event: WheelEvent) => {
    event.preventDefault();
    if (event.ctrlKey || event.metaKey) {
      zoomAt(event.deltaY < 0 ? 1.18 : 0.84, { clientX: event.clientX, clientY: event.clientY }, viewportRef.current);
      return;
    }
    setPan((current) => ({
      x: current.x - event.deltaX * 0.65,
      y: current.y - event.deltaY * 0.65,
    }));
  };

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return undefined;
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [onWheel]);

  return (
    <section className="mon-territorial-advance-map-card" aria-label="Mapa de manzanas UMP en Avance">
      <header className="mon-territorial-advance-map-head">
        <div>
          <span><MapPin size={14} /> Mapa territorial</span>
          <strong>{selectedBlock ? advanceBlockLabel(selectedBlock) : "Todos los distritos"}</strong>
          <em>{formatMetric(mapFeatures.length)} manzanas con geometría · {formatMetric(mapGpsPoints.length)} puntos GPS en mapa · {formatMetric(gpsPoints.length)} GPS visibles · {formatMetric(activeUbigeos.size)} distritos filtrados</em>
        </div>
        <div className="mon-territorial-advance-map-selection">
          <span>Selección</span>
          <strong title={selectedGpsPoint ? territorialAdvancePointDetail(selectedGpsPoint) : selectedBlock ? advanceBlockDetail(selectedBlock) : undefined}>
            {selectedGpsPoint
              ? territorialAdvancePointDetail(selectedGpsPoint)
              : selectedBlock ? advanceBlockDetail(selectedBlock) : "Sin UMP seleccionada"}
          </strong>
        </div>
      </header>
      <div
        ref={viewportRef}
        className="mon-territorial-map-viewport mon-territorial-advance-map-viewport"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={onMapClickCapture}
      >
        <div className="mon-territorial-map-tools" aria-label="Controles del mapa" onPointerDown={(event) => event.stopPropagation()}>
          <button type="button" aria-label="Acercar mapa" onClick={() => zoomBy(1.45)}><Plus size={13} /></button>
          <button type="button" aria-label="Alejar mapa" onClick={() => zoomBy(0.69)}><Minus size={13} /></button>
          <button type="button" aria-label="Ver todo el mapa" onClick={resetMap}><Maximize2 size={13} /></button>
          <span className="mon-territorial-map-zoom-readout">{zoom.toFixed(1)}x</span>
        </div>
        {projection.hasGeometry ? (
          <svg
            className={`mon-territorial-advance-map-hit-layer is-lima-map ${zoomClass}`}
            viewBox={`0 0 ${LIMA_MAP_WIDTH} ${LIMA_MAP_HEIGHT}`}
            preserveAspectRatio="none"
            role="img"
            aria-label="Mapa interactivo de manzanas territoriales de Avance"
          >
            <g transform={transform}>
              <g className="mon-territorial-map-context-features" aria-label="Contexto territorial">
                {visibleContextFeatures.map((feature, index) => {
                  const d = territorialContextFeaturePath(feature, projection);
                  return d ? (
                    <path
                      key={`context-feature-${feature.properties.id ?? feature.id ?? index}`}
                      d={d}
                      className={`is-${territorialContextClass(feature)}`}
                      vectorEffect="non-scaling-stroke"
                    >
                      <title>{feature.properties.display_name || feature.properties.name || feature.properties.feature_class || "Contexto territorial"}</title>
                    </path>
                  ) : null;
                })}
              </g>
              <g className="mon-territorial-route-coverage-context" aria-label="Bordes de Lima Metropolitana">
                {LIMA_DISTRICT_FEATURES.map((feature) => {
                  const d = territorialDistrictPath(feature, projection);
                  return d ? <path key={`context-${feature.properties.ubigeo}`} d={d} vectorEffect="non-scaling-stroke" /> : null;
                })}
              </g>
              <g className="mon-territorial-route-coverage-districts" aria-label="Distritos activos">
                {activeDistrictFeatures.map((feature, index) => {
                  const d = territorialDistrictPath(feature, projection);
                  const color = districtColor(index);
                  return d ? (
                    <path
                      key={feature.properties.ubigeo}
                      d={d}
                      className="is-active"
                      vectorEffect="non-scaling-stroke"
                      style={{ "--route-district-color": color } as CSSProperties}
                    >
                      <title>{feature.properties.distrito}</title>
                    </path>
                  ) : null;
                })}
              </g>
              <g className="mon-territorial-map-zones" aria-label="Zonas de Hoja de Ruta">
                {visibleZoneFeatures.map((feature, index) => {
                  const d = territorialZonePath(feature, projection);
                  const zona = stringOrEmpty(feature.properties.zona_label || feature.properties.zona || "Zona");
                  return d ? (
                    <path
                      key={`zone-${territorialZoneFeatureKey(feature) || index}`}
                      d={d}
                      className="is-selected-zone"
                      vectorEffect="non-scaling-stroke"
                    >
                      <title>{zona}</title>
                    </path>
                  ) : null;
                })}
              </g>
              <g className="mon-territorial-map-streets" aria-label="Calles principales de Hoja de Ruta">
                {visibleStreetFeatures.map((feature, index) => {
                  const d = territorialStreetPath(feature, projection);
                  return d ? (
                    <path
                      key={`street-${feature.properties.id ?? feature.id ?? index}`}
                      d={d}
                      className={feature.properties.class_group === "major" ? "is-major" : ""}
                      vectorEffect="non-scaling-stroke"
                    >
                      <title>{feature.properties.display_name || feature.properties.name || "Via local"}</title>
                    </path>
                  ) : null;
                })}
              </g>
              <g
                className="mon-territorial-map-neighbor-blocks"
                aria-label="Manzanas vecinas de referencia"
                style={{ opacity: zoom >= 2.4 ? 0.5 : zoom >= 1.5 ? 0.28 : 0.16 }}
              >
                {neighborFeatures.map((feature, index) => {
                  const d = territorialFeaturePath(feature, projection);
                  return d ? (
                    <path
                      key={`neighbor-${territorialFeatureZoneKey(feature)}-${index}`}
                      d={d}
                      className="mon-territorial-map-context-block"
                      vectorEffect="non-scaling-stroke"
                    />
                  ) : null;
                })}
              </g>
              <g className="mon-territorial-route-coverage-blocks" aria-label="Manzanas seleccionadas">
                {mapFeatures.map((item, index) => (
                  <TerritorialAdvanceUmpMapBlock
                    key={item.key}
                    feature={item}
                    index={index}
                    projection={projection}
                    selected={advanceBlockStableKey(item.block) === selectedBlockKey}
                    muted={!visibleKeys.has(advanceBlockStableKey(item.block))}
                    onSelect={onSelectBlock}
                  />
                ))}
              </g>
              <g className="mon-territorial-map-point-hit-layer" aria-label="Puntos GPS Kobo">
                {mapGpsPoints.map((point, index) => {
                  const projected = projection.project(point.lonValue, point.latValue);
                  const pointId = stringOrEmpty(point.response_id) || `gps-${index + 1}`;
                  const selected = selectedPointId === pointId;
                  const coreRadius = selected ? 3.6 : point.geoDisposition === "en_zona" ? 2.8 : 3;
                  return (
                    <g
                      key={pointId}
                      className={`mon-territorial-map-point-node ${advancePointGeoClass(point)} is-${point.geoDisposition}${selected ? " is-selected" : ""}`}
                      transform={`translate(${projected.x.toFixed(2)} ${projected.y.toFixed(2)}) scale(${pointScale.toFixed(6)})`}
                      role="button"
                      tabIndex={0}
                      aria-label={`Seleccionar punto GPS: ${territorialAdvancePointDetail(point)}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelectPoint(point);
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter" && event.key !== " ") return;
                        event.preventDefault();
                        event.stopPropagation();
                        onSelectPoint(point);
                      }}
                    >
                      <circle className="mon-territorial-map-point-hit mon-territorial-map-point-hit-area" r="6.2" />
                      {selected ? <circle className="mon-territorial-map-point-focus" r="6.1" /> : null}
                      <circle className="mon-territorial-map-point-core" r={coreRadius} />
                      <title>{territorialAdvancePointDetail(point)}</title>
                    </g>
                  );
                })}
              </g>
            </g>
          </svg>
        ) : (
          <div className="mon-territorial-route-map-placeholder">
            <span><MapPin size={18} /></span>
            <strong>Sin geometría territorial</strong>
            <em>El corte no trae cartografía de Hojas de Ruta para las manzanas filtradas.</em>
          </div>
        )}
        {blockingMapLoading ? <span className="mon-territorial-route-map-loading"><Loader2 size={13} className="pulso-spin" /> Cargando manzanas</span> : null}
        {blockingRichLayerLoading ? <span className="mon-territorial-route-map-loading is-context"><Loader2 size={13} className="pulso-spin" /> Cargando calles</span> : null}
        {gpsLayerLoading ? <span className="mon-territorial-route-map-loading is-gps"><Loader2 size={13} className="pulso-spin" /> Cargando GPS</span> : null}
        <div
          className="mon-territorial-map-legend mon-territorial-advance-map-legend"
          aria-label="Leyenda GPS y capas de mapa UMP"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <span className="is-map-legend-section">GPS Kobo</span>
          {ADVANCE_GPS_LEGEND.map((item) => (
            <span key={item.key} className={`is-gps-state is-${item.key}`}>{item.label}</span>
          ))}
          <span className="is-map-legend-section">Ruta</span>
          <span className="is-route-selected">Manzana seleccionada</span>
          <span className="is-map-context">Hoja de Ruta: {formatMetric(visibleZoneFeatures.length)} zonas · {formatMetric(visibleStreetFeatures.length)} vías · {formatMetric(visibleContextFeatures.length)} contexto</span>
          <span className="is-map-level">{formatMetric(neighborFeatures.length)} vecinas</span>
          {backgroundMapLoading ? <span className="is-map-level">Completando manzanas</span> : null}
          {backgroundRichLayerLoading ? <span className="is-map-level">Completando calles</span> : null}
        </div>
        {/* La ayuda de interacción vivía como <text> dentro del SVG, en
            coordenadas del viewBox: al ceder alto el mapa, quedaba partida por
            la mitad contra el borde. Como HTML se ancla al visor y no depende
            de la escala de la cartografía. */}
        <p className="mon-territorial-advance-map-hint" aria-hidden="true">
          Arrastra o usa trackpad para moverte · Ctrl+rueda o botones para zoom · click enfoca detalle
        </p>
        <TerritorialAdvanceMapFocusStrip
          selectedPoint={selectedGpsPoint}
          selectedBlock={selectedBlock}
          hasSelectedGeometry={Boolean(selectedFeature)}
        />
      </div>
      {/* Los conteos son datos del corte, no controles del mapa: salen del visor
          —donde flotaban tapando la cartografía y se encimaban con la leyenda—
          y pasan a ser una fila propia de la tarjeta, debajo del mapa. */}
      <div className="mon-territorial-advance-map-footer" aria-label="Resumen del mapa UMP">
        <span className="is-ready"><strong>{formatMetric(completeCount)}</strong><em>completas</em></span>
        <span className="is-warning"><strong>{formatMetric(incompleteCount)}</strong><em>incompletas</em></span>
        <span><strong>{formatMetric(gpsSummary.en_zona)}</strong><em>GPS en zona</em></span>
        <span><strong>{formatMetric(gpsSummary.en_distrito)}</strong><em>GPS fuera zona</em></span>
        <span><strong>{formatMetric(gpsSummary.fuera_distrito + gpsSummary.sin_cruce + gpsSummary.sin_gps)}</strong><em>GPS revisión</em></span>
        <span><strong>{formatMetric(mapFeatures.length)}</strong><em>manzanas mapa</em></span>
      </div>
      {mapError ? <div className="mon-territorial-map-error">{mapError}</div> : null}
      {richLayerError ? <div className="mon-territorial-map-error">{richLayerError}</div> : null}
      {gpsLayerError ? <div className="mon-territorial-map-error">{gpsLayerError}</div> : null}
    </section>
  );
}

function TerritorialAdvanceMapFocusStrip({
  selectedPoint,
  selectedBlock,
  hasSelectedGeometry,
}: {
  selectedPoint: TerritorialAdvanceKoboPoint | null;
  selectedBlock: TerritorialBlockProgress | null;
  hasSelectedGeometry: boolean;
}) {
  if (selectedPoint) {
    const distance = selectedPoint.gps_effective_distance_m ?? selectedPoint.gps_primary_distance_m ?? selectedPoint.distance_m;
    const pointId = stringOrEmpty(selectedPoint.response_id) || "sin id";
    const declared = selectedPoint.declared_ump_normalized
      || selectedPoint.advance_block_ump
      || selectedPoint.declared_ump_raw
      || "UMP sin declarar";
    return (
      <section
        className="mon-territorial-advance-map-focus-strip is-point"
        aria-label="Punto GPS enfocado en el mapa de Avance"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <span><CheckCircle2 size={13} /> GPS Kobo</span>
        <strong title={pointId}>{pointId}</strong>
        <em title={territorialAdvancePointDetail(selectedPoint)}>{declared} · {advancePointSubmissionLabel(selectedPoint)}</em>
        <b>{geoDispositionLabel(selectedPoint.geoDisposition)} · {formatDistanceLabel(distance)}</b>
      </section>
    );
  }

  if (selectedBlock) {
    const status = blockStatus(selectedBlock);
    const pct = clamp(progressPctForBlock(selectedBlock), 0, 100);
    return (
      <section
        className={`mon-territorial-advance-map-focus-strip is-${status}`}
        aria-label="Manzana UMP enfocada en el mapa de Avance"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <span><Route size={13} /> UMP foco</span>
        <strong title={advanceBlockDetail(selectedBlock)}>{advanceBlockLabel(selectedBlock)}</strong>
        <em title={advanceBlockDetail(selectedBlock)}>{advanceBlockDetail(selectedBlock)}</em>
        <b>{formatMetric(selectedBlock.validas)} / {formatMetric(selectedBlock.meta)} válidas · {formatMetric(selectedBlock.brecha)} pendientes · {hasSelectedGeometry ? "con geometría" : "sin geometría"}</b>
        <i aria-hidden="true"><small style={{ width: `${Math.max(4, pct)}%` }} /></i>
      </section>
    );
  }

  return (
    <section
      className="mon-territorial-advance-map-focus-strip is-empty"
      aria-label="Ayuda de selección del mapa UMP en Avance"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <span><MapPin size={13} /> Selección</span>
      <strong>Sin UMP seleccionada</strong>
      <em>Click en una manzana o punto GPS para enfocar detalle.</em>
    </section>
  );
}

function TerritorialAdvanceUmpMapBlock({
  feature,
  index,
  projection,
  selected,
  muted,
  onSelect,
}: {
  feature: TerritorialSelectedMapFeature;
  index: number;
  projection: ReturnType<typeof buildTerritorialMapProjection>;
  selected: boolean;
  muted: boolean;
  onSelect: (block: TerritorialBlockProgress, focusMap?: boolean) => void;
}) {
  const d = territorialFeaturePath(feature.feature, projection);
  if (!d) return null;
  const replacement = territorialRouteBlockIsReplacement(feature.block);
  const className = [
    replacement ? "is-replacement" : "is-titular",
    selected ? "is-selected" : "",
    muted ? "is-muted" : "",
  ].filter(Boolean).join(" ");
  return (
    <path
      d={d}
      className={className}
      vectorEffect="non-scaling-stroke"
      style={{ "--route-block-color": districtColor(index) } as CSSProperties}
      role="button"
      tabIndex={0}
      aria-label={advanceBlockDetail(feature.block)}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(feature.block, true);
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onSelect(feature.block, true);
      }}
    >
      <title>{advanceBlockDetail(feature.block)}</title>
    </path>
  );
}

function TerritorialUmpMapNavigator({
  blocks,
  selectedBlockKey,
  selectedDistrictLabel,
  onSelectBlock,
}: {
  blocks: TerritorialBlockProgress[];
  selectedBlockKey: string;
  selectedDistrictLabel: string;
  onSelectBlock: (block: TerritorialBlockProgress, focusMap?: boolean) => void;
}) {
  return (
    <aside className="mon-territorial-ump-map-nav" aria-label="Manzanas del mapa">
      <header>
        <div>
          <span><Route size={14} /> Manzanas</span>
          <strong>{selectedDistrictLabel}</strong>
        </div>
        <em>{formatMetric(blocks.length)}</em>
      </header>
      <div>
        {blocks.length ? blocks.map((block) => {
          const key = advanceBlockStableKey(block);
          const selected = key === selectedBlockKey;
          const status = blockStatus(block);
          const pct = clamp(progressPctForBlock(block), 0, 100);
          return (
            <button
              key={key}
              type="button"
              className={`mon-territorial-ump-map-nav-row is-${status}${selected ? " is-selected" : ""}`}
              aria-pressed={selected}
              title={advanceBlockDetail(block)}
              onClick={() => onSelectBlock(block, true)}
            >
              <span
                className="mon-territorial-ump-map-nav-ring"
                style={{ "--ump-ring": `${pct * 3.6}deg` } as CSSProperties}
                aria-hidden="true"
              >
                <MapPin size={14} />
              </span>
              <span>
                <strong>{block.ump || block.id_manzana || "S/D"}</strong>
                <em>{block.zona ? `Zona ${block.zona}` : "Zona S/D"} · {block.manzana ? `Mz ${block.manzana}` : "Mz S/D"}</em>
              </span>
              <b>{block.distrito || "Sin distrito"}</b>
              <div className="mon-territorial-ump-map-nav-meta" aria-label="Detalle operativo de la manzana">
                <small title={block.responsable || "Sin responsable"}>
                  <ContactRound size={10} />
                  {block.responsable || "Sin responsable"}
                </small>
                <small title={`${formatMetric(block.validas)} / ${formatMetric(block.meta)} válidas`}>
                  <ListChecks size={10} />
                  {formatMetric(block.validas)} / {formatMetric(block.meta)}
                </small>
                {numberOrZero(block.revision) ? (
                  <small className="is-alert" title={`${formatMetric(block.revision)} en revisión`}>
                    <AlertTriangle size={10} />
                    {formatMetric(block.revision)} revisión
                  </small>
                ) : null}
              </div>
              <i><small style={{ width: `${Math.max(4, pct)}%` }} /></i>
              <footer>
                <small>{blockStatusLabel(status)}</small>
                <small>{formatPercentLabel(pct)}</small>
              </footer>
            </button>
          );
        }) : (
          <p>No hay manzanas con esos filtros.</p>
        )}
      </div>
    </aside>
  );
}

function advanceBlockStableKey(block: TerritorialBlockProgress) {
  return territorialBlockStableKey(block)
    || [block.ubigeo, block.zona, block.manzana, block.id_manzana, block.ump, block.responsable]
      .map((value) => normalizeMapCode(value))
      .filter(Boolean)
      .join(":")
    || `ump:${normalizeMatch(advanceBlockDetail(block))}`;
}

function advanceBlockLabel(block: TerritorialBlockProgress) {
  const ump = stringOrEmpty(block.ump || block.territorio_muestral || block.hoja_num).trim();
  const blockLabel = block.manzana ? `Mz ${block.manzana}` : block.id_manzana ? `Mz ${block.id_manzana}` : "Mz S/D";
  return ump ? `UMP ${ump} · ${blockLabel}` : blockLabel;
}

function advanceBlockDetail(block: TerritorialBlockProgress) {
  return [
    block.distrito || "Sin distrito",
    block.zona ? `Zona ${block.zona}` : "",
    block.manzana ? `Mz ${block.manzana}` : block.id_manzana || "",
    block.responsable || "Sin responsable",
  ].filter(Boolean).join(" · ");
}

function progressPctForBlock(block: TerritorialBlockProgress) {
  const explicit = numberOrNull(block.avance_pct);
  if (explicit != null) return explicit;
  return safePercent(numberOrZero(block.validas), numberOrNull(block.meta)) ?? 0;
}

function districtColor(index: number) {
  const colors = ["#0f766e", "#be123c", "#2563eb", "#c2410c", "#7c3aed", "#0891b2", "#a16207", "#4f46e5"];
  return colors[Math.abs(index) % colors.length];
}

function normalizeMapCode(value: unknown) {
  return stringOrEmpty(value).trim().toUpperCase().replace(/[^A-Z0-9]+/g, "");
}

function featureCentroid(feature: HojasRutaBlockMapFeature, projection: ReturnType<typeof buildTerritorialMapProjection>) {
  const points = flattenFeaturePoints(feature);
  if (!points.length) return null;
  const total = points.reduce((acc, point) => ({ lon: acc.lon + point.lon, lat: acc.lat + point.lat }), { lon: 0, lat: 0 });
  return projection.project(total.lon / points.length, total.lat / points.length);
}

function flattenFeaturePoints(feature: HojasRutaBlockMapFeature): Array<{ lon: number; lat: number }> {
  const points: Array<{ lon: number; lat: number }> = [];
  const walk = (value: unknown) => {
    if (!Array.isArray(value)) return;
    if (value.length >= 2 && Number.isFinite(Number(value[0])) && Number.isFinite(Number(value[1]))) {
      points.push({ lon: Number(value[0]), lat: Number(value[1]) });
      return;
    }
    value.forEach(walk);
  };
  walk(feature.geometry?.coordinates);
  return points;
}

function territorialAdvanceKoboMapPoints(reports: MonitoreoTerritorialDashboard): TerritorialAdvanceKoboPoint[] {
  const rowsById = new Map((reports.response_audit ?? []).map((row) => [stringOrEmpty(row.response_id), row]));
  return (reports.map?.points ?? [])
    .map((point, index): TerritorialAdvanceKoboPoint | null => {
      const row = rowsById.get(stringOrEmpty(point.response_id));
      const latValue = numberOrNull(point.gps_effective_lat ?? point.gps_primary_lat ?? point.lat ?? row?.gps_effective_lat ?? row?.gps_primary_lat ?? row?.lat);
      const lonValue = numberOrNull(point.gps_effective_lon ?? point.gps_primary_lon ?? point.lon ?? row?.gps_effective_lon ?? row?.gps_primary_lon ?? row?.lon);
      if (latValue == null || lonValue == null) return null;
      const geoEstado = stringOrEmpty(point.geo_estado || point.gps_effective_estado || point.gps_primary_estado || row?.geo_estado || "geo_ok");
      return {
        ...point,
        response_id: stringOrEmpty(point.response_id || row?.response_id || `gps-${index + 1}`),
        submitted_by: stringOrEmpty(point.submitted_by || row?.submitted_by),
        responsible_display: stringOrEmpty(point.responsible_display || row?.responsible_display || row?.enumerator_assigned),
        lat: latValue,
        lon: lonValue,
        latValue,
        lonValue,
        geo_estado: geoEstado,
        geoDisposition: geoDispositionFromRaw(geoEstado),
      };
    })
    .filter((point): point is TerritorialAdvanceKoboPoint => point !== null);
}

function buildAdvanceBlockMatchIndex(blocks: TerritorialBlockProgress[]): TerritorialAdvanceBlockMatchIndex {
  const exact = new Set<string>();
  const district = new Set<string>();
  const addExact = (kind: string, value: unknown) => {
    const key = normalizeMapCode(value);
    if (key) exact.add(`${kind}:${key}`);
  };
  const addDistrict = (kind: string, value: unknown) => {
    const key = kind === "label" ? normalizeMatch(value) : normalizeMapCode(value);
    if (key) district.add(`${kind}:${key}`);
  };
  blocks.forEach((block) => {
    addExact("block", advanceBlockStableKey(block));
    addExact("block", block.id_manzana);
    addExact("ump", block.ump);
    addExact("ump", block.territorio_muestral);
    const locationKey = [
      normalizeMapCode(block.ubigeo),
      normalizeMapCode(block.zona),
      normalizeMapCode(block.manzana || block.id_manzana),
    ].filter(Boolean).join(":");
    if (locationKey) exact.add(`loc:${locationKey}`);
    addDistrict("ubigeo", block.ubigeo);
    addDistrict("label", block.distrito);
  });
  return { exact, district };
}

function territorialAdvancePointMatchesIndex(
  point: TerritorialAdvanceKoboPoint,
  index: TerritorialAdvanceBlockMatchIndex,
  includeDistrict: boolean,
) {
  if (!index.exact.size && !index.district.size) return false;
  for (const key of territorialAdvancePointExactKeys(point)) {
    if (index.exact.has(key)) return true;
  }
  if (!includeDistrict) return false;
  for (const key of territorialAdvancePointDistrictKeys(point)) {
    if (index.district.has(key)) return true;
  }
  return false;
}

function territorialAdvancePointExactKeys(point: TerritorialAdvanceKoboPoint) {
  const keys = new Set<string>();
  const add = (kind: string, value: unknown) => {
    const key = normalizeMapCode(value);
    if (key) keys.add(`${kind}:${key}`);
  };
  add("block", point.advance_block_id);
  add("block", point.nearest_block_id);
  add("block", point.gps_effective_nearest_block_id);
  add("block", point.gps_primary_nearest_block_id);
  add("ump", point.advance_block_ump);
  add("ump", point.declared_ump_normalized);
  add("ump", point.declared_ump_raw);
  const locationKey = [
    normalizeMapCode(point.advance_block_ubigeo || point.ubigeo),
    normalizeMapCode(point.advance_block_zona),
    normalizeMapCode(point.advance_block_manzana),
  ].filter(Boolean).join(":");
  if (locationKey) keys.add(`loc:${locationKey}`);
  return keys;
}

function territorialAdvancePointDistrictKeys(point: TerritorialAdvanceKoboPoint) {
  const keys = new Set<string>();
  const addCode = (value: unknown) => {
    const key = normalizeMapCode(value);
    if (key) keys.add(`ubigeo:${key}`);
  };
  const addLabel = (value: unknown) => {
    const key = normalizeMatch(value);
    if (key) keys.add(`label:${key}`);
  };
  addCode(point.advance_block_ubigeo);
  addCode(point.ubigeo);
  addLabel(point.advance_block_distrito);
  addLabel(point.distrito);
  return keys;
}

function summarizeAdvanceGpsPoints(points: TerritorialAdvanceKoboPoint[]) {
  return points.reduce((acc, point) => {
    acc[point.geoDisposition] += 1;
    return acc;
  }, { en_zona: 0, en_distrito: 0, fuera_distrito: 0, sin_cruce: 0, sin_gps: 0 });
}

function geoDispositionFromRaw(value: unknown): TerritorialAdvanceGeoDisposition {
  const key = normalizeMatch(value);
  if (key.includes("sin gps")) return "sin_gps";
  if (key.includes("sin cruce")) return "sin_cruce";
  if (key.includes("no defendible") || key.includes("fuera distrito")) return "fuera_distrito";
  if (key.includes("revision") || key.includes("cerca")) return "en_distrito";
  return "en_zona";
}

function geoDispositionShortLabel(value: TerritorialAdvanceGeoDisposition) {
  if (value === "en_zona") return "OK";
  if (value === "en_distrito") return "Rev.";
  if (value === "fuera_distrito") return "Fuera";
  if (value === "sin_cruce") return "Cruce";
  return "S/GPS";
}

function geoDispositionLabel(value: TerritorialAdvanceGeoDisposition) {
  if (value === "en_zona") return "GPS dentro de zona";
  if (value === "en_distrito") return "GPS fuera de zona";
  if (value === "fuera_distrito") return "GPS fuera de distrito";
  if (value === "sin_cruce") return "Sin cruce territorial";
  return "Sin coordenada GPS";
}

function advancePointGeoClass(point: TerritorialAdvanceKoboPoint) {
  const key = normalizeMatch(point.geo_estado || point.gps_effective_estado || point.gps_primary_estado);
  if (key.includes("geo ok")) return "is-geo_ok";
  if (key.includes("geo cerca")) return "is-geo_cerca";
  if (key.includes("geo revision")) return "is-geo_revision";
  if (key.includes("geo no defendible")) return "is-geo_no_defendible";
  if (key.includes("geo sin cruce")) return "is-geo_sin_cruce";
  if (key.includes("geo sin gps") || point.geoDisposition === "sin_gps") return "is-geo_sin_gps";
  if (point.geoDisposition === "en_distrito") return "is-geo_cerca";
  if (point.geoDisposition === "fuera_distrito") return "is-geo_no_defendible";
  if (point.geoDisposition === "sin_cruce") return "is-geo_sin_cruce";
  return "is-geo_ok";
}

function territorialAdvancePointDetail(point: TerritorialAdvanceKoboPoint) {
  const ump = stringOrEmpty(point.declared_ump_normalized || point.advance_block_ump || point.declared_ump_raw).trim() || "UMP S/D";
  const place = stringOrEmpty(point.advance_block_distrito || point.distrito || point.advance_block_ubigeo || point.ubigeo).trim() || "Sin distrito";
  const responsible = stringOrEmpty(point.responsible_display || point.enumerator_assigned || point.submitted_by).trim() || "Sin responsable";
  return `${ump} · ${place} · ${responsible} · ${geoDispositionLabel(point.geoDisposition)}`;
}

function advancePointSubmissionLabel(point: TerritorialAdvanceKoboPoint) {
  const value = stringOrEmpty(point.submission_datetime || point.submission_date_iso || point.submission_date || point.submission_time_source);
  return value ? formatDate(value) : "sin fecha";
}

function formatDistanceLabel(value: unknown) {
  const distance = numberOrNull(value);
  if (distance == null) return "S/D";
  if (distance < 1) return "<1 m";
  if (distance < 1000) return `${Math.round(distance)} m`;
  return `${(distance / 1000).toFixed(1)} km`;
}

function TerritorialAdvanceRhythmSection({
  rows,
  targetTotal,
  umpTotal,
}: {
  rows: TerritorialDailyDashboardRow[];
  targetTotal: number;
  umpTotal: number;
}) {
  const chartConfig = useMemo(() => ({
    displayModeBar: false,
    doubleClick: false,
    responsive: true,
    scrollZoom: false,
  }), []);
  const chart = useMemo(() => buildTerritorialDailyChart(rows, targetTotal), [rows, targetTotal]);
  const latest = rows[rows.length - 1] ?? null;
  // El máximo de una serie en cero sigue siendo una fila, y antes se imprimía
  // como "Mejor día válido: 0" —un logro de cero—. Un día sin válidas no es el
  // mejor día: es la ausencia de días con válidas.
  const bestRow = rows.reduce<TerritorialDailyDashboardRow | null>((current, row) => (!current || row.validas > current.validas ? row : current), null);
  const best = bestRow && bestRow.validas > 0 ? bestRow : null;
  const pendingValid = Math.max(0, targetTotal - (latest?.cumulative_valid ?? 0));
  const pendingUmp = Math.max(0, umpTotal - (latest?.cumulative_complete_ump ?? 0));
  return (
    <section className="mon-territorial-tab-panel mon-territorial-tab-panel--rhythm" aria-label="Ritmo diario y acumulado">
      <div className="mon-territorial-rhythm-layout">
        <article className="mon-territorial-rhythm-chart">
          <header>
            <div>
              <span><CalendarRange size={14} /> Ritmo diario válido</span>
              <strong>Válidas diarias y acumulado contra meta · todo el corte</strong>
            </div>
            <em>{formatMetric(rows.length)} días</em>
          </header>
          {rows.length ? (
            <PlotlyChart
              data={chart.data}
              layout={chart.layout}
              config={chartConfig}
              height={320}
              ariaLabel="UMP completadas por día y acumuladas"
            />
          ) : (
            <EmptyState
              icon={<CalendarRange size={18} />}
              title="Sin ritmo diario"
              hint="No hay fechas suficientes en las respuestas locales para construir barras diarias y acumulado."
              variant="inline"
            />
          )}
        </article>
        <aside className="mon-territorial-rhythm-side" aria-label="Resumen de ritmo diario">
          <AdvanceMetric
            label="Válidas acumuladas"
            value={latest ? formatMetric(latest.cumulative_valid) : "S/D"}
            hint={latest ? `de ${formatMetric(targetTotal)} de meta` : "sin fechas en el corte"}
            tone={latest && latest.cumulative_valid > 0 ? "ready" : "base"}
          />
          <AdvanceMetric label="Brecha meta" value={formatMetric(pendingValid)} hint={`meta ${formatMetric(targetTotal)}`} tone={pendingValid ? "warning" : "ready"} />
          <AdvanceMetric
            label="Mejor día válido"
            value={best ? formatMetric(best.validas) : "Sin días con válidas"}
            hint={best ? territorialDailyDateLabel(best) : "ningún día del corte registra válidas"}
            tone="base"
          />
          <AdvanceMetric label="UMP completas" value={formatMetric(latest?.cumulative_complete_ump ?? 0)} hint={latest ? `${formatMetric(pendingUmp)} pendientes de ${formatMetric(umpTotal)}` : "sin fechas"} tone="base" />
        </aside>
      </div>
      <TerritorialDailyDashboardTable rows={rows} />
    </section>
  );
}

function buildTerritorialDailyChart(rows: TerritorialDailyDashboardRow[], targetTotal: number) {
  const xLabels = rows.map((row) => territorialDailyDateLabel(row));
  const hoverData = rows.map((row) => [
    territorialDailyDateLabel(row),
    row.validas,
    row.cumulative_valid,
    row.revision,
    row.no_validas,
    row.cumulative_complete_ump_pct,
    row.new_complete_ump,
    row.cumulative_complete_ump,
  ]);
  const y2Max = Math.max(targetTotal, ...rows.map((row) => row.cumulative_valid), 1);
  return {
    data: [
      {
        type: "bar" as const,
        name: "Válidas del día",
        x: xLabels,
        y: rows.map((row) => row.validas),
        marker: { color: "#0f766e", line: { width: 0 } },
        customdata: hoverData,
        hovertemplate: "Válidas del día: %{y}<br>Acumulado válido: %{customdata[2]}<extra></extra>",
      },
      {
        type: "scatter" as const,
        mode: "lines+markers" as const,
        name: "Válidas acumuladas",
        x: xLabels,
        y: rows.map((row) => row.cumulative_valid),
        yaxis: "y2",
        line: { color: "#be123c", width: 3, shape: "spline" as const, smoothing: 0.45 },
        marker: { color: "#ffffff", size: 7, line: { color: "#be123c", width: 1.8 } },
        customdata: hoverData,
        hovertemplate: `Válidas acumuladas: %{y}<br>Meta: ${formatMetric(targetTotal)}<extra></extra>`,
      },
      {
        type: "bar" as const,
        name: "UMP completadas",
        x: xLabels,
        y: rows.map((row) => row.new_complete_ump),
        marker: { color: "rgba(100, 116, 139, 0.24)", line: { width: 0 } },
        customdata: hoverData,
        hovertemplate: "UMP completadas: %{y}<br>UMP acumuladas: %{customdata[7]}<extra></extra>",
      },
    ],
    layout: {
      barmode: "group" as const,
      bargap: rows.length <= 1 ? 0.7 : rows.length <= 7 ? 0.42 : 0.24,
      hovermode: "x unified" as const,
      showlegend: true,
      legend: { orientation: "h" as const, x: 0, y: 1.08, font: { size: 11, color: "#474f5b" } },
      margin: { l: 48, r: 66, t: 34, b: rows.length > 7 ? 62 : 44 },
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
        tickangle: rows.length > 7 ? -32 : 0,
        tickfont: { color: "#474f5b", size: 10 },
        automargin: true,
      },
      yaxis: {
        title: { text: "Por día", font: { color: "#474f5b", size: 11 } },
        fixedrange: true,
        rangemode: "tozero",
        showline: false,
        zeroline: false,
        gridcolor: "rgba(15, 23, 42, 0.08)",
        tickfont: { color: "#474f5b", size: 10 },
      },
      yaxis2: {
        title: { text: "Acumulado válido", font: { color: "#be123c", size: 11 } },
        overlaying: "y",
        side: "right",
        fixedrange: true,
        range: [0, Math.ceil(y2Max * 1.08)],
        showgrid: false,
        zeroline: false,
        tickfont: { color: "#be123c", size: 10 },
      },
    },
  };
}

function TerritorialDailyDashboardTable({ rows }: { rows: TerritorialDailyDashboardRow[] }) {
  if (!rows.length) return null;
  const latest = rows[rows.length - 1] ?? null;
  const matrix = [
    {
      key: "validas",
      label: "Válidas",
      tone: "effective",
      total: rows.reduce((sum, row) => sum + row.validas, 0),
      values: rows.map((row) => row.validas),
    },
    {
      key: "acumuladas",
      label: "Acumuladas",
      tone: "total",
      total: latest?.cumulative_valid ?? 0,
      values: rows.map((row) => row.cumulative_valid),
      always: true,
    },
    {
      key: "brecha",
      label: "Brecha meta",
      tone: "partial",
      total: latest?.cumulative_gap ?? 0,
      values: rows.map((row) => row.cumulative_gap),
      always: true,
    },
    {
      key: "revision",
      label: "Observación",
      tone: "partial",
      total: rows.reduce((sum, row) => sum + row.revision, 0),
      values: rows.map((row) => row.revision),
    },
    {
      key: "no_validas",
      label: "No válidas",
      tone: "refusals",
      total: rows.reduce((sum, row) => sum + row.no_validas, 0),
      values: rows.map((row) => row.no_validas),
    },
    {
      key: "ump",
      label: "UMP completadas",
      tone: "ump",
      total: latest?.cumulative_complete_ump ?? 0,
      values: rows.map((row) => row.new_complete_ump),
    },
  ].filter((item) => item.always || item.values.some((value) => value > 0));
  return (
    <div className="mon-advance-daily-table-wrap mon-territorial-table-wrap">
      <table className="mon-advance-daily-table" aria-label="Matriz diaria territorial por estado y fecha">
        <thead>
          <tr>
            <th>Estado</th>
            {rows.map((row) => (
              <th key={row.date}>{territorialDailyDateLabel(row)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((item) => (
            <tr key={item.key} className={`is-${item.tone}`}>
              <th scope="row">
                <span>{item.label}</span>
                <em>{formatMetric(item.total)}</em>
              </th>
              {item.values.map((value, index) => (
                <td key={`${item.key}-${rows[index]?.date ?? index}`} className={value > 0 ? "is-filled" : ""}>
                  {formatMetric(value)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AdvanceMetric({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: "base" | "target" | "ready" | "warning";
}) {
  return (
    <span className={`mon-advance-metric is-${tone}`}>
      <em>{label}</em>
      <strong>{value}</strong>
      <small>{hint}</small>
    </span>
  );
}

function buildAdvanceSummary(reports: MonitoreoTerritorialDashboard | null): AdvanceSummary {
  const base = reports?.advance ?? null;
  const kpis = reports?.kpis;
  const meta = numberOrNull(base?.meta ?? kpis?.meta);
  const total = numberOrZero(base?.total_respuestas ?? kpis?.total_respuestas);
  const validas = numberOrZero(base?.validas ?? kpis?.validas);
  const observacion = numberOrZero(base?.observacion ?? kpis?.revision);
  const noValidas = numberOrZero(base?.no_validas ?? kpis?.no_defendibles);
  const brecha = numberOrZero(base?.brecha ?? (meta == null ? 0 : Math.max(0, meta - validas)));
  return {
    total,
    validas,
    observacion,
    noValidas,
    meta,
    brecha,
    avancePct: numberOrNull(base?.avance_pct ?? kpis?.avance_pct),
  };
}

function buildAdvanceDistributions(reports: MonitoreoTerritorialDashboard | null) {
  const rows = (reports?.response_audit ?? []).filter((row) => rowCountsInAdvance(row));
  return {
    sex: distributionFromRows(rows, (row) => stringOrEmpty(row.sex).trim() || "S/D"),
    age: distributionFromRows(rows, (row) => ageGroup(row.age)),
  };
}

function buildDemographicQuotaProgress(reports: MonitoreoTerritorialDashboard | null): DemographicQuotaProgress {
  const quota = reports?.route_quota_progress;
  const empty = emptyDemographicQuotaProgress();
  if (!quota?.configured) return empty;
  const districts = quota.districts?.length
    ? quota.districts.map(demographicDistrictFromQuotaDistrict)
    : demographicDistrictsFromQuotaBlocks(quota.blocks ?? []);
  const activeDistricts = districts.filter((row) => row.target > 0 || row.sex.length || row.age.length);
  const sex = aggregateDemographicBuckets(activeDistricts.flatMap((row) => row.sex), "sex");
  const age = aggregateDemographicBuckets(activeDistricts.flatMap((row) => row.age), "age");
  const allBuckets = activeDistricts.flatMap((row) => [...row.sex, ...row.age]).filter((item) => item.target > 0);
  const target = activeDistricts.reduce((sum, row) => sum + row.target, 0);
  const achieved = activeDistricts.reduce((sum, row) => sum + row.achieved, 0);
  const missing = activeDistricts.reduce((sum, row) => sum + row.missing, 0);
  const configured = target > 0 || sex.length > 0 || age.length > 0;
  if (!configured) return empty;
  return {
    configured,
    summary: {
      target,
      achieved,
      missing,
      pct: safePercent(achieved, target),
      completeBuckets: allBuckets.filter((item) => item.missing <= 0).length,
      totalBuckets: allBuckets.length,
      districtsWithGap: activeDistricts.filter((row) => row.demographicMissing > 0 || row.missing > 0).length,
      districtCount: activeDistricts.length,
    },
    sex,
    age,
    districts: activeDistricts,
  };
}

function emptyDemographicQuotaProgress(): DemographicQuotaProgress {
  return {
    configured: false,
    summary: {
      target: 0,
      achieved: 0,
      missing: 0,
      pct: null,
      completeBuckets: 0,
      totalBuckets: 0,
      districtsWithGap: 0,
      districtCount: 0,
    },
    sex: [],
    age: [],
    districts: [],
  };
}

function demographicDistrictFromQuotaDistrict(row: TerritorialQuotaProgressDistrict): DemographicQuotaDistrict {
  const sex = normalizeDemographicQuotaItems(row.sex ?? [], "sex");
  const age = normalizeDemographicQuotaItems(row.age ?? [], "age");
  const target = quotaTargetValue(row.target, sex, age);
  const achieved = Math.max(0, Math.round(numberOrNull(row.validas) ?? quotaAchievedFallback(sex, age)));
  const missing = Math.max(0, Math.round(numberOrNull(row.missing_total) ?? (target - achieved)));
  const sexMissing = Math.max(0, Math.round(numberOrNull(row.sex_missing_total) ?? sex.reduce((sum, item) => sum + item.missing, 0)));
  const ageMissing = Math.max(0, Math.round(numberOrNull(row.age_missing_total) ?? age.reduce((sum, item) => sum + item.missing, 0)));
  const demographicMissing = Math.max(0, Math.round(numberOrNull(row.demographic_missing_total) ?? (sexMissing + ageMissing)));
  const label = stringOrEmpty(row.distrito).trim() || "Sin distrito";
  return {
    key: districtKey(row) || normalizeMatch(label) || label,
    label,
    target,
    achieved,
    missing,
    pct: safePercent(achieved, target),
    sexMissing,
    ageMissing,
    demographicMissing,
    sex,
    age,
  };
}

function demographicDistrictsFromQuotaBlocks(blocks: TerritorialQuotaProgressBlock[]): DemographicQuotaDistrict[] {
  const groups = new Map<string, TerritorialQuotaProgressBlock[]>();
  blocks
    .filter((row) => row?.configured && normalizeMatch(row.tipo_manzana) !== "reemplazo")
    .forEach((row) => {
      const key = districtKey(row) || normalizeMatch(row.distrito) || "sin_distrito";
      groups.set(key, [...(groups.get(key) ?? []), row]);
    });
  return Array.from(groups.entries()).map(([key, rows]) => {
    const first = rows[0];
    const sex = aggregateDemographicBuckets(rows.flatMap((row) => normalizeDemographicQuotaItems(row.sex ?? [], "sex")), "sex");
    const age = aggregateDemographicBuckets(rows.flatMap((row) => normalizeDemographicQuotaItems(row.age ?? [], "age")), "age");
    const target = rows.reduce((sum, row) => sum + quotaTargetValue(row.target, normalizeDemographicQuotaItems(row.sex ?? [], "sex"), normalizeDemographicQuotaItems(row.age ?? [], "age")), 0);
    const achieved = rows.reduce((sum, row) => sum + Math.max(0, Math.round(numberOrZero(row.validas))), 0);
    const missing = rows.reduce((sum, row) => sum + Math.max(0, Math.round(numberOrNull(row.missing_total) ?? (numberOrZero(row.target) - numberOrZero(row.validas)))), 0);
    const sexMissing = sex.reduce((sum, item) => sum + item.missing, 0);
    const ageMissing = age.reduce((sum, item) => sum + item.missing, 0);
    return {
      key,
      label: stringOrEmpty(first?.distrito).trim() || "Sin distrito",
      target,
      achieved,
      missing,
      pct: safePercent(achieved, target),
      sexMissing,
      ageMissing,
      demographicMissing: sexMissing + ageMissing,
      sex,
      age,
    };
  });
}

function normalizeDemographicQuotaItems(items: TerritorialQuotaProgressItem[], dimension: "sex" | "age"): DemographicQuotaBucket[] {
  return (items ?? [])
    .map((item, index) => {
      const label = prettyLabel(stringOrEmpty(item?.label).trim() || "Sin dato");
      const target = Math.max(0, Math.round(numberOrZero(item?.target)));
      const achieved = Math.max(0, Math.round(numberOrZero(item?.achieved)));
      const missing = Math.max(0, Math.round(numberOrNull(item?.missing) ?? (target - achieved)));
      return {
        key: `${dimension}-${normalizeMatch(label) || index}`,
        label,
        target,
        achieved,
        missing,
        pct: safePercent(achieved, target),
        tone: demographicQuotaTone(target, achieved, missing),
      };
    })
    .filter((item) => item.target > 0 || item.achieved > 0 || item.missing > 0)
    .sort((a, b) => demographicBucketOrder(a.label, dimension) - demographicBucketOrder(b.label, dimension)
      || a.label.localeCompare(b.label, "es-PE", { numeric: true }));
}

function aggregateDemographicBuckets(items: DemographicQuotaBucket[], dimension: "sex" | "age"): DemographicQuotaBucket[] {
  const grouped = new Map<string, DemographicQuotaBucket>();
  items.forEach((item) => {
    const key = normalizeMatch(item.label) || item.key;
    const current = grouped.get(key);
    if (!current) {
      grouped.set(key, { ...item, key: `${dimension}-${key}` });
      return;
    }
    current.target += item.target;
    current.achieved += item.achieved;
    current.missing += item.missing;
    current.pct = safePercent(current.achieved, current.target);
    current.tone = demographicQuotaTone(current.target, current.achieved, current.missing);
  });
  return Array.from(grouped.values())
    .sort((a, b) => demographicBucketOrder(a.label, dimension) - demographicBucketOrder(b.label, dimension)
      || a.label.localeCompare(b.label, "es-PE", { numeric: true }));
}

function quotaTargetValue(explicit: unknown, sex: DemographicQuotaBucket[], age: DemographicQuotaBucket[]) {
  const target = numberOrNull(explicit);
  if (target != null && target > 0) return Math.round(target);
  const sexTarget = sex.reduce((sum, item) => sum + item.target, 0);
  if (sexTarget > 0) return sexTarget;
  return age.reduce((sum, item) => sum + item.target, 0);
}

function quotaAchievedFallback(sex: DemographicQuotaBucket[], age: DemographicQuotaBucket[]) {
  const sexAchieved = sex.reduce((sum, item) => sum + item.achieved, 0);
  if (sexAchieved > 0) return sexAchieved;
  return age.reduce((sum, item) => sum + item.achieved, 0);
}

function demographicQuotaTone(target: number, achieved: number, missing: number): DemographicQuotaBucket["tone"] {
  if (target <= 0 && achieved <= 0) return "muted";
  if (missing <= 0) return "ready";
  return "warning";
}

function demographicBucketOrder(label: string, dimension: "sex" | "age") {
  const key = normalizeMatch(label);
  if (dimension === "sex") {
    if (key === "hombre" || key === "masculino") return 0;
    if (key === "mujer" || key === "femenino") return 1;
    if (key === "sin dato" || key === "sd") return 9;
    return 5;
  }
  if (key === "sin dato" || key === "sd") return 999;
  const match = label.match(/\d+/);
  return match ? Number(match[0]) : 998;
}

function distributionFromRows(rows: TerritorialResponseAuditRow[], getKey: (row: TerritorialResponseAuditRow) => string): DistributionItem[] {
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    const key = getKey(row);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  const total = rows.length;
  return Array.from(counts.entries())
    .map(([key, value]) => ({ key, label: prettyLabel(key), value, pct: safePercent(value, total) ?? 0, tone: "ready" as const }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "es"));
}

/** Cuántos se muestran de cada grupo. La cuenta real viaja aparte. */
const PRIORIDADES_VISIBLES = 5;

function buildAdvancePriorities(districts: TerritorialDistrictProgress[], blocks: TerritorialBlockProgress[]) {
  const districtsConBrecha = districts.filter((row) => numberOrZero(row.brecha) > 0);
  const blocksPendientes = blocks.filter((row) => blockStatus(row) !== "complete");
  const districtItems = [...districtsConBrecha]
    .sort((a, b) => numberOrZero(b.brecha) - numberOrZero(a.brecha))
    .slice(0, PRIORIDADES_VISIBLES)
    .map((row) => ({
      key: `district-${districtKey(row)}`,
      type: "district" as const,
      districtKey: districtKey(row),
      title: row.distrito || "Sin distrito",
      detail: `${formatMetric(row.validas)} / ${formatMetric(row.meta)} válidas`,
      gap: numberOrZero(row.brecha),
      progressPct: clamp(row.avance_pct ?? 0, 0, 100),
      tone: "warning" as const,
    }));
  const blockItems = [...blocksPendientes]
    .sort((a, b) => numberOrZero(b.brecha) - numberOrZero(a.brecha))
    .slice(0, PRIORIDADES_VISIBLES)
    .map((row) => ({
      key: `ump-${row.id_manzana || row.ump}`,
      type: "ump" as const,
      districtKey: districtKey(row),
      umpKey: row.ump || row.id_manzana,
      title: row.ump || row.id_manzana || "UMP sin código",
      detail: `${row.distrito || "Sin distrito"} · ${row.responsable || "Sin responsable"}`,
      gap: numberOrZero(row.brecha ?? Math.max(0, numberOrZero(row.meta) - numberOrZero(row.validas))),
      progressPct: clamp(row.avance_pct ?? safePercent(row.validas, row.meta) ?? 0, 0, 100),
      tone: blockStatus(row) === "none" ? "muted" as const : "warning" as const,
    }));
  // `total` y no `items.length`: la lista se corta en cinco, y pintar el largo
  // de lo cortado convierte un tope de presentación en un dato. En el corte real
  // el rótulo decía «UMP pendientes 5» —eran cinco filas— dos dedos debajo de un
  // panel que declara «Cuota pendiente 3»: dos cifras del mismo hecho que no
  // reconcilian, y ninguna de las dos era el número de UMP pendientes.
  return [
    { key: "districts", label: "Distritos con brecha", emptyLabel: "Sin distritos rezagados", items: districtItems, total: districtsConBrecha.length },
    { key: "ump", label: "UMP pendientes", emptyLabel: "Sin UMP pendientes", items: blockItems, total: blocksPendientes.length },
  ];
}

function DistrictShapeIcon({ ubigeo, label, active, warning }: { ubigeo?: string; label: string; active: boolean; warning: boolean }) {
  const initials = stringOrEmpty(label).split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "SD";
  const normalized = normalizeMapCode(ubigeo);
  const feature = normalized
    ? LIMA_DISTRICT_FEATURES.find((item) => normalizeMapCode(item.properties.ubigeo) === normalized)
    : null;
  const districtPath = feature ? buildDistrictShapePath(feature) : "";
  return (
    <svg
      className={`mon-territorial-district-shape${active ? " is-active" : ""}${warning ? " is-warning" : ""}${districtPath ? "" : " is-fallback"}`}
      viewBox="0 0 48 48"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={label || "Distrito"}
    >
      <rect x="2.5" y="2.5" width="43" height="43" rx="12" />
      {districtPath ? <path d={districtPath} /> : (
        <>
          <circle cx="24" cy="24" r={active ? 15 : warning ? 13 : 11} />
          <text x="24" y="27" textAnchor="middle">{initials}</text>
        </>
      )}
    </svg>
  );
}

function rowCountsInAdvance(row: TerritorialResponseAuditRow) {
  if (row.advance_valid === true) return true;
  if (row.advance_status === "validada" || row.validation_status === "validada") return true;
  return row.source_effective === true && row.observation_status !== "no_valida";
}

function advanceObjectiveTotal(reports: MonitoreoTerritorialDashboard | null) {
  const explicit = numberOrNull(reports?.advance?.meta ?? reports?.kpis?.meta);
  if (explicit != null && explicit > 0) return explicit;
  const validas = numberOrZero(reports?.advance?.validas ?? reports?.kpis?.validas);
  const brecha = numberOrZero(reports?.advance?.brecha);
  return Math.max(validas + brecha, validas, 0);
}

function buildTerritorialDailyRows(
  reports: MonitoreoTerritorialDashboard | null,
  targetTotal: number,
  blocks: TerritorialBlockProgress[],
): TerritorialDailyDashboardRow[] {
  const rows = reports?.daily?.length ? reports.daily : reports?.advance?.daily ?? [];
  let cumulativeValid = 0;
  let cumulativeCompleteUmp = 0;
  return [...rows]
    .filter((row) => row.date)
    .sort((a, b) => stringOrEmpty(a.date).localeCompare(stringOrEmpty(b.date), "es", { numeric: true }))
    .map((row) => {
      const source = row as MonitoreoTerritorialDashboard["daily"][number] & Partial<TerritorialDailyDashboardRow>;
      const total = Math.max(0, Math.round(numberOrZero(source.total)));
      const validas = Math.max(0, Math.round(numberOrZero(source.validas)));
      const revision = Math.max(0, Math.round(numberOrZero(source.revision)));
      const noValidas = Math.max(0, Math.round(numberOrNull(source.no_validas) ?? (total - validas - revision)));
      const explicitCumulativeValid = numberOrNull(source.cumulative_valid);
      cumulativeValid = explicitCumulativeValid == null
        ? cumulativeValid + validas
        : Math.max(0, Math.round(explicitCumulativeValid));
      const newCompleteUmp = Math.max(0, Math.round(numberOrNull(source.new_complete_ump) ?? 0));
      const explicitCumulativeCompleteUmp = numberOrNull(source.cumulative_complete_ump);
      cumulativeCompleteUmp = explicitCumulativeCompleteUmp == null
        ? cumulativeCompleteUmp + newCompleteUmp
        : Math.max(0, Math.round(explicitCumulativeCompleteUmp));
      return {
        ...source,
        total,
        validas,
        revision,
        no_validas: noValidas,
        cumulative_valid: cumulativeValid,
        cumulative_progress_pct: numberOrNull(source.cumulative_progress_pct) ?? safePercent(cumulativeValid, targetTotal || null),
        cumulative_gap: Math.max(0, Math.round(numberOrNull(source.cumulative_gap) ?? (targetTotal - cumulativeValid))),
        new_complete_ump: newCompleteUmp,
        cumulative_complete_ump: cumulativeCompleteUmp,
        cumulative_complete_ump_pct: numberOrNull(source.cumulative_complete_ump_pct) ?? safePercent(cumulativeCompleteUmp, blocks.length || null),
      };
    });
}

function districtRows(reports: MonitoreoTerritorialDashboard | null) {
  return reports?.advance?.district_progress?.length ? reports.advance.district_progress : reports?.district_progress ?? [];
}

function blockRows(reports: MonitoreoTerritorialDashboard | null) {
  return reports?.advance?.block_progress?.length
    ? reports.advance.block_progress
    : reports?.block_progress?.length
      ? reports.block_progress
      : reports?.route_blocks ?? [];
}

function summarizeUmp(blocks: TerritorialBlockProgress[]) {
  const total = blocks.length;
  const complete = blocks.filter((row) => blockStatus(row) === "complete").length;
  const none = blocks.filter((row) => blockStatus(row) === "none").length;
  const incomplete = Math.max(0, total - complete - none);
  return {
    total,
    complete,
    incomplete,
    none,
    subsanada: 0,
    inField: 0,
    notConfigured: 0,
    source: "raw_progress" as const,
  };
}

function summarizeOperationalUmp(
  reports: MonitoreoTerritorialDashboard | null,
  blocks: TerritorialBlockProgress[],
): TerritorialExecutiveUmpStack {
  const quota = reports?.route_quota_progress;
  const summary = quota?.ump_summary;
  if (quota?.configured && summary) {
    const total = Math.max(0, Math.round(numberOrNull(summary.total) ?? 0));
    const complete = Math.max(0, Math.round(numberOrNull(summary.complete) ?? 0));
    const subsanada = Math.max(0, Math.round(numberOrNull(summary.subsanada) ?? 0));
    const pending = Math.max(0, Math.round(numberOrNull(summary.pending) ?? 0));
    const partial = Math.max(0, Math.round(numberOrNull(summary.partial) ?? 0));
    const inField = Math.max(0, Math.round(numberOrNull(summary.in_field) ?? 0));
    const none = Math.max(0, Math.round(numberOrNull(summary.missing) ?? 0));
    const notConfigured = Math.max(0, Math.round(numberOrNull(summary.not_configured) ?? 0));
    const incomplete = Math.max(0, pending + partial + inField);
    return {
      total: Math.max(total, complete + incomplete + none + notConfigured),
      complete,
      incomplete,
      none: none + notConfigured,
      subsanada,
      inField,
      notConfigured,
      source: "operational_quota",
    };
  }
  return summarizeUmp(blocks);
}

function blockStatus(row: TerritorialBlockProgress) {
  const validas = numberOrZero(row.validas);
  const meta = numberOrNull(row.meta);
  if (meta != null && validas >= meta) return "complete";
  if (validas <= 0) return "none";
  return "incomplete";
}

function blockStatusLabel(status: string) {
  if (status === "complete") return "Completa";
  if (status === "none") return "Sin avance";
  return "Incompleta";
}

function blockQuotaStatus(row: TerritorialBlockProgress): TerritorialAdvanceQuotaStatus {
  const meta = numberOrNull(row.meta);
  const validas = numberOrZero(row.validas);
  const brecha = numberOrNull(row.brecha);
  if (meta == null || meta <= 0) return "not_configured";
  if (validas >= meta || (brecha != null && brecha <= 0)) return "complete";
  if (validas > 0) return "in_field";
  if (brecha != null && brecha > 0) return "missing";
  return "pending";
}

function blockQuotaStatusLabel(status: TerritorialAdvanceQuotaStatus) {
  const labels: Record<TerritorialAdvanceQuotaStatus, string> = {
    complete: "Completa",
    in_field: "En campo",
    pending: "Cuota pendiente",
    missing: "No iniciada",
    not_configured: "Sin cuota",
  };
  return labels[status];
}

function blockQuotaHint(row: TerritorialBlockProgress) {
  const meta = numberOrNull(row.meta);
  if (meta == null || meta <= 0) return "Meta no configurada";
  const brecha = Math.max(0, Math.round(numberOrZero(row.brecha)));
  if (brecha <= 0) return "Cuota cerrada";
  return `Faltan ${formatMetric(brecha)}`;
}

function compareBlocks(a: TerritorialBlockProgress, b: TerritorialBlockProgress) {
  const statusRank: Record<string, number> = { incomplete: 0, none: 1, complete: 2 };
  return (statusRank[blockStatus(a)] ?? 9) - (statusRank[blockStatus(b)] ?? 9)
    || stringOrEmpty(a.distrito).localeCompare(stringOrEmpty(b.distrito), "es", { numeric: true })
    || stringOrEmpty(a.ump).localeCompare(stringOrEmpty(b.ump), "es", { numeric: true });
}

function districtTone(row: TerritorialDistrictProgress) {
  if (numberOrZero(row.brecha) <= 0) return "ready";
  if (numberOrZero(row.validas) <= 0) return "empty";
  return "open";
}

function districtKey(row: { ubigeo?: string; distrito?: string }) {
  return stringOrEmpty(row.ubigeo).trim() || stringOrEmpty(row.distrito).trim();
}

function ageGroup(value: unknown) {
  const age = numberOrNull(value);
  if (age == null) return "S/D";
  if (age < 25) return "18-24";
  if (age < 35) return "25-34";
  if (age < 45) return "35-44";
  if (age < 55) return "45-54";
  if (age < 65) return "55-64";
  return "65+";
}

function prettyLabel(value: string) {
  const raw = stringOrEmpty(value).trim();
  if (!raw) return "S/D";
  if (raw.toLowerCase() === "m") return "Hombre";
  if (raw.toLowerCase() === "f") return "Mujer";
  return raw;
}

function isAdvanceTab(value: unknown): value is TerritorialAdvanceTab {
  return value === "resumen" || value === "distritos" || value === "ump" || value === "ritmo";
}

function safePercent(value: number | null | undefined, total: number | null | undefined) {
  if (value == null || total == null || total <= 0) return null;
  return Math.min(100, (value / total) * 100);
}

/* Anchos de una barra apilada con piso de visibilidad. Un segmento con valor
 * distinto de cero nunca baja de `floor`% —si no, desaparece—, pero ese piso hay
 * que descontárselo a los demás: sumando los pisos sin renormalizar, 147/3/0 UMP
 * daba 98% + 5% + 0% = 103% y la barra se comía 9px del último segmento contra
 * el borde de la píldora. */
function stackedWidths(values: number[], floor = 5) {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return values.map(() => 0);
  const raw = values.map((value) => (value ? Math.max(floor, (value / total) * 100) : 0));
  const sum = raw.reduce((acc, value) => acc + value, 0);
  return sum > 100 ? raw.map((value) => (value / sum) * 100) : raw;
}

function formatPercentLabel(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) ? "S/M" : `${Math.round(value)}%`;
}

function formatMetric(value: unknown, fallback = "0") {
  const number = numberOrNull(value);
  if (number == null) return fallback;
  return new Intl.NumberFormat("es-PE", { maximumFractionDigits: 0 }).format(number);
}

function numberOrZero(value: unknown) {
  return numberOrNull(value) ?? 0;
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

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function uniqueNonEmpty(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, "es"));
}

function shortDate(value: string) {
  if (!value) return "S/D";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-PE", { day: "2-digit", month: "short" });
}

function territorialDailyDateLabel(row: Pick<TerritorialDailyDashboardRow, "date" | "date_label">) {
  return stringOrEmpty(row.date_label).trim() || shortDate(row.date);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "Sin corte";
  return date.toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" });
}

// React.memo (unidad 3.6): la página re-renderiza en cada poll de sync y
// transición de scopes; con props estabilizadas en el caller, este workbench
// solo se re-renderiza cuando cambian sus datos reales.
export const TerritorialAdvanceWorkbench = memo(TerritorialAdvanceWorkbenchImpl);
