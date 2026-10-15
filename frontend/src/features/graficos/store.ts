import { create } from "zustand";
import type { GraficadorRef, PlanJson, PptStyleProfileMeta, Slide, SlideType } from "../../api/client";
import { scopeRulesConIdentidad, type PlanSugeridoAplicable } from "./armarDesde/aplicarPlanSugerido";
import {
  createDefaultWordPresets,
  normalizeDocumentoWord,
  normalizeWordPresets,
  type DocumentoWordOpciones,
} from "../../api/graficosConfigNormalizer";
import type { GraficosConfigDefaults } from "../../api/graficosConfigDefaults";
import { normalizeEstiloCliente, type EstiloCliente } from "../../api/graficosEstilo";
import { conVinculo, vinculosDecisiones } from "./paletasResolver";
import { sinEstiloDePerfil } from "./estiloInforme/quitarLineaVisual";

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

export type ScopeRulesConfig = Record<string, unknown> & {
  coverage_exclusions?: string[];
};

// UI-state persistido (v3): preferencias visuales del editor v2. No
// participa del undo/redo (es estado de vista, no de contenido).
export type ViewMode = "timeline" | "canvas";
export type InspectorTab = "content" | "data" | "style" | "filters";
export type Density = "comfortable" | "compact";
export type CanvasViewport = { x: number; y: number; zoom: number };

// Config persistida en el backend. Lo que el autosave envía y recibe.
// Version 2 añadió: paletas, iconos, overrides_reusables, debug_ph.
// Version 3 añade UI-state del editor v2 (view_mode, inspector_tab, density, canvas_viewport).
// Version 4 normaliza aliases camel/snake y preserva reglas por alcance.
export type GraficosConfig = {
  version: 2 | 3 | 4 | "graficos/4";
  plan: PlanJson;
  presets: Record<string, Record<string, unknown>>;
  w_presets: Record<string, Record<string, unknown>>;
  /** ADR 0094: opciones del documento Word (portada, apertura, …); sólo lo que el usuario decidió. */
  documento_word?: DocumentoWordOpciones;
  /** A6 R3: estilo del cliente (ámbito, logos, letra). Sólo las decisiones cuentan como «Propio». */
  estilo_cliente?: EstiloCliente;
  selected_slide_id: string | null;

  // Bloque 2: configuración global de estilo
  paletas: Record<string, PaletaPorLista>;   // list_name → {label: hex}
  /** ADR 0097: `list_name` del instrumento → clave de `paletas`. Sólo decisiones; ausente = sin vínculo. */
  paletas_vinculos?: Record<string, string>;
  iconos: IconoConfig[];
  overrides_reusables: OverrideReusable[];
  debug_ph: DebugPh;

  // Bloque v3: UI-state del editor v2 (opcional para retro-compat)
  view_mode?: ViewMode;
  inspector_tab?: InspectorTab;
  density?: Density;
  canvas_viewport?: CanvasViewport;


  /** B42/G-18: si el PPT lleva las láminas de listado de «Otros». Opt-in. */
  auto_otros_slides?: boolean;

  // Bloque v4: reglas flexibles por alcance. La UI puede ignorarlas; el
  // backend las conserva y las resuelve para export/render.
  scope_rules?: Record<string, unknown>;
  _unknown?: Record<string, unknown>;
};

// Snapshot del estado persistido — lo que va al undo/redo stack. No
// incluye `selectedSlideId` porque la selección de slide es estado visual
// (cambiarla no debería contar como una acción deshacible — el usuario
// espera que Cmd+Z revierta ediciones de contenido, no saltos de slide).
type Snapshot = {
  plan: PlanJson;
  presets: Record<string, Record<string, unknown>>;
  wPresets: Record<string, Record<string, unknown>>;
  documentoWord: DocumentoWordOpciones;
  estiloCliente: EstiloCliente;
  paletas: Record<string, PaletaPorLista>;
  paletasVinculos: Record<string, string>;
  iconos: IconoConfig[];
  overridesReusables: OverrideReusable[];
  debugPh: DebugPh;
  scopeRules: ScopeRulesConfig;
  /** G6: el interruptor de «Otros» cambia la salida, así que se deshace con Ctrl/⌘+Z como cualquier edición. */
  autoOtrosSlides: boolean;
};

// Tope del stack. 30 acciones cubre el flujo típico de edición (crear
// slide → configurarlo → ajustar → volver) sin inflar la memoria si el
// analista edita mucho tiempo sin recargar.
const MAX_HISTORY = 30;

