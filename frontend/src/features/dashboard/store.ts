import { useEffect, useRef } from "react";
import { create } from "zustand";
import {
  apiDashboardConfigGet,
  apiDashboardConfigPut,
  DashboardConfig,
  DashboardFodaViewConfig,
  DashboardFiltro,
  DashboardLogoConfig,
  DashboardTabId,
  DashboardVarMode,
  DashboardVarOverride,
} from "../../api/client";

// Máximo de logos en el header. Tres es el número práctico que cabe sin
// apretar el título y que sirve a la mayoría de los reportes (logo
// principal + cliente + auspiciador).
export const MAX_DASHBOARD_LOGOS = 3;

// Vistas virtuales del FODA — no son cruces reales ni se editan en
// Personalizar; viven solo del lado del switch del visualizador y se
// preservan al rehidratar (sin esto, el sanitizer las pisa con "conductores").
export const VIRTUAL_FODA_VIEWS = new Set<string>(["lectura"]);
export const DEFAULT_TABS_ENABLED: Record<DashboardTabId, boolean> = {
  resumen: true,
  relaciones: true,
  base_datos: true,
  dimensiones: true,
};

// Store del Dashboard. Patrón mismo que features/analitica/store.ts:
// hidrata desde backend al montar, autosave debounced 2s, setters
// granulares marcan dirty.
//
// Distinción clave (vs el WIP descartado):
//   - `config` = twitches ESTÉTICOS persistidos (logo, paleta, título,
//     subtítulo, color override, notas). NO twitches estructurales.
//   - `filtros` y `seccionActiva` = estado de exploración de la sesión.
//     NO se persiste — es local al render.

