// hojasRuta.ts — hojas de ruta para campo.
// Extraído de client.ts (split por dominio, 2026-07). Los consumidores
// importan del barrel ./client; este módulo no cambia el contrato.

import { apiFetch, apiPath, handle, headers, SESSION_KEY } from "./core";
import type { JobStart } from "./jobs";

// ---------- Hojas de ruta para campo ----------

export type HojasRutaFieldStatus = {
  nombre: string;
  estado: "listo" | "faltante";
  tipo: string | null;
};

export type HojasRutaIssue = {
  campo: string;
  mensaje: string;
};

export type HojasRutaVariable = {
  nombre: string;
  tipo: string;
};

export type HojasRutaConfig = {
  row_var: string;
  col_var: string;
  value_var: string;
  count_mode: "frecuencia" | "suma";
  cartografia_dir: string;
  project_code: string;
  max_umps: number | null;
};

export type HojasRutaAgeRange = {
  id: string;
  label: string;
  min: number;
  max: number | null;
};

export type SamplingMethod = "pps" | "sistematico" | "conglomerado_fijo";
export type SampleSizeMode = "calculator" | "external_total" | "external_district";
export type HojasRutaAgeRangeMode = "manual" | "terciles" | "cuartiles" | "quintiles" | "deciles";
export type HojasRutaAgeRangeScope = "selected" | "frame";
export type HojasRutaZoneAllocation = "proportional";
export type HojasRutaRandomPreference = "balanced" | "population" | "urban";
export type HojasRutaRouteStartCorner = "auto" | "1" | "2" | "3" | "4";
export type HojasRutaRouteJumpMode = "auto" | "off" | "manual";
export type HojasRutaFrameSource = "current" | "inei2017_official";
export type HojasRutaReplacementPolicy = "paired_by_titular_zone" | "alternate_zone_same_district";

export type AllocationMode = "proportional" | "uniform" | "compromise";

export type HojasRutaSampleSizeConfig = {
  confidence_level: number;
  margin_total: number;
  margin_district: number;
  margin_district_overrides?: Record<string, number>;
  expected_proportion: number;
  design_effect: number;
  design_effect_overrides?: Record<string, number>;
  allocation_mode?: AllocationMode;
  enforce_district_floor?: boolean;
  response_rate: number;
  apply_fpc: boolean;
  /** ADR 0116: tasa de ocupación y elegibilidad de viviendas (e), por defecto 1. */
  ocupacion?: number;
  /** De dónde sale el DEFF: `legado` (guardado antes), `por_declarar` (nuevo), `manual` o `icc_biblioteca`. */
  design_effect_fuente?: HojasRutaDeffFuente;
  /** La entrada de la biblioteca de ICC aplicada, copiada para reconstruir el DEFF sin la biblioteca. */
  icc_aplicado?: HojasRutaIccEntrada | null;
};

export type HojasRutaDeffFuente = "legado" | "por_declarar" | "manual" | "icc_biblioteca";

export type HojasRutaIntegratedConfig = {
  frame_source: HojasRutaFrameSource;
  n_objetivo: number;
  n_mode: "total" | "por_distrito";
  n_por_distrito: Record<string, number>;
  replacement_routes_per_district: Record<string, number>;
  replacement_policy: HojasRutaReplacementPolicy;
  replacements_per_titular: number;
  territorios: string[];
  row_var: "departamento" | "provincia" | "distrito" | "ubigeo" | "zona";
  col_var: "rango_edad";
  subquota_var: "sexo" | "ninguna";
  measure_var: "viviendas" | "poblacion";
  sampling_method: SamplingMethod;
  seed: number;
  max_per_manzana: number;
  entrevistas_por_manzana: number;
  route_start_corner: HojasRutaRouteStartCorner;
  route_jump_mode: HojasRutaRouteJumpMode;
  route_jump_manual: number;
  age_range_mode: HojasRutaAgeRangeMode;
  age_range_scope: HojasRutaAgeRangeScope;
  zone_allocation: HojasRutaZoneAllocation;
  age_ranges: HojasRutaAgeRange[];
  sample_size_mode: SampleSizeMode;
  sample_size: HojasRutaSampleSizeConfig;
  excluded_titular_ids?: string[];
  /** Marco elegible del run (ADR 0115). Ausente = corrida legacy: el marco no se depura. */
  marco_elegible?: HojasRutaMarcoElegible;
  random_preference?: HojasRutaRandomPreference;
};

export type HojasRutaUiStage = "territorio" | "poblacion" | "muestra" | "manzanas" | "seleccion";

export type HojasRutaUiState = {
  active_stage: HojasRutaUiStage;
  draft_territories: string[];
  map_ubigeo: string;
  map_zona: string;
  map_level: "distritos" | "zonas" | "manzanas";
  map_selection_mode: boolean;
  route_history: HojasRutaRouteSnapshot[];
  /** U14: supuestos del plan de campo. */
  plan_campo?: HojasRutaPlanSupuestos;
};

export type TerritorialFrameMeta = {
  ok: boolean;
  active_source?: HojasRutaFrameSource;
  source: string;
  year: number;
  version: string;
  packaged_at: string;
  checksum: string | null;
  coverage: string;
  pilot: boolean;
  granularity?: string;
  path: string;
  n_departamentos: number;
  n_provincias: number;
  n_distritos: number;
  n_manzanas: number;
  viviendas: number;
  poblacion: number;
  current?: Partial<TerritorialFrameMeta>;
  official?: Partial<TerritorialFrameMeta> & { available?: boolean };
  frame?: {
    current?: Partial<TerritorialFrameMeta>;
    official?: Partial<TerritorialFrameMeta> & { available?: boolean };
    active_source?: HojasRutaFrameSource;
  };
  age_data?: TerritorialAgeSimpleMeta;
  zone_cartography?: {
    ok: boolean;
    available: boolean;
    source: string;
    year: number;
    version: string;
    coverage: string;
    districts: number;
    zones: number;
    packaged_districts?: number;
    packaged_zones?: number;
    note?: string;
  };
  audit?: {
    ok: boolean;
    available: boolean;
    summary_path?: string;
    audit_path?: string;
    rows?: number;
    status_counts?: Record<string, number>;
    major_differences?: unknown[];
    message?: string;
  };
  block_cartography?: TerritorialBlockCartographyMeta;
  street_cartography?: StreetCartographyMeta;
  context_cartography?: ContextCartographyMeta;
  nse_data?: {
    ok: boolean;
    available: boolean;
    source?: string;
    message?: string;
    coverage?: string;
    matched_blocks?: number;
    input_points?: number;
    coverage_rate?: number;
    levels?: string[];
    callao_available?: boolean;
  };
  note: string;
  methods: { id: SamplingMethod; label: string; description: string }[];
};

export type StreetCartographyMeta = {
  ok: boolean;
  source: string;
  source_url: string;
  provider: string;
  provider_url: string;
  license: string;
  license_url: string;
  attribution: string;
  extraction_date: string | null;
  packaged_at: string | null;
  coverage: string;
  format: string;
  mode: string;
  packaged_districts: number;
  packaged_streets: number;
  checksum: string | null;
  manifest_path: string;
  note: string;
};