type PlanStore = {
  // --- Config principal (persistida) ---
  plan: PlanJson;
  presets: Record<string, Record<string, unknown>>;
  wPresets: Record<string, Record<string, unknown>>;
  documentoWord: DocumentoWordOpciones;
  estiloCliente: EstiloCliente;
  selectedSlideId: string | null;
  paletas: Record<string, PaletaPorLista>;
  /** ADR 0097: vínculos `list_name → clave de paleta` (sólo decisiones). */
  paletasVinculos: Record<string, string>;
  iconos: IconoConfig[];
  overridesReusables: OverrideReusable[];
  debugPh: DebugPh;
  scopeRules: ScopeRulesConfig;

  // --- UI-state del editor v2 (persistido pero NO historizado) ---
  viewMode: ViewMode;
  inspectorTab: InspectorTab;
  density: Density;
  canvasViewport: CanvasViewport;

  // --- Flags de sincronización ---
  /**
   * B42/G-18: inserta una lámina con el listado literal de respuestas «Otros»
   * después de cada gráfico cuya pregunta tenga campo abierto. Apagada por
   * defecto: es una opción del entregable, no una sorpresa del template.
   */
  autoOtrosSlides: boolean;
  setAutoOtrosSlides: (value: boolean) => void;
  /**
   * Aplica un plan sugerido en UN paso deshacible (contrato A5 2b): plan, sello de la declaración, perfil de estilo,
   * identidad en `scope_rules.global` y, sólo si el analista lo aceptó, el «Otros» que propone el plan.
   */
  aplicarPlanSugerido: (entrada: PlanSugeridoAplicable) => void;
  hydrated: boolean;
  /**
   * La carga de la config reintenta con backoff (hasta 15 s) y hasta ahora lo
   * hacía en silencio: el editor se pintaba vacío y no había forma de
   * distinguir «cargando» de «no hay láminas». Este flag es lo que permite
   * decirlo en pantalla.
   */
  hydrationRetrying: boolean;
  setHydrationRetrying: (retrying: boolean) => void;
  /**
   * Defaults que declara el backend en el GET de la config (ADR 0094 §6). No se persisten ni se historizan; `null`
   * cuando el backend no los manda, y entonces «Modificado» compara contra el espejo local.
   */
  configDefaults: GraficosConfigDefaults | null;
  setConfigDefaults: (defaults: GraficosConfigDefaults | null) => void;
  /**
   * `defaults.estilo_cliente` del GET (recetario + perfil + ámbito por defecto). Como `configDefaults`: ni se persiste
   * ni se historiza; `null` hasta que la pestaña Estilo del cliente los pide, y entonces se compara contra el recetario.
   */
  estiloClienteDefaults: EstiloCliente | null;
  setEstiloClienteDefaults: (defaults: EstiloCliente | null) => void;
  dirty: boolean;

  // --- Undo/redo ---
  past: Snapshot[];
  future: Snapshot[];
  undo: () => void;
  redo: () => void;

  // --- Lifecycle ---
  hydrate: (cfg: GraficosConfig) => void;
  markClean: () => void;

  // --- Setters del plan (marcan dirty) ---
  addSlide: (tipo: SlideType) => void;
  removeSlide: (id: string) => void;
  duplicateSlide: (id: string) => void;
  moveSlide: (id: string, direction: "up" | "down") => void;
  updateSlidePayload: (id: string, patch: Record<string, unknown>) => void;
  /** Cambia el tipo de una lámina con el payload ya reacomodado (laminas/selectores/cambioTipoLamina.ts). */
  setSlideTipo: (id: string, tipo: SlideType, payload: Record<string, unknown>) => void;
  /** Inserta una lámina en `index` (0-based) con su payload, la selecciona y devuelve su id (un paso deshacible). */
  insertSlideAt: (tipo: SlideType, payload: Record<string, unknown>, index: number) => string;
  setSlot: (id: string, slot: string, graf: GraficadorRef | null) => void;
  updateSlotArgs: (id: string, slot: string, patch: Record<string, unknown>) => void;
  setPresets: (presets: Record<string, Record<string, unknown>>) => void;
  setWPresets: (wPresets: Record<string, Record<string, unknown>>) => void;
  setDocumentoWord: (documentoWord: DocumentoWordOpciones) => void;
  /** Reemplaza el estilo del cliente (un paso deshacible). Las funciones de cambio viven en `estilo/modeloEstilo.ts`. */
  setEstiloCliente: (estiloCliente: EstiloCliente) => void;
  applyPptStyleProfile: (profile: PptStyleProfileMeta) => void;
  quitarPptStyleProfile: (profile: PptStyleProfileMeta) => void;
  /** ID3d: vuelve presets, paletas, ajustes guardados y reglas a un estado tomado antes (descartar cambios sobre una línea). */
  restaurarEstilo: (estado: Partial<Pick<PlanStore, "presets" | "paletas" | "overridesReusables" | "scopeRules">>) => void;
  // Merge granular de args en el preset `tipo`. Si `patch[arg] === null`
  // (o undefined después de merge), borra ese arg para que el backend
  // use el default. Usado por PresetsEditor para actualizar un arg a la vez.
  setPresetArg: (tipo: string, arg: string, value: unknown) => void;
  // Reemplaza el OBJETO COMPLETO de un preset (bypass de `setPresetArg`).
  // Si args queda vacío (`{}`), elimina el preset del map. Usado por el
  // Superficies visuales de presets y overrides reutilizables.
  replacePreset: (tipo: string, args: Record<string, unknown>) => void;
  // Reset completo de un preset tipo (vuelve a defaults de prosecnur).
  resetPreset: (tipo: string) => void;
  select: (id: string | null) => void;
  loadPlan: (plan: PlanJson) => void;
  reset: () => void;

  // --- Setters de configuración global (Bloque 2) ---
  setPaleta: (listName: string, paleta: PaletaPorLista) => void;
  /** Reemplaza el mapa de paletas entero en un solo paso deshacible (Colores de las respuestas pinta un grupo de listas a la vez). */
  setPaletas: (paletas: Record<string, PaletaPorLista>) => void;
  /** Paletas y vínculos juntos en un solo paso deshacible (nombrar o agrupar paletas en Colores de las respuestas). */
  setPaletasYVinculos: (paletas: Record<string, PaletaPorLista>, vinculos: Record<string, string>) => void;
  setColorEnPaleta: (listName: string, label: string, hex: string) => void;
  removePaleta: (listName: string) => void;
  removeColoresDePaleta: (listName: string, labels: string[]) => void;
  /** ADR 0097: vincula una lista del instrumento a una paleta (`null` quita el vínculo). Un paso deshacible. */
  setPaletaVinculo: (listName: string, clave: string | null) => void;

  addIcono: (icono: IconoConfig) => void;
  renameIcono: (id: string, nombre: string) => void;
  removeIcono: (id: string) => void;

  addOverrideReusable: (ov: OverrideReusable) => void;
  updateOverrideReusable: (id: string, patch: Partial<OverrideReusable>) => void;
  removeOverrideReusable: (id: string) => void;

  // Debug de placeholders (toggle global)
  setDebugPh: (patch: Partial<DebugPh>) => void;
  setScopeRules: (rules: ScopeRulesConfig) => void;
  setCoverageExcluded: (ref: string, excluded: boolean) => void;

  // --- Setters UI-state v2 (NO marcan dirty: persisten via autosave junto al resto, pero no historizan) ---
  setViewMode: (mode: ViewMode) => void;
  setInspectorTab: (tab: InspectorTab) => void;
  setDensity: (d: Density) => void;
  setCanvasViewport: (vp: CanvasViewport) => void;

  // Reordenar a una posición arbitraria (drag&drop). Diferente de moveSlide
  // (que solo hace ±1).
  moveSlideTo: (id: string, newIndex: number) => void;
};

