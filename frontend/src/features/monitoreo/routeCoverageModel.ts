import type {
  MonitoreoTerritorialDashboard,
  TerritorialBlockProgress,
  TerritorialQuotaProgressItem,
} from "../../api/client";

type RouteCoverageReports = Partial<Pick<
  MonitoreoTerritorialDashboard,
  "district_progress" | "route_quota_marginals" | "route_quota_progress"
>>;

export type TerritorialRouteBucket = {
  label: string;
  target: number;
  achieved: number;
  missing: number;
};

export type TerritorialRouteDistrictCoverage = {
  ubigeo: string;
  distrito: string;
  color: string;
  titulares: number;
  reemplazos: number;
  zones: number;
  target: number;
  validas: number;
  population: number;
  sex: TerritorialRouteBucket[];
  age: TerritorialRouteBucket[];
};

export type TerritorialRouteCoverageModel = {
  districts: TerritorialRouteDistrictCoverage[];
  ubigeos: string[];
  zoneKeys: Set<string>;
  totals: {
    titulares: number;
    reemplazos: number;
    operationalBlocks: number;
    districts: number;
    zones: number;
    target: number;
    validas: number;
    population: number;
  };
  sexTotals: TerritorialRouteBucket[];
  ageTotals: TerritorialRouteBucket[];
};

const ROUTE_DISTRICT_COLORS = [
  "#0f766e",
  "#be123c",
  "#2563eb",
  "#c2410c",
  "#7c3aed",
  "#0891b2",
  "#a16207",
  "#15803d",
  "#b91c1c",
  "#4338ca",
  "#0e7490",
  "#b45309",
] as const;

type MutableDistrictCoverage = Omit<TerritorialRouteDistrictCoverage, "zones" | "sex" | "age"> & {
  zoneKeys: Set<string>;
  marginalTarget: number;
  blockValidas: number;
  sexMap: Map<string, TerritorialRouteBucket>;
  ageMap: Map<string, TerritorialRouteBucket>;
  hasProgress: boolean;
};

export function normalizeRouteSearchText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-PE")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function normalizeRouteBlockCode(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleUpperCase("es-PE")
    .replace(/[^A-Z0-9]/g, "");
}

export function normalizeRouteUmpKey(value: unknown) {
  const normalized = normalizeRouteSearchText(value)
    .replace(/^(?:u\s*m\s*p|ump|manzana|manz|mz|mza)\s*/, "")
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9]/g, "");
  if (/^\d+$/.test(normalized)) return stripLeftZeros(normalized);
  return normalized;
}

export function routeBlockStableKey(block: TerritorialBlockProgress) {
  return [
    normalizeRouteBlockCode(block.ubigeo),
    normalizeRouteBlockCode(block.zona),
    normalizeRouteBlockCode(block.manzana),
    normalizeRouteBlockCode(block.id_manzana),
  ].filter(Boolean).join(":");
}

export function routeBlockZoneKey(block: Pick<TerritorialBlockProgress, "ubigeo" | "zona">) {
  const ubigeo = normalizeRouteBlockCode(block.ubigeo);
  const zona = normalizeRouteBlockCode(block.zona);
  return ubigeo && zona ? `${ubigeo}:${stripLeftZeros(zona)}` : "";
}

export function routeRangeLabel(block: Pick<TerritorialBlockProgress, "rango_inicio" | "rango_fin" | "entrevistas" | "meta">) {
  const start = numberOrNull(block.rango_inicio);
  const end = numberOrNull(block.rango_fin);
  if (start != null && end != null) return `${formatRoutePlainNumber(start)}-${formatRoutePlainNumber(end)}`;
  const meta = numberOrNull(block.entrevistas ?? block.meta);
  return meta != null ? `1-${formatRoutePlainNumber(meta)}` : "Por definir";
}

export function routeOperationalLabel(block: TerritorialBlockProgress) {
  if (block.tipo_manzana === "reemplazo") {
    const primary = routePrimaryUmpLabel(block);
    const replacement = routeReplacementLabel(block);
    return primary === "UMP por definir" ? replacement : `${primary} · ${replacement}`;
  }
  return routePrimaryUmpLabel(block);
}

export function filterTerritorialRouteBlocks(
  blocks: TerritorialBlockProgress[],
  filters: { districtFilter?: string; query?: string },
) {
  const districtFilter = String(filters.districtFilter || "").trim();
  const needles = routeSearchNeedles(filters.query);
  return blocks.filter((block) => {
    const districtValue = String(block.ubigeo || block.distrito || "").trim();
    if (districtFilter && districtValue !== districtFilter) return false;
    if (!needles.length) return true;
    const haystack = routeBlockSearchHaystack(block);
    return needles.some((needle) => haystack.includes(needle));
  });
}

