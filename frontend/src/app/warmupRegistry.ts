import type {
  HojasRutaIntegratedConfig,
  HojasRutaPhase,
  HojasRutaRun,
  HojasRutaState,
  HojasRutaUiState,
  HojasRutaWorkspaceOutputs,
  JobSnapshot,
} from "../api/client";

export type WarmupModuleStatus = "pending" | "running" | "ready" | "error";

export type WarmupModuleEntry = {
  id: string;
  label: string;
  load: () => Promise<unknown>;
};

export type WarmupModuleProgress = {
  id: string;
  label: string;
  status: WarmupModuleStatus;
  elapsed_ms?: number;
  error?: string;
};

type WarmupApi = typeof import("../api/client");

const DEFAULT_WARMUP_TASK_TIMEOUT_MS = 18000;
const HOJAS_RUTA_CARTOGRAPHY_INITIAL_LIMIT = 8;
const COMPLETED_WARMUP_MODULES = new Set<string>();

const HOJAS_RUTA_STAGE_ORDER: Record<HojasRutaUiState["active_stage"], number> = {
  territorio: 0,
  poblacion: 1,
  muestra: 2,
  manzanas: 3,
  entrega: 4,
};

const HOJAS_RUTA_PHASES: HojasRutaPhase[] = ["pilot", "field"];
const HOJAS_RUTA_DETAILED_CARTOGRAPHY_WARMUP = false;
const MONITOREO_FULL_PROFILE_WARMUP_TIMEOUT_MS = 300000;
const MONITOREO_TERRITORIAL_PREWARM_TIMEOUT_MS = 220000;
const MONITOREO_TERRITORIAL_SCOPE_TIMEOUT_MS = 180000;
const MONITOREO_TERRITORIAL_MAP_TIMEOUT_MS = 120000;
const BACKEND_MONITOREO_READY_KEY = "pulso.backendMonitoreoWarmupReady";
const MONITOREO_TERRITORIAL_SCOPES = [
  "source",
  "route_summary",
  "advance_summary",
  "validation_summary",
  "queries_summary",
];
const MONITOREO_TERRITORIAL_PILOT_SCOPES = ["advance_summary"] as const;
const MONITOREO_TERRITORIAL_MAP_LAYERS = ["route_geometry", "gps_points"] as const;

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function backendMonitoreoWarmupReady() {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(BACKEND_MONITOREO_READY_KEY) === "1";
  } catch {
    return false;
  }
}

export function markBackendMonitoreoWarmupReady(ready: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (ready) window.sessionStorage.setItem(BACKEND_MONITOREO_READY_KEY, "1");
    else window.sessionStorage.removeItem(BACKEND_MONITOREO_READY_KEY);
  } catch {
    // sessionStorage can be unavailable in restricted contexts; warmup still works.
  }
}

function uniqueStrings(values: unknown[]) {
  return Array.from(new Set(values.map(cleanString).filter(Boolean)));
}

function territorialPhaseSourceExists(lightState: unknown, phase: "pilot" | "field") {
  const territorial = (lightState as { config?: { territorial?: Record<string, unknown> } }).config?.territorial;
  const source = (territorial?.phase_sources as Record<string, { source_id?: string; asset_uid?: string }> | undefined)?.[phase];
  return Boolean(cleanString(source?.source_id) || cleanString(source?.asset_uid));
}

function preferredTerritorialWarmupPhase(lightState: unknown): "pilot" | "field" {
  const territorial = (lightState as { config?: { territorial?: Record<string, unknown> } }).config?.territorial;
  const active = cleanString(
    (lightState as { active_route_phase?: string }).active_route_phase ??
    territorial?.active_route_phase,
  );
  const hasFieldSource = territorialPhaseSourceExists(lightState, "field");
  const hasPilotSource = territorialPhaseSourceExists(lightState, "pilot");
  const hasLegacySource = Boolean(cleanString(territorial?.source_id) || cleanString(territorial?.asset_uid));
  if (hasFieldSource || hasLegacySource) return "field";
  if (active === "pilot" && hasPilotSource && !hasFieldSource) return "pilot";
  return "field";
}

