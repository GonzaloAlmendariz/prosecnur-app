import { create } from "zustand";
import type { GraficadorRef, PlanJson, Slide, SlideType } from "../../api/client";

// Store del plan de gráficos. Sigue el mismo patrón que el store de
// Analítica: hidrata desde backend al montar, marca `dirty` con cada
// cambio, autosave debounced 2s persiste al backend vía
// `useGraficosAutosave`. Export/import JSON se mantienen como respaldo.

// ----- Bloque 2: Configuración global ---------------------------------------

// Paleta de colores por value-label para una lista del instrumento.
// Ej. { "Sí": "#93C4EB", "No": "#1B679D", "Valor perdido": "#C3C3C3" }.
// Se indexa por `list_name` (del XLSForm). Si una lista no tiene paleta
// definida, prosecnur usa la paleta genérica azul.
export type PaletaPorLista = Record<string, string>;

// Un ícono PNG subido por el analista para usar en slides de población.
// El archivo vive en `session/$sid/icons/<file_id>.png`; el store solo
// guarda la referencia. El frontend lo consume via `downloadUrl(file_id)`.
export type IconoConfig = {
  id: string;          // uuid stable, usado como key en la UI
  nombre: string;      // etiqueta humana: "Logo GIZ", "Icono EESS"
  file_id: string;     // file_id del backend files store
  uploaded_at?: string;
};

// Mini-preset reutilizable que sobreescribe al preset tipo. El analista
// lo usa en slides específicos ("aplica el override 'compacto' a este
// gráfico"). Mirror del patrón `ovr_apiladas_compactas` de los QMDs.
export type OverrideReusable = {
  id: string;
  nombre: string;           // "compacto", "grande", "minimal"
  tipo_preset: string;      // "barras_apiladas" | "pie" | "multi_apiladas" | ...
  args: Record<string, unknown>;
};

// Debug de placeholders — herramienta global para ver visualmente cómo
// queda la disposición de los slots y canvas dentro de cada gráfico.
// Es un toggle single-source que se inyecta al preset `base` antes de
// cada export, afectando TODOS los graficadores por igual. Evita que
// el analista tenga que editarlo slot por slot.
export type DebugPh = {
  activo: boolean;  // muestra/oculta los bordes de debug
  color: string;    // hex del borde (default magenta #FF00FF)
  lwd: number;      // grosor de línea (default 0.6)
};

// Config persistida en el backend. Lo que el autosave envía y recibe.
// Version 2 añade: paletas, iconos, overrides_reusables, debug_ph.
export type GraficosConfig = {
  version: 2;
  plan: PlanJson;
  presets: Record<string, Record<string, unknown>>;
  w_presets: Record<string, Record<string, unknown>>;
  selected_slide_id: string | null;

  // Bloque 2: configuración global de estilo
  paletas: Record<string, PaletaPorLista>;   // list_name → {label: hex}
  iconos: IconoConfig[];
  overrides_reusables: OverrideReusable[];
  debug_ph: DebugPh;
};

type PlanStore = {
  // --- Config principal (persistida) ---
  plan: PlanJson;
  presets: Record<string, Record<string, unknown>>;
  wPresets: Record<string, Record<string, unknown>>;
  selectedSlideId: string | null;
  paletas: Record<string, PaletaPorLista>;
  iconos: IconoConfig[];
  overridesReusables: OverrideReusable[];
  debugPh: DebugPh;

  // --- Flags de sincronización ---
  hydrated: boolean;
  dirty: boolean;

  // --- Lifecycle ---
  hydrate: (cfg: GraficosConfig) => void;
  markClean: () => void;

  // --- Setters del plan (marcan dirty) ---
  addSlide: (tipo: SlideType) => void;
  removeSlide: (id: string) => void;
  moveSlide: (id: string, direction: "up" | "down") => void;
  updateSlidePayload: (id: string, patch: Record<string, unknown>) => void;
  setSlot: (id: string, slot: string, graf: GraficadorRef | null) => void;
  updateSlotArgs: (id: string, slot: string, patch: Record<string, unknown>) => void;
  setPresets: (presets: Record<string, Record<string, unknown>>) => void;
  setWPresets: (wPresets: Record<string, Record<string, unknown>>) => void;
  select: (id: string | null) => void;
  loadPlan: (plan: PlanJson) => void;
  reset: () => void;

  // --- Setters de configuración global (Bloque 2) ---
  setPaleta: (listName: string, paleta: PaletaPorLista) => void;
  setColorEnPaleta: (listName: string, label: string, hex: string) => void;
  removePaleta: (listName: string) => void;

  addIcono: (icono: IconoConfig) => void;
  renameIcono: (id: string, nombre: string) => void;
  removeIcono: (id: string) => void;

  addOverrideReusable: (ov: OverrideReusable) => void;
  updateOverrideReusable: (id: string, patch: Partial<OverrideReusable>) => void;
  removeOverrideReusable: (id: string) => void;

  // Debug de placeholders (toggle global)
  setDebugPh: (patch: Partial<DebugPh>) => void;
};