export function buildTerritorialRouteCoverageModel(
  blocks: TerritorialBlockProgress[],
  reports: RouteCoverageReports = {},
): TerritorialRouteCoverageModel {
  const districtMap = new Map<string, MutableDistrictCoverage>();
  const ensureDistrict = (ubigeoValue: unknown, distritoValue: unknown) => {
    const ubigeo = String(ubigeoValue || "").trim();
    const distrito = String(distritoValue || "").trim() || ubigeo || "Sin distrito";
    const key = ubigeo || normalizeRouteSearchText(distrito) || "sin-distrito";
    const existing = districtMap.get(key);
    if (existing) {
      if (!existing.distrito || existing.distrito === existing.ubigeo) existing.distrito = distrito;
      return existing;
    }
    const color = ROUTE_DISTRICT_COLORS[districtMap.size % ROUTE_DISTRICT_COLORS.length];
    const next: MutableDistrictCoverage = {
      ubigeo,
      distrito,
      color,
      titulares: 0,
      reemplazos: 0,
      target: 0,
      validas: 0,
      population: 0,
      marginalTarget: 0,
      blockValidas: 0,
      zoneKeys: new Set(),
      sexMap: new Map(),
      ageMap: new Map(),
      hasProgress: false,
    };
    districtMap.set(key, next);
    return next;
  };

  blocks.forEach((block) => {
    const district = ensureDistrict(block.ubigeo, block.distrito);
    if (block.tipo_manzana === "reemplazo") district.reemplazos += 1;
    else district.titulares += 1;
    const zoneKey = routeBlockZoneKey(block);
    if (zoneKey) district.zoneKeys.add(zoneKey);
    district.population += Math.max(0, Math.round(numberOrNull(block.poblacion) ?? 0));
    district.blockValidas += Math.max(0, Math.round(numberOrNull(block.validas) ?? 0));
  });

  (reports.route_quota_marginals?.blocks ?? []).forEach((block) => {
    const district = ensureDistrict(block.ubigeo, block.distrito);
    const total = Math.max(0, Math.round(numberOrNull(block.total) ?? 0));
    district.marginalTarget += total;
    mergeBuckets(district.sexMap, block.sex_totals, "target");
    mergeBuckets(district.ageMap, block.age_totals, "target");
  });

  (reports.route_quota_progress?.districts ?? []).forEach((row) => {
    const district = ensureDistrict(row.ubigeo, row.distrito);
    district.hasProgress = true;
    district.target = Math.max(0, Math.round(numberOrNull(row.target) ?? 0));
    district.validas = Math.max(0, Math.round(numberOrNull(row.validas) ?? 0));
    if (row.sex?.length) {
      district.sexMap.clear();
      mergeBuckets(district.sexMap, row.sex, "progress");
    }
    if (row.age?.length) {
      district.ageMap.clear();
      mergeBuckets(district.ageMap, row.age, "progress");
    }
  });

  const districts = Array.from(districtMap.values())
    .map((district) => {
      const target = district.hasProgress ? district.target : district.marginalTarget;
      const validas = district.hasProgress ? district.validas : district.blockValidas;
      return {
        ubigeo: district.ubigeo,
        distrito: district.distrito,
        color: district.color,
        titulares: district.titulares,
        reemplazos: district.reemplazos,
        zones: district.zoneKeys.size,
        target,
        validas,
        population: district.population,
        sex: sortRouteBuckets(Array.from(district.sexMap.values())),
        age: sortRouteBuckets(Array.from(district.ageMap.values())),
      };
    })
    .filter((district) => district.titulares || district.reemplazos || district.target || district.validas)
    .sort((a, b) => b.titulares - a.titulares || b.zones - a.zones || a.distrito.localeCompare(b.distrito, "es-PE", { numeric: true }));

  const sexTotals = new Map<string, TerritorialRouteBucket>();
  const ageTotals = new Map<string, TerritorialRouteBucket>();
  const zoneKeys = new Set<string>();
  districtMap.forEach((district) => {
    district.zoneKeys.forEach((key) => zoneKeys.add(key));
    district.sexMap.forEach((bucket) => mergeBucket(sexTotals, bucket.label, bucket.target, bucket.achieved, bucket.missing));
    district.ageMap.forEach((bucket) => mergeBucket(ageTotals, bucket.label, bucket.target, bucket.achieved, bucket.missing));
  });

  const totals = districts.reduce<TerritorialRouteCoverageModel["totals"]>((acc, district) => ({
    titulares: acc.titulares + district.titulares,
    reemplazos: acc.reemplazos + district.reemplazos,
    operationalBlocks: acc.operationalBlocks + district.titulares + district.reemplazos,
    districts: acc.districts,
    zones: acc.zones,
    target: acc.target + district.target,
    validas: acc.validas + district.validas,
    population: acc.population + district.population,
  }), {
    titulares: 0,
    reemplazos: 0,
    operationalBlocks: 0,
    districts: districts.length,
    zones: zoneKeys.size,
    target: 0,
    validas: 0,
    population: 0,
  });

  return {
    districts,
    ubigeos: districts.map((district) => district.ubigeo).filter(Boolean),
    zoneKeys,
    totals,
    sexTotals: sortRouteBuckets(Array.from(sexTotals.values())),
    ageTotals: sortRouteBuckets(Array.from(ageTotals.values())),
  };
}