function valuesOfRecord<T>(value: Partial<Record<string, T>> | null | undefined): T[] {
  return value && typeof value === "object" ? Object.values(value).filter(Boolean) as T[] : [];
}

async function settleAllLimited<T>(
  items: T[],
  worker: (item: T) => Promise<unknown>,
  concurrency = 2,
) {
  const queue = [...items];
  const results: PromiseSettledResult<unknown>[] = [];
  const workers = Array.from({ length: Math.min(Math.max(1, concurrency), queue.length) }, async () => {
    while (queue.length) {
      const item = queue.shift();
      if (item == null) return;
      results.push(await Promise.resolve(worker(item)).then(
        (value): PromiseFulfilledResult<unknown> => ({ status: "fulfilled", value }),
        (reason): PromiseRejectedResult => ({ status: "rejected", reason }),
      ));
    }
  });
  await Promise.all(workers);
  return results;
}

function timeoutError(label: string, ms: number) {
  return new Error(`${label} no termino en ${Math.round(ms / 1000)}s`);
}

async function withTimeout<T>(label: string, promise: Promise<T>, ms = DEFAULT_WARMUP_TASK_TIMEOUT_MS): Promise<T> {
  let timer: number | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = window.setTimeout(() => reject(timeoutError(label, ms)), ms);
      }),
    ]);
  } finally {
    if (timer != null) window.clearTimeout(timer);
  }
}

function normalizeHojasRutaConfig(config: Partial<HojasRutaIntegratedConfig> | null | undefined) {
  if (!config) return null;
  return {
    ...config,
    n_mode: config.n_mode ?? "total",
    n_por_distrito: config.n_por_distrito ?? {},
    replacement_routes_per_district: config.replacement_routes_per_district ?? {},
    replacement_policy: config.replacement_policy ?? "paired_by_titular_zone",
    replacements_per_titular: config.replacements_per_titular ?? 1,
    age_range_mode: config.age_range_mode ?? "manual",
    age_range_scope: config.age_range_scope ?? "selected",
    zone_allocation: config.zone_allocation ?? "proportional",
    sample_size_mode: config.sample_size_mode ?? "calculator",
  };
}

function normalizeHojasRutaUiState(
  uiState: Partial<HojasRutaUiState> | null | undefined,
  fallbackTerritories: string[] = [],
): HojasRutaUiState {
  const activeStage = Object.prototype.hasOwnProperty.call(HOJAS_RUTA_STAGE_ORDER, uiState?.active_stage ?? "")
    ? uiState?.active_stage as HojasRutaUiState["active_stage"]
    : "territorio";
  const draft = Array.isArray(uiState?.draft_territories)
    ? uiState.draft_territories
    : fallbackTerritories;
  const mapUbigeo = cleanString(uiState?.map_ubigeo);
  const mapZona = cleanString(uiState?.map_zona);
  const mapLevel = ["distritos", "zonas", "manzanas"].includes(String(uiState?.map_level))
    ? uiState?.map_level as HojasRutaUiState["map_level"]
    : mapZona ? "manzanas" : mapUbigeo ? "zonas" : "distritos";
  return {
    active_stage: activeStage,
    draft_territories: uniqueStrings(draft),
    map_ubigeo: mapUbigeo,
    map_zona: mapZona,
    map_level: mapUbigeo ? mapLevel : "distritos",
    map_selection_mode: Boolean(uiState?.map_selection_mode),
    route_history: Array.isArray(uiState?.route_history) ? uiState.route_history : [],
  };
}