// Valores por defecto del debug. Alineado con los QMDs de GIZ y las
// pruebas (magenta + grosor 0.6). `activo: false` por defecto: se
// enciende solo durante el trabajo de diseño.
export const DEFAULT_DEBUG_PH: DebugPh = {
  activo: false,
  color: "#FF00FF",
  lwd: 0.6,
};

// Payload por defecto de cada tipo de slide. Mirror de los formals() de
// `prosecnur::p_slide_*`. La fuente de verdad está en el registry del
// backend; acá solo mapeamos los slots y los campos de texto para que
// la UI inicie con los keys correctos.
const DEFAULT_PAYLOADS: Record<SlideType, Record<string, unknown>> = {
  // ---- Estructurales (sin gráficos) -----------------------------------
  p_slide_portada:        { titulo: "Informe", subtitulo: "", fecha: "", subtexto: "" },
  p_slide_indice:         {},
  p_slide_seccion:        { titulo: "Sección", subtitulo: "", introduccion_word: "" },
  p_slide_objetivo_icono: { titulo: "", texto: "", icono: null },
  p_slide_texto:          { titulo: "", texto: "", bullets: "", base: "" },
  p_slide_tabla_tecnica:  { titulo: "", filas: "", pie: "" },

  // ---- 1 gráfico ------------------------------------------------------
  p_slide_1_grafico:           { titulo: "", grafico: null, base: "", pie: "", etiqueta: "" },
  p_slide_1_grafico_narrativo: { titulo: "", grafico: null, texto: "", base: "", pie: "", etiqueta: "" },
  p_slide_grafico_texto_derecha:    { titulo: "", grafico: null, texto: "", base: "", pie: "", etiqueta: "" },
  p_slide_grafico_texto_izquierda:  { titulo: "", grafico: null, texto: "", base: "", pie: "", etiqueta: "" },

  // ---- 2 gráficos -----------------------------------------------------
  p_slide_2_graficos:              { titulo: "", izquierda: null, derecha: null, base: "", pie: "", etiqueta: "" },
  p_slide_2_graficos_narrativo:    { titulo: "", izquierda: null, derecha: null, texto: "", base: "", pie: "", etiqueta: "" },
  p_slide_2_graficos_texto_izquierda: { titulo: "", grafico_1: null, grafico_2: null, texto: "", base: "", pie: "", etiqueta: "" },
  p_slide_2_graficos_texto_derecha:   { titulo: "", grafico_1: null, grafico_2: null, texto: "", base: "", pie: "", etiqueta: "" },

  // ---- Grids ----------------------------------------------------------
  p_slide_4_graficos: {
    titulo: "", base: "", pie: "", etiqueta: "",
    superior_izquierda: null, superior_derecha: null,
    inferior_izquierda: null, inferior_derecha: null,
  },

  // ---- Población (con ícono central) ----------------------------------
  p_slide_2_graficos_poblacion: {
    titulo: "", base: "", pie: "", etiqueta: "",
    izquierda: null, derecha: null, icono: null,
  },
  p_slide_4_graficos_poblacion: {
    titulo: "", base: "", pie: "", etiqueta: "",
    superior_izquierda: null, superior_derecha: null,
    inferior_izquierda: null, inferior_derecha: null,
    icono: null,
  },
  p_slide_5_graficos_poblacion: {
    titulo: "", base: "", pie: "", etiqueta: "",
    grafico_superior_1: null, grafico_superior_2: null, grafico_superior_3: null,
    grafico_inferior_1: null, grafico_inferior_2: null,
    icono: null,
  },
  p_slide_6_graficos_poblacion: {
    titulo: "", base: "", pie: "", etiqueta: "",
    grafico_superior_1: null, grafico_superior_2: null, grafico_superior_3: null,
    grafico_inferior_1: null, grafico_inferior_2: null, grafico_inferior_3: null,
    icono: null,
  },
};

function newId() {
  return `s-${Math.random().toString(36).slice(2, 10)}`;
}

// Helper: marca `dirty: true` en el patch devuelto al set(). Usado por
// todos los setters que alteran la config persistida.
function dirty<T extends object>(partial: T): T & { dirty: true } {
  return { ...partial, dirty: true };
}