export type ContextCartographyMeta = {
  ok: boolean;
  source: string;
  source_url: string;
  provider: string;
  license: string;
  license_url: string;
  attribution: string;
  packaged_at: string | null;
  coverage: string;
  format: string;
  geometry: string;
  mode: string;
  packaged_districts: number;
  packaged_features: number;
  counts_by_class?: Record<string, number>;
  included_classes?: string[];
  checksum: string | null;
  manifest_path: string;
  curated_path?: string;
  note: string;
};

export type TerritorialBlockCartographyMeta = {
  ok: boolean;
  source: string;
  source_url: string;
  layer_url: string;
  query_url: string;
  year: number;
  years?: number[];
  provider: string;
  version: string;
  packaged_at: string | null;
  coverage: string;
  geometry: string;
  id_field: string;
  district_field: string;
  source_field: string;
  area_field: string;
  mode: string;
  manifest_path: string;
  checksum: string | null;
  packaged_districts?: number;
  packaged_blocks?: number;
  sources?: Record<string, TerritorialBlockCartographyMeta>;
  note: string;
};

export type HojasRutaStreetMapFeature = {
  type: "Feature";
  id?: string | number;
  geometry: {
    type: "LineString" | "MultiLineString";
    coordinates: number[][] | number[][][];
  } | null;
  properties: {
    id?: string;
    osm_id?: string | number;
    name?: string;
    display_name?: string;
    highway?: string;
    class_group?: "major" | "detail" | string;
    rank?: number;
    avenue_like?: boolean;
    ubigeo?: string;
  };
};

export type HojasRutaStreetMap = {
  ok: boolean;
  source: StreetCartographyMeta;
  ubigeo: string;
  count: number;
  returned: number;
  cache: boolean;
  geojson: {
    type: "FeatureCollection";
    properties?: Record<string, unknown>;
    features: HojasRutaStreetMapFeature[];
  };
  alerts: HojasRutaAlert[];
};

export type HojasRutaContextMapFeature = {
  type: "Feature";
  id?: string | number;
  geometry: {
    type: "Point" | "MultiPoint" | "LineString" | "MultiLineString" | "Polygon" | "MultiPolygon";
    coordinates: unknown;
  } | null;
  properties: {
    id?: string;
    osm_id?: string | number;
    name?: string;
    display_name?: string;
    feature_class?: "water" | "coast" | "waterway" | "green" | "square" | "public" | "transit" | "landmark" | string;
    kind?: string;
    rank?: number;
    area_m2?: number;
    length_m?: number;
    source_kind?: "osm" | "curated" | string;
    source?: string;
    source_url?: string;
    confidence?: string;
    aliases?: string[];
  };
};

export type HojasRutaContextMap = {
  ok: boolean;
  source: ContextCartographyMeta;
  ubigeo: string;
  count: number;
  returned: number;
  geojson: {
    type: "FeatureCollection";
    properties?: Record<string, unknown>;
    features: HojasRutaContextMapFeature[];
  };
  alerts: HojasRutaAlert[];
};

export type TerritorialAgeSimpleMeta = {
  ok: boolean;
  source: string;
  source_url: string;
  query_url: string;
  year: number;
  version: string;
  packaged_at: string | null;
  checksum: string | null;
  granularity: string;
  variable_edad: string;
  variable_sexo: string;
  min_age: number | null;
  max_age: number | null;
  n_ubigeos: number;
  rows: number;
  poblacion: number;
  poblacion_18_plus: number;
  path: string;
};

export type HojasRutaAgeSource = {
  type: string;
  label?: string;
  granularity?: string;
  variable_edad?: string;
  variable_sexo?: string;
  version?: string;
  reason?: string;
};

export type HojasRutaTerritory = {
  ubigeo: string;
  departamento: string;
  provincia: string;
  distrito: string;
  viviendas: number;
  poblacion: number;
  manzanas: number;
};

export type HojasRutaAlert = {
  level: "info" | "warn" | "error";
  code: string;
  message: string;
};

export type QuotaPlan = {
  ok: boolean;
  frame_meta: TerritorialFrameMeta;
  config: HojasRutaIntegratedConfig;
  n_objetivo: number;
  total_asignado: number;
  route_size?: number;
  route_multiple_ok?: boolean;
  age_source?: HojasRutaAgeSource;
  territories: HojasRutaTerritory[];
  cells: Record<string, string | number | null>[];
  table: Record<string, string | number | null>[];
  alerts: HojasRutaAlert[];
};

export type PopulationPlan = {
  ok: boolean;
  frame_meta: TerritorialFrameMeta;
  config: HojasRutaIntegratedConfig;
  total_poblacion: number;
  age_source?: HojasRutaAgeSource;
  territories: HojasRutaTerritory[];
  cells: Record<string, string | number | null>[];
  table: Record<string, string | number | null>[];
  alerts: HojasRutaAlert[];
};

export type HojasRutaSampleSizeDistrictRow = {
  ubigeo: string;
  distrito: string;
  poblacion: number;
  viviendas: number;
  n_recommended: number;
  n_min_district: number;
  n_used: number;
  margin_estimated: number | null;
  target_margin: number;
  sampling_fraction: number | null;
  design_effect: number;
  status: "ok" | "alerta" | "faltante";
  message: string;
};

export type HojasRutaSampleSizePreview = {
  ok: boolean;
  frame_meta: TerritorialFrameMeta;
  config: HojasRutaIntegratedConfig;
  sample_size: HojasRutaSampleSizeConfig;
  mode: SampleSizeMode;
  total_population: number;
  n_recommended: number;
  n_recommended_route?: number;
  n_total_min: number;
  n_total_min_raw?: number;
  n_district_floor: number;
  n_district_floor_raw?: number;
  route_size?: number;
  route_multiple_ok?: boolean;
  n_route_previous?: number;
  n_route_next?: number;
  allocation_mode: AllocationMode;
  enforce_district_floor: boolean;
  n_used: number;
  contacts_suggested: number;
  /** ADR 0116: la no respuesta suma visitas, no entrevistas. */
  visitas?: HojasRutaVisitas;
  design_effect_fuente?: HojasRutaDeffFuente;
  margen_incluye_conglomerado?: boolean;
  margin_total_estimated: number | null;
  margin_total_target: number;
  district_rows: HojasRutaSampleSizeDistrictRow[];
  alerts: HojasRutaAlert[];
};

export type HojasRutaPopulationExportResult = {
  ok: true;
  file_id: string;
  filename: string;
  size: number;
  total_poblacion: number;
  n_territorios: number;
  n_cells: number;
};