export const DEFAULT_CANVAS_VIEWPORT: CanvasViewport = { x: 0, y: 0, zoom: 1 };

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
  p_slide_top_two_box:    {},
  // Sin título: el constructor trae el de la casa («CÓMO SE REDONDEAN LAS CIFRAS»).
  p_slide_redondeo:       {},
  p_slide_cierre:         { variante: "contraportada" },

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
  p_slide_2_graficos_vertical:        { titulo: "", base: "", superior: null, inferior: null },
  p_slide_2_graficos_asimetrico:      { titulo: "", base: "", principal: null, apoyo: null },
  p_slide_cifras_y_graficos: {
    titulo: "", base: "",
    cifra_izquierda: null, cifra_centro: null, cifra_derecha: null,
    grafico_izquierda: null, grafico_derecha: null,
  },

  // ---- 3 gráficos -----------------------------------------------------
  p_slide_3_graficos_2mas1:  { titulo: "", base: "", superior_izquierda: null, inferior_izquierda: null, derecha: null },
  p_slide_3_graficos_1mas2:  { titulo: "", base: "", izquierda: null, superior_derecha: null, inferior_derecha: null },
  p_slide_3_graficos_fila:   { titulo: "", base: "", izquierda: null, centro: null, derecha: null },
  p_slide_3_graficos_1arriba: { titulo: "", base: "", superior: null, inferior_izquierda: null, inferior_derecha: null },

  // ---- Grids ----------------------------------------------------------
  p_slide_4_graficos: {
    titulo: "", base: "", pie: "", etiqueta: "",
    superior_izquierda: null, superior_derecha: null,
    inferior_izquierda: null, inferior_derecha: null,
  },

  // ---- Población (con ícono central) ----------------------------------
  p_slide_3_graficos_poblacion_tira: { titulo: "", base: "", icono: null, superior: null, medio: null, inferior: null },
  p_slide_3_graficos_poblacion_corona: {
    titulo: "", base: "", icono: null,
    superior_izquierda: null, superior_derecha: null, inferior: null,
  },
  p_slide_3_graficos_poblacion_cifras: {
    titulo: "", base: "", icono: null,
    superior_izquierda: null, derecha: null, cifra_superior: null, inferior_izquierda: null, cifra_inferior: null,
  },
  p_slide_3_graficos_poblacion: {
    titulo: "", base: "", icono: null,
    superior_izquierda: null, inferior_izquierda: null, derecha: null,
  },
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