// jsonlite (server) serializa R `NULL` dentro de listas como `[]`. Tras
// hidratar desde backend, normalizamos los campos nullables: cualquier
// valor que no sea string no-vacío → null. Evita que `[] || ...` truthy
// rompa derivaciones aguas abajo (ej. theme).
export function sanitizeConfig(c: DashboardConfig): DashboardConfig {
  const str = (v: unknown) =>
    typeof v === "string" && v.length > 0 ? v : null;
  const num = (v: unknown, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) ? v : fallback;
  const paletasListas =
    c.paletas_listas && typeof c.paletas_listas === "object" && !Array.isArray(c.paletas_listas)
      ? c.paletas_listas
      : {};
  // Defaults 60-100: rango útil cuando los puntajes están en porcentaje
  // (escala típica del FODA). Antes era 0-120 que dejaba mucho aire vacío
  // arriba y abajo cuando todos los items caían en 60-100.
  const fodaScoreMin = Math.max(0, Math.min(95, num(c.foda_score_min, 60)));
  const fodaScoreMax = Math.max(fodaScoreMin + 5, Math.min(140, num(c.foda_score_max, 100)));
  const fodaSpacing = Math.max(0.7, Math.min(1.8, num(c.foda_spacing, 1.15)));
  const fodaGridIntensity = Math.max(0, Math.min(1, num(c.foda_grid_intensity, 0.42)));
  const recordOfRecords = (v: unknown): Record<string, Record<string, string>> => {
    if (!v || typeof v !== "object" || Array.isArray(v)) return {};
    const out: Record<string, Record<string, string>> = {};
    for (const [key, value] of Object.entries(v)) {
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      const inner: Record<string, string> = {};
      for (const [k, val] of Object.entries(value)) {
        if (typeof val === "string" && val.length > 0) inner[k] = val;
      }
      if (Object.keys(inner).length) out[key] = inner;
    }
    return out;
  };
  const recordOfStrings = (v: unknown): Record<string, string> => {
    if (!v || typeof v !== "object" || Array.isArray(v)) return {};
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(v)) {
      if (typeof value === "string" && value.length > 0) out[key] = value;
    }
    return out;
  };
  const sanitizeFodaView = (view: unknown, fallbackIndex: number): DashboardFodaViewConfig | null => {
    if (!view || typeof view !== "object" || Array.isArray(view)) return null;
    const v = view as Record<string, unknown>;
    const id = typeof v.id === "string" && v.id.trim() ? slugifyFodaId(v.id) : `vista_${fallbackIndex + 1}`;
    const label = typeof v.label === "string" && v.label.trim() ? v.label.trim() : titleFromFodaId(id);
    const variable = typeof v.variable === "string" ? v.variable.trim() : "";
    const metric = typeof v.metric_var === "string" ? v.metric_var.trim() : "";
    const cardMode = v.card_mode === "alias" ? "alias" : "iconos";
    return {
      id,
      label,
      variable,
      metric_var: metric,
      card_mode: cardMode,
      aliases: recordOfStrings(v.aliases),
      icons: recordOfStrings(v.icons),
    };
  };
  const incomingViews = Array.isArray(c.foda_views)
    ? c.foda_views
        .map((view, index) => sanitizeFodaView(view, index))
        .filter((view): view is DashboardFodaViewConfig => Boolean(view))
    : [];
  const legacyAliases = {
    ...DEFAULT_FODA_ALIASES,
    ...recordOfRecords(c.foda_aliases),
  };
  const legacyServiceIcons = recordOfStrings(c.foda_service_icons);
  const mergedViews = mergeDefaultFodaViews(incomingViews, legacyAliases, legacyServiceIcons);
  const fodaVistaRaw = typeof c.foda_vista === "string" && c.foda_vista.trim()
    ? slugifyFodaId(c.foda_vista)
    : "conductores";
  // "lectura" es una vista virtual (pedagógica, no es un cruce real ni
  // se persiste como vista editable). El usuario puede activarla desde
  // el switch del FODA y queremos preservarla al rehidratar.
  const isVirtualVista = VIRTUAL_FODA_VIEWS.has(fodaVistaRaw);
  const fodaVista = isVirtualVista || mergedViews.some((view) => view.id === fodaVistaRaw)
    ? fodaVistaRaw
    : "conductores";
  // Logos: si el array nuevo viene poblado, gana. Si está vacío y hay
  // `logo_data_uri` legacy, lo migramos al primer slot. Limitamos a
  // MAX_DASHBOARD_LOGOS y filtramos slots inválidos (sin data URI).
  const incomingLogos = Array.isArray(c.logos) ? c.logos : [];
  const sanitizedLogos: DashboardLogoConfig[] = incomingLogos
    .filter(
      (l): l is DashboardLogoConfig =>
        !!l && typeof l === "object" && typeof (l as DashboardLogoConfig).data_uri === "string" && (l as DashboardLogoConfig).data_uri.length > 0,
    )
    .slice(0, MAX_DASHBOARD_LOGOS)
    .map((l) => ({ data_uri: l.data_uri, alt: typeof l.alt === "string" ? l.alt : "" }));
  const logoLegacy = str(c.logo_data_uri);
  const logos: DashboardLogoConfig[] =
    sanitizedLogos.length > 0
      ? sanitizedLogos
      : logoLegacy
        ? [{ data_uri: logoLegacy, alt: typeof c.logo_alt === "string" ? c.logo_alt : "" }]
        : [];
  // Tabs habilitadas: cualquier valor distinto a `false` se considera true
  // (defaults). Restringe a las claves conocidas.
  const tabsEnabledIn =
    c.tabs_enabled && typeof c.tabs_enabled === "object" && !Array.isArray(c.tabs_enabled)
      ? c.tabs_enabled
      : {};
  const tabsEnabled: Record<DashboardTabId, boolean> = { ...DEFAULT_TABS_ENABLED };
  for (const k of Object.keys(DEFAULT_TABS_ENABLED) as DashboardTabId[]) {
    if (typeof tabsEnabledIn[k] === "boolean") tabsEnabled[k] = tabsEnabledIn[k] as boolean;
  }
  // dashboard_var_modes — sanitiza modos válidos por variable.
  const varModesIn =
    c.dashboard_var_modes && typeof c.dashboard_var_modes === "object" && !Array.isArray(c.dashboard_var_modes)
      ? c.dashboard_var_modes
      : {};
  const varModes: Record<string, DashboardVarMode> = {};
  for (const [varName, raw] of Object.entries(varModesIn)) {
    if (!raw || typeof raw !== "object") continue;
    const m = (raw as DashboardVarMode).modo;
    // Solo "original" o "recod". El antiguo "ambas" se mapea a "original"
    // (el comportamiento más conservador: mostrar la versión del XLSForm).
    const cleanModo: DashboardVarMode["modo"] = m === "recod" ? "recod" : "original";
    varModes[varName] = { modo: cleanModo };
  }
  // dashboard_var_overrides — sanitiza enabled (bool) y label (string).
  const overridesIn =
    c.dashboard_var_overrides && typeof c.dashboard_var_overrides === "object" && !Array.isArray(c.dashboard_var_overrides)
      ? c.dashboard_var_overrides
      : {};
  const varOverrides: Record<string, DashboardVarOverride> = {};
  for (const [varName, raw] of Object.entries(overridesIn)) {
    if (!raw || typeof raw !== "object") continue;
    const enabled = typeof (raw as DashboardVarOverride).enabled === "boolean"
      ? (raw as DashboardVarOverride).enabled
      : true;
    const label = typeof (raw as DashboardVarOverride).label === "string"
      ? (raw as DashboardVarOverride).label
      : "";
    varOverrides[varName] = { enabled, label };
  }
  return {
    ...c,
    titulo: typeof c.titulo === "string" ? c.titulo : "Dashboard",
    subtitulo: typeof c.subtitulo === "string" ? c.subtitulo : "",
    logos,
    logo_data_uri: logos[0]?.data_uri ?? null,
    logo_alt: logos[0]?.alt ?? "",
    logo_height_px: num(c.logo_height_px, 36),
    tabs_enabled: tabsEnabled,
    dashboard_var_modes: varModes,
    dashboard_var_overrides: varOverrides,
    bar_decimals: Math.max(0, Math.min(2, Math.round(num(c.bar_decimals, 0)))),
    sm_order: c.sm_order === "desc" ? "desc" : "questionnaire",
    paleta_id: str(c.paleta_id),
    paletas_listas: paletasListas,
    color_primario_override: str(c.color_primario_override),
    notas: typeof c.notas === "string" ? c.notas : "",
    semaforo_modo: c.semaforo_modo === "gradiente" ? "gradiente" : "cortes",
    semaforo_red_color: typeof c.semaforo_red_color === "string" && c.semaforo_red_color.length > 0
      ? c.semaforo_red_color
      : "#D84B55",
    semaforo_amber_color: typeof c.semaforo_amber_color === "string" && c.semaforo_amber_color.length > 0
      ? c.semaforo_amber_color
      : "#E0B44C",
    semaforo_green_color: typeof c.semaforo_green_color === "string" && c.semaforo_green_color.length > 0
      ? c.semaforo_green_color
      : "#3A9A5B",
    semaforo_red_max: Math.max(5, Math.min(95, num(c.semaforo_red_max, 60))),
    semaforo_amber_max: Math.max(
      Math.max(5, Math.min(95, num(c.semaforo_red_max, 60))) + 1,
      Math.min(99, num(c.semaforo_amber_max, 80)),
    ),
    semaforo_stops_extra: Array.isArray(c.semaforo_stops_extra)
      ? c.semaforo_stops_extra
          .filter(
            (s): s is { value: number; color: string } =>
              !!s && typeof s === "object" && typeof s.value === "number" && typeof s.color === "string",
          )
          .map((s) => ({
            value: Math.max(0, Math.min(100, s.value)),
            color: s.color,
          }))
          .sort((a, b) => a.value - b.value)
      : [],
    radar_min: Math.max(0, Math.min(95, num(c.radar_min, 0))),
    radar_max: Math.max(
      Math.max(0, Math.min(95, num(c.radar_min, 0))) + 5,
      Math.min(200, num(c.radar_max, 100)),
    ),
    radar_gridshape: c.radar_gridshape === "circular" ? "circular" : "linear",
    radar_modo: c.radar_modo === "facet" || c.radar_modo === "alternante" ? c.radar_modo : "uno",
    radar_animado: typeof c.radar_animado === "boolean" ? c.radar_animado : true,
    barras_orientacion:
      c.barras_orientacion === "vertical" || c.barras_orientacion === "facet"
        ? c.barras_orientacion
        : "horizontal",
    barras_x_min: Math.max(0, Math.min(90, num(c.barras_x_min, 0))),
    barras_x_max: Math.max(
      Math.max(0, Math.min(90, num(c.barras_x_min, 0))) + 10,
      Math.min(200, num(c.barras_x_max, 100)),
    ),
    foda_iconos_enabled: typeof c.foda_iconos_enabled === "boolean" ? c.foda_iconos_enabled : true,
    foda_icon_tint: typeof c.foda_icon_tint === "string" && c.foda_icon_tint.length > 0
      ? c.foda_icon_tint
      : "#FFFFFF",
    foda_icon_size: Math.max(0.5, Math.min(1.8, num(c.foda_icon_size, 1))),
    foda_icon_legend: typeof c.foda_icon_legend === "boolean" ? c.foda_icon_legend : true,
    foda_score_min: fodaScoreMin,
    foda_score_max: fodaScoreMax,
    foda_show_total: typeof c.foda_show_total === "boolean" ? c.foda_show_total : true,
    foda_spacing: fodaSpacing,
    foda_grid_intensity: fodaGridIntensity,
    foda_vista: fodaVista,
    foda_views: mergedViews,
    foda_aliases: legacyAliases,
    foda_service_icons: legacyServiceIcons,
    dim_desglose_layout: c.dim_desglose_layout === "apilado" ? "apilado" : "paginado",
    matriz_var_color: typeof c.matriz_var_color === "string" ? c.matriz_var_color : "",
    matriz_var_nombre: typeof c.matriz_var_nombre === "string" ? c.matriz_var_nombre : "",
    dim_axis_icons: recordOfStrings(c.dim_axis_icons),
  };
}