export type SelectedBlock = {
  id_manzana: string;
  departamento: string;
  provincia: string;
  distrito: string;
  ubigeo: string;
  zona: string;
  manzana: string;
  viviendas: number;
  poblacion: number;
  territorio_muestral: string;
  metodo: SamplingMethod;
  orden_seleccion: number;
  hoja_num?: number;
  rango_inicio?: number;
  rango_fin?: number;
  entrevistas: number;
  medida_tamano: number;
  lat: number | null;
  lon: number | null;
  tipo_manzana?: "titular" | "reemplazo" | string;
  replacement_policy?: string;
  replacement_order?: number;
  replacement_total?: number;
  titular_id_manzana?: string;
  titular_orden_seleccion?: number;
  titular_ubigeo?: string;
  titular_zona?: string;
  titular_hoja_num?: number;
  titular_rango_inicio?: number;
  titular_rango_fin?: number;
  replacement_label?: string;
  replacement_fallback?: boolean | string;
  esquina_codigo?: number;
  esquina_inicio?: string;
  esquina_coordenada?: string;
  sentido_recorrido?: string;
  vivienda_inicio?: number;
  domicilio_inicio?: number;
  constante_salto?: number;
  constante_salto_raw?: number;
  constante_salto_formula?: string;
  constante_salto_unidad?: string;
  constante_salto_modo?: HojasRutaRouteJumpMode | string;
  salto_operativo?: number;
  modo_seleccion_vivienda?: string;
  nse_codigo?: string | number | null;
  nse_nivel?: string | null;
  nse_match_method?: string | null;
  nse_distance_m?: number | null;
  nse_income_per_capita?: number | null;
  nse_personas?: number | null;
  nse_hogares?: number | null;
  nse_idmz18?: string | null;
};

export type HojasRutaSamplePreview = {
  ok: boolean;
  frame_meta: TerritorialFrameMeta;
  config: HojasRutaIntegratedConfig;
  quota: QuotaPlan;
  method: SamplingMethod;
  seed: number;
  blocks: SelectedBlock[];
  replacement_blocks: SelectedBlock[];
  n_blocks: number;
  n_replacement_blocks: number;
  total_entrevistas: number;
  total_replacement_interviews: number;
  unassigned: number;
  alerts: HojasRutaAlert[];
};

export type HojasRutaWorkspaceOutputs = {
  population?: PopulationPlan | null;
  sample_size_preview?: HojasRutaSampleSizePreview | null;
  quota?: QuotaPlan | null;
  sample?: HojasRutaSamplePreview | null;
};

export type HojasRutaPhase = "pilot" | "field";
export type HojasRutaPilotExclusionMode = "exclude_titulars" | "ignore";

export type HojasRutaRun = {
  config: HojasRutaIntegratedConfig;
  ui_state: HojasRutaUiState;
  workspace_outputs: HojasRutaWorkspaceOutputs;
  locked?: boolean;
  role: HojasRutaPhase;
  pilot_exclusion_mode?: HojasRutaPilotExclusionMode;
};

export type HojasRutaPhaseNotice = {
  kind: string;
  message?: string;
  migrated_at?: string;
  pilot_total_entrevistas?: number;
  pilot_titulars?: number;
};

export type HojasRutaRouteDistrictSummary = {
  ubigeo: string;
  distrito: string;
  n: number;
  manzanas: number;
  reemplazos: number;
};

export type HojasRutaRouteSnapshot = {
  id: string;
  label: string;
  created_at: string;
  seed: number;
  method: SamplingMethod;
  route_size: number;
  n_final: number;
  n_blocks: number;
  n_replacement_blocks: number;
  total_entrevistas: number;
  total_replacement_interviews: number;
  territories: string[];
  distribution: HojasRutaRouteDistrictSummary[];
  config: HojasRutaIntegratedConfig;
  sample: HojasRutaSamplePreview;
};

export type HojasRutaBlockMapFeature = {
  type: "Feature";
  id?: string | number;
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
  } | null;
  properties: {
    OBJECTID?: number;
    ID_MANZANA?: string;
    NOMBDIST?: string;
    NOMBPROV?: string;
    NOMBDEP?: string;
    FTE_MZNA?: string;
    AREA_M2?: number;
    ubigeo?: string;
    cartografia_id?: string;
    manzana_label?: string;
    fuente_anio?: number;
    inei_zona?: string;
    inei_manzana?: string;
    inei_id_manzana?: string;
    inei_viviendas?: number;
    inei_poblacion?: number;
    inei_pob_hombres?: number;
    inei_pob_mujeres?: number;
    inei_pob_18_plus?: number;
    inei_age_breakdown?: Record<string, number>;
    nse_codigo?: number | string | null;
    nse_nivel?: string | null;
    nse_match_method?: string | null;
    nse_distance_m?: number | null;
  };
};

export type HojasRutaZoneMapFeature = {
  type: "Feature";
  id?: string | number;
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][] | number[][][][][];
  } | null;
  properties: {
    id?: string;
    ubigeo?: string;
    departamento?: string;
    provincia?: string;
    distrito?: string;
    zona?: string;
    zona_label?: string;
    n_manzanas?: number;
    viviendas?: number;
    poblacion?: number;
  };
};

export type HojasRutaZoneMap = {
  ok: boolean;
  source: TerritorialBlockCartographyMeta;
  ubigeo: string;
  territory: {
    ubigeo: string;
    departamento: string | null;
    provincia: string | null;
    distrito: string | null;
  };
  count: number;
  returned: number;
  cache: boolean;
  geojson: {
    type: "FeatureCollection";
    properties?: Record<string, unknown>;
    features: HojasRutaZoneMapFeature[];
  };
  alerts: HojasRutaAlert[];
};

export type HojasRutaBlockMap = {
  ok: boolean;
  source: TerritorialBlockCartographyMeta;
  ubigeo: string;
  territory: {
    ubigeo: string;
    departamento: string | null;
    provincia: string | null;
    distrito: string | null;
  };
  count: number;
  returned: number;
  truncated: boolean;
  feature_limit: number;
  cache: boolean;
  geojson: {
    type: "FeatureCollection";
    properties?: Record<string, unknown>;
    features: HojasRutaBlockMapFeature[];
  };
  alerts: HojasRutaAlert[];
};

export type HojasRutaCampos = {
  ok: boolean;
  required: string[];
  present: string[];
  missing: string[];
  columns: HojasRutaFieldStatus[];
  invalid: HojasRutaIssue[];
  n_filas: number;
  n_columnas: number;
};

export type HojasRutaPreviewRow = {
  index: number;
  ump: string;
  idmanzana: string;
  ubigeo: string | null;
  cod_zona: string | null;
  cod_manzana: string | null;
  mapa: string | null;
  mapa_encontrado: boolean;
  mapa_path: string | null;
  filename: string;
  cuota: Record<string, string | number | null>[];
};

export type HojasRutaReporteDecisionalMeta = {
  disponible: boolean;
  generated_at?: string | null;
  formato?: "html" | "pdf" | null;
  job_id?: string | null;
};

export type HojasRutaState = {
  ok: boolean;
  has_data: boolean;
  cache_dir: string;
  config: HojasRutaConfig;
  integrated_config: HojasRutaIntegratedConfig;
  ui_state: HojasRutaUiState;
  workspace_outputs?: HojasRutaWorkspaceOutputs;
  runs?: Partial<Record<HojasRutaPhase, HojasRutaRun>>;
  active_phase?: HojasRutaPhase;
  phase_notice?: HojasRutaPhaseNotice | null;
  frame_meta: TerritorialFrameMeta;
  territories: HojasRutaTerritory[];
  campos: HojasRutaCampos | null;
  variables: HojasRutaVariable[];
  reporte_decisional?: HojasRutaReporteDecisionalMeta;
  reporte_decisional_listo_para_generar?: boolean;
};