/** Payload con el que nace una lámina de `tipo` (copia: se puede mutar). */
export function payloadPorDefecto(tipo: SlideType): Record<string, unknown> {
  return { ...DEFAULT_PAYLOADS[tipo] };
}

/** Id estable de una lámina nueva (`s-` + 8 caracteres): el que nombra `foco=<id>` (ver `focoLamina.ts`). */
export function nuevoIdLamina(): string {
  return `s-${Math.random().toString(36).slice(2, 10)}`;
}

// Captura el estado persistido para el undo/redo stack.
function snapshotFromState(state: PlanStore): Snapshot {
  return {
    plan: state.plan,
    presets: state.presets,
    wPresets: state.wPresets,
    documentoWord: state.documentoWord,
    estiloCliente: state.estiloCliente,
    paletas: state.paletas,
    paletasVinculos: state.paletasVinculos,
    iconos: state.iconos,
    overridesReusables: state.overridesReusables,
    debugPh: state.debugPh,
    scopeRules: state.scopeRules,
    autoOtrosSlides: state.autoOtrosSlides,
  };
}

// Helper: marca `dirty: true` y pushea el state ACTUAL al stack `past`
// antes de aplicar el cambio. Vacía `future` porque una edición nueva
// invalida los redos pendientes (comportamiento estándar de undo/redo).
//
// Usado por todos los setters que alteran la config persistida. NO se
// usa en `select` (la selección de slide no es una acción deshacible).
function dirty<T extends object>(state: PlanStore, partial: T): T & {
  dirty: true;
  past: Snapshot[];
  future: Snapshot[];
} {
  const past = [...state.past, snapshotFromState(state)].slice(-MAX_HISTORY);
  return { ...partial, dirty: true, past, future: [] };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function mergeSlotArgsPatch(
  currentArgs: Record<string, unknown> = {},
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const merged = { ...currentArgs };
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === undefined) {
      delete merged[key];
    } else {
      merged[key] = value;
    }
  }
  return merged;
}

