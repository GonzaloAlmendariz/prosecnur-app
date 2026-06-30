import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import { ListChecks, Loader2, MapPin, Route } from "lucide-react";
import {
  apiHojasRutaBlockMap,
  apiHojasRutaContextMap,
  apiHojasRutaStreetMap,
  apiHojasRutaZoneMap,
  type HojasRutaBlockMap,
  type HojasRutaBlockMapFeature,
  type HojasRutaContextMap,
  type HojasRutaContextMapFeature,
  type HojasRutaStreetMap,
  type HojasRutaStreetMapFeature,
  type HojasRutaZoneMap,
  type HojasRutaZoneMapFeature,
  type MonitoreoTerritorialDashboard,
  type TerritorialBlockProgress,
} from "../../../../api/client";
import {
  buildTerritorialRouteCoverageModel,
  normalizeRouteBlockCode,
  type TerritorialRouteBucket,
  type TerritorialRouteCoverageModel,
  type TerritorialRouteDistrictCoverage,
} from "../../routeCoverageModel";
import districtCoverage from "../../../hojasRuta/limaDistrictCoverage.json";

export const LIMA_MAP_WIDTH = 1000;
export const LIMA_MAP_HEIGHT = 620;
const ROUTE_CARTOGRAPHY_CACHE_VERSION = "route-cartography-v2";
const LIMA_MAP_STREET_LIMIT = 220;
const LIMA_MAP_POI_LIMIT = 120;

type RouteMetricCard = {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
};

type TerritorialRouteCoverageAtlasProps = {
  cards: RouteMetricCard[];
  reports: MonitoreoTerritorialDashboard;
  blocks: TerritorialBlockProgress[];
  routeMeta: number | null;
  responseCount: number;
  progressPct: number | null;
  phaseLabel: string;
};

type TerritorialRouteCoverageMapMode = "selection" | "effective-zones";

export type TerritorialRouteCartographyBundle = {
  blockMap: HojasRutaBlockMap | null;
  zoneMap: HojasRutaZoneMap | null;
  streetMap: HojasRutaStreetMap | null;
  contextMap: HojasRutaContextMap | null;
  partial: boolean;
};

type TerritorialRouteCartographyOptions = {
  includeRichLayers?: boolean;
};

type TerritorialDistrictGeometry =
  | { type: "Polygon"; coordinates: TerritorialGeoPolygon }
  | { type: "MultiPolygon"; coordinates: TerritorialGeoPolygon[] };

export type TerritorialDistrictFeature = {
  type: "Feature";
  properties: {
    ubigeo: string;
    distrito: string;
    label_lon: number;
    label_lat: number;
  };
  geometry: TerritorialDistrictGeometry;
};

type TerritorialGeoPoint = [number, number];
type TerritorialGeoRing = TerritorialGeoPoint[];
type TerritorialGeoPolygon = TerritorialGeoRing[];

export type TerritorialMapProjection = {
  width: number;
  height: number;
  hasGeometry: boolean;
  project: (lon: number, lat: number) => { x: number; y: number };
};

export type TerritorialSelectedMapFeature = {
  feature: HojasRutaBlockMapFeature;
  block: TerritorialBlockProgress;
  key: string;
};

export const LIMA_DISTRICT_FEATURES = (districtCoverage as unknown as { features: TerritorialDistrictFeature[] }).features;
const CARTOGRAPHY_MEMORY_CACHE = new Map<string, TerritorialRouteCartographyBundle>();
const CARTOGRAPHY_INFLIGHT = new Map<string, Promise<TerritorialRouteCartographyBundle>>();

let cartographyDbPromise: Promise<IDBDatabase | null> | null = null;

export function TerritorialRouteCoverageAtlas({
  cards,
  reports,
  blocks,
  routeMeta,
  responseCount,
  progressPct,
  phaseLabel,
}: TerritorialRouteCoverageAtlasProps) {
  const coverage = useMemo(() => buildTerritorialRouteCoverageModel(blocks, reports), [blocks, reports]);
  return (
    <section className="mon-territorial-route-summary-tab" aria-label="Resumen de manzanas seleccionadas">
      <div className="mon-territorial-route-atlas">
        <section className="mon-territorial-route-summary-hero" aria-label="Cobertura de UMP">
          <div>
            <span><Route size={13} /> Cobertura</span>
            <strong>{formatMetric(coverage.totals.titulares)} titulares · {formatMetric(coverage.totals.reemplazos)} reemplazos</strong>
            <em>{formatMetric(coverage.totals.zones)} zonas en {formatMetric(coverage.totals.districts)} distritos. Lectura territorial sin puntos GPS.</em>
          </div>
          <div className="mon-territorial-route-summary-progress" aria-label="Avance contra meta de fase">
            <span>
              <strong>{formatMetric(responseCount)}</strong>
              <em>respuestas Kobo</em>
            </span>
            <i style={{ "--route-progress": `${progressPct ?? 0}%` } as CSSProperties}>
              <b />
            </i>
            <small>{progressPct == null ? "Meta de fase por definir" : `${progressPct}% de ${formatMetric(routeMeta)} entrevistas`}</small>
          </div>
          <div className="mon-territorial-route-summary-metrics" aria-label="Indicadores UMP">
            {cards.map((item) => (
              <TerritorialRouteKpiCard
                key={item.label}
                label={item.label}
                value={item.value}
                hint={item.hint}
                icon={item.icon}
              />
            ))}
          </div>
        </section>

        <section className="mon-territorial-route-atlas-map-panel" aria-label="Mapa ligero de cobertura territorial">
          <header>
            <span><MapPin size={13} /> Manzanas seleccionadas</span>
            <strong>{formatMetric(coverage.totals.titulares)} titulares · {formatMetric(coverage.totals.reemplazos)} reemplazos</strong>
          </header>
          <TerritorialRouteCoverageMap coverage={coverage} blocks={blocks} reports={reports} mode="selection" />
        </section>

        <aside className="mon-territorial-route-atlas-rail" aria-label="Indicadores y composicion demografica">
          <div className="mon-territorial-route-atlas-phase">
            <span>{phaseLabel}</span>
            <strong>{formatMetric(coverage.totals.titulares)} titulares · {formatMetric(coverage.totals.reemplazos)} reemplazos</strong>
            <small>{formatMetric(coverage.totals.operationalBlocks)} manzanas operativas · {formatMetric(coverage.totals.zones)} zonas</small>
          </div>
          <TerritorialRouteBucketBars title="Sexo" buckets={coverage.sexTotals} empty="Sin cuotas por sexo" />
          <TerritorialRouteBucketBars title="Rango de edad" buckets={coverage.ageTotals} empty="Sin cuotas por edad" />
        </aside>

        <TerritorialRouteDistrictCoverageTable rows={coverage.districts} />
      </div>
    </section>
  );
}