export type HojasRutaWarmupTargets = {
  ok: boolean;
  frame_ok: boolean;
  has_data: boolean;
  active_phase?: HojasRutaPhase;
  ubigeos: string[];
  territories_count: number;
};

export type HojasRutaPreview = HojasRutaState & {
  config_issues: HojasRutaIssue[];
  n_umps: number;
  mapas_faltantes: number;
  rows: HojasRutaPreviewRow[];
};

export type HojasRutaJobResult = {
  ok: true;
  file_id: string;
  filename: string;
  size: number;
  n_pdfs: number;
  n_zone_pdfs?: number;
  n_blocks: number;
  n_replacement_blocks?: number;
  n_zones?: number;
  total_entrevistas: number;
  total_replacement_interviews?: number;
  frame_version: string;
  alerts: HojasRutaAlert[];
  mapas_faltantes: number;
};

export type HojasRutaWorkbookResult = {
  ok: true;
  file_id: string;
  filename: string;
  size: number;
  n_blocks: number;
  n_replacement_blocks: number;
  total_entrevistas: number;
  total_replacement_interviews?: number;
  frame_version: string;
  alerts: HojasRutaAlert[];
};

export type HojasRutaManualReplacementResult = {
  ok: true;
  file_id: string;
  filename: string;
  size: number;
  n_titulars: number;
  n_replacement_blocks: number;
  replacements_per_titular: number;
  replacement_blocks: SelectedBlock[];
  alerts: HojasRutaAlert[];
  frame_version: string;
};

export type HojasRutaRandomPdfResult = {
  ok: true;
  file_id: string;
  filename: string;
  size: number;
  distrito: string;
  ubigeo: string;
  zona: string;
  manzana: string;
  id_manzana: string;
  entrevistas: number;
  hoja_num: number;
  rango_inicio: number;
  rango_fin: number;
  frame_version: string;
  random_preference: HojasRutaRandomPreference;
  alerts: HojasRutaAlert[];
};

export async function apiHojasRutaState() {
  return handle<HojasRutaState>(
    await apiFetch("/api/hojas-ruta/state", { headers: headers() }),
  );
}

export async function apiHojasRutaWarmupTargets(options: { maxUbigeos?: number } = {}) {
  const params = new URLSearchParams();
  if (options.maxUbigeos != null) params.set("max_ubigeos", String(options.maxUbigeos));
  const qs = params.toString();
  return handle<HojasRutaWarmupTargets>(
    await apiFetch(`/api/hojas-ruta/warmup-targets${qs ? `?${qs}` : ""}`, { headers: headers() }),
  );
}

/**
 * Cuerpo de /api/hojas-ruta/workspace. Sin `outputs` la clave no viaja y el backend
 * conserva las salidas guardadas; antes viajaba `{}` y las borraba todas (revisión de
 * la fase 3 del lienzo, M1). Mandar `{}` explícito sigue limpiándolas a propósito.
 */
export function cuerpoPersistWorkspace(
  config: Partial<HojasRutaIntegratedConfig>,
  uiState: Partial<HojasRutaUiState>,
  outputs?: Partial<HojasRutaWorkspaceOutputs>,
  phase?: HojasRutaPhase,
  pilotExclusionMode?: HojasRutaPilotExclusionMode,
) {
  return {
    config,
    ui_state: uiState,
    ...(outputs !== undefined ? { workspace_outputs: outputs } : {}),
    ...(phase ? { phase } : {}),
    ...(pilotExclusionMode ? { pilot_exclusion_mode: pilotExclusionMode } : {}),
  };
}

export async function apiHojasRutaPersistWorkspace(
  config: Partial<HojasRutaIntegratedConfig>,
  uiState: Partial<HojasRutaUiState>,
  outputs?: Partial<HojasRutaWorkspaceOutputs>,
  phase?: HojasRutaPhase,
  pilotExclusionMode?: HojasRutaPilotExclusionMode,
) {
  return handle<{ ok: true; integrated_config: HojasRutaIntegratedConfig; ui_state: HojasRutaUiState; workspace_outputs?: HojasRutaWorkspaceOutputs; active_phase?: HojasRutaPhase; runs?: Partial<Record<HojasRutaPhase, HojasRutaRun>> }>(
    await apiFetch("/api/hojas-ruta/workspace", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(cuerpoPersistWorkspace(config, uiState, outputs, phase, pilotExclusionMode)),
    }),
  );
}

export async function apiHojasRutaSetPhase(phase: HojasRutaPhase) {
  return handle<HojasRutaState>(
    await apiFetch("/api/hojas-ruta/phase", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ phase }),
    }),
  );
}

export async function apiHojasRutaCreateFieldFromPilot(pilotExclusionMode: HojasRutaPilotExclusionMode = "exclude_titulars") {
  return handle<HojasRutaState>(
    await apiFetch("/api/hojas-ruta/field/from-pilot", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ pilot_exclusion_mode: pilotExclusionMode }),
    }),
  );
}

export async function apiHojasRutaSaveConfig(config: Partial<HojasRutaConfig>) {
  return handle<{ ok: true; config: HojasRutaConfig }>(
    await apiFetch("/api/hojas-ruta/config", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ config }),
    }),
  );
}

export async function apiHojasRutaPreview(config: Partial<HojasRutaConfig>) {
  return handle<HojasRutaPreview>(
    await apiFetch("/api/hojas-ruta/preview", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ config }),
    }),
  );
}

export async function apiHojasRutaQuotaPreview(config: Partial<HojasRutaIntegratedConfig>) {
  return handle<QuotaPlan>(
    await apiFetch("/api/hojas-ruta/quota-preview", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ config }),
    }),
  );
}

/**
 * Quién pide el cálculo. «restauracion» es el warm start o la hidratación que rehacen
 * salidas que faltan al abrir el proyecto: el servidor calcula igual pero no lo anota
 * en la bitácora, porque no es una decisión del usuario (U17, revisión de contratos).
 */
export type HojasRutaOrigenCalculo = "restauracion";

export async function apiHojasRutaPopulationPreview(config: Partial<HojasRutaIntegratedConfig>, origen?: HojasRutaOrigenCalculo) {
  return handle<PopulationPlan>(
    await apiFetch("/api/hojas-ruta/population-preview", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(origen ? { config, origen } : { config }),
    }),
  );
}

export async function apiHojasRutaPopulationExport(config: Partial<HojasRutaIntegratedConfig>) {
  return handle<HojasRutaPopulationExportResult>(
    await apiFetch("/api/hojas-ruta/population-export", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ config }),
    }),
  );
}

export async function apiHojasRutaSampleSizePreview(config: Partial<HojasRutaIntegratedConfig>, origen?: HojasRutaOrigenCalculo) {
  return handle<HojasRutaSampleSizePreview>(
    await apiFetch("/api/hojas-ruta/sample-size-preview", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(origen ? { config, origen } : { config }),
    }),
  );
}