export const usePlanStore = create<PlanStore>((set) => ({
  plan: { slides: [] },
  presets: {},
  wPresets: {},
  selectedSlideId: null,
  paletas: {},
  iconos: [],
  overridesReusables: [],
  debugPh: DEFAULT_DEBUG_PH,

  hydrated: false,
  dirty: false,

  hydrate: (cfg) => set({
    plan: cfg.plan ?? { slides: [] },
    presets: cfg.presets ?? {},
    wPresets: cfg.w_presets ?? {},
    selectedSlideId: cfg.selected_slide_id ?? null,
    paletas: cfg.paletas ?? {},
    iconos: cfg.iconos ?? [],
    overridesReusables: cfg.overrides_reusables ?? [],
    debugPh: { ...DEFAULT_DEBUG_PH, ...(cfg.debug_ph ?? {}) },
    hydrated: true,
    dirty: false,
  }),

  markClean: () => set({ dirty: false }),

  addSlide: (tipo) => {
    const s: Slide = { id: newId(), tipo, payload: { ...DEFAULT_PAYLOADS[tipo] } };
    set((state) => dirty({
      plan: { slides: [...state.plan.slides, s] },
      selectedSlideId: s.id,
    }));
  },

  removeSlide: (id) => {
    set((state) => {
      const slides = state.plan.slides.filter((s) => s.id !== id);
      const nextSelected = state.selectedSlideId === id ? (slides[0]?.id ?? null) : state.selectedSlideId;
      return dirty({ plan: { slides }, selectedSlideId: nextSelected });
    });
  },

  moveSlide: (id, direction) => {
    set((state) => {
      const i = state.plan.slides.findIndex((s) => s.id === id);
      if (i < 0) return state;
      const j = direction === "up" ? i - 1 : i + 1;
      if (j < 0 || j >= state.plan.slides.length) return state;
      const slides = [...state.plan.slides];
      [slides[i], slides[j]] = [slides[j], slides[i]];
      return dirty({ plan: { slides } });
    });
  },

  updateSlidePayload: (id, patch) => {
    set((state) => dirty({
      plan: {
        slides: state.plan.slides.map((s) =>
          s.id === id ? { ...s, payload: { ...s.payload, ...patch } } : s
        ),
      },
    }));
  },

  setSlot: (id, slot, graf) => {
    set((state) => dirty({
      plan: {
        slides: state.plan.slides.map((s) =>
          s.id === id
            ? { ...s, payload: { ...s.payload, [slot]: graf ?? undefined } }
            : s
        ),
      },
    }));
  },

  updateSlotArgs: (id, slot, patch) => {
    set((state) => dirty({
      plan: {
        slides: state.plan.slides.map((s) => {
          if (s.id !== id) return s;
          const current = s.payload[slot] as GraficadorRef | undefined;
          if (!current) return s;
          const merged: GraficadorRef = { graficador: current.graficador, args: { ...current.args, ...patch } };
          return { ...s, payload: { ...s.payload, [slot]: merged } };
        }),
      },
    }));
  },

  setPresets: (presets) => set(() => dirty({ presets })),
  setWPresets: (wPresets) => set(() => dirty({ wPresets })),

  // `select` NO marca dirty: la selección del slide activo es estado
  // visual; persistirlo igual para que al refrescar la pestaña el usuario
  // caiga en el mismo slide, pero no tiene sentido disparar autosave solo
  // por hacer click en otro slide.
  select: (id) => set({ selectedSlideId: id, dirty: true }),

  loadPlan: (plan) => set(() => dirty({ plan, selectedSlideId: plan.slides[0]?.id ?? null })),

  reset: () => set(() => dirty({
    plan: { slides: [] }, selectedSlideId: null, presets: {}, wPresets: {},
    paletas: {}, iconos: [], overridesReusables: [],
    debugPh: DEFAULT_DEBUG_PH,
  })),

  // ----- Paletas ----------------------------------------------------------

  setPaleta: (listName, paleta) =>
    set((state) => dirty({
      paletas: { ...state.paletas, [listName]: paleta },
    })),

  setColorEnPaleta: (listName, label, hex) =>
    set((state) => {
      const prev = state.paletas[listName] ?? {};
      return dirty({
        paletas: {
          ...state.paletas,
          [listName]: { ...prev, [label]: hex },
        },
      });
    }),

  removePaleta: (listName) =>
    set((state) => {
      const next = { ...state.paletas };
      delete next[listName];
      return dirty({ paletas: next });
    }),

  // ----- Iconos -----------------------------------------------------------

  addIcono: (icono) =>
    set((state) => dirty({ iconos: [...state.iconos, icono] })),

  renameIcono: (id, nombre) =>
    set((state) => dirty({
      iconos: state.iconos.map((i) => (i.id === id ? { ...i, nombre } : i)),
    })),

  removeIcono: (id) =>
    set((state) => dirty({
      iconos: state.iconos.filter((i) => i.id !== id),
    })),

  // ----- Overrides reutilizables -----------------------------------------

  addOverrideReusable: (ov) =>
    set((state) => dirty({
      overridesReusables: [...state.overridesReusables, ov],
    })),

  updateOverrideReusable: (id, patch) =>
    set((state) => dirty({
      overridesReusables: state.overridesReusables.map((o) =>
        o.id === id ? { ...o, ...patch } : o,
      ),
    })),

  removeOverrideReusable: (id) =>
    set((state) => dirty({
      overridesReusables: state.overridesReusables.filter((o) => o.id !== id),
    })),

  setDebugPh: (patch) =>
    set((state) => dirty({
      debugPh: { ...state.debugPh, ...patch },
    })),
}));

