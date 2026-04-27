import { useEffect, useRef } from "react";
import { create } from "zustand";
import {
  apiDashboardConfigGet,
  apiDashboardConfigPut,
  DashboardConfig,
  DashboardFiltro,
  DashboardTabId,
} from "../../api/client";

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
function sanitizeConfig(c: DashboardConfig): DashboardConfig {
  const str = (v: unknown) =>
    typeof v === "string" && v.length > 0 ? v : null;
  const num = (v: unknown, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) ? v : fallback;
  const paletasListas =
    c.paletas_listas && typeof c.paletas_listas === "object" && !Array.isArray(c.paletas_listas)
      ? c.paletas_listas
      : {};
  const fodaScoreMin = Math.max(0, Math.min(95, num(c.foda_score_min, 0)));
  const fodaScoreMax = Math.max(fodaScoreMin + 5, Math.min(140, num(c.foda_score_max, 120)));
  const fodaSpacing = Math.max(0.7, Math.min(1.8, num(c.foda_spacing, 1.15)));
  const fodaGridIntensity = Math.max(0, Math.min(1, num(c.foda_grid_intensity, 0.42)));
  return {
    ...c,
    titulo: typeof c.titulo === "string" ? c.titulo : "Dashboard",
    subtitulo: typeof c.subtitulo === "string" ? c.subtitulo : "",
    logo_data_uri: str(c.logo_data_uri),
    logo_alt: typeof c.logo_alt === "string" ? c.logo_alt : "",
    logo_height_px: num(c.logo_height_px, 36),
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
    radar_min: Math.max(0, Math.min(95, num(c.radar_min, 0))),
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
  };
}

export const DEFAULT_DASHBOARD_CONFIG: DashboardConfig = {
  titulo: "Dashboard",
  subtitulo: "",
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
  radar_min: 0,
  foda_iconos_enabled: true,
  foda_icon_tint: "#FFFFFF",
  foda_icon_size: 1,
  foda_icon_legend: true,
  foda_score_min: 0,
  foda_score_max: 120,
  foda_show_total: true,
  foda_spacing: 1.15,
  foda_grid_intensity: 0.42,
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
export type DashboardDimVisualMode = "heatmap" | "barras" | "radar" | "foda";
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
  visualMode: "heatmap",
  fodaSubmode: "matriz",
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

  // Config setters (estéticos) — todos marcan dirty.
  setTitulo: (s: string) => void;
  setSubtitulo: (s: string) => void;
  setLogo: (dataUri: string | null, alt?: string) => void;
  setLogoHeight: (px: number) => void;
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
  setRadarMin: (n: number) => void;
  setFodaIconosEnabled: (enabled: boolean) => void;
  setFodaIconTint: (hex: string) => void;
  setFodaIconSize: (n: number) => void;
  setFodaIconLegend: (enabled: boolean) => void;
  setFodaScoreMin: (n: number) => void;
  setFodaScoreMax: (n: number) => void;
  setFodaShowTotal: (enabled: boolean) => void;
  setFodaSpacing: (n: number) => void;
  setFodaGridIntensity: (n: number) => void;

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

  setTitulo: (s) => set((st) => dirtyPatch({ config: { ...st.config, titulo: s } })),
  setSubtitulo: (s) => set((st) => dirtyPatch({ config: { ...st.config, subtitulo: s } })),
  setLogo: (dataUri, alt) =>
    set((st) =>
      dirtyPatch({
        config: { ...st.config, logo_data_uri: dataUri, logo_alt: alt ?? st.config.logo_alt },
      }),
    ),
  setLogoHeight: (px) =>
    set((st) => dirtyPatch({ config: { ...st.config, logo_height_px: Math.max(16, Math.min(120, px)) } })),
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
  setRadarMin: (n) =>
    set((st) =>
      dirtyPatch({ config: { ...st.config, radar_min: Math.max(0, Math.min(95, Math.round(n))) } }),
    ),
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
export function useDashboardAutosave() {
  const config = useDashboardStore((s) => s.config);
  const dirty = useDashboardStore((s) => s.dirty);
  const hydrated = useDashboardStore((s) => s.hydrated);
  const hydrate = useDashboardStore((s) => s.hydrate);
  const markClean = useDashboardStore((s) => s.markClean);

  useEffect(() => {
    let cancelled = false;
    apiDashboardConfigGet()
      .then((r) => {
        if (cancelled) return;
        hydrate(sanitizeConfig({ ...DEFAULT_DASHBOARD_CONFIG, ...r.config }));
      })
      .catch(() => {
        if (!cancelled) hydrate(DEFAULT_DASHBOARD_CONFIG);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const timer = useRef<number | null>(null);
  useEffect(() => {
    if (!hydrated || !dirty) return;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      try {
        await apiDashboardConfigPut(config);
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