export async function apiHojasRutaSamplePreview(config: Partial<HojasRutaIntegratedConfig>, origen?: HojasRutaOrigenCalculo) {
  return handle<HojasRutaSamplePreview>(
    await apiFetch("/api/hojas-ruta/sample-preview", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(origen ? { config, origen } : { config }),
    }),
  );
}

export async function apiHojasRutaRandomPdf(
  config: Partial<HojasRutaIntegratedConfig>,
  randomPreference: HojasRutaRandomPreference = "balanced",
) {
  return handle<HojasRutaRandomPdfResult>(
    await apiFetch("/api/hojas-ruta/random-pdf", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ config, random_preference: randomPreference }),
    }),
  );
}

export async function apiHojasRutaBlockMap(ubigeo: string, limit = 0, refresh = false, allowOnline = false) {
  const params = new URLSearchParams({ ubigeo, limit: String(limit) });
  if (refresh) params.set("refresh", "1");
  if (allowOnline) params.set("allow_online", "1");
  return handle<HojasRutaBlockMap>(
    await apiFetch(`/api/hojas-ruta/block-map?${params.toString()}`),
  );
}

export async function apiHojasRutaZoneMap(ubigeo: string) {
  const params = new URLSearchParams({ ubigeo });
  return handle<HojasRutaZoneMap>(
    await apiFetch(`/api/hojas-ruta/zone-map?${params.toString()}`),
  );
}

export async function apiHojasRutaStreetMap(ubigeo: string) {
  const params = new URLSearchParams({ ubigeo });
  return handle<HojasRutaStreetMap>(
    await apiFetch(`/api/hojas-ruta/street-map?${params.toString()}`),
  );
}

export async function apiHojasRutaContextMap(ubigeo: string) {
  const params = new URLSearchParams({ ubigeo });
  return handle<HojasRutaContextMap>(
    await apiFetch(`/api/hojas-ruta/context-map?${params.toString()}`),
  );
}

export async function apiHojasRutaGenerate(
  config: Partial<HojasRutaIntegratedConfig>,
  sample?: HojasRutaSamplePreview | null,
) {
  return handle<JobStart>(
    await apiFetch("/api/hojas-ruta/generate", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ config, sample }),
    }),
  );
}

export async function apiHojasRutaRouteWorkbook(
  config: Partial<HojasRutaIntegratedConfig>,
  sample?: HojasRutaSamplePreview | null,
) {
  return handle<HojasRutaWorkbookResult>(
    await apiFetch("/api/hojas-ruta/route-workbook", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ config, sample }),
    }),
  );
}

export async function apiHojasRutaManualReplacementsPdf(
  config: Partial<HojasRutaIntegratedConfig>,
  sample: HojasRutaSamplePreview,
  titularIds: string[],
  replacementsPerTitular: number,
) {
  return handle<JobStart>(
    await apiFetch("/api/hojas-ruta/manual-replacements-pdf", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        config,
        sample,
        titular_ids: titularIds,
        replacements_per_titular: replacementsPerTitular,
      }),
    }),
  );
}

export async function apiHojasRutaReporteDecisionalIniciar(
  formato: "html" | "pdf" = "html",
) {
  return handle<{ ok: true; job_id: string; formato: "html" | "pdf" }>(
    await apiFetch("/api/hojas-ruta/reporte-decisional", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ formato }),
    }),
  );
}

export function hojasRutaReporteDecisionalUrl(opts: { inline?: boolean } = {}): string {
  const sid = localStorage.getItem(SESSION_KEY);
  const params = new URLSearchParams();
  if (sid) params.set("sid", sid);
  if (opts.inline) params.set("inline", "1");
  const qs = params.toString();
  return apiPath(`/api/hojas-ruta/reporte-decisional/descargar${qs ? `?${qs}` : ""}`);
}

// ---------- Geometría compacta para el lienzo (ADR 0114 §7) ----------

/** Manzana: id, viviendas, zona, NSE (0 sin dato · 1 Alto … 5 Bajo) y anillos en metros (x1,y1,x2,y2…). */
export type HojasRutaGeometriaManzana = {
  id: string;
  viviendas: number;
  zona: string;
  nse: 0 | 1 | 2 | 3 | 4 | 5;
  anillos: number[][];
};

/** Vía mayor: rango 2 troncal o primaria, 1 secundaria; nombre vacío si no tiene. */
export type HojasRutaGeometriaVia = { rango: 1 | 2; nombre: string; lineas: number[][] };

export type HojasRutaGeometriaZona = { codigo: string; anillos: number[][] };

export type HojasRutaGeometria = {
  ok: boolean;
  version: string;
  ubigeo: string;
  nombre: string;
  /** [xmin, ymin, xmax, ymax] en metros. */
  bbox: [number, number, number, number];
  manzanas: HojasRutaGeometriaManzana[];
  vias: HojasRutaGeometriaVia[];
  zonas: HojasRutaGeometriaZona[];
};

const esArreglo = Array.isArray;
const comoNumero = (v: unknown, defecto = 0) => (typeof v === "number" && Number.isFinite(v) ? v : defecto);
const comoTexto = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
const anillosValidos = (v: unknown, minimo: number): number[][] =>
  esArreglo(v)
    ? v.filter((r): r is number[] => esArreglo(r) && r.length >= minimo && r.every((n) => typeof n === "number"))
    : [];

/**
 * Normaliza la respuesta cruda de `/api/hojas-ruta/geometria`. Descarta en
 * silencio sólo lo que no se puede dibujar (anillos con menos de tres puntos,
 * líneas con menos de dos); el resto llega con valores por defecto explícitos.
 */
export function normalizarGeometriaHojasRuta(raw: unknown): HojasRutaGeometria {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const bbox = esArreglo(o.bbox) && o.bbox.length === 4 ? (o.bbox.map((n) => comoNumero(n)) as [number, number, number, number]) : ([0, 0, 0, 0] as [number, number, number, number]);
  const manzanas = (esArreglo(o.manz) ? o.manz : []).flatMap((m): HojasRutaGeometriaManzana[] => {
    if (!esArreglo(m)) return [];
    const anillos = anillosValidos(m[4], 6);
    const nse = comoNumero(m[3]);
    if (!anillos.length) return [];
    return [{ id: comoTexto(m[0]), viviendas: Math.max(0, comoNumero(m[1])), zona: comoTexto(m[2]), nse: (nse >= 0 && nse <= 5 ? Math.round(nse) : 0) as HojasRutaGeometriaManzana["nse"], anillos }];
  });
  const vias = (esArreglo(o.calles) ? o.calles : []).flatMap((c): HojasRutaGeometriaVia[] => {
    if (!esArreglo(c)) return [];
    const lineas = anillosValidos(c[2], 4);
    return lineas.length ? [{ rango: comoNumero(c[0]) >= 2 ? 2 : 1, nombre: comoTexto(c[1]), lineas }] : [];
  });
  const zonas = (esArreglo(o.zonas) ? o.zonas : []).flatMap((z): HojasRutaGeometriaZona[] => {
    if (!esArreglo(z)) return [];
    const anillos = anillosValidos(z[1], 6);
    return anillos.length ? [{ codigo: comoTexto(z[0]), anillos }] : [];
  });
  return { ok: o.ok === true && manzanas.length > 0, version: comoTexto(o.version), ubigeo: comoTexto(o.ubigeo), nombre: comoTexto(o.nombre), bbox, manzanas, vias, zonas };
}