// Mapa exportado de nombres humanos (para UIs que necesitan mostrar el
// tipo de slide sin ir al registry backend). Es fallback — la UI nueva
// debería consumir el registry para tener descripciones + iconos.
export const SLIDE_LABELS: Record<SlideType, string> = {
  p_slide_portada:                      "Portada",
  p_slide_indice:                       "Índice",
  p_slide_seccion:                      "Separador de sección",
  p_slide_objetivo_icono:               "Objetivo con ícono",
  p_slide_texto:                        "Bloque de texto",
  p_slide_tabla_tecnica:                "Tabla técnica",
  p_slide_1_grafico:                    "Un gráfico",
  p_slide_1_grafico_narrativo:          "Un gráfico + narrativa",
  p_slide_grafico_texto_derecha:        "Gráfico + texto derecha",
  p_slide_grafico_texto_izquierda:      "Gráfico + texto izquierda",
  p_slide_2_graficos:                   "Dos gráficos",
  p_slide_2_graficos_narrativo:         "Dos gráficos + narrativa",
  p_slide_2_graficos_texto_izquierda:   "Dos gráficos + texto izquierda",
  p_slide_2_graficos_texto_derecha:     "Dos gráficos + texto derecha",
  p_slide_4_graficos:                   "Cuatro gráficos",
  p_slide_2_graficos_poblacion:         "2 gráficos + ícono (población)",
  p_slide_4_graficos_poblacion:         "4 gráficos + ícono (población)",
  p_slide_5_graficos_poblacion:         "5 gráficos + ícono (población)",
  p_slide_6_graficos_poblacion:         "6 gráficos + ícono (población)",
};

// Slots de gráfico por tipo de slide (para iteración en la UI).
// Excluye slots especiales como `icono` (que no es un graficador, es PNG).
export const SLIDE_GRAF_SLOTS: Record<SlideType, string[]> = {
  p_slide_portada:                      [],
  p_slide_indice:                       [],
  p_slide_seccion:                      [],
  p_slide_objetivo_icono:               [],
  p_slide_texto:                        [],
  p_slide_tabla_tecnica:                [],
  p_slide_1_grafico:                    ["grafico"],
  p_slide_1_grafico_narrativo:          ["grafico"],
  p_slide_grafico_texto_derecha:        ["grafico"],
  p_slide_grafico_texto_izquierda:      ["grafico"],
  p_slide_2_graficos:                   ["izquierda", "derecha"],
  p_slide_2_graficos_narrativo:         ["izquierda", "derecha"],
  p_slide_2_graficos_texto_izquierda:   ["grafico_1", "grafico_2"],
  p_slide_2_graficos_texto_derecha:     ["grafico_1", "grafico_2"],
  p_slide_4_graficos:                   ["superior_izquierda", "superior_derecha", "inferior_izquierda", "inferior_derecha"],
  p_slide_2_graficos_poblacion:         ["izquierda", "derecha"],
  p_slide_4_graficos_poblacion:         ["superior_izquierda", "superior_derecha", "inferior_izquierda", "inferior_derecha"],
  p_slide_5_graficos_poblacion:         ["grafico_superior_1", "grafico_superior_2", "grafico_superior_3", "grafico_inferior_1", "grafico_inferior_2"],
  p_slide_6_graficos_poblacion:         ["grafico_superior_1", "grafico_superior_2", "grafico_superior_3", "grafico_inferior_1", "grafico_inferior_2", "grafico_inferior_3"],
};