function mergeDeepRecord(
  base: Record<string, unknown> = {},
  patch: Record<string, unknown> = {},
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (isPlainRecord(out[key]) && isPlainRecord(value)) {
      out[key] = mergeDeepRecord(out[key] as Record<string, unknown>, value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function mergePresetMaps(
  base: Record<string, Record<string, unknown>>,
  patch: Record<string, Record<string, unknown>> = {},
): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = { ...base };
  for (const [presetName, args] of Object.entries(patch)) {
    out[presetName] = mergeDeepRecord(out[presetName] ?? {}, args ?? {}) as Record<string, unknown>;
  }
  return out;
}

function mergePaletas(
  base: Record<string, PaletaPorLista>,
  patch: Record<string, Record<string, string>> = {},
): Record<string, PaletaPorLista> {
  const out: Record<string, PaletaPorLista> = { ...base };
  for (const [listName, paleta] of Object.entries(patch)) {
    out[listName] = { ...(out[listName] ?? {}), ...(paleta ?? {}) };
  }
  return out;
}

function mergeOverrides(current: OverrideReusable[], incoming: OverrideReusable[] = []): OverrideReusable[] {
  if (!incoming.length) return current;
  const order = current.map((item) => item.id);
  const byId = new Map<string, OverrideReusable>();
  for (const item of current) byId.set(item.id, item);
  for (const item of incoming) {
    if (!item?.id) continue;
    if (!byId.has(item.id)) order.push(item.id);
    byId.set(item.id, item);
  }
  return order.map((id) => byId.get(id)).filter(Boolean) as OverrideReusable[];
}

/** Lo que un perfil de estilo PPT funde en el estado (mismo resultado en `applyPptStyleProfile` y al aplicar un plan). */
function estiloDePerfil(state: PlanStore, profile: PptStyleProfileMeta) {
  return {
    presets: mergePresetMaps(state.presets, profile.presets ?? {}),
    paletas: mergePaletas(state.paletas, profile.paletas ?? {}),
    overridesReusables: mergeOverrides(
      state.overridesReusables,
      (profile.overrides_reusables ?? []) as OverrideReusable[],
    ),
    scopeRules: mergeDeepRecord(state.scopeRules, profile.scope_rules ?? {}) as ScopeRulesConfig,
  };
}

export const usePlanStore = create<PlanStore>((set) => ({
  plan: { slides: [] },
  presets: {},
  wPresets: createDefaultWordPresets(),
  documentoWord: {},
  estiloCliente: {},
  selectedSlideId: null,
  paletas: {},
  paletasVinculos: {},
  iconos: [],
  overridesReusables: [],
  debugPh: DEFAULT_DEBUG_PH,
  scopeRules: {},

  viewMode: "timeline",
  inspectorTab: "content",
  density: "comfortable",
  canvasViewport: DEFAULT_CANVAS_VIEWPORT,

  autoOtrosSlides: false,
  setAutoOtrosSlides: (value) => set((state) => (
    state.autoOtrosSlides === value ? state : dirty(state, { autoOtrosSlides: value })
  )),
  aplicarPlanSugerido: ({ plan, perfil, identidad, autoOtrosSlides }) => set((state) => {
    const estilo = perfil ? estiloDePerfil(state, perfil) : null;
    return dirty(state, {
      plan,
      selectedSlideId: plan.slides[0]?.id ?? null,
      ...(estilo ?? {}),
      scopeRules: scopeRulesConIdentidad(estilo?.scopeRules ?? state.scopeRules, identidad) as ScopeRulesConfig,
      ...(autoOtrosSlides !== undefined ? { autoOtrosSlides } : {}),
    });
  }),
  hydrated: false,
  hydrationRetrying: false,
  setHydrationRetrying: (retrying) => set({ hydrationRetrying: retrying }),
  configDefaults: null,
  setConfigDefaults: (configDefaults) => set({ configDefaults }),
  estiloClienteDefaults: null,
  setEstiloClienteDefaults: (estiloClienteDefaults) => set({ estiloClienteDefaults }),
  dirty: false,

  past: [],
  future: [],

  // Undo: aplica el último snapshot del past, guardando el estado actual
  // en future para poder rehacer. Si past está vacío, no-op.
  undo: () => {
    set((state) => {
      if (state.past.length === 0) return state;
      const prev = state.past[state.past.length - 1];
      const past = state.past.slice(0, -1);
      const future = [...state.future, snapshotFromState(state)];
      return {
        ...prev,
        past,
        future,
        dirty: true,  // undo genera un cambio visible; autosave lo persiste
      };
    });
  },

  redo: () => {
    set((state) => {
      if (state.future.length === 0) return state;
      const next = state.future[state.future.length - 1];
      const future = state.future.slice(0, -1);
      const past = [...state.past, snapshotFromState(state)];
      return {
        ...next,
        past,
        future,
        dirty: true,
      };
    });
  },

  hydrate: (cfg) => set({
    plan: cfg.plan ?? { slides: [] },
    presets: cfg.presets ?? {},
    wPresets: normalizeWordPresets(cfg.w_presets),
    documentoWord: normalizeDocumentoWord(cfg.documento_word),
    estiloCliente: normalizeEstiloCliente(cfg.estilo_cliente),
    selectedSlideId: cfg.selected_slide_id ?? null,
    paletas: cfg.paletas ?? {},
    paletasVinculos: vinculosDecisiones(cfg.paletas_vinculos),
    iconos: cfg.iconos ?? [],
    overridesReusables: cfg.overrides_reusables ?? [],
    debugPh: { ...DEFAULT_DEBUG_PH, ...(cfg.debug_ph ?? {}) },
    scopeRules: cfg.scope_rules ?? {},
    viewMode: cfg.view_mode ?? "timeline",
    inspectorTab: cfg.inspector_tab ?? "content",
    density: cfg.density ?? "comfortable",
    canvasViewport: cfg.canvas_viewport ?? DEFAULT_CANVAS_VIEWPORT,
    autoOtrosSlides: cfg.auto_otros_slides === true,
    hydrated: true,
    hydrationRetrying: false,
    dirty: false,
    // El hydrate viene del backend (autosave inicial o import). No
    // historizamos el estado pre-hidratación porque era placeholder vacío.
    past: [],
    future: [],
  }),

  markClean: () => set({ dirty: false }),

  addSlide: (tipo) => {
    const s: Slide = { id: nuevoIdLamina(), tipo, payload: { ...DEFAULT_PAYLOADS[tipo] } };
    set((state) => dirty(state, {
      plan: { slides: [...state.plan.slides, s] },
      selectedSlideId: s.id,
    }));
  },

  removeSlide: (id) => {
    set((state) => {
      const slides = state.plan.slides.filter((s) => s.id !== id);
      const nextSelected = state.selectedSlideId === id ? (slides[0]?.id ?? null) : state.selectedSlideId;
      return dirty(state, { plan: { slides }, selectedSlideId: nextSelected });
    });
  },

  // Duplica un slide. El nuevo se inserta justo después del original,
  // con nuevo id pero payload idéntico (deep clone via JSON — nuestros
  // payloads son JSON-safe por construcción). Pasa a ser el slide
  // activo para que el analista pueda renombrarlo de inmediato.
  duplicateSlide: (id) => {
    set((state) => {
      const i = state.plan.slides.findIndex((s) => s.id === id);
      if (i < 0) return state;
      const source = state.plan.slides[i];
      const copy: Slide = {
        id: nuevoIdLamina(),
        tipo: source.tipo,
        payload: JSON.parse(JSON.stringify(source.payload)),
      };
      const slides = [
        ...state.plan.slides.slice(0, i + 1),
        copy,
        ...state.plan.slides.slice(i + 1),
      ];
      return dirty(state, { plan: { slides }, selectedSlideId: copy.id });
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
      return dirty(state, { plan: { slides } });
    });
  },

  updateSlidePayload: (id, patch) => {
    set((state) => dirty(state, {
      plan: {
        slides: state.plan.slides.map((s) =>
          s.id === id ? { ...s, payload: { ...s.payload, ...patch } } : s
        ),
      },
    }));
  },

  setSlideTipo: (id, tipo, payload) => {
    set((state) => dirty(state, {
      plan: { slides: state.plan.slides.map((s) => (s.id === id ? { ...s, tipo, payload } : s)) },
    }));
  },

  insertSlideAt: (tipo, payload, index) => {
    const s: Slide = { id: nuevoIdLamina(), tipo, payload };
    set((state) => {
      const i = Math.max(0, Math.min(state.plan.slides.length, Math.floor(index)));
      const slides = [...state.plan.slides.slice(0, i), s, ...state.plan.slides.slice(i)];
      return dirty(state, { plan: { slides }, selectedSlideId: s.id });
    });
    return s.id;
  },

  setSlot: (id, slot, graf) => {
    set((state) => dirty(state, {
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
    set((state) => dirty(state, {
      plan: {
        slides: state.plan.slides.map((s) => {
          if (s.id !== id) return s;
          const current = s.payload[slot] as GraficadorRef | undefined;
          if (!current) return s;
          const merged: GraficadorRef = {
            graficador: current.graficador,
            args: mergeSlotArgsPatch(current.args, patch),
          };
          return { ...s, payload: { ...s.payload, [slot]: merged } };
        }),
      },
    }));
  },

  setPresets: (presets) => set((state) => dirty(state, { presets })),
  setWPresets: (wPresets) => set((state) => dirty(state, { wPresets })),
  setDocumentoWord: (documentoWord) => set((state) => dirty(state, { documentoWord: normalizeDocumentoWord(documentoWord) })),
  setEstiloCliente: (estiloCliente) => set((state) => dirty(state, { estiloCliente: normalizeEstiloCliente(estiloCliente) })),

  applyPptStyleProfile: (profile) => set((state) => dirty(state, estiloDePerfil(state, profile))),
  quitarPptStyleProfile: (profile) => set((state) => dirty(state, sinEstiloDePerfil(state, profile) as Partial<PlanStore>)),
  restaurarEstilo: (estado) => set((state) => dirty(state, estado)),

  setPresetArg: (tipo, arg, value) => {
    set((state) => {
      const prev = state.presets[tipo] ?? {};
      const next = { ...prev };
      if (value === null || value === undefined || value === "") {
        delete next[arg];
      } else {
        next[arg] = value;
      }
      const presets = { ...state.presets };
      if (Object.keys(next).length === 0) {
        delete presets[tipo];
      } else {
        presets[tipo] = next;
      }
      return dirty(state, { presets });
    });
  },

  replacePreset: (tipo, args) =>
    set((state) => {
      const presets = { ...state.presets };
      if (!args || Object.keys(args).length === 0) {
        delete presets[tipo];
      } else {
        presets[tipo] = { ...args };
      }
      return dirty(state, { presets });
    }),

  resetPreset: (tipo) =>
    set((state) => {
      if (!(tipo in state.presets)) return state;
      const presets = { ...state.presets };
      delete presets[tipo];
      return dirty(state, { presets });
    }),

  // `select` NO marca dirty ni historiza: la selección del slide activo
  // es estado visual; persistirlo igual para que al refrescar la pestaña
  // el usuario caiga en el mismo slide, pero no tiene sentido disparar
  // autosave ni contaminar el undo stack solo por hacer click en otro slide.
  // Cambiar de lámina no es una edición: no marca `dirty` ni dispara el autosave. La selección viaja con el próximo
  // guardado real (F6.1; antes cada clic en el árbol escribía la config).
  select: (id) => set({ selectedSlideId: id }),

  loadPlan: (plan) => set((state) => dirty(state, {
    plan, selectedSlideId: plan.slides[0]?.id ?? null,
  })),

  reset: () => set((state) => dirty(state, {
    plan: { slides: [] }, selectedSlideId: null, presets: {}, wPresets: createDefaultWordPresets(),
    // `{}` y no `undefined`: la clave debe viajar para que el backend borre lo guardado (contrato A6, vitest 4).
    documentoWord: {},
    // Igual con el estilo del cliente: `{}` lo devuelve al recetario; el ámbito queda como estaba en el backend.
    estiloCliente: {},
    paletas: {}, paletasVinculos: {}, iconos: [], overridesReusables: [],
    debugPh: DEFAULT_DEBUG_PH,
    scopeRules: {},
    autoOtrosSlides: false,
  })),

  // ----- Paletas ----------------------------------------------------------

  setPaleta: (listName, paleta) =>
    set((state) => dirty(state, {
      paletas: { ...state.paletas, [listName]: paleta },
    })),

  setPaletas: (paletas) =>
    set((state) => (paletas === state.paletas ? state : dirty(state, { paletas }))),

  setPaletasYVinculos: (paletas, vinculos) =>
    set((state) => dirty(state, { paletas, paletasVinculos: vinculos })),

  setColorEnPaleta: (listName, label, hex) =>
    set((state) => {
      const prev = state.paletas[listName] ?? {};
      return dirty(state, {
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
      return dirty(state, { paletas: next });
    }),

  // Un mismo `list_name` puede alojar VARIAS escalas en un proyecto multibase
  // (`lst_p6` es la lista de grados en docentes y Sí/No en administrativos).
  // Comparten el mapa etiqueta → color porque sus etiquetas son disjuntas, así
  // que vaciar la escala que se está editando no puede borrar la entrada
  // entera: se quitan solo sus etiquetas.
  removeColoresDePaleta: (listName, labels) =>
    set((state) => {
      const prev = state.paletas[listName];
      if (!prev) return state;
      const restante = Object.fromEntries(
        Object.entries(prev).filter(([label]) => !labels.includes(label)),
      );
      const next = { ...state.paletas };
      if (Object.keys(restante).length) next[listName] = restante;
      else delete next[listName];
      return dirty(state, { paletas: next });
    }),

  // Sólo decisiones: quitar borra la clave y volver a poner la misma no historiza (`conVinculo` devuelve el mismo objeto).
  setPaletaVinculo: (listName, clave) =>
    set((state) => {
      const next = conVinculo(state.paletasVinculos, listName, clave);
      return next === state.paletasVinculos ? state : dirty(state, { paletasVinculos: next });
    }),

  // ----- Iconos -----------------------------------------------------------

  addIcono: (icono) =>
    set((state) => dirty(state, { iconos: [...state.iconos, icono] })),

  renameIcono: (id, nombre) =>
    set((state) => dirty(state, {
      iconos: state.iconos.map((i) => (i.id === id ? { ...i, nombre } : i)),
    })),

  removeIcono: (id) =>
    set((state) => dirty(state, {
      iconos: state.iconos.filter((i) => i.id !== id),
    })),

  // ----- Overrides reutilizables -----------------------------------------

  addOverrideReusable: (ov) =>
    set((state) => dirty(state, {
      overridesReusables: [...state.overridesReusables, ov],
    })),

  updateOverrideReusable: (id, patch) =>
    set((state) => dirty(state, {
      overridesReusables: state.overridesReusables.map((o) =>
        o.id === id ? { ...o, ...patch } : o,
      ),
    })),

  removeOverrideReusable: (id) =>
    set((state) => dirty(state, {
      overridesReusables: state.overridesReusables.filter((o) => o.id !== id),
    })),

  setDebugPh: (patch) =>
    set((state) => dirty(state, {
      debugPh: { ...state.debugPh, ...patch },
    })),

  setScopeRules: (rules) =>
    set((state) => dirty(state, {
      scopeRules: { ...rules },
    })),

  setCoverageExcluded: (ref, excluded) =>
    set((state) => {
      const cleanRef = String(ref ?? "").trim();
      if (!cleanRef) return state;
      const current = Array.isArray(state.scopeRules.coverage_exclusions)
        ? state.scopeRules.coverage_exclusions.map(String)
        : [];
      const nextSet = new Set(current);
      if (excluded) nextSet.add(cleanRef);
      else nextSet.delete(cleanRef);
      return dirty(state, {
        scopeRules: {
          ...state.scopeRules,
          coverage_exclusions: Array.from(nextSet),
        },
      });
    }),

  // ----- UI-state v2 (NO historizado, marca dirty para autosave) ----------
  setViewMode: (mode) => set({ viewMode: mode, dirty: true }),
  setInspectorTab: (tab) => set({ inspectorTab: tab, dirty: true }),
  setDensity: (d) => set({ density: d, dirty: true }),
  setCanvasViewport: (vp) => set({ canvasViewport: vp, dirty: true }),

  moveSlideTo: (id, newIndex) => {
    set((state) => {
      const i = state.plan.slides.findIndex((s) => s.id === id);
      if (i < 0) return state;
      const slides = [...state.plan.slides];
      const [moved] = slides.splice(i, 1);
      const target = Math.max(0, Math.min(slides.length, newIndex));
      slides.splice(target, 0, moved);
      return dirty(state, { plan: { slides } });
    });
  },
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
  p_slide_top_two_box:                  "Explicación Top Two Box",
  p_slide_redondeo:                     "Explicación del redondeo",
  p_slide_cierre:                       "Cierre",
  p_slide_1_grafico:                    "Un gráfico",
  p_slide_1_grafico_narrativo:          "Un gráfico + narrativa",
  p_slide_grafico_texto_derecha:        "Gráfico + texto derecha",
  p_slide_grafico_texto_izquierda:      "Gráfico + texto izquierda",
  p_slide_2_graficos:                   "Dos gráficos",
  p_slide_2_graficos_narrativo:         "Dos gráficos + narrativa",
  p_slide_2_graficos_texto_izquierda:   "Dos gráficos + texto izquierda",
  p_slide_2_graficos_texto_derecha:     "Dos gráficos + texto derecha",
  p_slide_2_graficos_vertical:          "Dos gráficos apilados",
  p_slide_2_graficos_asimetrico:        "Dos gráficos: principal y apoyo",
  p_slide_cifras_y_graficos:            "Banda de cifras + dos gráficos",
  p_slide_3_graficos_2mas1:             "Tres gráficos: dos apilados + uno alto",
  p_slide_3_graficos_1mas2:             "Tres gráficos: uno alto + dos apilados",
  p_slide_3_graficos_fila:              "Tres gráficos en fila",
  p_slide_3_graficos_1arriba:           "Tres gráficos: uno ancho arriba",
  p_slide_4_graficos:                   "Cuatro gráficos",
  p_slide_3_graficos_poblacion_tira:    "Tres franjas a lo ancho",
  p_slide_3_graficos_poblacion_corona:  "Tres gráficos: dos arriba y uno ancho",
  p_slide_3_graficos_poblacion_cifras:  "Tres gráficos + cifras",
  p_slide_2_graficos_poblacion:         "Dos gráficos",
  p_slide_3_graficos_poblacion:         "Tres gráficos",
  p_slide_4_graficos_poblacion:         "Cuatro gráficos",
  p_slide_5_graficos_poblacion:         "Cinco gráficos",
  p_slide_6_graficos_poblacion:         "Seis gráficos",
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
  p_slide_top_two_box:                  [],
  p_slide_redondeo:                     [],
  p_slide_cierre:                       [],
  p_slide_1_grafico:                    ["grafico"],
  p_slide_1_grafico_narrativo:          ["grafico"],
  p_slide_grafico_texto_derecha:        ["grafico"],
  p_slide_grafico_texto_izquierda:      ["grafico"],
  p_slide_2_graficos:                   ["izquierda", "derecha"],
  p_slide_2_graficos_narrativo:         ["izquierda", "derecha"],
  p_slide_2_graficos_texto_izquierda:   ["grafico_1", "grafico_2"],
  p_slide_2_graficos_texto_derecha:     ["grafico_1", "grafico_2"],
  p_slide_2_graficos_vertical:          ["superior", "inferior"],
  p_slide_2_graficos_asimetrico:        ["principal", "apoyo"],
  p_slide_cifras_y_graficos:            ["cifra_izquierda", "cifra_centro", "cifra_derecha", "grafico_izquierda", "grafico_derecha"],
  p_slide_3_graficos_2mas1:             ["superior_izquierda", "inferior_izquierda", "derecha"],
  p_slide_3_graficos_1mas2:             ["izquierda", "superior_derecha", "inferior_derecha"],
  p_slide_3_graficos_fila:              ["izquierda", "centro", "derecha"],
  p_slide_3_graficos_1arriba:           ["superior", "inferior_izquierda", "inferior_derecha"],
  p_slide_4_graficos:                   ["superior_izquierda", "superior_derecha", "inferior_izquierda", "inferior_derecha"],
  p_slide_3_graficos_poblacion_tira:    ["superior", "medio", "inferior"],
  p_slide_3_graficos_poblacion_corona:  ["superior_izquierda", "superior_derecha", "inferior"],
  p_slide_3_graficos_poblacion_cifras:  ["superior_izquierda", "derecha", "cifra_superior", "inferior_izquierda", "cifra_inferior"],
  p_slide_2_graficos_poblacion:         ["izquierda", "derecha"],
  p_slide_3_graficos_poblacion:         ["superior_izquierda", "inferior_izquierda", "derecha"],
  p_slide_4_graficos_poblacion:         ["superior_izquierda", "superior_derecha", "inferior_izquierda", "inferior_derecha"],
  p_slide_5_graficos_poblacion:         ["grafico_superior_1", "grafico_superior_2", "grafico_superior_3", "grafico_inferior_1", "grafico_inferior_2"],
  p_slide_6_graficos_poblacion:         ["grafico_superior_1", "grafico_superior_2", "grafico_superior_3", "grafico_inferior_1", "grafico_inferior_2", "grafico_inferior_3"],
};