export async function apiHojasRutaGeometria(ubigeo: string): Promise<HojasRutaGeometria> {
  const params = new URLSearchParams({ ubigeo });
  return normalizarGeometriaHojasRuta(
    await handle<unknown>(await apiFetch(`/api/hojas-ruta/geometria?${params.toString()}`)),
  );
}

// ---------- Marco elegible (ADR 0115) ----------

export type HojasRutaMotivoExclusion = "inseguridad" | "no_residencial" | "inaccesible" | "otro";

export type HojasRutaAreaExcluida = {
  id: string;
  motivo: HojasRutaMotivoExclusion;
  detalle: string;
  /** Obligatorias con `inseguridad` e `inaccesible`. */
  fuente?: string;
  fecha_evidencia?: string;
  /** Anillo cerrado en lon/lat WGS84. */
  poligono: [number, number][];
  creada?: string;
};

export type HojasRutaMarcoElegible = { declarado: boolean; minimo_viviendas: number; areas_excluidas: HojasRutaAreaExcluida[] };

export type HojasRutaConteoMarco = { manzanas: number; viviendas: number; poblacion: number };

export type HojasRutaCoberturaMarco = {
  ubigeo: string;
  distrito: string;
  zona?: string;
  total: HojasRutaConteoMarco;
  elegible: HojasRutaConteoMarco;
  excluida_area: HojasRutaConteoMarco;
  excluida_minimo: HojasRutaConteoMarco;
  /** Titulares del piloto (Campo real), contadas aparte de los criterios del marco. */
  excluida_piloto: HojasRutaConteoMarco;
  excluida_minimo_sin_conteo: number;
  sin_geometria: number;
  /** `null` cuando el distrito o la zona no tienen población. */
  cobertura_poblacion: number | null;
};

export type HojasRutaCapacidadZona = { ubigeo: string; distrito: string; zona: string; rutas: number; manzanas: number; necesita: number; falta: "titulares" | "reemplazos" | null };

export type HojasRutaMarcoElegiblePreview = {
  ok: boolean;
  marco_elegible: HojasRutaMarcoElegible;
  por_distrito: HojasRutaCoberturaMarco[];
  por_zona: HojasRutaCoberturaMarco[];
  nse: { elegible: Record<string, number>; excluida: Record<string, number> };
  capacidad: HojasRutaCapacidadZona[];
  alerts: HojasRutaAlert[];
};

const MOTIVOS_EXCLUSION: readonly HojasRutaMotivoExclusion[] = ["inseguridad", "no_residencial", "inaccesible", "otro"];

function normalizarConteoMarco(raw: unknown): HojasRutaConteoMarco {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return { manzanas: Math.max(0, comoNumero(o.manzanas)), viviendas: Math.max(0, comoNumero(o.viviendas)), poblacion: Math.max(0, comoNumero(o.poblacion)) };
}

export function normalizarMarcoElegible(raw: unknown): HojasRutaMarcoElegible {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const areas = (esArreglo(o.areas_excluidas) ? o.areas_excluidas : []).flatMap((a): HojasRutaAreaExcluida[] => {
    const r = (a && typeof a === "object" ? a : {}) as Record<string, unknown>;
    const motivo = comoTexto(r.motivo) as HojasRutaMotivoExclusion;
    const poligono = (esArreglo(r.poligono) ? r.poligono : []).flatMap((p): [number, number][] => (esArreglo(p) && p.length >= 2 ? [[comoNumero(p[0]), comoNumero(p[1])]] : []));
    if (!MOTIVOS_EXCLUSION.includes(motivo) || poligono.length < 4) return [];
    return [{ id: comoTexto(r.id), motivo, detalle: comoTexto(r.detalle), fuente: comoTexto(r.fuente) || undefined, fecha_evidencia: comoTexto(r.fecha_evidencia) || undefined, poligono, creada: comoTexto(r.creada) || undefined }];
  });
  return { declarado: o.declarado === true, minimo_viviendas: Math.max(0, Math.round(comoNumero(o.minimo_viviendas))), areas_excluidas: areas };
}

export function normalizarMarcoElegiblePreview(raw: unknown): HojasRutaMarcoElegiblePreview {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const cobertura = (lista: unknown) =>
    // R puede mandarla como objeto con claves (una lista con nombres): se aceptan las dos formas.
    (esArreglo(lista) ? lista : lista && typeof lista === "object" ? Object.values(lista) : []).map((c): HojasRutaCoberturaMarco => {
      const r = (c && typeof c === "object" ? c : {}) as Record<string, unknown>;
      const cob = typeof r.cobertura_poblacion === "number" && Number.isFinite(r.cobertura_poblacion) ? r.cobertura_poblacion : null;
      return {
        ubigeo: comoTexto(r.ubigeo), distrito: comoTexto(r.distrito), zona: r.zona === undefined ? undefined : comoTexto(r.zona),
        total: normalizarConteoMarco(r.total), elegible: normalizarConteoMarco(r.elegible),
        excluida_area: normalizarConteoMarco(r.excluida_area), excluida_minimo: normalizarConteoMarco(r.excluida_minimo), excluida_piloto: normalizarConteoMarco(r.excluida_piloto),
        excluida_minimo_sin_conteo: Math.max(0, comoNumero(r.excluida_minimo_sin_conteo)), sin_geometria: Math.max(0, comoNumero(r.sin_geometria)),
        cobertura_poblacion: cob,
      };
    });
  const perfil = (x: unknown): Record<string, number> => Object.fromEntries(Object.entries((x && typeof x === "object" ? x : {}) as Record<string, unknown>).map(([k, v]) => [k, Math.max(0, comoNumero(esArreglo(v) ? v[0] : v))]));
  const nse = (o.nse && typeof o.nse === "object" ? o.nse : {}) as Record<string, unknown>;
  const capacidad = (esArreglo(o.capacidad) ? o.capacidad : []).map((c): HojasRutaCapacidadZona => {
    const r = (c && typeof c === "object" ? c : {}) as Record<string, unknown>;
    const falta = comoTexto(r.falta);
    return { ubigeo: comoTexto(r.ubigeo), distrito: comoTexto(r.distrito), zona: comoTexto(r.zona), rutas: comoNumero(r.rutas), manzanas: comoNumero(r.manzanas), necesita: comoNumero(r.necesita), falta: falta === "titulares" || falta === "reemplazos" ? falta : null };
  });
  return {
    ok: o.ok === true,
    marco_elegible: normalizarMarcoElegible(o.marco_elegible),
    por_distrito: cobertura(o.por_distrito),
    por_zona: cobertura(o.por_zona),
    nse: { elegible: perfil(nse.elegible), excluida: perfil(nse.excluida) },
    capacidad,
    alerts: (esArreglo(o.alerts) ? o.alerts : []) as HojasRutaAlert[],
  };
}