function hojasRutaRunPlans(state: HojasRutaState) {
  const plans: Array<{
    phase: HojasRutaPhase;
    config: Partial<HojasRutaIntegratedConfig>;
    uiState: HojasRutaUiState;
    outputs: HojasRutaWorkspaceOutputs;
  }> = [];
  const runs = state.runs ?? {};
  const pushPlan = (
    phase: HojasRutaPhase,
    run: HojasRutaRun | null | undefined,
    fallbackConfig: Partial<HojasRutaIntegratedConfig>,
    fallbackUiState: Partial<HojasRutaUiState>,
    fallbackOutputs: Partial<HojasRutaWorkspaceOutputs>,
  ) => {
    const config = normalizeHojasRutaConfig(run?.config ?? fallbackConfig);
    if (!config) return;
    const uiState = normalizeHojasRutaUiState(run?.ui_state ?? fallbackUiState, config.territorios ?? []);
    plans.push({
      phase,
      config,
      uiState,
      outputs: (run?.workspace_outputs ?? fallbackOutputs ?? {}) as HojasRutaWorkspaceOutputs,
    });
  };

  const activePhase = state.active_phase ?? "field";
  pushPlan(activePhase, runs[activePhase], state.integrated_config, state.ui_state, state.workspace_outputs ?? {});
  for (const phase of HOJAS_RUTA_PHASES) {
    if (phase === activePhase) continue;
    pushPlan(phase, runs[phase], state.integrated_config, state.ui_state, state.workspace_outputs ?? {});
  }
  const seen = new Set<string>();
  return plans.filter((plan) => {
    const key = `${plan.phase}:${JSON.stringify(plan.config)}:${plan.uiState.active_stage}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function hojasRutaUbigeos(state: HojasRutaState) {
  const plans = hojasRutaRunPlans(state);
  const fromRuns = plans.flatMap((plan) => [
    plan.uiState.map_ubigeo,
    ...plan.uiState.draft_territories,
    ...(plan.config.territorios ?? []),
    ...(plan.outputs.sample?.blocks ?? []).map((block) => block.ubigeo),
    ...(plan.outputs.sample?.replacement_blocks ?? []).map((block) => block.ubigeo),
  ]);
  const fromTerritories = (state.territories ?? []).map((territory) => (territory as { ubigeo?: string }).ubigeo);
  return uniqueStrings([...fromRuns, ...fromTerritories]);
}

async function warmupHojasRutaRunData(api: WarmupApi, plan: ReturnType<typeof hojasRutaRunPlans>[number]) {
  const territorios = plan.config.territorios ?? [];
  if (!territorios.length) return { phase: plan.phase, skipped: "sin territorios" };

  const depth = HOJAS_RUTA_STAGE_ORDER[plan.uiState.active_stage] ?? 0;
  const fullDepth = Math.max(depth, HOJAS_RUTA_STAGE_ORDER.entrega);
  let population = plan.outputs.population ?? null;
  let sampleSize = plan.outputs.sample_size_preview ?? null;
  let quota = plan.outputs.quota ?? null;
  let sample = plan.outputs.sample ?? null;

  if (!population && fullDepth >= HOJAS_RUTA_STAGE_ORDER.poblacion) {
    population = await api.apiHojasRutaPopulationPreview(plan.config).catch(() => null);
  }
  if (!sampleSize && fullDepth >= HOJAS_RUTA_STAGE_ORDER.muestra) {
    sampleSize = await api.apiHojasRutaSampleSizePreview(plan.config).catch(() => null);
  }
  if (!quota && fullDepth >= HOJAS_RUTA_STAGE_ORDER.manzanas && (sampleSize as { ok?: boolean } | null)?.ok) {
    quota = await api.apiHojasRutaQuotaPreview(plan.config).catch(() => null);
  }
  if (!sample && fullDepth >= HOJAS_RUTA_STAGE_ORDER.entrega && (quota as { ok?: boolean } | null)?.ok) {
    sample = await api.apiHojasRutaSamplePreview(plan.config).catch(() => null);
  }

  return {
    phase: plan.phase,
    population: Boolean(population),
    sample_size: Boolean(sampleSize),
    quota: Boolean(quota),
    sample: Boolean(sample),
  };
}

async function warmupHojasRutaLocalData() {
  const api = await import("../api/client");
  const state = await api.apiHojasRutaState();
  const plans = hojasRutaRunPlans(state);
  return withTimeout(
    "Hojas de ruta locales",
    settleAllLimited(plans, (plan) => warmupHojasRutaRunData(api, plan), 1),
    22000,
  );
}

async function warmupHojasRutaCartography() {
  if (!HOJAS_RUTA_DETAILED_CARTOGRAPHY_WARMUP) {
    return { skipped: "cartografia detallada centralizada en Monitoreo" };
  }
  const api = await import("../api/client");
  const { warmupTerritorialRouteCartography } = await import("../features/monitoreo/territorial/cartographyWarmup");
  const targets = await api.apiHojasRutaWarmupTargets({ maxUbigeos: HOJAS_RUTA_CARTOGRAPHY_INITIAL_LIMIT }).catch(() => null);
  const ubigeos = uniqueStrings(targets?.ubigeos ?? []).slice(0, HOJAS_RUTA_CARTOGRAPHY_INITIAL_LIMIT);
  if (!ubigeos.length) return { skipped: "sin ubigeos" };
  return withTimeout(
    "Rutas y mapas",
    warmupTerritorialRouteCartography(ubigeos),
    42000,
  );
}

async function waitForWarmupJob(api: WarmupApi, jobId: string, maxMs = 45000) {
  const startedAt = performance.now();
  let last: JobSnapshot | null = null;
  while (performance.now() - startedAt < maxMs) {
    last = await api.apiJobStatus(jobId);
    if (last.status === "done" || last.status === "error" || last.status === "cancelled") return last;
    await new Promise((resolve) => window.setTimeout(resolve, 900));
  }
  return last;
}

async function warmupMonitoreoLocalData() {
  const api = await import("../api/client");
  const { preloadMonitoreoFamily } = await import("../features/monitoreo/profiles/registry");
  const { monitoreoScopeCache } = await import("../features/monitoreo/core/reportScopeCache");
  const lightState = await api.apiMonitoreoState({ includeReports: false, warmupCache: true });
  const family = cleanString(
    (lightState as { monitoreo_profile?: { family?: string }; config?: { monitoreo_profile?: { family?: string } } }).monitoreo_profile?.family ??
    (lightState as { config?: { monitoreo_profile?: { family?: string } } }).config?.monitoreo_profile?.family,
  );
  const familyProfile = await preloadMonitoreoFamily(family);

  if (family === "territorial") {
    const backendReady = backendMonitoreoWarmupReady();
    const backendPhase = cleanString(
      (lightState as { config?: { territorial?: { active_route_phase?: string } }; active_route_phase?: string }).active_route_phase ??
      (lightState as { config?: { territorial?: { active_route_phase?: string } } }).config?.territorial?.active_route_phase,
    );
    const activePhase = preferredTerritorialWarmupPhase(lightState);
    if (activePhase !== backendPhase) {
      await api.apiMonitoreoTerritorialPhase(activePhase).catch(() => null);
    }
    const phases = uniqueStrings([activePhase]) as Array<"pilot" | "field">;

    const scopes = activePhase === "pilot"
      ? [...MONITOREO_TERRITORIAL_PILOT_SCOPES]
      : familyProfile?.warmupScopes?.length
      ? [...familyProfile.warmupScopes]
      : [...MONITOREO_TERRITORIAL_SCOPES];

    if (!backendReady) {
      await withTimeout("Monitoreo territorial", settleAllLimited(phases, async (phase) => {
        const job = await api.apiMonitoreoTerritorialPrewarm({ phase, scopes }).catch(() => null);
        if (job?.job_id) await waitForWarmupJob(api, job.job_id, MONITOREO_TERRITORIAL_PREWARM_TIMEOUT_MS).catch(() => null);
      }, 1), MONITOREO_TERRITORIAL_PREWARM_TIMEOUT_MS);
    }

    await withTimeout("Scopes de monitoreo", settleAllLimited(scopes, async (reportScope) => {
      const scopedState = await api.apiMonitoreoState({ includeReports: true, reportScope }).catch(() => null);
      if (scopedState) monitoreoScopeCache.putTerritorialState(scopedState);
    }, 1), MONITOREO_TERRITORIAL_SCOPE_TIMEOUT_MS);

    if (activePhase !== "pilot" && !backendReady) {
      await withTimeout("Mapas de monitoreo", settleAllLimited(phases, async (phase) => {
        await api.apiMonitoreoTerritorialMapPrepare({
          phase,
          layers: [...MONITOREO_TERRITORIAL_MAP_LAYERS],
          force: false,
        }).catch(() => null);
        await settleAllLimited([...MONITOREO_TERRITORIAL_MAP_LAYERS], async (layer) => {
          await api.apiMonitoreoTerritorialMap({ phase, layer, allowStale: true, prepare: true }).catch(() => null);
        }, 1);
      }, 1), MONITOREO_TERRITORIAL_MAP_TIMEOUT_MS);
    }
    return { family, profile: familyProfile?.chunk, phases, scopes };
  }

  if (family === "acreditacion") {
    const scopes = familyProfile?.warmupScopes?.length
      ? [...familyProfile.warmupScopes]
      : ["source", "advance_summary", "queries_summary", "phone_summary"];
    await withTimeout(
      "Monitoreo acreditación",
      settleAllLimited(scopes, async (reportScope) => {
        await api.apiMonitoreoState({ includeReports: true, reportScope, warmupCache: true }).catch(() => null);
      }, 1),
      MONITOREO_FULL_PROFILE_WARMUP_TIMEOUT_MS,
    );
    return { family, profile: familyProfile?.chunk, scopes };
  }

  if (family === "telefonico") {
    const scopes = familyProfile?.warmupScopes?.length
      ? [...familyProfile.warmupScopes]
      : ["source", "phone_summary"];
    await withTimeout(
      "Monitoreo telefónico",
      settleAllLimited(scopes, async (reportScope) => {
        await api.apiMonitoreoState({ includeReports: true, reportScope, warmupCache: true }).catch(() => null);
      }, 1),
      45000,
    );
    return { family, profile: familyProfile?.chunk, scopes };
  }

  if (family === "aulas_universitarias") {
    const scopes = familyProfile?.warmupScopes?.length
      ? [...familyProfile.warmupScopes]
      : ["source", "advance_summary", "validation_summary", "queries_summary"];
    await withTimeout(
      "Monitoreo de cursos-horario",
      settleAllLimited(scopes, async (reportScope) => {
        await api.apiMonitoreoState({ includeReports: true, reportScope, warmupCache: true }).catch(() => null);
      }, 1),
      32000,
    );
    return { family, profile: familyProfile?.chunk, scopes };
  }

  return { family: family || "sin perfil", profile: familyProfile?.chunk };
}

export function graficosWarmupScope(search: string): "active" | "consolidated" {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return params.get("scope") === "consolidado" ? "consolidated" : "active";
}

async function warmupGraficosLocalData() {
  const api = await import("../api/client");
  const scope = graficosWarmupScope(typeof window === "undefined" ? "" : window.location.search);
  return Promise.allSettled([
    api.apiGraficosRegistry(),
    api.apiGraficosPresetsMetadata(),
    api.apiGraficosTemplates(),
    api.apiGraficosConfigGet(),
    api.apiGraficosVariables(scope),
  ]);
}

async function warmupDashboardLocalData() {
  const api = await import("../api/client");
  return Promise.allSettled([
    api.apiDashboardManifest(),
    api.apiDashboardSourceGet(),
    api.apiDashboardConfigGet(),
  ]);
}

export const WARMUP_MODULES: WarmupModuleEntry[] = [
  {
    id: "home",
    label: "Inicio",
    load: () => import("../features/home/HomePage"),
  },
  {
    id: "procesamiento",
    label: "Procesamiento",
    load: () => import("../features/home/ProcesamientoEntry"),
  },
  {
    id: "carga",
    label: "Carga",
    load: () => import("../features/carga/CargaPage"),
  },
  {
    id: "validacion",
    label: "Validación",
    load: () => import("../features/validacion/ValidacionPage"),
  },
  {
    id: "codificacion",
    label: "Codificación",
    load: () => import("../features/codificacion/CodificacionPage"),
  },
  {
    id: "analitica",
    label: "Analítica",
    load: () => import("../features/analitica/AnaliticaPage"),
  },
  {
    id: "graficos",
    label: "Gráficos",
    load: () => import("../features/graficos/GraficosPage"),
  },
  {
    id: "graficos_datos",
    label: "Gráficos locales",
    load: warmupGraficosLocalData,
  },
  {
    id: "hojas_ruta",
    label: "Hojas de ruta",
    load: () => import("../features/hojasRuta/HojasRutaPage"),
  },
  {
    id: "hojas_ruta_datos",
    label: "Hojas de ruta locales",
    load: warmupHojasRutaLocalData,
  },
  {
    id: "hojas_ruta_cartografia",
    label: "Rutas y mapas",
    load: warmupHojasRutaCartography,
  },
  {
    id: "muestra",
    label: "Muestra",
    load: () => import("../features/muestra/MuestraHub"),
  },
  {
    id: "calc_muestra",
    label: "Cálculo de muestra",
    load: () => import("../features/calcMuestra/CalcMuestraPage"),
  },
  {
    id: "plan_trabajo",
    label: "Cronograma del proyecto",
    load: () => import("../features/bitacora/BitacoraPage"),
  },
  {
    id: "recopiladores",
    label: "Fichas QR",
    load: () => import("../features/recopiladores/RecopiladoresPage"),
  },
  {
    id: "monitoreo",
    label: "Monitoreo",
    load: () => import("../features/monitoreo/MonitoreoShell"),
  },
  {
    id: "monitoreo_datos",
    label: "Monitoreo local",
    load: warmupMonitoreoLocalData,
  },
  {
    id: "dashboard",
    label: "Dashboard",
    load: () => import("../features/dashboard/DashboardPage"),
  },
  {
    id: "dashboard_datos",
    label: "Dashboard local",
    load: warmupDashboardLocalData,
  },
  {
    id: "editor_xlsform",
    label: "Editor de formularios",
    load: () => import("../features/xlsformEditor/XlsformEditorPage"),
  },
  {
    id: "enciclopedia",
    label: "Enciclopedia",
    load: () => Promise.all([
      import("../features/enciclopedia/EnciclopediaHome"),
      import("../features/enciclopedia/FichaMetodologica"),
    ]),
  },
  {
    id: "diseno_estudio",
    label: "Bitácora",
    load: () => import("../features/bitacora/BitacoraPage"),
  },
  {
    id: "plotly",
    label: "Motor de gráficos",
    load: () => import("plotly.js-dist-min"),
  },
  {
    id: "html_to_image",
    label: "Exportación visual",
    load: () => Promise.all([
      import("html-to-image"),
      import("../features/dashboard/shared/FullscreenWrapper"),
    ]),
  },
];

export function warmupModuleIds(): string[] {
  return WARMUP_MODULES.map((entry) => entry.id);
}

export function markWarmupModulesComplete(ids: string[]) {
  for (const id of ids) {
    if (id) COMPLETED_WARMUP_MODULES.add(id);
  }
}

export function resetWarmupModulesComplete() {
  COMPLETED_WARMUP_MODULES.clear();
}

export function warmupModulesComplete(ids: string[]) {
  return ids.length > 0 && ids.every((id) => COMPLETED_WARMUP_MODULES.has(id));
}

export async function warmupFrontendModules(
  onProgress?: (progress: WarmupModuleProgress) => void,
  options: { concurrency?: number; moduleIds?: string[]; taskTimeoutMs?: number } = {},
) {
  const concurrency = Math.max(1, Math.min(4, Math.floor(options.concurrency ?? 2)));
  const allowedIds = options.moduleIds?.length ? new Set(options.moduleIds) : null;
  const queue = allowedIds
    ? WARMUP_MODULES.filter((entry) => allowedIds.has(entry.id))
    : [...WARMUP_MODULES];
  const results: WarmupModuleProgress[] = [];

  async function worker() {
    while (queue.length) {
      const entry = queue.shift();
      if (!entry) return;
      const startedAt = performance.now();
      onProgress?.({ id: entry.id, label: entry.label, status: "running" });
      try {
        await withTimeout(entry.label, entry.load(), options.taskTimeoutMs ?? DEFAULT_WARMUP_TASK_TIMEOUT_MS);
        const item = {
          id: entry.id,
          label: entry.label,
          status: "ready" as const,
          elapsed_ms: Math.max(0, Math.round(performance.now() - startedAt)),
        };
        results.push(item);
        onProgress?.(item);
      } catch (error) {
        const item = {
          id: entry.id,
          label: entry.label,
          status: "error" as const,
          elapsed_ms: Math.max(0, Math.round(performance.now() - startedAt)),
          error: error instanceof Error ? error.message : String(error),
        };
        results.push(item);
        onProgress?.(item);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, () => worker()));
  markWarmupModulesComplete(results.map((item) => item.id));
  return results;
}