export const DEFAULT_FODA_ALIASES: Record<string, Record<string, string>> = {
  distrito: {
    Ate: "ATE",
    Rimac: "RIM",
    "San Juan de Lurigancho": "SJL",
    "Villa El Salvador": "VES",
    "La Esperanza": "LE",
    "El Porvenir": "EP",
  },
};

export const DEFAULT_FODA_SERVICE_CATEGORIES = ["ULE", "CIAM", "DEMUNA", "OMAPED", "UPSEP"];

export const DEFAULT_FODA_VIEWS: DashboardFodaViewConfig[] = [
  {
    id: "conductores",
    label: "Conductores",
    variable: "",
    metric_var: "",
    card_mode: "iconos",
    aliases: {},
    icons: {},
  },
  {
    id: "servicios",
    label: "Servicios",
    variable: "servicio",
    metric_var: "idx_indice_general",
    card_mode: "iconos",
    aliases: {},
    icons: {},
  },
  {
    id: "municipios",
    label: "Municipios",
    variable: "distrito",
    metric_var: "idx_indice_general",
    card_mode: "alias",
    aliases: DEFAULT_FODA_ALIASES.distrito,
    icons: {},
  },
];

function slugifyFodaId(value: string): string {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug || "vista";
}

function titleFromFodaId(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function uniqueFodaId(base: string, views: DashboardFodaViewConfig[]) {
  const root = slugifyFodaId(base);
  const used = new Set(views.map((view) => view.id));
  if (!used.has(root)) return root;
  let i = 2;
  while (used.has(`${root}_${i}`)) i += 1;
  return `${root}_${i}`;
}

function mergeDefaultFodaViews(
  incoming: DashboardFodaViewConfig[],
  aliases: Record<string, Record<string, string>>,
  serviceIcons: Record<string, string>,
): DashboardFodaViewConfig[] {
  const byId = new Map<string, DashboardFodaViewConfig>();
  for (const view of DEFAULT_FODA_VIEWS) {
    byId.set(view.id, { ...view, aliases: { ...(view.aliases ?? {}) }, icons: { ...(view.icons ?? {}) } });
  }
  for (const view of incoming) {
    byId.set(view.id, {
      ...view,
      aliases: { ...(view.aliases ?? {}) },
      icons: { ...(view.icons ?? {}) },
    });
  }
  const servicios = byId.get("servicios");
  if (servicios) {
    servicios.icons = { ...serviceIcons, ...(servicios.icons ?? {}) };
  }
  for (const view of byId.values()) {
    if (view.variable && aliases[view.variable]) {
      view.aliases = { ...aliases[view.variable], ...(view.aliases ?? {}) };
    }
  }
  return [...byId.values()];
}

export const DEFAULT_DASHBOARD_CONFIG: DashboardConfig = {
  titulo: "Dashboard",
  subtitulo: "",
  logos: [],
  tabs_enabled: { ...DEFAULT_TABS_ENABLED },
  dashboard_var_modes: {},
  dashboard_var_overrides: {},
  bar_decimals: 0,
  sm_order: "questionnaire",
  logo_data_uri: null,
  logo_alt: "",
  logo_height_px: 36,
  paleta_id: null,
  paletas_listas: {},
  color_primario_override: null,
  notas: "",
  semaforo_modo: "cortes",
  semaforo_red_color: "#D84B55",
  semaforo_amber_color: "#E0B44C",
  semaforo_green_color: "#3A9A5B",
  semaforo_red_max: 60,
  semaforo_amber_max: 80,
  semaforo_stops_extra: [],
  radar_min: 0,
  radar_max: 100,
  radar_gridshape: "linear",
  radar_modo: "uno",
  radar_animado: true,
  barras_orientacion: "horizontal",
  barras_x_min: 0,
  barras_x_max: 100,
  foda_iconos_enabled: true,
  foda_icon_tint: "#FFFFFF",
  foda_icon_size: 1,
  foda_icon_legend: true,
  foda_score_min: 60,
  foda_score_max: 100,
  foda_show_total: true,
  foda_spacing: 1.15,
  foda_grid_intensity: 0.42,
  foda_vista: "conductores",
  foda_views: DEFAULT_FODA_VIEWS,
  foda_aliases: DEFAULT_FODA_ALIASES,
  foda_service_icons: {},
  dim_desglose_layout: "paginado",
  matriz_var_color: "",
  matriz_var_nombre: "",
  dim_axis_icons: {},
};

// Estado de exploración para Relaciones (no persistido).
export type DashboardRelacionState = {
  varPrincipal: string;
  varSegmento: string;
  iterarVar: string;
  iterarOn: boolean;
  filtrosOn: boolean;
};

const DEFAULT_RELACION_STATE: DashboardRelacionState = {
  varPrincipal: "",
  varSegmento: "",
  iterarVar: "",
  iterarOn: false,
  filtrosOn: false,
};

// Estado de exploración para Dimensiones (no persistido).
export type DashboardDimVisualMode = "construccion" | "heatmap" | "barras" | "radar" | "foda" | "matriz";
export type DashboardDimMatrizOrden = "score" | "alfabetico";
export type DashboardDimFodaSubmode = "matriz" | "dispersion";

export type DashboardDimensionesState = {
  modo: "general" | "indicadores";
  objetivo: string;
  cruce: string;
  incluirTotal: boolean;
  iterarOn: boolean;
  iterarVar: string;
  iterarLevel: string;
  filtrosOn: boolean;
  enfoqueOn: boolean;
  enfoqueGrupo: string;
  // Visual mode controlado por el usuario (override del payload.visual_mode).
  visualMode: DashboardDimVisualMode;
  // Submodo dentro de FODA.
  fodaSubmode: DashboardDimFodaSubmode;
  // Orden de filas en el modo "matriz" — toggle minimalista (sesión).
  matrizOrden: DashboardDimMatrizOrden;
};

const DEFAULT_DIMENSIONES_STATE: DashboardDimensionesState = {
  modo: "general",
  objetivo: "",
  cruce: "",
  incluirTotal: true,
  iterarOn: false,
  iterarVar: "",
  iterarLevel: "",
  filtrosOn: false,
  enfoqueOn: false,
  enfoqueGrupo: "",
  visualMode: "construccion",
  fodaSubmode: "matriz",
  matrizOrden: "score",
};

// Estado de exploración para Base de datos (no persistido).
export type DashboardBaseDatosState = {
  modo: "codigos" | "etiquetas";
  variables: string[];
  seccionesAbiertas: string[];
  page: number;
  pageSize: number;
  search: string;
  sort: { col: string; desc: boolean } | null;
};

const DEFAULT_BASE_DATOS_STATE: DashboardBaseDatosState = {
  modo: "etiquetas",
  variables: [],
  seccionesAbiertas: [],
  page: 1,
  pageSize: 25,
  search: "",
  sort: null,
};

type DashboardStore = {
  config: DashboardConfig;
  hydrated: boolean;
  dirty: boolean;

  // Estado de exploración (no persistido)
  tabActiva: DashboardTabId;
  seccionActiva: string | null;
  filtros: DashboardFiltro[];
  relacion: DashboardRelacionState;
  baseDatos: DashboardBaseDatosState;
  dimensiones: DashboardDimensionesState;

  hydrate: (c: DashboardConfig) => void;
  markClean: () => void;
  // Limpia store completo (config + estado exploración) a defaults. Llamado
  // desde el listener global cuando cambia `pulso:session-changed`, antes
  // de que `useDashboardAutosave` re-hidrate desde el backend del proyecto
  // nuevo. Sin esto, al cambiar de proyecto el dashboard mostraba logo /
  // paleta / filtros del proyecto anterior durante el fetch (y peor: el
  // autosave podía sobrescribir la config nueva con la vieja).
  resetForSession: () => void;

  // Config setters (estéticos) — todos marcan dirty.
  setTitulo: (s: string) => void;
  setSubtitulo: (s: string) => void;
  setLogo: (dataUri: string | null, alt?: string) => void;
  setLogoHeight: (px: number) => void;
  setLogoSlot: (index: number, logo: DashboardLogoConfig | null) => void;
  removeLogoSlot: (index: number) => void;
  setTabEnabled: (tab: DashboardTabId, enabled: boolean) => void;
  setVarMode: (varName: string, mode: DashboardVarMode) => void;
  setVarModes: (modes: Record<string, DashboardVarMode>) => void;
  setVarOverride: (varName: string, override: DashboardVarOverride) => void;
  removeVarOverride: (varName: string) => void;
  setBarDecimals: (n: number) => void;
  setSmOrder: (order: "questionnaire" | "desc") => void;
  setPaletaId: (id: string | null) => void;
  setPaletaLista: (listName: string, paleta: Record<string, string>) => void;
  setColorEnPaletaLista: (listName: string, label: string, color: string) => void;
  removePaletaLista: (listName: string) => void;
  setColorPrimarioOverride: (hex: string | null) => void;
  setNotas: (s: string) => void;
  setSemaforoModo: (m: "cortes" | "gradiente") => void;
  setSemaforoRedColor: (hex: string) => void;
  setSemaforoAmberColor: (hex: string) => void;
  setSemaforoGreenColor: (hex: string) => void;
  setSemaforoRedMax: (n: number) => void;
  setSemaforoAmberMax: (n: number) => void;
  addSemaforoStop: (stop: { value: number; color: string }) => void;
  removeSemaforoStop: (index: number) => void;
  updateSemaforoStop: (index: number, patch: Partial<{ value: number; color: string }>) => void;
  setRadarMin: (n: number) => void;
  setRadarMax: (n: number) => void;
  setRadarGridshape: (m: "linear" | "circular") => void;
  setRadarModo: (m: "uno" | "facet" | "alternante") => void;
  setRadarAnimado: (b: boolean) => void;
  setBarrasOrientacion: (m: "horizontal" | "vertical" | "facet") => void;
  setBarrasXMin: (n: number) => void;
  setBarrasXMax: (n: number) => void;
  setFodaIconosEnabled: (enabled: boolean) => void;
  setFodaIconTint: (hex: string) => void;
  setFodaIconSize: (n: number) => void;
  setFodaIconLegend: (enabled: boolean) => void;
  setFodaScoreMin: (n: number) => void;
  setFodaScoreMax: (n: number) => void;
  setFodaShowTotal: (enabled: boolean) => void;
  setFodaSpacing: (n: number) => void;
  setFodaGridIntensity: (n: number) => void;
  setFodaVista: (v: string) => void;
  setFodaViews: (views: DashboardFodaViewConfig[]) => void;
  addFodaView: () => void;
  updateFodaView: (id: string, patch: Partial<DashboardFodaViewConfig>) => void;
  removeFodaView: (id: string) => void;
  setFodaViewAlias: (id: string, category: string, alias: string) => void;
  setFodaViewIcon: (id: string, category: string, icon: string) => void;
  setDimDesgloseLayout: (v: "paginado" | "apilado") => void;
  setMatrizVarColor: (v: string) => void;
  setMatrizVarNombre: (v: string) => void;
  setDimAxisIcon: (label: string, dataUri: string | null) => void;
  clearDimAxisIcons: () => void;

  // Estado de exploración (local, no marca dirty)
  setTabActiva: (t: DashboardTabId) => void;
  setSeccionActiva: (s: string | null) => void;
  setFiltros: (f: DashboardFiltro[]) => void;
  addFiltro: (f: DashboardFiltro) => void;
  removeFiltro: (varName: string) => void;
  clearFiltros: () => void;

  // Relaciones
  setRelacion: (patch: Partial<DashboardRelacionState>) => void;
  resetRelacion: () => void;

  // Base de datos
  setBaseDatos: (patch: Partial<DashboardBaseDatosState>) => void;
  toggleBaseDatosVariable: (name: string) => void;
  setBaseDatosVariables: (names: string[]) => void;
  toggleBaseDatosSeccion: (id: string) => void;
  resetBaseDatos: () => void;

  // Dimensiones
  setDimensiones: (patch: Partial<DashboardDimensionesState>) => void;
  resetDimensiones: () => void;
};

function dirtyPatch<T extends Partial<DashboardStore>>(p: T): T & { dirty: true } {
  return { ...p, dirty: true } as T & { dirty: true };
}

export const useDashboardStore = create<DashboardStore>((set) => ({
  config: DEFAULT_DASHBOARD_CONFIG,
  hydrated: false,
  dirty: false,

  tabActiva: "resumen",
  seccionActiva: null,
  filtros: [],
  relacion: DEFAULT_RELACION_STATE,
  baseDatos: DEFAULT_BASE_DATOS_STATE,
  dimensiones: DEFAULT_DIMENSIONES_STATE,

  hydrate: (c) => set({ config: c, hydrated: true, dirty: false }),
  markClean: () => set({ dirty: false }),
  resetForSession: () =>
    set({
      config: DEFAULT_DASHBOARD_CONFIG,
      hydrated: false,
      dirty: false,
      tabActiva: "resumen",
      seccionActiva: null,
      filtros: [],
      relacion: DEFAULT_RELACION_STATE,
      baseDatos: DEFAULT_BASE_DATOS_STATE,
      dimensiones: DEFAULT_DIMENSIONES_STATE,
    }),

  setTitulo: (s) => set((st) => dirtyPatch({ config: { ...st.config, titulo: s } })),
  setSubtitulo: (s) => set((st) => dirtyPatch({ config: { ...st.config, subtitulo: s } })),
  setLogo: (dataUri, alt) =>
    set((st) => {
      // Compat: el setter legacy actualiza el primer slot del array.
      const next = [...(st.config.logos ?? [])];
      if (dataUri) {
        next[0] = { data_uri: dataUri, alt: alt ?? next[0]?.alt ?? "" };
      } else {
        next.shift();
      }
      const filtered = next.filter((l): l is DashboardLogoConfig => !!l);
      return dirtyPatch({
        config: {
          ...st.config,
          logos: filtered,
          logo_data_uri: filtered[0]?.data_uri ?? null,
          logo_alt: filtered[0]?.alt ?? "",
        },
      });
    }),
  setLogoHeight: (px) =>
    set((st) => dirtyPatch({ config: { ...st.config, logo_height_px: Math.max(16, Math.min(120, px)) } })),
  setLogoSlot: (index, logo) =>
    set((st) => {
      const current = [...(st.config.logos ?? [])];
      // Permite escribir hasta MAX_DASHBOARD_LOGOS slots; pad con
      // strings vacíos no, simplemente ignora índices fuera de rango.
      if (index < 0 || index >= MAX_DASHBOARD_LOGOS) return st;
      if (logo) {
        current[index] = logo;
      } else {
        current[index] = undefined as unknown as DashboardLogoConfig;
      }
      const compacted = current.filter((l): l is DashboardLogoConfig => !!l);
      return dirtyPatch({
        config: {
          ...st.config,
          logos: compacted,
          logo_data_uri: compacted[0]?.data_uri ?? null,
          logo_alt: compacted[0]?.alt ?? "",
        },
      });
    }),
  removeLogoSlot: (index) =>
    set((st) => {
      const current = [...(st.config.logos ?? [])];
      if (index < 0 || index >= current.length) return st;
      current.splice(index, 1);
      return dirtyPatch({
        config: {
          ...st.config,
          logos: current,
          logo_data_uri: current[0]?.data_uri ?? null,
          logo_alt: current[0]?.alt ?? "",
        },
      });
    }),
  setTabEnabled: (tab, enabled) =>
    set((st) =>
      dirtyPatch({
        config: {
          ...st.config,
          tabs_enabled: { ...DEFAULT_TABS_ENABLED, ...(st.config.tabs_enabled ?? {}), [tab]: enabled },
        },
      }),
    ),
  setVarMode: (varName, mode) =>
    set((st) =>
      dirtyPatch({
        config: {
          ...st.config,
          dashboard_var_modes: {
            ...(st.config.dashboard_var_modes ?? {}),
            [varName]: mode,
          },
        },
      }),
    ),
  setVarModes: (modes) =>
    set((st) =>
      dirtyPatch({
        config: {
          ...st.config,
          dashboard_var_modes: { ...(st.config.dashboard_var_modes ?? {}), ...modes },
        },
      }),
    ),
  setVarOverride: (varName, override) =>
    set((st) =>
      dirtyPatch({
        config: {
          ...st.config,
          dashboard_var_overrides: {
            ...(st.config.dashboard_var_overrides ?? {}),
            [varName]: override,
          },
        },
      }),
    ),
  removeVarOverride: (varName) =>
    set((st) => {
      const cur = { ...(st.config.dashboard_var_overrides ?? {}) };
      delete cur[varName];
      return dirtyPatch({ config: { ...st.config, dashboard_var_overrides: cur } });
    }),
  setBarDecimals: (n) =>
    set((st) =>
      dirtyPatch({
        config: { ...st.config, bar_decimals: Math.max(0, Math.min(2, Math.round(n))) },
      }),
    ),
  setSmOrder: (order) =>
    set((st) => dirtyPatch({ config: { ...st.config, sm_order: order } })),
  setPaletaId: (id) => set((st) => dirtyPatch({ config: { ...st.config, paleta_id: id } })),
  setPaletaLista: (listName, paleta) =>
    set((st) =>
      dirtyPatch({
        config: {
          ...st.config,
          paletas_listas: { ...st.config.paletas_listas, [listName]: paleta },
        },
      }),
    ),
  setColorEnPaletaLista: (listName, label, color) =>
    set((st) => {
      const current = st.config.paletas_listas[listName] ?? {};
      const nextForList = { ...current };
      if (!color) delete nextForList[label];
      else nextForList[label] = color;
      const next = { ...st.config.paletas_listas };
      if (Object.keys(nextForList).length === 0) delete next[listName];
      else next[listName] = nextForList;
      return dirtyPatch({ config: { ...st.config, paletas_listas: next } });
    }),
  removePaletaLista: (listName) =>
    set((st) => {
      const next = { ...st.config.paletas_listas };
      delete next[listName];
      return dirtyPatch({ config: { ...st.config, paletas_listas: next } });
    }),
  setColorPrimarioOverride: (hex) =>
    set((st) => dirtyPatch({ config: { ...st.config, color_primario_override: hex } })),
  setNotas: (s) => set((st) => dirtyPatch({ config: { ...st.config, notas: s } })),
  setSemaforoModo: (m) =>
    set((st) => dirtyPatch({ config: { ...st.config, semaforo_modo: m } })),
  setSemaforoRedColor: (hex) =>
    set((st) => dirtyPatch({ config: { ...st.config, semaforo_red_color: hex } })),
  setSemaforoAmberColor: (hex) =>
    set((st) => dirtyPatch({ config: { ...st.config, semaforo_amber_color: hex } })),
  setSemaforoGreenColor: (hex) =>
    set((st) => dirtyPatch({ config: { ...st.config, semaforo_green_color: hex } })),
  setSemaforoRedMax: (n) =>
    set((st) => {
      const r = Math.max(5, Math.min(95, Math.round(n)));
      const a = Math.max(r + 1, st.config.semaforo_amber_max ?? 80);
      return dirtyPatch({ config: { ...st.config, semaforo_red_max: r, semaforo_amber_max: a } });
    }),
  setSemaforoAmberMax: (n) =>
    set((st) => {
      const r = st.config.semaforo_red_max ?? 60;
      const a = Math.max(r + 1, Math.min(99, Math.round(n)));
      return dirtyPatch({ config: { ...st.config, semaforo_amber_max: a } });
    }),
  addSemaforoStop: (stop) =>
    set((st) => {
      const next = [...(st.config.semaforo_stops_extra ?? []), stop].sort(
        (a, b) => a.value - b.value,
      );
      return dirtyPatch({ config: { ...st.config, semaforo_stops_extra: next } });
    }),
  removeSemaforoStop: (index) =>
    set((st) => {
      const arr = [...(st.config.semaforo_stops_extra ?? [])];
      arr.splice(index, 1);
      return dirtyPatch({ config: { ...st.config, semaforo_stops_extra: arr } });
    }),
  updateSemaforoStop: (index, patch) =>
    set((st) => {
      const arr = [...(st.config.semaforo_stops_extra ?? [])];
      const current = arr[index];
      if (!current) return st;
      const value = patch.value !== undefined
        ? Math.max(0, Math.min(100, patch.value))
        : current.value;
      const color = patch.color ?? current.color;
      arr[index] = { value, color };
      arr.sort((a, b) => a.value - b.value);
      return dirtyPatch({ config: { ...st.config, semaforo_stops_extra: arr } });
    }),
  setRadarMin: (n) =>
    set((st) => {
      const r = Math.max(0, Math.min(95, Math.round(n)));
      const max = Math.max(r + 5, st.config.radar_max ?? 100);
      return dirtyPatch({ config: { ...st.config, radar_min: r, radar_max: max } });
    }),
  setRadarMax: (n) =>
    set((st) => {
      const r = st.config.radar_min ?? 0;
      const max = Math.max(r + 5, Math.min(200, Math.round(n)));
      return dirtyPatch({ config: { ...st.config, radar_max: max } });
    }),
  setRadarGridshape: (m) =>
    set((st) => dirtyPatch({ config: { ...st.config, radar_gridshape: m } })),
  setRadarModo: (m) =>
    set((st) => dirtyPatch({ config: { ...st.config, radar_modo: m } })),
  setRadarAnimado: (b) =>
    set((st) => dirtyPatch({ config: { ...st.config, radar_animado: b } })),
  setBarrasOrientacion: (m) =>
    set((st) => dirtyPatch({ config: { ...st.config, barras_orientacion: m } })),
  setBarrasXMin: (n) =>
    set((st) => {
      const min = Math.max(0, Math.min(90, Math.round(n)));
      const max = Math.max(min + 10, st.config.barras_x_max ?? 100);
      return dirtyPatch({ config: { ...st.config, barras_x_min: min, barras_x_max: max } });
    }),
  setBarrasXMax: (n) =>
    set((st) => {
      const min = st.config.barras_x_min ?? 0;
      const max = Math.max(min + 10, Math.min(200, Math.round(n)));
      return dirtyPatch({ config: { ...st.config, barras_x_max: max } });
    }),
  setFodaIconosEnabled: (enabled) =>
    set((st) => dirtyPatch({ config: { ...st.config, foda_iconos_enabled: enabled } })),
  setFodaIconTint: (hex) =>
    set((st) => dirtyPatch({ config: { ...st.config, foda_icon_tint: hex || "#FFFFFF" } })),
  setFodaIconSize: (n) =>
    set((st) =>
      dirtyPatch({ config: { ...st.config, foda_icon_size: Math.max(0.6, Math.min(1.8, n)) } }),
    ),
  setFodaIconLegend: (enabled) =>
    set((st) => dirtyPatch({ config: { ...st.config, foda_icon_legend: enabled } })),
  setFodaScoreMin: (n) =>
    set((st) => {
      const max = st.config.foda_score_max ?? 120;
      const min = Math.max(0, Math.min(95, Math.round(n)));
      return dirtyPatch({ config: { ...st.config, foda_score_min: Math.min(min, max - 5) } });
    }),
  setFodaScoreMax: (n) =>
    set((st) => {
      const min = st.config.foda_score_min ?? 0;
      const max = Math.max(60, Math.min(140, Math.round(n)));
      return dirtyPatch({ config: { ...st.config, foda_score_max: Math.max(max, min + 5) } });
    }),
  setFodaShowTotal: (enabled) =>
    set((st) => dirtyPatch({ config: { ...st.config, foda_show_total: enabled } })),
  setFodaSpacing: (n) =>
    set((st) =>
      dirtyPatch({ config: { ...st.config, foda_spacing: Math.max(0.7, Math.min(1.8, n)) } }),
    ),
  setFodaGridIntensity: (n) =>
    set((st) =>
      dirtyPatch({ config: { ...st.config, foda_grid_intensity: Math.max(0, Math.min(1, n)) } }),
    ),
  setFodaVista: (v) =>
    set((st) => {
      const views = st.config.foda_views ?? DEFAULT_FODA_VIEWS;
      // Acepta el id si está en las vistas reales O si es una vista virtual
      // whitelistada (ej. "lectura"). Sin esto, el setter rebotaba la vista
      // virtual al primer id real y el click en Lectura "no hacía nada".
      const accepted =
        VIRTUAL_FODA_VIEWS.has(v) || views.some((view) => view.id === v);
      const next = accepted ? v : (views[0]?.id ?? "conductores");
      return dirtyPatch({ config: { ...st.config, foda_vista: next } });
    }),
  setFodaViews: (views) =>
    set((st) => {
      const clean = mergeDefaultFodaViews(views, {}, {});
      // Si la vista activa es virtual ("lectura"), preservarla. Solo
      // forzamos fallback cuando la vista activa era una vista real que
      // dejó de existir tras el cambio en `views`.
      const current = st.config.foda_vista ?? "conductores";
      const active =
        VIRTUAL_FODA_VIEWS.has(current) || clean.some((view) => view.id === current)
          ? current
          : (clean[0]?.id ?? "conductores");
      return dirtyPatch({ config: { ...st.config, foda_views: clean, foda_vista: active } });
    }),
  addFodaView: () =>
    set((st) => {
      const views = [...(st.config.foda_views ?? DEFAULT_FODA_VIEWS)];
      const id = uniqueFodaId("vista_personalizada", views);
      const nextView: DashboardFodaViewConfig = {
        id,
        label: "Vista personalizada",
        variable: "",
        metric_var: "idx_indice_general",
        card_mode: "alias",
        aliases: {},
        icons: {},
      };
      return dirtyPatch({
        config: {
          ...st.config,
          foda_vista: id,
          foda_views: [...views, nextView],
        },
      });
    }),
  updateFodaView: (id, patch) =>
    set((st) => {
      const views = st.config.foda_views ?? DEFAULT_FODA_VIEWS;
      let nextActive = st.config.foda_vista ?? "conductores";
      const next = views.map((view) => {
        if (view.id !== id) return view;
        const proposedId = patch.id !== undefined && patch.id.trim()
          ? uniqueFodaId(patch.id, views.filter((v) => v.id !== id))
          : view.id;
        if (nextActive === id) nextActive = proposedId;
        return {
          ...view,
          ...patch,
          id: proposedId,
          label: patch.label !== undefined ? patch.label : view.label,
          variable: patch.variable !== undefined ? patch.variable.trim() : view.variable,
          metric_var: patch.metric_var !== undefined ? patch.metric_var.trim() : view.metric_var,
          aliases: patch.aliases !== undefined ? patch.aliases : view.aliases,
          icons: patch.icons !== undefined ? patch.icons : view.icons,
          card_mode: patch.card_mode === "alias" ? "alias" : patch.card_mode === "iconos" ? "iconos" : view.card_mode,
        };
      });
      return dirtyPatch({ config: { ...st.config, foda_views: next, foda_vista: nextActive } });
    }),
  removeFodaView: (id) =>
    set((st) => {
      if (id === "conductores") return st;
      const next = (st.config.foda_views ?? DEFAULT_FODA_VIEWS).filter((view) => view.id !== id);
      const active = st.config.foda_vista === id ? "conductores" : (st.config.foda_vista ?? "conductores");
      return dirtyPatch({ config: { ...st.config, foda_views: next, foda_vista: active } });
    }),
  setFodaViewAlias: (id, category, alias) =>
    set((st) => {
      const key = category.trim();
      if (!key) return st;
      const next = (st.config.foda_views ?? DEFAULT_FODA_VIEWS).map((view) => {
        if (view.id !== id) return view;
        const aliases = { ...(view.aliases ?? {}) };
        if (alias.trim()) aliases[key] = alias.trim();
        else delete aliases[key];
        return { ...view, aliases };
      });
      const aliasesByVar: Record<string, Record<string, string>> = { ...(st.config.foda_aliases ?? {}) };
      const view = next.find((v) => v.id === id);
      if (view?.variable) aliasesByVar[view.variable] = { ...(view.aliases ?? {}) };
      return dirtyPatch({ config: { ...st.config, foda_views: next, foda_aliases: aliasesByVar } });
    }),
  setFodaViewIcon: (id, category, icon) =>
    set((st) => {
      const key = category.trim();
      if (!key) return st;
      const next = (st.config.foda_views ?? DEFAULT_FODA_VIEWS).map((view) => {
        if (view.id !== id) return view;
        const icons = { ...(view.icons ?? {}) };
        if (icon.trim()) icons[key] = icon.trim();
        else delete icons[key];
        return { ...view, icons };
      });
      const view = next.find((v) => v.id === id);
      const serviceIcons = view?.id === "servicios"
        ? { ...(view.icons ?? {}) }
        : { ...(st.config.foda_service_icons ?? {}) };
      return dirtyPatch({ config: { ...st.config, foda_views: next, foda_service_icons: serviceIcons } });
    }),

  setDimDesgloseLayout: (v) =>
    set((st) => dirtyPatch({ config: { ...st.config, dim_desglose_layout: v } })),
  setMatrizVarColor: (v) =>
    set((st) => dirtyPatch({ config: { ...st.config, matriz_var_color: v } })),
  setMatrizVarNombre: (v) =>
    set((st) => dirtyPatch({ config: { ...st.config, matriz_var_nombre: v } })),
  setDimAxisIcon: (label, dataUri) =>
    set((st) => {
      const next = { ...(st.config.dim_axis_icons ?? {}) };
      const key = label.trim();
      if (!key) return st;
      if (dataUri && typeof dataUri === "string") {
        next[key] = dataUri;
      } else {
        delete next[key];
      }
      return dirtyPatch({ config: { ...st.config, dim_axis_icons: next } });
    }),
  clearDimAxisIcons: () =>
    set((st) => dirtyPatch({ config: { ...st.config, dim_axis_icons: {} } })),

  setTabActiva: (t) => set({ tabActiva: t }),
  setSeccionActiva: (s) => set({ seccionActiva: s }),
  setFiltros: (f) => set({ filtros: f }),
  addFiltro: (f) =>
    set((st) => {
      const others = st.filtros.filter((x) => x.var !== f.var);
      return { filtros: [...others, f] };
    }),
  removeFiltro: (varName) =>
    set((st) => ({ filtros: st.filtros.filter((f) => f.var !== varName) })),
  clearFiltros: () => set({ filtros: [] }),

  setRelacion: (patch) =>
    set((st) => ({ relacion: { ...st.relacion, ...patch } })),
  resetRelacion: () => set({ relacion: DEFAULT_RELACION_STATE }),

  setBaseDatos: (patch) =>
    set((st) => ({ baseDatos: { ...st.baseDatos, ...patch } })),
  toggleBaseDatosVariable: (name) =>
    set((st) => {
      const has = st.baseDatos.variables.includes(name);
      const next = has
        ? st.baseDatos.variables.filter((v) => v !== name)
        : [...st.baseDatos.variables, name];
      return { baseDatos: { ...st.baseDatos, variables: next, page: 1 } };
    }),
  setBaseDatosVariables: (names) =>
    set((st) => ({ baseDatos: { ...st.baseDatos, variables: names, page: 1 } })),
  toggleBaseDatosSeccion: (id) =>
    set((st) => {
      const has = st.baseDatos.seccionesAbiertas.includes(id);
      const next = has
        ? st.baseDatos.seccionesAbiertas.filter((s) => s !== id)
        : [...st.baseDatos.seccionesAbiertas, id];
      return { baseDatos: { ...st.baseDatos, seccionesAbiertas: next } };
    }),
  resetBaseDatos: () => set({ baseDatos: DEFAULT_BASE_DATOS_STATE }),

  setDimensiones: (patch) =>
    set((st) => ({ dimensiones: { ...st.dimensiones, ...patch } })),
  resetDimensiones: () => set({ dimensiones: DEFAULT_DIMENSIONES_STATE }),
}));

// Hook de hidratación + autosave (debounced 2s). Se monta una vez en
// DashboardPage. Mismo patrón que useAnaliticaAutosave.
export function useDashboardAutosave(enabled: boolean = true) {
  const config = useDashboardStore((s) => s.config);
  const dirty = useDashboardStore((s) => s.dirty);
  const hydrated = useDashboardStore((s) => s.hydrated);
  const hydrate = useDashboardStore((s) => s.hydrate);
  const markClean = useDashboardStore((s) => s.markClean);

  // Hidratación inicial + re-hidratación al cambiar de sesión (ej. abrir
  // otro .pulso). Sin el listener de `pulso:session-changed` el store
  // quedaba con la config (logo, paleta, FODA views, var_modes, ...) del
  // proyecto anterior, y el autosave debounced podía sobrescribir la
  // config del proyecto recién abierto con la del anterior.
  useEffect(() => {
    let cancelled = false;

    async function hydrateFromBackend() {
      if (cancelled) return;
      try {
        const r = await apiDashboardConfigGet();
        if (!cancelled) hydrate(sanitizeConfig({ ...DEFAULT_DASHBOARD_CONFIG, ...r.config }));
      } catch {
        if (!cancelled) hydrate(DEFAULT_DASHBOARD_CONFIG);
      }
    }

    void hydrateFromBackend();

    function onSessionChanged() {
      void hydrateFromBackend();
    }
    window.addEventListener("pulso:session-changed", onSessionChanged);
    return () => {
      cancelled = true;
      window.removeEventListener("pulso:session-changed", onSessionChanged);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const timer = useRef<number | null>(null);
  useEffect(() => {
    if (!enabled) return;
    if (!hydrated || !dirty) return;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      try {
        await apiDashboardConfigPut(config);
        window.dispatchEvent(new CustomEvent("pulso:project-status-changed"));
        markClean();
      } catch {
        // Silencioso — el próximo cambio reintenta.
      }
    }, 2000);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [config, dirty, hydrated, markClean]);
}