export function TerritorialRouteCoverageMap({
  coverage,
  blocks = [],
  reports = null,
  mode = "selection",
}: {
  coverage: TerritorialRouteCoverageModel;
  blocks?: TerritorialBlockProgress[];
  reports?: MonitoreoTerritorialDashboard | null;
  mode?: TerritorialRouteCoverageMapMode;
}) {
  const needsBlockMaps = mode === "selection";
  const needsZoneMaps = mode === "effective-zones";
  const effectiveBlocks = useMemo(() => (
    mode === "effective-zones" && reports ? territorialEffectiveRouteBlocks(blocks, reports) : []
  ), [blocks, mode, reports]);
  const mapBlocks = mode === "effective-zones" ? effectiveBlocks : blocks;
  const mapUbigeos = useMemo(() => {
    const fromBlocks = Array.from(new Set(
      mapBlocks
        .map((block) => normalizeRouteBlockCode(block.ubigeo))
        .filter(Boolean)
    ));
    if (fromBlocks.length) return fromBlocks;
    return mode === "selection" ? coverage.ubigeos : [];
  }, [coverage.ubigeos, mapBlocks, mode]);
  const effectiveZoneKeys = useMemo(() => (
    new Set(effectiveBlocks.map((block) => territorialBlockZoneKey(block)).filter(Boolean))
  ), [effectiveBlocks]);
  const selectionTotals = useMemo(() => summarizeTerritorialRouteBlockKinds(blocks), [blocks]);
  const [zoneMaps, setZoneMaps] = useState<Record<string, HojasRutaZoneMap>>({});
  const [blockMaps, setBlockMaps] = useState<Record<string, HojasRutaBlockMap>>({});
  const [loading, setLoading] = useState(false);
  const [mapError, setMapError] = useState("");

  useEffect(() => {
    const missing = mapUbigeos.filter((ubigeo) => (
      ubigeo
      && ((needsBlockMaps && !blockMaps[ubigeo]) || (needsZoneMaps && !zoneMaps[ubigeo]))
    ));
    if (!missing.length) return;
    let cancelled = false;
    setLoading(true);
    setMapError("");
    Promise.allSettled(missing.map(async (ubigeo) => [ubigeo, await loadTerritorialRouteCartography(ubigeo)] as const))
      .then((results) => {
        if (cancelled) return;
        const nextMaps: Record<string, HojasRutaZoneMap> = {};
        const nextBlockMaps: Record<string, HojasRutaBlockMap> = {};
        results.forEach((result) => {
          if (result.status !== "fulfilled") return;
          const [ubigeo, bundle] = result.value;
          if (needsZoneMaps && bundle.zoneMap) nextMaps[ubigeo] = bundle.zoneMap;
          if (needsBlockMaps && bundle.blockMap) nextBlockMaps[ubigeo] = bundle.blockMap;
        });
        if (Object.keys(nextMaps).length) {
          setZoneMaps((previous) => ({ ...previous, ...nextMaps }));
        }
        if (Object.keys(nextBlockMaps).length) {
          setBlockMaps((previous) => ({ ...previous, ...nextBlockMaps }));
        }
        if (results.some((result) => result.status === "rejected")) {
          setMapError("No se pudo cargar toda la cartografia de Hojas de Ruta.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [blockMaps, mapUbigeos, needsBlockMaps, needsZoneMaps, zoneMaps]);

  const districtByUbigeo = useMemo(() => (
    new Map(coverage.districts.map((district) => [normalizeRouteBlockCode(district.ubigeo), district]))
  ), [coverage.districts]);
  const activeUbigeos = useMemo(() => new Set(mapUbigeos.map(normalizeRouteBlockCode)), [mapUbigeos]);
  const activeDistrictFeatures = useMemo(() => (
    LIMA_DISTRICT_FEATURES.filter((feature) =>
      activeUbigeos.has(normalizeRouteBlockCode(feature.properties.ubigeo))
    )
  ), [activeUbigeos]);
  const allBlockFeatures = useMemo(() => (
    mapUbigeos.flatMap((ubigeo) => blockMaps[ubigeo]?.geojson?.features ?? [])
  ), [blockMaps, mapUbigeos]);
  const selectedMapFeatures = useMemo(() => (
    mode === "selection" ? selectTerritorialMapFeatures(allBlockFeatures, blocks) : []
  ), [allBlockFeatures, blocks, mode]);
  const routeZoneFeatures = useMemo(() => (
    mode === "effective-zones"
      ? mapUbigeos.flatMap((ubigeo) => zoneMaps[ubigeo]?.geojson?.features ?? [])
        .filter((feature) => effectiveZoneKeys.has(territorialZoneFeatureKey(feature)))
      : []
  ), [effectiveZoneKeys, mapUbigeos, mode, zoneMaps]);
  const projectionDistrictFeatures = useMemo(() => {
    if (selectedMapFeatures.length || routeZoneFeatures.length) return [];
    return activeDistrictFeatures.length ? activeDistrictFeatures : LIMA_DISTRICT_FEATURES;
  }, [activeDistrictFeatures, routeZoneFeatures, selectedMapFeatures]);
  const labelDistrictKeys = useMemo(() => new Set(
    coverage.districts
      .filter((district) => activeUbigeos.has(normalizeRouteBlockCode(district.ubigeo)))
      .slice(0, 6)
      .map((district) => normalizeRouteBlockCode(district.ubigeo))
      .filter(Boolean)
  ), [activeUbigeos, coverage.districts]);
  const labelDistrictFeatures = useMemo(() => (
    activeDistrictFeatures.filter((feature) =>
      labelDistrictKeys.has(normalizeRouteBlockCode(feature.properties.ubigeo))
    )
  ), [activeDistrictFeatures, labelDistrictKeys]);
  const projection = useMemo(() => buildTerritorialMapProjection(
    projectionDistrictFeatures,
    selectedMapFeatures.map((item) => item.feature),
    routeZoneFeatures,
    22,
  ), [projectionDistrictFeatures, routeZoneFeatures, selectedMapFeatures]);
  const visibleMapFeatureCount = mode === "selection" ? selectedMapFeatures.length : routeZoneFeatures.length;
  const showLoading = loading && !visibleMapFeatureCount;
  const legendRows = coverage.districts
    .filter((district) => activeUbigeos.has(normalizeRouteBlockCode(district.ubigeo)))
    .slice(0, 7);
  const replacementPatternId = `mon-route-replacement-pattern-${mode}`;
  const caption = mode === "selection"
    ? `${formatMetric(selectionTotals.titulares)} titulares · ${formatMetric(selectionTotals.reemplazos)} reemplazos · ${formatMetric(activeUbigeos.size)} distritos`
    : `${formatMetric(effectiveZoneKeys.size)} zonas con cierre · ${formatMetric(effectiveBlocks.length)} UMP completas`;
  const ariaLabel = mode === "selection"
    ? "Mapa estatico con bordes de Lima Metropolitana y manzanas titulares y reemplazos seleccionadas"
    : "Mapa estatico con bordes de Lima Metropolitana y zonas con cierre de avance";

  return (
    <div className="mon-territorial-route-coverage-map">
      <div className="mon-territorial-route-coverage-map-frame">
        {projection.hasGeometry ? (
          <svg
            className="mon-territorial-route-coverage-svg"
            viewBox={`0 0 ${LIMA_MAP_WIDTH} ${LIMA_MAP_HEIGHT}`}
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label={ariaLabel}
          >
            <defs>
              <pattern id={replacementPatternId} width="8" height="8" patternUnits="userSpaceOnUse">
                <rect width="8" height="8" fill="rgba(251, 146, 60, 0.13)" />
                <circle cx="2" cy="2" r="1.05" fill="rgba(180, 83, 9, 0.54)" />
                <circle cx="6" cy="6" r="1.05" fill="rgba(180, 83, 9, 0.38)" />
              </pattern>
            </defs>
            <g className="mon-territorial-route-coverage-context" aria-label="Bordes de Lima Metropolitana">
              {LIMA_DISTRICT_FEATURES.map((feature) => {
                const d = territorialDistrictPath(feature, projection);
                if (!d) return null;
                return (
                  <path key={`context-${feature.properties.ubigeo}`} d={d} vectorEffect="non-scaling-stroke">
                    <title>{feature.properties.distrito}</title>
                  </path>
                );
              })}
            </g>
            <g className="mon-territorial-route-coverage-districts" aria-label="Distritos seleccionados">
              {LIMA_DISTRICT_FEATURES.map((feature) => {
                const key = normalizeRouteBlockCode(feature.properties.ubigeo);
                const active = activeUbigeos.has(key);
                if (!active) return null;
                const district = districtByUbigeo.get(key);
                const d = territorialDistrictPath(feature, projection);
                if (!d) return null;
                return (
                  <path
                    key={feature.properties.ubigeo}
                    d={d}
                    className="is-active"
                    vectorEffect="non-scaling-stroke"
                    style={{ "--route-district-color": district?.color ?? "#94a3b8" } as CSSProperties}
                  >
                    <title>{feature.properties.distrito}</title>
                  </path>
                );
              })}
            </g>
            {mode === "selection" ? (
              <g className="mon-territorial-route-coverage-blocks" aria-label="Manzanas titulares y reemplazos seleccionadas">
                {selectedMapFeatures.map((item) => {
                  const d = territorialFeaturePath(item.feature, projection);
                  if (!d) return null;
                  const ubigeo = normalizeRouteBlockCode(item.block.ubigeo);
                  const district = districtByUbigeo.get(ubigeo);
                  const replacement = territorialRouteBlockIsReplacement(item.block);
                  return (
                    <path
                      key={item.key}
                      d={d}
                      className={replacement ? "is-replacement" : "is-titular"}
                      fill={replacement ? `url(#${replacementPatternId})` : undefined}
                      vectorEffect="non-scaling-stroke"
                      style={{ "--route-block-color": district?.color ?? "#7c3aed" } as CSSProperties}
                    >
                      <title>{territorialRouteBlockMapTitle(item.block, district?.distrito)}</title>
                    </path>
                  );
                })}
              </g>
            ) : null}
            {mode === "effective-zones" ? (
              <g className="mon-territorial-route-coverage-zones" aria-label="Zonas con cierre de avance">
                {routeZoneFeatures.map((feature) => {
                  const d = territorialZonePath(feature, projection);
                  if (!d) return null;
                  const ubigeo = normalizeRouteBlockCode(feature.properties.ubigeo);
                  const district = districtByUbigeo.get(ubigeo);
                  return (
                    <path
                      key={territorialZoneFeatureKey(feature)}
                      d={d}
                      vectorEffect="non-scaling-stroke"
                      style={{ "--route-zone-color": district?.color ?? "#be123c" } as CSSProperties}
                    >
                      <title>{`${district?.distrito || feature.properties.ubigeo || "Distrito"} · ${territorialZoneDisplayLabel(feature)}`}</title>
                    </path>
                  );
                })}
              </g>
            ) : null}
            <g className="mon-territorial-route-coverage-labels" aria-label="Etiquetas distritales">
              {labelDistrictFeatures.map((feature) => {
                const key = normalizeRouteBlockCode(feature.properties.ubigeo);
                const anchor = Number.isFinite(feature.properties.label_lon) && Number.isFinite(feature.properties.label_lat)
                  ? { lon: feature.properties.label_lon, lat: feature.properties.label_lat }
                  : territorialDistrictCentroid(feature);
                if (!anchor) return null;
                const point = projection.project(anchor.lon, anchor.lat);
                return (
                  <text key={`label-${feature.properties.ubigeo}`} x={point.x} y={point.y} className={activeUbigeos.has(key) ? "is-active" : ""} textAnchor="middle">
                    {feature.properties.distrito}
                  </text>
                );
              })}
            </g>
            <text className="mon-territorial-route-coverage-caption" x="18" y={LIMA_MAP_HEIGHT - 18}>
              {caption}
            </text>
          </svg>
        ) : (
          <MapEmptyState title="Sin geometria territorial" hint="No hay distritos o zonas para dibujar en este corte." />
        )}
        {showLoading ? (
          <span className="mon-territorial-route-map-loading">
            <Loader2 size={13} className="pulso-spin" /> {mode === "selection" ? "Cargando manzanas" : "Cargando zonas"}
          </span>
        ) : null}
      </div>
      {mapError ? <div className="mon-territorial-map-error">{mapError}</div> : null}
      <div className="mon-territorial-route-coverage-legend" aria-label="Leyenda por distrito">
        <em className="is-context">Bordes Lima Metropolitana</em>
        {mode === "selection" ? (
          <>
            <em className="is-titular"><i /> Titulares</em>
            <em className="is-replacement"><i /> Reemplazos</em>
          </>
        ) : (
          <em className="is-effective"><i /> Zonas con cierre</em>
        )}
        {legendRows.map((district) => (
          <span key={district.ubigeo || district.distrito} style={{ "--route-district-color": district.color } as CSSProperties}>
            <i />
            <b title={district.distrito}>{district.distrito}</b>
          </span>
        ))}
        {coverage.districts.length > legendRows.length ? <em>+{formatMetric(coverage.districts.length - legendRows.length)} distritos</em> : null}
      </div>
    </div>
  );
}

function TerritorialRouteBucketBars({
  title,
  buckets,
  empty,
}: {
  title: string;
  buckets: TerritorialRouteBucket[];
  empty: string;
}) {
  const maxValue = Math.max(1, ...buckets.map((bucket) => Math.max(bucket.target, bucket.achieved)));
  return (
    <section className="mon-territorial-route-bucket-panel" aria-label={`Distribucion por ${title}`}>
      <header>
        <span>{title}</span>
        <strong>{buckets.length ? `${formatMetric(buckets.reduce((total, bucket) => total + bucket.target, 0))} cuota` : empty}</strong>
      </header>
      <div>
        {buckets.slice(0, 7).map((bucket, index) => {
          const pct = Math.max(5, Math.round((Math.max(bucket.target, bucket.achieved) / maxValue) * 100));
          return (
            <article key={bucket.label} style={{ "--route-bucket-pct": `${pct}%`, "--route-bucket-color": territorialRouteBucketColor(index) } as CSSProperties}>
              <span><strong title={bucket.label}>{bucket.label}</strong><em>{formatMetric(bucket.achieved)} / {formatMetric(bucket.target)}</em></span>
              <i><b /></i>
            </article>
          );
        })}
        {!buckets.length ? <p>{empty}</p> : null}
      </div>
    </section>
  );
}

function TerritorialRouteDistrictCoverageTable({ rows }: { rows: TerritorialRouteDistrictCoverage[] }) {
  const maxTarget = Math.max(1, ...rows.map((row) => Math.max(row.target, row.validas)));
  return (
    <section className="mon-territorial-route-district-coverage" aria-label="Cobertura por distrito">
      <header>
        <span><ListChecks size={13} /> Distritos evaluados</span>
        <strong>{formatMetric(rows.length)} distritos con manzanas seleccionadas</strong>
      </header>
      <div className="mon-territorial-route-district-coverage-head" aria-hidden="true">
        <span>Distrito</span>
        <span>Territorio</span>
        <span>Cuota</span>
        <span>Sexo</span>
        <span>Edad</span>
      </div>
      <div className="mon-territorial-route-district-coverage-list">
        {rows.map((row) => {
          const pct = Math.max(5, Math.round((Math.max(row.target, row.validas) / maxTarget) * 100));
          return (
            <article key={row.ubigeo || row.distrito} style={{ "--route-district-color": row.color, "--route-district-pct": `${pct}%` } as CSSProperties}>
              <div className="mon-territorial-route-district-identity">
                <DistrictShapeIcon ubigeo={row.ubigeo} label={row.distrito} />
                <span>
                  <strong title={row.distrito}>{row.distrito}</strong>
                  <em>{row.ubigeo || "sin ubigeo"}</em>
                </span>
              </div>
              <div className="mon-territorial-route-district-territory">
                <strong>{formatMetric(row.zones)} zonas</strong>
                <em>{formatMetric(row.titulares)} titulares · {formatMetric(row.reemplazos)} reemplazos</em>
              </div>
              <div className="mon-territorial-route-district-quota">
                <span><strong>{formatMetric(row.validas)}</strong><em>de {formatMetric(row.target || row.population)} previstas</em></span>
                <i><b /></i>
              </div>
              <TerritorialRouteMiniStack buckets={row.sex} />
              <TerritorialRouteMiniStack buckets={row.age} />
            </article>
          );
        })}
        {!rows.length ? <p>Sin distritos cruzados con Hojas de Ruta.</p> : null}
      </div>
    </section>
  );
}

function TerritorialRouteKpiCard({ label, value, hint, icon: Icon }: RouteMetricCard) {
  return (
    <article className="mon-territorial-route-kpi">
      <Icon size={15} />
      <span>{label}</span>
      <strong>{value}</strong>
      <em title={hint}>{hint}</em>
    </article>
  );
}

function TerritorialRouteMiniStack({ buckets }: { buckets: TerritorialRouteBucket[] }) {
  const total = buckets.reduce((sum, bucket) => sum + Math.max(bucket.target, bucket.achieved), 0);
  if (!buckets.length || total <= 0) return <div className="mon-territorial-route-mini-stack is-empty">Sin dato</div>;
  return (
    <div className="mon-territorial-route-mini-stack">
      <i>
        {buckets.slice(0, 5).map((bucket, index) => {
          const value = Math.max(bucket.target, bucket.achieved);
          return (
            <b
              key={bucket.label}
              title={`${bucket.label}: ${formatMetric(bucket.achieved)} / ${formatMetric(bucket.target)}`}
              style={{
                "--route-bucket-color": territorialRouteBucketColor(index),
                "--route-bucket-pct": `${Math.max(4, Math.round((value / total) * 100))}%`,
              } as CSSProperties}
            />
          );
        })}
      </i>
      <span>{buckets.slice(0, 2).map((bucket) => bucket.label).join(" · ")}</span>
    </div>
  );
}

function DistrictShapeIcon({ ubigeo, label }: { ubigeo: string; label: string }) {
  const feature = LIMA_DISTRICT_FEATURES.find((item) => normalizeRouteBlockCode(item.properties.ubigeo) === normalizeRouteBlockCode(ubigeo));
  const d = feature ? buildDistrictShapePath(feature) : "";
  return (
    <svg className="mon-territorial-district-shape is-active" viewBox="0 0 48 48" role="img" aria-label={label}>
      {d ? <path d={d} /> : <circle cx="24" cy="24" r="15" />}
    </svg>
  );
}

function MapEmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="mon-territorial-route-map-placeholder" role="status">
      <span><MapPin size={18} /></span>
      <strong>{title}</strong>
      <em>{hint}</em>
    </div>
  );
}

function territorialRouteBucketColor(index: number) {
  const colors = ["#0f766e", "#be123c", "#2563eb", "#c2410c", "#7c3aed", "#0891b2", "#a16207"];
  return colors[index % colors.length];
}

function formatMetric(value: unknown) {
  if (value == null || value === "") return "0";
  const n = Number(value);
  if (Number.isFinite(n)) return new Intl.NumberFormat("es-PE").format(n);
  return String(value);
}

function numberOrNull(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeMatch(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-PE")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function stripLeftZeros(value: unknown) {
  const raw = String(value ?? "").trim();
  const stripped = raw.replace(/^0+(?=\d)/, "");
  return stripped || raw;
}

export function territorialRouteBlockIsReplacement(block: TerritorialBlockProgress) {
  return normalizeMatch(block.tipo_manzana) === "reemplazo";
}

function territorialRouteReplacementShortLabel(block: TerritorialBlockProgress) {
  const order = numberOrNull(block.replacement_order);
  if (order != null) return `R${formatMetric(order)}`;
  const raw = String(block.replacement_label ?? "").trim();
  return raw || "Reemplazo";
}

function territorialRouteBlockMapTitle(block: TerritorialBlockProgress, fallbackDistrict?: string) {
  const parts = [
    fallbackDistrict || block.distrito || "Distrito",
    block.ump ? `UMP ${block.ump}` : block.hoja_num != null ? `UMP ${formatMetric(block.hoja_num)}` : "",
    block.manzana ? `Mz ${block.manzana}` : "",
    territorialRouteBlockIsReplacement(block) ? territorialRouteReplacementShortLabel(block) : "Titular",
  ].filter(Boolean);
  return parts.join(" · ");
}

export function territorialBlockZoneKey(block: TerritorialBlockProgress) {
  const ubigeo = normalizeRouteBlockCode(block.ubigeo);
  const zona = normalizeRouteBlockCode(block.zona);
  return ubigeo && zona ? `${ubigeo}:${stripLeftZeros(zona)}` : "";
}

export function territorialFeatureZoneKey(feature: HojasRutaBlockMapFeature) {
  const props = feature.properties || {};
  const ubigeo = normalizeRouteBlockCode(props.ubigeo);
  const zona = normalizeRouteBlockCode(props.inei_zona);
  return ubigeo && zona ? `${ubigeo}:${stripLeftZeros(zona)}` : "";
}

export function territorialZoneFeatureKey(feature: HojasRutaZoneMapFeature) {
  const props = feature.properties || {};
  const ubigeo = normalizeRouteBlockCode(props.ubigeo);
  const zona = normalizeRouteBlockCode(props.zona);
  return ubigeo && zona ? `${ubigeo}:${stripLeftZeros(zona)}` : "";
}

function territorialZoneDisplayLabel(feature: HojasRutaZoneMapFeature) {
  const props = feature.properties || {};
  const raw = String(props.zona_label || props.zona || feature.id || "").trim();
  if (!raw) return "Z S/D";
  const compact = raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (compact.startsWith("Z")) return compact;
  return `Z${compact.padStart(5, "0")}`;
}

export function territorialBlockStableKey(block: TerritorialBlockProgress) {
  return [
    normalizeRouteBlockCode(block.ubigeo),
    normalizeRouteBlockCode(block.zona),
    normalizeRouteBlockCode(block.manzana),
    normalizeRouteBlockCode(block.id_manzana),
  ].filter(Boolean).join(":");
}

function operationalCodeVariants(value: unknown, includeTrimmed = true) {
  const raw = String(value ?? "").trim();
  if (!raw) return [];
  const normalized = normalizeRouteBlockCode(raw);
  const variants = new Set<string>();
  if (normalized) variants.add(normalized);
  if (includeTrimmed) {
    const stripped = stripLeftZeros(normalized);
    if (stripped) variants.add(stripped);
  }
  return Array.from(variants);
}

function territorialBlockLookupKeys(block: TerritorialBlockProgress) {
  const keys = new Set<string>();
  operationalCodeVariants(block.id_manzana).forEach((id) => keys.add(`id:${id}`));
  const zoneVariants = operationalCodeVariants(block.zona, false);
  const blockVariants = operationalCodeVariants(block.manzana);
  const ubigeo = normalizeRouteBlockCode(block.ubigeo);
  if (ubigeo && zoneVariants.length && blockVariants.length) {
    zoneVariants.forEach((zona) => {
      blockVariants.forEach((manzana) => {
        keys.add(`uzm:${ubigeo}:${zona}:${manzana}`);
      });
    });
  }
  return Array.from(keys);
}

function territorialFeatureLookupKeys(feature: HojasRutaBlockMapFeature) {
  const props = feature.properties || {};
  const keys = new Set<string>();
  [props.ID_MANZANA, props.cartografia_id, props.inei_id_manzana, props.manzana_label, feature.id].forEach((value) => {
    operationalCodeVariants(value).forEach((id) => keys.add(`id:${id}`));
  });
  const ubigeo = normalizeRouteBlockCode(props.ubigeo);
  const zoneVariants = operationalCodeVariants(props.inei_zona, false);
  const blockVariants = operationalCodeVariants(props.inei_manzana);
  if (ubigeo && zoneVariants.length && blockVariants.length) {
    zoneVariants.forEach((zona) => {
      blockVariants.forEach((manzana) => {
        keys.add(`uzm:${ubigeo}:${zona}:${manzana}`);
      });
    });
  }
  return Array.from(keys);
}

function territorialFeatureStableKey(feature: HojasRutaBlockMapFeature, index = 0) {
  const props = feature.properties || {};
  return normalizeRouteBlockCode(props.cartografia_id || props.inei_id_manzana || props.ID_MANZANA || feature.id || index) || String(index);
}

export function selectTerritorialMapFeatures(features: HojasRutaBlockMapFeature[], blocks: TerritorialBlockProgress[]): TerritorialSelectedMapFeature[] {
  const lookup = new Map<string, TerritorialBlockProgress>();
  blocks.forEach((block) => {
    territorialBlockLookupKeys(block).forEach((key) => {
      if (key && !lookup.has(key)) lookup.set(key, block);
    });
  });
  const selected: TerritorialSelectedMapFeature[] = [];
  const usedBlocks = new Set<string>();
  features.forEach((feature, index) => {
    const match = territorialFeatureLookupKeys(feature).map((key) => lookup.get(key)).find((block) => {
      if (!block) return false;
      const blockKey = territorialBlockStableKey(block);
      return !usedBlocks.has(blockKey);
    });
    if (!match) return;
    const blockKey = territorialBlockStableKey(match);
    usedBlocks.add(blockKey);
    selected.push({
      feature,
      block: match,
      key: `${blockKey}-${territorialFeatureStableKey(feature, index)}`,
    });
  });
  return selected;
}

function summarizeTerritorialRouteBlockKinds(blocks: TerritorialBlockProgress[]) {
  return blocks.reduce((acc, block) => {
    if (territorialRouteBlockIsReplacement(block)) acc.reemplazos += 1;
    else acc.titulares += 1;
    return acc;
  }, { titulares: 0, reemplazos: 0 });
}

export function territorialEffectiveRouteBlocks(blocks: TerritorialBlockProgress[], reports: MonitoreoTerritorialDashboard) {
  return blocks.filter((block) => territorialRouteBlockHasClosedQuota(block, reports));
}

function territorialRouteBlockHasClosedQuota(block: TerritorialBlockProgress, reports: MonitoreoTerritorialDashboard) {
  const quota = findQuotaForBlock(reports, block);
  if (quota) {
    const target = numberOrNull(quota.total);
    return target != null && target > 0 && numberOrNull(block.validas) != null && Number(block.validas) >= target;
  }
  const meta = numberOrNull(block.meta);
  const validas = numberOrNull(block.validas);
  const brecha = numberOrNull(block.brecha);
  if (meta != null && meta > 0 && validas != null && validas >= meta && (brecha == null || brecha <= 0)) return true;
  const advancePct = numberOrNull(block.avance_pct);
  return advancePct != null && advancePct >= 100 && (brecha == null || brecha <= 0);
}

function findQuotaForBlock(reports: MonitoreoTerritorialDashboard, block: TerritorialBlockProgress) {
  const rows = reports.route_quota_marginals?.blocks ?? [];
  const blockId = normalizeRouteBlockCode(block.id_manzana);
  const ubigeo = normalizeRouteBlockCode(block.ubigeo);
  const zona = normalizeRouteBlockCode(block.zona);
  const manzana = normalizeRouteBlockCode(block.manzana);
  return rows.find((row) => (
    (blockId && normalizeRouteBlockCode(row.id_manzana) === blockId)
    || (
      ubigeo
      && normalizeRouteBlockCode(row.ubigeo) === ubigeo
      && normalizeRouteBlockCode(row.zona) === zona
      && normalizeRouteBlockCode(row.manzana) === manzana
    )
  )) ?? null;
}

export async function loadTerritorialRouteCartography(
  ubigeo: string,
  options: TerritorialRouteCartographyOptions = {},
): Promise<TerritorialRouteCartographyBundle> {
  const normalized = normalizeRouteBlockCode(ubigeo);
  const cacheKey = territorialRouteCartographyCacheKey(normalized, Boolean(options.includeRichLayers));
  const cached = CARTOGRAPHY_MEMORY_CACHE.get(cacheKey);
  if (cached) return cached;
  const inflight = CARTOGRAPHY_INFLIGHT.get(cacheKey);
  if (inflight) return inflight;
  const request = (async () => {
    const includeRichLayers = Boolean(options.includeRichLayers);
    const persisted = await readTerritorialRouteCartographyCache(normalized, includeRichLayers);
    if (persisted) {
      CARTOGRAPHY_MEMORY_CACHE.set(cacheKey, persisted);
      CARTOGRAPHY_INFLIGHT.delete(cacheKey);
      return persisted;
    }

    const basicCacheKey = territorialRouteCartographyCacheKey(normalized, false);
    const basicBundle = includeRichLayers
      ? CARTOGRAPHY_MEMORY_CACHE.get(basicCacheKey)
        ?? await CARTOGRAPHY_INFLIGHT.get(basicCacheKey)
        ?? await readTerritorialRouteCartographyCache(normalized, false)
      : null;
    if (basicBundle) CARTOGRAPHY_MEMORY_CACHE.set(basicCacheKey, basicBundle);

    let blockMap = basicBundle?.blockMap ?? null;
    let zoneMap = basicBundle?.zoneMap ?? null;
    let streetMap: HojasRutaStreetMap | null = null;
    let contextMap: HojasRutaContextMap | null = null;

    const requests: Array<{
      key: "block" | "zone" | "street" | "context";
      promise: Promise<HojasRutaBlockMap | HojasRutaZoneMap | HojasRutaStreetMap | HojasRutaContextMap>;
    }> = [];
    if (!blockMap) requests.push({ key: "block", promise: apiHojasRutaBlockMap(normalized, 0, false) });
    if (!zoneMap) requests.push({ key: "zone", promise: apiHojasRutaZoneMap(normalized) });
    if (includeRichLayers) {
      requests.push({ key: "street", promise: apiHojasRutaStreetMap(normalized) });
      requests.push({ key: "context", promise: apiHojasRutaContextMap(normalized) });
    }

    const results = await Promise.allSettled(requests.map((item) => item.promise));
    results.forEach((result, index) => {
      if (result.status !== "fulfilled") return;
      const key = requests[index]?.key;
      if (key === "block") blockMap = result.value as HojasRutaBlockMap;
      else if (key === "zone") zoneMap = result.value as HojasRutaZoneMap;
      else if (key === "street") streetMap = result.value as HojasRutaStreetMap;
      else if (key === "context") contextMap = result.value as HojasRutaContextMap;
    });

    const bundle: TerritorialRouteCartographyBundle = {
      blockMap,
      zoneMap,
      streetMap,
      contextMap,
      partial: Boolean(basicBundle?.partial) || results.some((result) => result.status === "rejected"),
    };

    if (includeRichLayers && (blockMap || zoneMap)) {
      const basicHydrated: TerritorialRouteCartographyBundle = {
        blockMap,
        zoneMap,
        streetMap: null,
        contextMap: null,
        partial: !blockMap || !zoneMap,
      };
      CARTOGRAPHY_MEMORY_CACHE.set(basicCacheKey, basicHydrated);
      void writeTerritorialRouteCartographyCache(normalized, basicHydrated, false);
    }

    CARTOGRAPHY_MEMORY_CACHE.set(cacheKey, bundle);
    void writeTerritorialRouteCartographyCache(normalized, bundle, includeRichLayers);
    CARTOGRAPHY_INFLIGHT.delete(cacheKey);
    return bundle;
  })().catch((error) => {
    CARTOGRAPHY_INFLIGHT.delete(cacheKey);
    throw error;
  });
  CARTOGRAPHY_INFLIGHT.set(cacheKey, request);
  return request;
}

function openTerritorialRouteCartographyDb(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !("indexedDB" in window)) return Promise.resolve(null);
  if (cartographyDbPromise) return cartographyDbPromise;
  cartographyDbPromise = new Promise((resolve) => {
    const request = window.indexedDB.open("prosecnur-territorial-route-cartography", 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("bundles")) db.createObjectStore("bundles");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
  return cartographyDbPromise;
}

async function readTerritorialRouteCartographyCache(ubigeo: string, includeRichLayers: boolean): Promise<TerritorialRouteCartographyBundle | null> {
  const db = await openTerritorialRouteCartographyDb();
  if (!db) return null;
  return new Promise((resolve) => {
    const tx = db.transaction("bundles", "readonly");
    const request = tx.objectStore("bundles").get(territorialRouteCartographyCacheKey(ubigeo, includeRichLayers));
    request.onsuccess = () => {
      const entry = request.result as { version?: string; bundle?: TerritorialRouteCartographyBundle } | undefined;
      resolve(entry?.version === ROUTE_CARTOGRAPHY_CACHE_VERSION && entry.bundle ? entry.bundle : null);
    };
    request.onerror = () => resolve(null);
  });
}

async function writeTerritorialRouteCartographyCache(ubigeo: string, bundle: TerritorialRouteCartographyBundle, includeRichLayers: boolean) {
  if (bundle.partial || (!bundle.blockMap && !bundle.zoneMap && !bundle.streetMap && !bundle.contextMap)) return;
  const db = await openTerritorialRouteCartographyDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction("bundles", "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
    tx.onabort = () => resolve();
    tx.objectStore("bundles").put({
      version: ROUTE_CARTOGRAPHY_CACHE_VERSION,
      created_at: Date.now(),
      bundle,
    }, territorialRouteCartographyCacheKey(ubigeo, includeRichLayers));
  });
}

function territorialRouteCartographyCacheKey(ubigeo: string, includeRichLayers: boolean) {
  return `${ROUTE_CARTOGRAPHY_CACHE_VERSION}:${includeRichLayers ? "rich" : "base"}:${normalizeRouteBlockCode(ubigeo)}`;
}

export function buildTerritorialMapProjection(
  districtFeatures: TerritorialDistrictFeature[],
  blockFeatures: HojasRutaBlockMapFeature[] = [],
  zoneFeatures: HojasRutaZoneMapFeature[] = [],
  padding = 32,
  extraPoints: Array<{ lon: number; lat: number }> = [],
): TerritorialMapProjection {
  const points: TerritorialGeoPoint[] = [];
  districtFeatures.forEach((feature) => territorialDistrictPolygons(feature).forEach((polygon) => polygon.forEach((ring) => points.push(...ring))));
  blockFeatures.forEach((feature) => territorialFeaturePolygons(feature).forEach((polygon) => polygon.forEach((ring) => points.push(...ring))));
  zoneFeatures.forEach((feature) => territorialZonePolygons(feature).forEach((polygon) => polygon.forEach((ring) => points.push(...ring))));
  extraPoints.forEach((point) => points.push([point.lon, point.lat]));
  const valid = points.filter(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat));
  if (!valid.length) {
    return {
      width: LIMA_MAP_WIDTH,
      height: LIMA_MAP_HEIGHT,
      hasGeometry: false,
      project: () => ({ x: LIMA_MAP_WIDTH / 2, y: LIMA_MAP_HEIGHT / 2 }),
    };
  }
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  valid.forEach(([lon, lat]) => {
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  });
  const spanLon = Math.max(0.000001, maxLon - minLon);
  const spanLat = Math.max(0.000001, maxLat - minLat);
  const scale = Math.min((LIMA_MAP_WIDTH - padding * 2) / spanLon, (LIMA_MAP_HEIGHT - padding * 2) / spanLat);
  const projectedWidth = spanLon * scale;
  const projectedHeight = spanLat * scale;
  const offsetX = (LIMA_MAP_WIDTH - projectedWidth) / 2;
  const offsetY = (LIMA_MAP_HEIGHT - projectedHeight) / 2;
  return {
    width: LIMA_MAP_WIDTH,
    height: LIMA_MAP_HEIGHT,
    hasGeometry: true,
    project: (lon: number, lat: number) => ({
      x: offsetX + (lon - minLon) * scale,
      y: offsetY + (maxLat - lat) * scale,
    }),
  };
}

export function territorialDistrictPath(feature: TerritorialDistrictFeature, projection: TerritorialMapProjection) {
  return territorialDistrictPolygons(feature)
    .map((polygon) => polygon.map((ring) => territorialRingPath(ring, projection, true)).filter(Boolean).join(" "))
    .filter(Boolean)
    .join(" ");
}

export function territorialFeaturePath(feature: HojasRutaBlockMapFeature, projection: TerritorialMapProjection) {
  return territorialFeaturePolygons(feature)
    .map((polygon) => polygon.map((ring) => territorialRingPath(ring, projection, true)).filter(Boolean).join(" "))
    .filter(Boolean)
    .join(" ");
}

export function territorialZonePath(feature: HojasRutaZoneMapFeature, projection: TerritorialMapProjection) {
  return territorialZonePolygons(feature)
    .map((polygon) => polygon.map((ring) => territorialRingPath(ring, projection, true)).filter(Boolean).join(" "))
    .filter(Boolean)
    .join(" ");
}

export function territorialContextFeaturePath(feature: HojasRutaContextMapFeature, projection: TerritorialMapProjection) {
  const geometry = feature.geometry;
  if (!geometry) return "";
  if (geometry.type === "LineString" || geometry.type === "MultiLineString") {
    return territorialContextLines(feature)
      .map((line) => territorialRingPath(line, projection, false))
      .filter(Boolean)
      .join(" ");
  }
  if (geometry.type === "Polygon" || geometry.type === "MultiPolygon") {
    return territorialContextPolygons(feature)
      .map((polygon) => polygon.map((ring) => territorialRingPath(ring, projection, true)).filter(Boolean).join(" "))
      .filter(Boolean)
      .join(" ");
  }
  return "";
}

export function territorialStreetPath(feature: HojasRutaStreetMapFeature, projection: TerritorialMapProjection) {
  return territorialStreetLines(feature)
    .map((line) => territorialRingPath(line, projection, false))
    .filter(Boolean)
    .join(" ");
}

function territorialRingPath(ring: TerritorialGeoRing, projection: TerritorialMapProjection, close: boolean) {
  const commands = ring
    .map((coord, index) => {
      const lon = Number(coord[0]);
      const lat = Number(coord[1]);
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) return "";
      const { x, y } = projection.project(lon, lat);
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .filter(Boolean)
    .join(" ");
  return commands ? `${commands}${close ? " Z" : ""}` : "";
}

function territorialDistrictPolygons(feature: TerritorialDistrictFeature): TerritorialGeoPolygon[] {
  if (feature.geometry.type === "Polygon") return [feature.geometry.coordinates];
  return feature.geometry.coordinates;
}

function territorialFeaturePolygons(feature: HojasRutaBlockMapFeature): TerritorialGeoPolygon[] {
  const geometry = feature.geometry;
  if (!geometry) return [];
  if (geometry.type === "Polygon") return [geometry.coordinates as TerritorialGeoPolygon];
  return geometry.coordinates as TerritorialGeoPolygon[];
}

function territorialZonePolygons(feature: HojasRutaZoneMapFeature): TerritorialGeoPolygon[] {
  return normalizeTerritorialPolygons(feature.geometry?.coordinates);
}

function territorialContextPolygons(feature: HojasRutaContextMapFeature): TerritorialGeoPolygon[] {
  const geometry = feature.geometry;
  if (!geometry || (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon")) return [];
  return normalizeTerritorialPolygons(geometry.coordinates);
}

function territorialContextLines(feature: HojasRutaContextMapFeature): TerritorialGeoRing[] {
  const geometry = feature.geometry;
  if (!geometry) return [];
  if (geometry.type === "LineString") return [normalizeTerritorialRing(geometry.coordinates)];
  if (geometry.type === "MultiLineString") {
    return (geometry.coordinates as unknown[]).map(normalizeTerritorialRing).filter((line) => line.length > 1);
  }
  return [];
}

function territorialStreetLines(feature: HojasRutaStreetMapFeature): TerritorialGeoRing[] {
  const geometry = feature.geometry;
  if (!geometry) return [];
  if (geometry.type === "LineString") return [normalizeTerritorialRing(geometry.coordinates)];
  return (geometry.coordinates as unknown[]).map(normalizeTerritorialRing).filter((line) => line.length > 1);
}

function normalizeTerritorialPolygons(value: unknown): TerritorialGeoPolygon[] {
  if (!Array.isArray(value)) return [];
  if (isTerritorialRing(value)) return [[normalizeTerritorialRing(value)]];
  if (value.length && isTerritorialRing(value[0])) return [value.map(normalizeTerritorialRing).filter((ring) => ring.length > 1)];
  return value.flatMap((item) => normalizeTerritorialPolygons(item));
}

function normalizeTerritorialRing(value: unknown): TerritorialGeoRing {
  if (!Array.isArray(value)) return [];
  return value
    .map((point) => Array.isArray(point) ? [Number(point[0]), Number(point[1])] as TerritorialGeoPoint : null)
    .filter((point): point is TerritorialGeoPoint => point !== null && Number.isFinite(point[0]) && Number.isFinite(point[1]));
}

function isTerritorialRing(value: unknown): value is unknown[] {
  return Array.isArray(value) && value.length > 1 && value.every((point) => (
    Array.isArray(point) && Number.isFinite(Number(point[0])) && Number.isFinite(Number(point[1]))
  ));
}

export function sampleTerritorialStreetFeatures(features: HojasRutaStreetMapFeature[]) {
  const priority = features
    .filter((feature) => {
      const rank = Number(feature.properties.rank ?? 99);
      return feature.properties.class_group === "major" || feature.properties.avenue_like || rank <= 4;
    })
    .sort((a, b) => Number(a.properties.rank ?? 99) - Number(b.properties.rank ?? 99));
  return priority.slice(0, LIMA_MAP_STREET_LIMIT);
}

export function sampleTerritorialContextFeatures(features: HojasRutaContextMapFeature[]) {
  const wanted = new Set(["water", "coast", "waterway", "green", "square", "public", "transit", "landmark"]);
  return features
    .filter((feature) => wanted.has(String(feature.properties.feature_class ?? "")))
    .sort((a, b) => Number(a.properties.rank ?? 99) - Number(b.properties.rank ?? 99))
    .slice(0, LIMA_MAP_POI_LIMIT);
}

export function territorialContextClass(feature: HojasRutaContextMapFeature) {
  return String(feature.properties.feature_class || feature.properties.kind || "context").replace(/[^a-z0-9_-]+/gi, "-").toLowerCase();
}

function territorialDistrictCentroid(feature: TerritorialDistrictFeature) {
  let lonTotal = 0;
  let latTotal = 0;
  let count = 0;
  territorialDistrictPolygons(feature).forEach((polygon) => {
    polygon[0]?.forEach((coord) => {
      const lon = Number(coord[0]);
      const lat = Number(coord[1]);
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;
      lonTotal += lon;
      latTotal += lat;
      count += 1;
    });
  });
  return count ? { lon: lonTotal / count, lat: latTotal / count } : null;
}

export function buildDistrictShapePath(feature: TerritorialDistrictFeature) {
  const coords = territorialDistrictPolygons(feature).flat(2);
  if (!coords.length) return "";
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  coords.forEach(([lon, lat]) => {
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  });
  const spanLon = Math.max(0.000001, maxLon - minLon);
  const spanLat = Math.max(0.000001, maxLat - minLat);
  const size = 48;
  const padding = 6;
  const scale = Math.min((size - padding * 2) / spanLon, (size - padding * 2) / spanLat);
  const mapW = spanLon * scale;
  const mapH = spanLat * scale;
  const offsetX = (size - mapW) / 2;
  const offsetY = (size - mapH) / 2;
  const project = ([lon, lat]: TerritorialGeoPoint) => [
    offsetX + (lon - minLon) * scale,
    size - offsetY - (lat - minLat) * scale,
  ] as const;
  return territorialDistrictPolygons(feature)
    .map((polygon) => polygon
      .map((ring) => {
        const path = ring.map((coord, index) => {
          const [x, y] = project(coord);
          return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
        }).join(" ");
        return path ? `${path} Z` : "";
      })
      .filter(Boolean)
      .join(" "))
    .filter(Boolean)
    .join(" ");
}