export async function apiHojasRutaMarcoElegiblePreview(config: Partial<HojasRutaIntegratedConfig>): Promise<HojasRutaMarcoElegiblePreview> {
  return normalizarMarcoElegiblePreview(
    await handle<unknown>(
      await apiFetch("/api/hojas-ruta/marco-elegible/preview", {
        method: "POST",
        headers: headers({ "Content-Type": "application/json" }),
        body: JSON.stringify({ config }),
      }),
    ),
  );
}

// ---------- No respuesta e ICC (ADR 0116) ----------

export type HojasRutaVisitas = {
  entrevistas_por_ruta: number;
  respuesta: number;
  ocupacion: number;
  por_ruta: number;
  tope_90: number;
  contactos_esperados: number;
  visitas_planificadas: number;
};

export type HojasRutaIccEntrada = {
  id: string;
  estudio?: string;
  indicador?: string;
  escala?: "proporcion" | "continua" | string;
  unidad_conglomerado?: string;
  definicion_conglomerado?: string;
  estimador?: string;
  icc: number;
  icc_ic95?: [number, number];
  m_medio?: number;
  conglomerados?: number;
  fecha?: string;
  fuente?: string;
  k_ruta?: number;
  deff_resultante?: number;
};

export type HojasRutaIccAplicable = { ok: boolean; motivo: string; avisos?: HojasRutaAlert[] };

function normalizarIccEntrada(raw: unknown): (HojasRutaIccEntrada & { aplicable: HojasRutaIccAplicable }) | null {
  const o = (raw && typeof raw === "object" ? raw : null) as Record<string, unknown> | null;
  if (!o || !comoTexto(o.id)) return null;
  const ap = (o.aplicable && typeof o.aplicable === "object" ? o.aplicable : {}) as Record<string, unknown>;
  const ic = esArreglo(o.icc_ic95) && o.icc_ic95.length === 2 ? ([comoNumero(o.icc_ic95[0]), comoNumero(o.icc_ic95[1])] as [number, number]) : undefined;
  return {
    id: comoTexto(o.id), estudio: comoTexto(o.estudio), indicador: comoTexto(o.indicador), escala: comoTexto(o.escala),
    unidad_conglomerado: comoTexto(o.unidad_conglomerado), definicion_conglomerado: comoTexto(o.definicion_conglomerado),
    estimador: comoTexto(o.estimador), icc: comoNumero(o.icc, Number.NaN), icc_ic95: ic,
    m_medio: comoNumero(o.m_medio, Number.NaN), conglomerados: comoNumero(o.conglomerados, Number.NaN),
    fecha: comoTexto(o.fecha), fuente: comoTexto(o.fuente),
    aplicable: { ok: ap.ok === true, motivo: comoTexto(ap.motivo), avisos: (esArreglo(ap.avisos) ? ap.avisos : []) as HojasRutaAlert[] },
  };
}

export async function apiHojasRutaIcc(): Promise<Array<HojasRutaIccEntrada & { aplicable: HojasRutaIccAplicable }>> {
  const r = await handle<{ entradas?: unknown }>(await apiFetch("/api/hojas-ruta/icc", { headers: headers() }));
  return (esArreglo(r?.entradas) ? r.entradas : []).flatMap((e) => normalizarIccEntrada(e) ?? []);
}

export async function apiHojasRutaIccGuardar(entrada: HojasRutaIccEntrada): Promise<HojasRutaIccAplicable> {
  const r = await handle<{ aplicable?: HojasRutaIccAplicable }>(
    await apiFetch("/api/hojas-ruta/icc", { method: "POST", headers: headers({ "Content-Type": "application/json" }), body: JSON.stringify({ entrada }) }),
  );
  return r.aplicable ?? { ok: false, motivo: "" };
}

/** Devuelve el `sample_size` con el DEFF recalculado; no guarda nada. */
export async function apiHojasRutaIccAplicar(config: Partial<HojasRutaIntegratedConfig>, id: string) {
  return handle<{ ok: boolean; sample_size: HojasRutaSampleSizeConfig; alerts: HojasRutaAlert[]; distritos_con_override: string[] }>(
    await apiFetch("/api/hojas-ruta/icc/aplicar", { method: "POST", headers: headers({ "Content-Type": "application/json" }), body: JSON.stringify({ config, id }) }),
  );
}

// ---------- Comparar semillas (U13) ----------

export type HojasRutaSemillaComparada = {
  semilla: number;
  actual: boolean;
  titulares: number;
  por_revisar: number;
  por_revisar_pct: number | null;
  mediana_viviendas: number | null;
  nse_distancia: number | null;
  cercania_km: number | null;
  sin_asignar: number;
};

const numONull = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function normalizarSemillasComparadas(raw: unknown): HojasRutaSemillaComparada[] {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return (esArreglo(o.semillas) ? o.semillas : []).flatMap((x): HojasRutaSemillaComparada[] => {
    const r = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
    const semilla = comoNumero(r.semilla, Number.NaN);
    if (!Number.isFinite(semilla)) return [];
    return [{
      semilla, actual: r.actual === true, titulares: comoNumero(r.titulares), por_revisar: comoNumero(r.por_revisar),
      por_revisar_pct: numONull(r.por_revisar_pct), mediana_viviendas: numONull(r.mediana_viviendas),
      nse_distancia: numONull(r.nse_distancia), cercania_km: numONull(r.cercania_km), sin_asignar: comoNumero(r.sin_asignar),
    }];
  });
}

/** Sorteos en seco con otras semillas; no guarda nada. */
export async function apiHojasRutaCompararSemillas(config: Partial<HojasRutaIntegratedConfig>, nuevas = 2): Promise<HojasRutaSemillaComparada[]> {
  return normalizarSemillasComparadas(
    await handle<unknown>(
      await apiFetch("/api/hojas-ruta/sample-preview/comparar", { method: "POST", headers: headers({ "Content-Type": "application/json" }), body: JSON.stringify({ config, nuevas }) }),
    ),
  );
}

// ---------- Plan de campo (U14) ----------

export type HojasRutaPlanSupuestos = {
  encuestadores: number;
  visitas_por_jornada: number;
  costo_por_entrevista: number;
  costo_por_jornada: number;
  costo_por_km: number;
  moneda: string;
};

export type HojasRutaJornada = {
  id: string; ubigeo: string; distrito: string; rutas: string[]; visitas: number; km: number;
  /** La ruta no cabe en una jornada: va entera, con el mismo encuestador varios días. */
  excede_jornada: boolean; jornadas_equivalentes: number;
};

export type HojasRutaPlanCampo = {
  supuestos: HojasRutaPlanSupuestos;
  jornadas: HojasRutaJornada[];
  resumen: { rutas: number; entrevistas: number; visitas: number; jornadas: number; dias: number; km: number; costo: number };
};

export const PLAN_SUPUESTOS_POR_DEFECTO: HojasRutaPlanSupuestos = { encuestadores: 4, visitas_por_jornada: 30, costo_por_entrevista: 0, costo_por_jornada: 0, costo_por_km: 0, moneda: "S/" };