function routeSearchNeedles(query: unknown) {
  const normalized = normalizeRouteSearchText(query);
  if (!normalized) return [];
  const withoutLeadingZeroes = normalized.replace(/\b0+(\d+)/g, "$1");
  const compact = normalized.replace(/\s+/g, "");
  const compactWithoutLeadingZeroes = withoutLeadingZeroes.replace(/\s+/g, "");
  if (/^ump(?:\s|\d|$)/.test(normalized)) {
    return Array.from(new Set([normalized, withoutLeadingZeroes, compact, compactWithoutLeadingZeroes].filter(Boolean)));
  }
  const umpKey = normalizeRouteUmpKey(query);
  return Array.from(new Set([normalized, withoutLeadingZeroes, compact, compactWithoutLeadingZeroes, umpKey].filter(Boolean)));
}

function routeBlockSearchHaystack(block: TerritorialBlockProgress) {
  const values = [
    routeOperationalLabel(block),
    routePrimaryUmpLabel(block),
    routeReplacementLabel(block),
    routeUmpNumber(block),
    block.hoja_num,
    block.orden_seleccion,
    block.ump,
    block.id_manzana,
    block.manzana,
    block.ubigeo,
    block.distrito,
    block.zona,
    routeRangeLabel(block),
    block.responsable,
    block.territorio_muestral,
    block.titular_hoja_num,
    block.titular_id_manzana,
  ];
  const normalized = values.map(normalizeRouteSearchText).filter(Boolean);
  const compact = normalized.map((value) => value.replace(/\s+/g, ""));
  const noLeadingZeroes = normalized.map((value) => value.replace(/\b0+(\d+)/g, "$1"));
  const umpKeys = values.map(normalizeRouteUmpKey).filter(Boolean);
  return Array.from(new Set([...normalized, ...compact, ...noLeadingZeroes, ...umpKeys])).join(" ");
}

function routeUmpNumber(block: TerritorialBlockProgress) {
  return numberOrNull(block.hoja_num)
    ?? numberOrNull(block.orden_seleccion)
    ?? numberOrNull(block.ump)
    ?? numberOrNull(block.titular_hoja_num)
    ?? Number.MAX_SAFE_INTEGER;
}

function routePrimaryUmpNumber(block: TerritorialBlockProgress) {
  if (block.tipo_manzana === "reemplazo") {
    return numberOrNull(block.titular_hoja_num)
      ?? numberOrNull(block.titular_orden_seleccion)
      ?? Number.MAX_SAFE_INTEGER;
  }
  return routeUmpNumber(block);
}

function routePrimaryUmpLabel(block: TerritorialBlockProgress) {
  const value = routePrimaryUmpNumber(block);
  return Number.isFinite(value) && value !== Number.MAX_SAFE_INTEGER
    ? `UMP ${formatRoutePlainNumber(value)}`
    : "UMP por definir";
}

function routeReplacementLabel(block: TerritorialBlockProgress) {
  const order = numberOrNull(block.replacement_order) ?? numberOrNull(block.hoja_num) ?? numberOrNull(block.orden_seleccion);
  return order != null ? `R${formatRoutePlainNumber(order)}` : "R";
}

function mergeBuckets(
  target: Map<string, TerritorialRouteBucket>,
  rows: Array<Partial<TerritorialQuotaProgressItem> & { value?: number; order?: number }> | undefined,
  mode: "target" | "progress",
) {
  (rows ?? []).forEach((row) => {
    const label = String(row.label || "").trim() || "Sin dato";
    const targetValue = mode === "progress" ? numberOrNull(row.target) : numberOrNull(row.value ?? row.target);
    const achievedValue = mode === "progress" ? numberOrNull(row.achieved) : 0;
    const missingValue = mode === "progress" ? numberOrNull(row.missing) : null;
    mergeBucket(target, label, targetValue ?? 0, achievedValue ?? 0, missingValue ?? 0);
  });
}

function mergeBucket(
  target: Map<string, TerritorialRouteBucket>,
  label: string,
  targetValue = 0,
  achievedValue = 0,
  missingValue = 0,
) {
  const key = normalizeRouteSearchText(label) || "sin-dato";
  const current = target.get(key) ?? { label, target: 0, achieved: 0, missing: 0 };
  current.target += Math.max(0, Math.round(targetValue));
  current.achieved += Math.max(0, Math.round(achievedValue));
  current.missing += Math.max(0, Math.round(missingValue));
  target.set(key, current);
}

function sortRouteBuckets(rows: TerritorialRouteBucket[]) {
  return rows
    .filter((row) => row.target || row.achieved || row.missing)
    .sort((a, b) => b.target - a.target || b.achieved - a.achieved || a.label.localeCompare(b.label, "es-PE", { numeric: true }));
}

function numberOrNull(value: unknown) {
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatRoutePlainNumber(value: number) {
  return new Intl.NumberFormat("es-PE", { maximumFractionDigits: 0 }).format(value);
}

function stripLeftZeros(value: string) {
  const stripped = value.replace(/^0+/, "");
  return stripped || "0";
}
