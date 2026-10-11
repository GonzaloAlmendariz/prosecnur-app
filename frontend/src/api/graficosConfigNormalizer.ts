import { normalizeEstiloCliente } from "./graficosEstilo";

type Dict = Record<string, unknown>;

const DEFAULT_DEBUG_PH = { activo: false, color: "#FF00FF", lwd: 0.6 };
const DEFAULT_CANVAS_VIEWPORT = { x: 0, y: 0, zoom: 1 };
// Espejo de `.WORD_PRESETS_DEFAULT_PULSO` (api/R/reporte_plan_word.R): el bloque `barras_apiladas` debe coincidir
// clave por clave con el de R (test-reporte-word-defaults-espejo.R). El recetario manda: las escalas apiladas del Word
// llevan su columna Top Two Box (propuesta-word.docx, figuras 13, 44, 45 y 47).
export const DEFAULT_WORD_PRESETS: Record<string, Record<string, unknown>> = {
  chart_options: { ocultar_etiqueta_si_titulo: true },
  chart_presets: {
    barras_apiladas: {
      mostrar_barra_extra: true,
      barra_extra_preset: "top2box",
      prefijo_barra_extra: "",
      titulo_barra_extra: "",

      canvas_w_etiquetas: 0.18,
      canvas_w_buf_etq_bars: 0,
      canvas_w_bars: 0.64,
      canvas_w_buf_bars_extra: 0.02,
      canvas_w_extra: 0.16,

      canvas_h_toprow_in: 0,
      canvas_h_legend_in: 0.42,
      canvas_h_caption_in: 0.45,
      canvas_h_panel_in_min: 1.1,
      alto_por_categoria: 0.55,

      grosor_barras_mult: 1.5,
      ancho_max_eje_y: 36,
      size_ejes: 7,
      size_texto_barras: 2.8,
      size_texto_barras_peq: 2.8,

      leyenda_posicion: "abajo",
      mostrar_leyenda: true,
      legend_key_cm: 0.18,
      legend_espaciado: 0,
      legend_n_por_fila: 10,
      size_leyenda: 8,
      size_barra_extra: 9,
      size_titulo_extra: 9,
      centro_cowplot: 0.5,
    },

    multi_apiladas: {
      mostrar_barra_extra: false,

      canvas_w_etiquetas: 0.3,
      canvas_w_buf_etq_bars: 0.02,
      canvas_w_bars: 0.6,
      canvas_w_extra: 0.08,

      canvas_h_toprow_in: 0,
      canvas_h_legend_in: 0.42,
      canvas_h_caption_in: 0.45,
      alto_por_categoria: 0.55,

      ancho_max_eje_y: 26,
      size_ejes: 9,
      size_titulos_grupo: 9,
      size_texto_barras: 2.8,
      size_texto_barras_peq: 2.8,
      size_barra_extra: 9,
      size_titulo_extra: 9,

      leyenda_posicion: "abajo",
      mostrar_leyenda: true,
      legend_key_cm: 0.18,
      legend_espaciado: 0,
      legend_n_por_fila: 10,
      size_leyenda: 8,
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
  "auto_otros_slides",
  "autoOtrosSlides",
  // ADR 0063: el sello de la declaración de equivalencias es campo de primera clase. Fuera de esta lista el normalizador
  // lo copiaba también en `_unknown`, y una lectura que sólo lo trajera ahí lo perdía al hidratar.
  "equivalencias_revision",
  "equivalenciasRevision",
  // ADR 0094 / contrato A6 §0.4: las opciones del documento Word son campo de primera clase. Desde `_unknown` el store
  // las descartaba al hidratar y sólo las salvaba el backend (`.graficos_conservar_campos_backend`).
  "documento_word",
  "documentoWord",
  // A6 R3: el estilo del cliente (logos y letra) es campo de primera clase por la misma razón.
  "estilo_cliente",
  "estiloCliente",
  "_unknown",
]);

function isObj(x: unknown): x is Dict {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

// jsonlite serializa una lista R vacía con nombres como `[]`: sobre un bloque que tiene default, `[]` significa «sin
// decisiones» y no «reemplazar el bloque por una lista vacía».
function deepMerge(base: Dict, override: Dict): Dict {
  const out: Dict = { ...base };
  for (const [key, raw] of Object.entries(override)) {
    const prev = out[key];
    const value = isObj(prev) && Array.isArray(raw) && raw.length === 0 ? {} : raw;
    out[key] = isObj(prev) && isObj(value) ? deepMerge(prev, value) : value;
  }
  return out;
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => sameValue(v, b[i]));
  }
  if (isObj(a) && isObj(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) if (!sameValue(a[key], b[key])) return false;
    return true;
  }
  return false;
}