export function normalizarPlanSupuestos(raw: unknown): HojasRutaPlanSupuestos {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const d = PLAN_SUPUESTOS_POR_DEFECTO;
  return {
    encuestadores: Math.max(1, Math.round(comoNumero(o.encuestadores, d.encuestadores))),
    visitas_por_jornada: Math.max(1, Math.round(comoNumero(o.visitas_por_jornada, d.visitas_por_jornada))),
    costo_por_entrevista: Math.max(0, comoNumero(o.costo_por_entrevista, 0)),
    costo_por_jornada: Math.max(0, comoNumero(o.costo_por_jornada, 0)),
    costo_por_km: Math.max(0, comoNumero(o.costo_por_km, 0)),
    moneda: comoTexto(o.moneda) || d.moneda,
  };
}

export function normalizarPlanCampo(raw: unknown): HojasRutaPlanCampo {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const r = (o.resumen && typeof o.resumen === "object" ? o.resumen : {}) as Record<string, unknown>;
  return {
    supuestos: normalizarPlanSupuestos(o.supuestos),
    jornadas: (esArreglo(o.jornadas) ? o.jornadas : []).map((j) => {
      const x = (j && typeof j === "object" ? j : {}) as Record<string, unknown>;
      return {
        id: comoTexto(x.id), ubigeo: comoTexto(x.ubigeo), distrito: comoTexto(x.distrito), rutas: (esArreglo(x.rutas) ? x.rutas : []).map(comoTexto), visitas: comoNumero(x.visitas), km: comoNumero(x.km),
        excede_jornada: x.excede_jornada === true, jornadas_equivalentes: Math.max(1, comoNumero(x.jornadas_equivalentes) || 1),
      };
    }),
    resumen: { rutas: comoNumero(r.rutas), entrevistas: comoNumero(r.entrevistas), visitas: comoNumero(r.visitas), jornadas: comoNumero(r.jornadas), dias: comoNumero(r.dias), km: comoNumero(r.km), costo: comoNumero(r.costo) },
  };
}

/** Arma el plan sobre la muestra guardada; no guarda nada. */
export async function apiHojasRutaPlanCampo(supuestos: HojasRutaPlanSupuestos): Promise<HojasRutaPlanCampo> {
  return normalizarPlanCampo(
    await handle<unknown>(await apiFetch("/api/hojas-ruta/plan-campo", { method: "POST", headers: headers({ "Content-Type": "application/json" }), body: JSON.stringify({ supuestos }) })),
  );
}

// ---------- Bitácora de decisiones (U17) ----------

export type HojasRutaBitacoraEntrada = { id: number; fecha: string; fase: string; accion: string; resumen: string; detalle: Record<string, unknown> };

export function normalizarBitacora(raw: unknown): HojasRutaBitacoraEntrada[] {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return (esArreglo(o.entradas) ? o.entradas : []).flatMap((e): HojasRutaBitacoraEntrada[] => {
    const x = (e && typeof e === "object" ? e : {}) as Record<string, unknown>;
    if (!comoTexto(x.resumen)) return [];
    return [{ id: comoNumero(x.id), fecha: comoTexto(x.fecha), fase: comoTexto(x.fase), accion: comoTexto(x.accion), resumen: comoTexto(x.resumen), detalle: (x.detalle && typeof x.detalle === "object" ? x.detalle : {}) as Record<string, unknown> }];
  });
}

export async function apiHojasRutaBitacora(): Promise<HojasRutaBitacoraEntrada[]> {
  return normalizarBitacora(await handle<unknown>(await apiFetch("/api/hojas-ruta/bitacora", { headers: headers() })));
}

/** Desde la interfaz sólo se anotan decisiones de cobertura (ADR 0115 §4) y notas. */
export async function apiHojasRutaBitacoraAnotar(accion: "decision_cobertura" | "nota", resumen: string, detalle: Record<string, unknown> = {}) {
  return handle<{ ok: boolean }>(
    await apiFetch("/api/hojas-ruta/bitacora", { method: "POST", headers: headers({ "Content-Type": "application/json" }), body: JSON.stringify({ accion, resumen, detalle }) }),
  );
}

// ---------- Decisión de cobertura (ADR 0115 §4, enmienda U17) ----------

export type HojasRutaDecisionCobertura = {
  fase: string;
  /** Distritos que pierden 10 % o más de su población con el marco elegible. */
  exigida: { ubigeo: string; distrito: string; excluida: number }[];
  huella: string;
  /** Id de la entrada de la bitácora que la cubre, o null si falta. */
  vigente: number | null;
};

export function normalizarDecisionCobertura(raw: unknown): HojasRutaDecisionCobertura {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const exigida = (Array.isArray(o.exigida) ? o.exigida : []).flatMap((x) => {
    const d = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
    const excluida = Number(d.excluida);
    return comoTexto(d.ubigeo) ? [{ ubigeo: comoTexto(d.ubigeo), distrito: comoTexto(d.distrito), excluida: Number.isFinite(excluida) ? excluida : 0 }] : [];
  });
  const v = Number(o.vigente);
  return { fase: comoTexto(o.fase) || "field", exigida, huella: comoTexto(o.huella), vigente: o.vigente == null || !Number.isFinite(v) ? null : v };
}

/** Estado de la decisión para el marco del run activo, según la muestra guardada. */
export async function apiHojasRutaDecisionCobertura() {
  return normalizarDecisionCobertura(await handle<unknown>(await apiFetch("/api/hojas-ruta/decision-cobertura", { headers: headers() })));
}

// ---------- Vista previa de la hoja y hoja del día (U15) ----------

export type HojasRutaArchivoGenerado = { file_id: string; filename: string; formato: "png" | "pdf" };

export function normalizarArchivo(raw: unknown, formatoPorDefecto: "png" | "pdf"): HojasRutaArchivoGenerado & Record<string, unknown> {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const f = comoTexto(o.formato);
  return { ...o, file_id: comoTexto(o.file_id), filename: comoTexto(o.filename), formato: f === "png" || f === "pdf" ? f : formatoPorDefecto };
}

/** La ficha de una UMP de la muestra guardada (titular o reemplazo); tarda unos segundos. */
export async function apiHojasRutaFichaUmp(idManzana: string, formato: "png" | "pdf" = "png") {
  return normalizarArchivo(
    await handle<unknown>(await apiFetch("/api/hojas-ruta/ficha-ump", { method: "POST", headers: headers({ "Content-Type": "application/json" }), body: JSON.stringify({ id_manzana: idManzana, formato }) })),
    formato,
  );
}

/** La hoja del día de una jornada del plan de campo, en PDF. */
export async function apiHojasRutaHojaDia(jornada: string, supuestos?: HojasRutaPlanSupuestos) {
  return normalizarArchivo(
    await handle<unknown>(await apiFetch("/api/hojas-ruta/hoja-dia", { method: "POST", headers: headers({ "Content-Type": "application/json" }), body: JSON.stringify({ jornada, ...(supuestos ? { supuestos } : {}) }) })),
    "pdf",
  );
}
