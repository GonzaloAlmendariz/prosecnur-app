// Exportar e importar el plan de gráficos por secciones (C12). Lógica pura: qué secciones existen, qué viaja en el
// archivo, cómo se combina lo entrante con lo actual y cómo se nombra el archivo. La usan por igual la barra de
// Láminas (menú ⋯) y la barra del Editor anterior: no hay otra copia de estas reglas.

export type GraficosJsonSectionId =
  | "plan"
  | "presets"
  | "w_presets"
  | "paletas"
  | "iconos"
  | "overrides_reusables"
  | "debug_ph"
  | "scope_rules"
  | "ui_state";

export type SeccionesJson = Record<GraficosJsonSectionId, boolean>;

export type ModoImportacionJson = "merge" | "replace";

export type SeccionJson = { id: GraficosJsonSectionId; label: string; help: string };

export const GRAFICOS_JSON_SECTIONS: readonly SeccionJson[] = [
  { id: "plan", label: "Láminas", help: "Orden y contenido de cada lámina." },
  { id: "presets", label: "Estilo para PPT", help: "Bases visuales para PowerPoint." },
  { id: "w_presets", label: "Estilo para Word", help: "Formato de gráficos y tablas." },
  { id: "paletas", label: "Colores", help: "Paletas de respuestas y categorías." },
  { id: "iconos", label: "Íconos", help: "Recursos para láminas de población." },
  { id: "overrides_reusables", label: "Estilos reutilizables", help: "Ajustes guardados para varios gráficos." },
  { id: "debug_ph", label: "Guías de edición", help: "Marcas temporales de espacio." },
  { id: "scope_rules", label: "Reglas por caso", help: "Ajustes por lista, gráfico o slide." },
  { id: "ui_state", label: "Vista de trabajo", help: "Vista, pestaña y zoom del editor." },
];

export function todasLasSecciones(valor: boolean): SeccionesJson {
  return Object.fromEntries(GRAFICOS_JSON_SECTIONS.map((s) => [s.id, valor])) as SeccionesJson;
}

export const SECCIONES_JSON_POR_DEFECTO: SeccionesJson = todasLasSecciones(true);

export function seccionesElegidas(secciones: SeccionesJson): SeccionJson[] {
  return GRAFICOS_JSON_SECTIONS.filter((s) => secciones[s.id]);
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

export function deepMerge<T extends Record<string, unknown>>(base: T, override: Record<string, unknown>): T {
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const actual = out[key];
    out[key] = isRecord(actual) && isRecord(value) ? deepMerge(actual, value) : value;
  }
  return out as T;
}

export function pickGraficosConfigSections(
  cfg: Record<string, unknown>,
  sections: SeccionesJson,
  mode: ModoImportacionJson,
): Record<string, unknown> {
  const out: Record<string, unknown> = { version: "graficos/4" };
  if (sections.plan) out.plan = cfg.plan;
  if (sections.presets) out.presets = cfg.presets;
  if (sections.w_presets) out.w_presets = cfg.w_presets;
  if (sections.paletas) out.paletas = cfg.paletas;
  if (sections.iconos) out.iconos = cfg.iconos;
  if (sections.overrides_reusables) out.overrides_reusables = cfg.overrides_reusables;
  if (sections.debug_ph) out.debug_ph = cfg.debug_ph;
  if (sections.scope_rules) out.scope_rules = cfg.scope_rules;
  if (sections.ui_state) {
    out.selected_slide_id = cfg.selected_slide_id;
    out.view_mode = cfg.view_mode;
    out.inspector_tab = cfg.inspector_tab;
    out.density = cfg.density;
    out.canvas_viewport = cfg.canvas_viewport;
  }
  if (cfg._unknown && mode === "replace") out._unknown = cfg._unknown;
  return out;
}

export function syncGlobalScopeRules(cfg: Record<string, unknown>, sections: SeccionesJson): Record<string, unknown> {
  if (!isRecord(cfg.scope_rules)) cfg.scope_rules = {};
  const scopeRules = cfg.scope_rules as Record<string, unknown>;
  const global: Record<string, unknown> = isRecord(scopeRules.global) ? { ...scopeRules.global } : {};
  if (sections.presets) global.presets = cfg.presets;
  if (sections.paletas) global.paletas = cfg.paletas;
  if (sections.overrides_reusables) global.overrides_reusables = cfg.overrides_reusables;
  if (sections.debug_ph) global.debug_ph = cfg.debug_ph;
  scopeRules.global = global;
  return cfg;
}

/** El archivo que se descarga: sobre `graficos/4` con las secciones elegidas y su lista en `export_scope`. */
export function armarExportacionJson(
  cfg: Record<string, unknown>,
  secciones: SeccionesJson,
  ahora: Date,
): { texto: string; nombreArchivo: string } {
  const elegidas = seccionesElegidas(secciones);
  const payload = {
    version: "graficos/4",
    exported_at: ahora.toISOString(),
    export_scope: elegidas.map((s) => s.id),
    config: pickGraficosConfigSections(cfg, secciones, "replace"),
  };
  const alcance = elegidas.length === GRAFICOS_JSON_SECTIONS.length ? "completo" : "parcial";
  return { texto: JSON.stringify(payload, null, 2), nombreArchivo: `pulso_graficos_${alcance}_${ahora.getTime()}.json` };
}

/**
 * Lo que se envía al importar: las secciones elegidas del archivo, combinadas con lo actual (`merge`) o en su lugar
 * (`replace`), con las reglas globales sincronizadas. `actual` y `entrante` ya pasaron por `normalizeGraficosConfig`.
 */
export function componerImportacion(
  actual: Record<string, unknown>,
  entrante: Record<string, unknown>,
  secciones: SeccionesJson,
  modo: ModoImportacionJson,
): Record<string, unknown> {
  const elegido = pickGraficosConfigSections(entrante, secciones, modo);
  const siguiente = modo === "replace" ? { ...actual, ...elegido } : deepMerge(actual, elegido);
  return syncGlobalScopeRules(siguiente, secciones);
}

export function rotuloSeccionesImportadas(n: number): string {
  return `${n} ${n === 1 ? "sección importada" : "secciones importadas"}`;
}