function decisiones(actual: Dict, defaults: Dict): Dict {
  const out: Dict = {};
  for (const [key, value] of Object.entries(actual)) {
    const def = defaults[key];
    if (Array.isArray(value) && value.length === 0 && isObj(def)) continue;
    if (isObj(value) && (isObj(def) || def === undefined)) {
      const inner = decisiones(value, isObj(def) ? def : {});
      if (Object.keys(inner).length > 0) out[key] = inner;
    } else if (!sameValue(value, def)) {
      out[key] = value;
    }
  }
  return out;
}

/**
 * Decisión 5a (ADR 0094): sólo lo que difiere del default. Las hojas iguales al default y los contenedores que quedan
 * vacíos desaparecen; lo que no tiene default se conserva. Pura: no muta sus argumentos.
 */
export function wordPresetsDecisiones(actual: unknown, defaults: unknown): Record<string, Record<string, unknown>> {
  if (!isObj(actual)) return {};
  return decisiones(actual, isObj(defaults) ? defaults : {}) as Record<string, Record<string, unknown>>;
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

// Espejo de `.graficos_opciones_documento` (api/R/graficos_documento_word.R). Defensivo: lo inválido se descarta en vez
// de viajar y provocar el 400 del backend; lo ausente usa el default del recetario.
export type DocumentoWordContacto = Partial<Record<"correo" | "direccion" | "web", string>>;
export type DocumentoWordMetaPortada = Partial<Record<"ante" | "sub" | "para" | "por" | "fecha" | "version", string>>;
export type DocumentoWordOpciones = {
  portada?: "A" | "B" | "C";
  apertura?: "A" | "B";
  redondeo?: "estandar" | "resto_mayor" | "ambos";
  como_leer?: boolean;
  titulo_corto?: string;
  fuente?: string;
  contacto?: DocumentoWordContacto;
  meta_portada?: DocumentoWordMetaPortada;
};

const DOCUMENTO_WORD_ENUMS = {
  portada: ["A", "B", "C"],
  apertura: ["B", "A"],
  redondeo: ["estandar", "resto_mayor", "ambos"],
} as const;
const DOCUMENTO_WORD_CONTACTO = ["correo", "direccion", "web"] as const;
const DOCUMENTO_WORD_META_PORTADA = ["ante", "sub", "para", "por", "fecha", "version"] as const;

function texto(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function subTextos<K extends string>(value: unknown, claves: readonly K[]): Partial<Record<K, string>> | undefined {
  if (!isObj(value)) return undefined;
  const out: Partial<Record<K, string>> = {};
  for (const clave of claves) {
    const v = texto(value[clave]);
    if (v) out[clave] = v;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function enumValido<T extends string>(value: unknown, admitidos: readonly T[]): T | undefined {
  const v = texto(value);
  return (admitidos as readonly string[]).includes(v) ? v as T : undefined;
}

export function normalizeDocumentoWord(input: unknown): DocumentoWordOpciones {
  if (!isObj(input)) return {};
  const out: DocumentoWordOpciones = {};
  const portada = enumValido(input.portada, DOCUMENTO_WORD_ENUMS.portada);
  if (portada) out.portada = portada;
  const apertura = enumValido(input.apertura, DOCUMENTO_WORD_ENUMS.apertura);
  if (apertura) out.apertura = apertura;
  const redondeo = enumValido(input.redondeo, DOCUMENTO_WORD_ENUMS.redondeo);
  if (redondeo) out.redondeo = redondeo;
  // `"auto"` equivale a ausente.
  if (typeof input.como_leer === "boolean") out.como_leer = input.como_leer;
  const tituloCorto = texto(input.titulo_corto);
  if (tituloCorto) out.titulo_corto = tituloCorto;
  const fuente = texto(input.fuente);
  if (fuente) out.fuente = fuente;
  const contacto = subTextos(input.contacto, DOCUMENTO_WORD_CONTACTO);
  if (contacto) out.contacto = contacto;
  const metaPortada = subTextos(input.meta_portada, DOCUMENTO_WORD_META_PORTADA);
  if (metaPortada) out.meta_portada = metaPortada;
  return out;
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

  const planLeido = pick(source, "plan");
  // Un `plan.auto_otros_slides` (lo trae el plan sugerido del backend) no es parte del plan: sube a la raíz si ésta no
  // lo dice y siempre sale de `plan`, para que no le gane al interruptor sin avisar (router_graficos.R lo prefiere).
  const otrosDelPlan = isObj(planLeido) && typeof planLeido.auto_otros_slides === "boolean"
    ? planLeido.auto_otros_slides
    : undefined;
  const plan = isObj(planLeido) && "auto_otros_slides" in planLeido
    ? Object.fromEntries(Object.entries(planLeido).filter(([key]) => key !== "auto_otros_slides"))
    : planLeido;
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
  const unknownLeido = isObj(source._unknown) ? source._unknown : {};
  // El GET del backend todavía puede traer el sello sólo dentro de `_unknown` (lo guardó un front que no lo conocía): se
  // rescata de ahí cuando la raíz no lo trae.
  const equivalenciasRevision = pick(source, "equivalencias_revision", ["equivalenciasRevision"]) ??
    pick(unknownLeido, "equivalencias_revision", ["equivalenciasRevision"]);
  const autoOtrosSlides = pick(source, "auto_otros_slides", ["autoOtrosSlides"]) ?? otrosDelPlan;
  const documentoWord = pick(source, "documento_word", ["documentoWord"]);
  const estiloCliente = pick(source, "estilo_cliente", ["estiloCliente"]);

  const config: Dict = {
    version: "graficos/4",
    plan: isObj(plan) && Array.isArray(plan.slides) ? plan : { slides: [] },
    presets: isObj(presets) ? presets : {},
    w_presets: normalizeWordPresets(wPresets),
    // Siempre presente (aunque sea `{}`): una clave ausente hace que el backend conserve lo guardado, y `{}` es lo que
    // dice «volver al default» (contrato A6 §3, vitest 4).
    documento_word: normalizeDocumentoWord(documentoWord),
    // Igual: `{}` vuelve al recetario y la clave ausente conservaría lo guardado (contrato A6 §1, vitest 4 y 9).
    estilo_cliente: normalizeEstiloCliente(estiloCliente),
    selected_slide_id: typeof selectedSlideId === "string" ? selectedSlideId : null,
    paletas: isObj(paletas) ? paletas : {},
    iconos: Array.isArray(iconos) ? iconos : [],
    overrides_reusables: Array.isArray(overridesReusables) ? overridesReusables : [],
    debug_ph: isObj(debugPh) ? { ...DEFAULT_DEBUG_PH, ...debugPh } : DEFAULT_DEBUG_PH,
    view_mode: validViewMode(viewMode) ? viewMode : "timeline",
    inspector_tab: validInspectorTab(inspectorTab) ? inspectorTab : "content",
    density: validDensity(density) ? density : "comfortable",
    canvas_viewport: validViewport(canvasViewport) ? canvasViewport : DEFAULT_CANVAS_VIEWPORT,
    // ADR 0063. Campo de primera clase y no huésped de `_unknown`: de ahí
    // sobreviviría por accidente, y este sello es el que decide si el aviso de
    // desfase aparece.
    equivalencias_revision: typeof equivalenciasRevision === "string" ? equivalenciasRevision : "",
    // B42/G-18: campo de primera clase por la misma razón que el sello de
    // equivalencias. Desde `_unknown` el booleano sobreviviría sólo por
    // accidente, y este es el que decide si el PPT lleva las láminas de
    // «Otros» — en ACRD ING el plan guardado las tenía apagadas y al
    // regenerar desaparecían sin aviso (31 slides contra 39 entregadas).
    // La raíz manda; `scope_rules.global` es el fallback para una config
    // editada a mano antes de que existiera el interruptor. El fallback vive
    // ACÁ y no en un hidratador: los cuatro caminos de hydrate pasan por esta
    // función, y ponerlo en uno solo dejaba al import de paquete compartido
    // apagando una bandera que nadie tocó.
    auto_otros_slides: autoOtrosSlides === true ||
      (autoOtrosSlides === undefined && isObj(scopeRules) &&
        isObj(scopeRules.global) && scopeRules.global.auto_otros_slides === true),
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

  // El sello rescatado deja de viajar como huésped: una sola copia, la de la raíz.
  const restoUnknown = Object.fromEntries(
    Object.entries(unknownLeido).filter(([key]) => key !== "equivalencias_revision" && key !== "equivalenciasRevision"),
  );
  const unknown: Dict = {
    ...restoUnknown,
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
