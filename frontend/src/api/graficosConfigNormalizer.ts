type Dict = Record<string, unknown>;

const DEFAULT_DEBUG_PH = { activo: false, color: "#FF00FF", lwd: 0.6 };
const DEFAULT_CANVAS_VIEWPORT = { x: 0, y: 0, zoom: 1 };
export const DEFAULT_WORD_PRESETS: Record<string, Record<string, unknown>> = {
  chart_options: { ocultar_etiqueta_si_titulo: true },
  chart_presets: {
    barras_apiladas: {
      mostrar_barra_extra: false,
      barra_extra_preset: "ninguno",
      prefijo_barra_extra: "",
      titulo_barra_extra: "",

      canvas_w_etiquetas: 0.18,
      canvas_w_buf_etq_bars: 0,
      canvas_w_bars: 0.82,
      canvas_w_buf_bars_extra: 0,
      canvas_w_extra: 0,

      canvas_h_toprow_in: 0,
      canvas_h_legend_in: 0.42,
      canvas_h_caption_in: 0.45,
      canvas_h_panel_in_min: 1.1,
      alto_por_categoria: 0.55,

      grosor_barras_mult: 1.5,
      ancho_max_eje_y: 36,
      size_ejes: 7,
      size_texto_barras: 2.8,

      leyenda_posicion: "abajo",
      mostrar_leyenda: true,
      legend_key_cm: 0.15,
      legend_espaciado: 0,
      legend_n_por_fila: 10,
      size_leyenda: 6,
      centro_cowplot: 0.5,
    },
  },
};

const KNOWN_KEYS = new Set([
  "ok",
  "version",
  "exported_at",
  "exportedAt",
  "imported_at",
  "importedAt",
  "config",
  "plan",
  "presets",
  "w_presets",
  "wPresets",
  "selected_slide_id",
  "selectedSlideId",
  "paletas",
  "iconos",
  "overrides_reusables",
  "overridesReusables",
  "debug_ph",
  "debugPh",
  "view_mode",
  "viewMode",
  "inspector_tab",
  "inspectorTab",
  "density",
  "canvas_viewport",
  "canvasViewport",
  "scope_rules",
  "scopeRules",
  "_unknown",
]);

function isObj(x: unknown): x is Dict {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function deepMerge(base: Dict, override: Dict): Dict {
  const out: Dict = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const prev = out[key];
    out[key] = isObj(prev) && isObj(value) ? deepMerge(prev, value) : value;
  }
  return out;
}

export function createDefaultWordPresets(): Record<string, Record<string, unknown>> {
  return cloneValue(DEFAULT_WORD_PRESETS);
}

export function normalizeWordPresets(input: unknown): Record<string, Record<string, unknown>> {
  const defaults = createDefaultWordPresets();
  return isObj(input)
    ? deepMerge(defaults as Dict, input) as Record<string, Record<string, unknown>>
    : defaults;
}

function pick(source: Dict, canonical: string, aliases: string[] = []): unknown {
  if (source[canonical] !== undefined) return source[canonical];
  for (const alias of aliases) {
    if (source[alias] !== undefined) return source[alias];
  }
  return undefined;
}

function unknownFields(source: Dict): Dict {
  const out: Dict = {};
  for (const [key, value] of Object.entries(source)) {
    if (!KNOWN_KEYS.has(key)) out[key] = value;
  }
  return out;
}

function validViewMode(x: unknown) {
  return x === "timeline" || x === "canvas";
}

function validInspectorTab(x: unknown) {
  return x === "content" || x === "data" || x === "style" || x === "filters";
}

function validDensity(x: unknown) {
  return x === "comfortable" || x === "compact";
}

function validViewport(x: unknown) {
  return isObj(x) && typeof x.x === "number" && typeof x.y === "number" && typeof x.zoom === "number";
}

export function normalizeGraficosConfig(input: unknown, options: { includeLegacyAliases?: boolean } = {}): Dict {
  const envelope = isObj(input) ? input : {};
  const source = isObj(envelope.config) ? envelope.config : envelope;

  const plan = pick(source, "plan");
  const presets = pick(source, "presets");
  const wPresets = pick(source, "w_presets", ["wPresets"]);
  const selectedSlideId = pick(source, "selected_slide_id", ["selectedSlideId"]);
  const paletas = pick(source, "paletas");
  const iconos = pick(source, "iconos");
  const overridesReusables = pick(source, "overrides_reusables", ["overridesReusables"]);
  const debugPh = pick(source, "debug_ph", ["debugPh"]);
  const viewMode = pick(source, "view_mode", ["viewMode"]);
  const inspectorTab = pick(source, "inspector_tab", ["inspectorTab"]);
  const density = pick(source, "density");
  const canvasViewport = pick(source, "canvas_viewport", ["canvasViewport"]);
  const scopeRules = pick(source, "scope_rules", ["scopeRules"]);

  const config: Dict = {
    version: "graficos/4",
    plan: isObj(plan) && Array.isArray(plan.slides) ? plan : { slides: [] },
    presets: isObj(presets) ? presets : {},
    w_presets: normalizeWordPresets(wPresets),
    selected_slide_id: typeof selectedSlideId === "string" ? selectedSlideId : null,
    paletas: isObj(paletas) ? paletas : {},
    iconos: Array.isArray(iconos) ? iconos : [],
    overrides_reusables: Array.isArray(overridesReusables) ? overridesReusables : [],
    debug_ph: isObj(debugPh) ? { ...DEFAULT_DEBUG_PH, ...debugPh } : DEFAULT_DEBUG_PH,
    view_mode: validViewMode(viewMode) ? viewMode : "timeline",
    inspector_tab: validInspectorTab(inspectorTab) ? inspectorTab : "content",
    density: validDensity(density) ? density : "comfortable",
    canvas_viewport: validViewport(canvasViewport) ? canvasViewport : DEFAULT_CANVAS_VIEWPORT,
  };

  config.scope_rules = isObj(scopeRules)
    ? scopeRules
    : {
        global: {
          presets: config.presets,
          paletas: config.paletas,
          overrides_reusables: config.overrides_reusables,
          debug_ph: config.debug_ph,
        },
      };

  const unknown = {
    ...(isObj(source._unknown) ? source._unknown : {}),
    ...unknownFields(source),
  };
  if (isObj(envelope.config)) {
    const envelopeUnknown = unknownFields(envelope);
    if (Object.keys(envelopeUnknown).length > 0) unknown.__bundle = envelopeUnknown;
  }
  if (Object.keys(unknown).length > 0) config._unknown = unknown;

  if (options.includeLegacyAliases) {
    config.wPresets = config.w_presets;
    config.selectedSlideId = config.selected_slide_id;
    config.overridesReusables = config.overrides_reusables;
    config.canvasViewport = config.canvas_viewport;
    config.viewMode = config.view_mode;
    config.inspectorTab = config.inspector_tab;
    config.scopeRules = config.scope_rules;
  }

  return config;
}

export function normalizeGraficosConfigBundle(input: unknown, options: { includeLegacyAliases?: boolean } = {}) {
  const envelope = isObj(input) ? input : {};
  return {
    ...envelope,
    version: "graficos/4",
    config: normalizeGraficosConfig(input, options),
  };
}
