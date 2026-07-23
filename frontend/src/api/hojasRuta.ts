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
};

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
  random_preference?: HojasRutaRandomPreference;
};

export type HojasRutaUiStage = "territorio" | "poblacion" | "muestra" | "manzanas" | "entrega";

export type HojasRutaUiState = {
  active_stage: HojasRutaUiStage;
  draft_territories: string[];
  map_ubigeo: string;
  map_zona: string;
  map_level: "distritos" | "zonas" | "manzanas";
  map_selection_mode: boolean;
  route_history: HojasRutaRouteSnapshot[];
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
      body: JSON.stringify({
        config,
        ui_state: uiState,
        workspace_outputs: outputs ?? {},
        ...(phase ? { phase } : {}),
        ...(pilotExclusionMode ? { pilot_exclusion_mode: pilotExclusionMode } : {}),
      }),
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

export async function apiHojasRutaPopulationPreview(config: Partial<HojasRutaIntegratedConfig>) {
  return handle<PopulationPlan>(
    await apiFetch("/api/hojas-ruta/population-preview", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ config }),
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

export async function apiHojasRutaSampleSizePreview(config: Partial<HojasRutaIntegratedConfig>) {
  return handle<HojasRutaSampleSizePreview>(
    await apiFetch("/api/hojas-ruta/sample-size-preview", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ config }),
    }),
  );
}

export async function apiHojasRutaSamplePreview(config: Partial<HojasRutaIntegratedConfig>) {
  return handle<HojasRutaSamplePreview>(
    await apiFetch("/api/hojas-ruta/sample-preview", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ config }),
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
