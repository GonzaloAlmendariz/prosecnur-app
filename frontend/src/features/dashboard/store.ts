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
