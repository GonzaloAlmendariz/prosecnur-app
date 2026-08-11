import type {
  ArgChoice,
  ArgGrupo,
  ArgMetadata,
  ArgMetadataDependencia,
  ArgTipoInput,
  GraficadorAuthoringMode,
  GraficadorBlueprintKind,
  GraficadorCapabilityKey,
  GraficadorCategoria,
  GraficadorDataRequirement,
  GraficadorMetadata,
  PresetsRegistry,
  Registry,
  SlideBlueprint,
  SlideBlueprintKind,
  SlideCategoria,
  SlideMetadata,
  SlideSlotRole,
  SlideSlotSpec,
} from "../../api/client";
import { safeText } from "./safeText";
import { resolveGraficadorContract } from "./slidePreviewModel";

const ARG_TIPO_INPUTS: Record<ArgTipoInput, true> = {
  variable: true,
  variable_opt: true,
  variables_list: true,
  string: true,
  textarea: true,
  technical_rows: true,
  number: true,
  bool: true,
  choice: true,
  codigos_list: true,
  multiflag: true,
  color: true,
  colores_list: true,
  iconos_list: true,
  categorias_escala: true,
  base_labels: true,
  series_colors: true,
  criteria_config: true,
  icono: true,
  overrides: true,
  filtros: true,
  base_config: true,
  meta: true,
};

const ARG_GRUPOS: Record<ArgGrupo, true> = {
  datos: true,
  lectura: true,
  valores: true,
  leyenda: true,
  espacio: true,
  diagnostico: true,
  textos: true,
  estilo: true,
  filtro: true,
  semaforo: true,
  canvas: true,
  tabla: true,
  avanzado: true,
};

const SLIDE_CATEGORIAS: Record<SlideCategoria, true> = {
  estructural: true,
  "1grafico": true,
  "2graficos": true,
  "4graficos": true,
  poblacion: true,
  otro: true,
};

const SLIDE_BLUEPRINT_KINDS: Record<SlideBlueprintKind, true> = {
  cover: true,
  index: true,
  section: true,
  objective: true,
  text: true,
  technical: true,
  topTwo: true,
  single: true,
  singleNarrative: true,
  splitRight: true,
  splitLeft: true,
  two: true,
  twoNarrative: true,
  twoTextLeft: true,
  twoTextRight: true,
  grid4: true,
  population2: true,
  population4: true,
  population5: true,
  population6: true,
  neutral: true,
};

const SLIDE_SLOT_ROLES: Record<SlideSlotRole, true> = {
  chart: true,
  icon: true,
  unknown: true,
};

const GRAFICADOR_CATEGORIAS: Record<GraficadorCategoria, true> = {
  distribution: true,
  numeric: true,
  comparison: true,
  text: true,
  dimensions: true,
  territory: true,
  other: true,
};

const GRAFICADOR_BLUEPRINT_KINDS: Record<GraficadorBlueprintKind, true> = {
  "bars-grouped": true,
  "bars-categorical": true,
  "bars-stacked": true,
  "bars-multi-stacked": true,
  pie: true,
  donut: true,
  numeric: true,
  histogram: true,
  boxplot: true,
  "mean-range": true,
  "bars-diverging": true,
  "comparison-dots": true,
  dumbbell: true,
  lollipop: true,
  "line-series": true,
  radar: true,
  table: true,
  "word-cloud": true,
  "territory-map": true,
  "dimension-radar": true,
  "dimension-heatmap": true,
  "dimension-radar-bars": true,
  "dimension-foda": true,
  "dimension-criteria-heatmap": true,
  future: true,
};

const GRAFICADOR_CAPABILITY_KEYS: Record<GraficadorCapabilityKey, true> = {
  "": true,
  dimensions: true,
  territorial_coverage: true,
  equivalences_exactly_two: true,
  equivalences_temporal: true,
  unknown: true,
};

const GRAFICADOR_AUTHORING_MODES: Record<GraficadorAuthoringMode, true> = {
  direct: true,
  generated: true,
  unknown: true,
};

const GRAFICADOR_DATA_REQUIREMENTS: Record<GraficadorDataRequirement, true> = {
  var_or_vars: true,
  var_cruces_corte: true,
  named_vars: true,
  capability: true,
  unknown: true,
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : null;
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function isArgTipoInput(value: unknown): value is ArgTipoInput {
  return typeof value === "string" && hasOwn(ARG_TIPO_INPUTS, value);
}

function isArgGrupo(value: unknown): value is ArgGrupo {
  return typeof value === "string" && hasOwn(ARG_GRUPOS, value);
}

function isSlideCategoria(value: unknown): value is SlideCategoria {
  return typeof value === "string" && hasOwn(SLIDE_CATEGORIAS, value);
}

function isSlideBlueprintKind(value: unknown): value is SlideBlueprintKind {
  return typeof value === "string" && hasOwn(SLIDE_BLUEPRINT_KINDS, value);
}

function isSlideSlotRole(value: unknown): value is SlideSlotRole {
  return typeof value === "string" && hasOwn(SLIDE_SLOT_ROLES, value);
}

function isGraficadorCategoria(value: unknown): value is GraficadorCategoria {
  return typeof value === "string" && hasOwn(GRAFICADOR_CATEGORIAS, value);
}

function isGraficadorBlueprintKind(value: unknown): value is GraficadorBlueprintKind {
  return typeof value === "string" && hasOwn(GRAFICADOR_BLUEPRINT_KINDS, value);
}

function isGraficadorCapabilityKey(value: unknown): value is GraficadorCapabilityKey {
  return typeof value === "string" && hasOwn(GRAFICADOR_CAPABILITY_KEYS, value);
}

function isGraficadorAuthoringMode(value: unknown): value is GraficadorAuthoringMode {
  return typeof value === "string" && hasOwn(GRAFICADOR_AUTHORING_MODES, value);
}

function isGraficadorDataRequirement(value: unknown): value is GraficadorDataRequirement {
  return typeof value === "string" && hasOwn(GRAFICADOR_DATA_REQUIREMENTS, value);
}

function normalizedStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => safeText(item).trim()).filter(Boolean);
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function normalizeChoice(value: unknown): ArgChoice | null {
  const choice = asRecord(value);
  if (!choice) return null;
  const normalizedValue = safeText(choice.value).trim();
  if (!normalizedValue) return null;
  const hint = safeText(choice.hint).trim();
  return {
    value: normalizedValue,
    label: safeText(choice.label, normalizedValue).trim() || normalizedValue,
    ...(hint ? { hint } : {}),
  };
}

function normalizedChoices(value: unknown): ArgChoice[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value
    .map(normalizeChoice)
    .filter((choice): choice is ArgChoice => choice !== null);
}

function normalizeArgDependencia(value: unknown): ArgMetadataDependencia | undefined {
  const dependencia = asRecord(value);
  if (!dependencia || typeof dependencia.arg !== "string") return undefined;
  const arg = dependencia.arg.trim();
  if (!arg) return undefined;
  const rawValues = Array.isArray(dependencia.valores)
    ? dependencia.valores
    : [dependencia.valores];
  const valores = rawValues
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
  return valores.length > 0 ? { arg, valores } : undefined;
}

export function normalizeArgMetadata(value: unknown): ArgMetadata {
  const arg = asRecord(value) ?? {};
  const name = safeText(arg.name).trim();
  const tipoInput = safeText(arg.tipo_input).trim();
  const grupo = safeText(arg.grupo).trim();
  const descripcion = safeText(arg.descripcion).trim();
  const unidad = safeText(arg.unidad).trim();
  const control = safeText(arg.control).trim();
  const efecto = safeText(arg.efecto).trim();
  const normalized: ArgMetadata = {
    name,
    label: safeText(arg.label, name || "Campo").trim() || name || "Campo",
    tipo_input: isArgTipoInput(tipoInput) ? tipoInput : "string",
    grupo: isArgGrupo(grupo) ? grupo : "diagnostico",
    relacionados: normalizedStrings(arg.relacionados),
    choices: normalizedChoices(arg.choices),
    opciones: normalizedChoices(arg.opciones),
  };

  if (descripcion) normalized.descripcion = descripcion;
  if (unidad) normalized.unidad = unidad;
  if (control) normalized.control = control;
  if (efecto) normalized.efecto = efecto;
  const depende = normalizeArgDependencia(arg.depende);
  if (depende) normalized.depende = depende;
  const min = optionalNumber(arg.min);
  const max = optionalNumber(arg.max);
  const step = optionalNumber(arg.step);
  if (min !== undefined) normalized.min = min;
  if (max !== undefined) normalized.max = max;
  if (step !== undefined) normalized.step = step;
  if (hasOwn(arg, "default")) normalized.default = arg.default;
  // El normalizador es una whitelist: lo que no se copie aquí se pierde entre
  // el registry y la UI sin que nadie lo note. `ranuras` es lo que convierte
  // una lista plana de colores o de íconos en ranuras con nombre.
  const ranuras = normalizedStrings(arg.ranuras);
  if (ranuras.length) normalized.ranuras = ranuras;
  const ejemplo = safeText(arg.ejemplo).trim();
  if (ejemplo) normalized.ejemplo = ejemplo;
  if (safeText(arg.ranuras_desde).trim() === "secciones_indice") {
    normalized.ranuras_desde = "secciones_indice";
  }
  return normalized;
}

function normalizeSlideBlueprint(value: unknown): SlideBlueprint {
  const blueprint = asRecord(value) ?? {};
  const kind = safeText(blueprint.kind).trim();
  return {
    kind: isSlideBlueprintKind(kind) ? kind : "neutral",
    ppt_layout: safeText(blueprint.ppt_layout).trim(),
    structure_label: safeText(blueprint.structure_label, "Composición compatible").trim()
      || "Composición compatible",
  };
}

function humanizeMetadataName(value: string): string {
  const words = value.split("_").filter(Boolean).join(" ");
  return words ? `${words.charAt(0).toLocaleUpperCase("es")}${words.slice(1)}` : "Zona";
}

function normalizeSlideSlotSpec(value: unknown): SlideSlotSpec | null {
  const spec = asRecord(value);
  if (!spec) return null;
  const name = safeText(spec.name).trim();
  if (!name) return null;
  const role = safeText(spec.role).trim();
  return {
    name,
    role: isSlideSlotRole(role) ? role : "unknown",
    label: safeText(spec.label, humanizeMetadataName(name)).trim() || humanizeMetadataName(name),
  };
}

function normalizeSlideSlotSpecs(value: unknown): SlideSlotSpec[] {
  if (!Array.isArray(value)) return [];
  const names = new Set<string>();
  const specs: SlideSlotSpec[] = [];
  for (const item of value) {
    const spec = normalizeSlideSlotSpec(item);
    if (!spec || names.has(spec.name)) continue;
    names.add(spec.name);
    specs.push(spec);
  }
  return specs;
}

function normalizeSlideMetadata(value: unknown): SlideMetadata {
  const slide = asRecord(value) ?? {};
  const name = safeText(slide.name).trim();
  const categoria = safeText(slide.categoria).trim();
  return {
    name,
    render_key: safeText(slide.render_key).trim(),
    titulo_humano: safeText(slide.titulo_humano, name).trim() || name,
    descripcion: safeText(slide.descripcion).trim(),
    icono_ui: safeText(slide.icono_ui, "FileText").trim() || "FileText",
    categoria: isSlideCategoria(categoria) ? categoria : "otro",
    blueprint: normalizeSlideBlueprint(slide.blueprint),
    ...(hasOwn(slide, "slot_specs")
      ? { slot_specs: normalizeSlideSlotSpecs(slide.slot_specs) }
      : {}),
    slots: normalizedStrings(slide.slots),
    args: Array.isArray(slide.args) ? slide.args.map(normalizeArgMetadata) : [],
    args_extra: normalizedStrings(slide.args_extra),
  };
}

function normalizeGraficadorMetadata(value: unknown): GraficadorMetadata {
  const graf = asRecord(value) ?? {};
  const name = safeText(graf.name).trim();
  const categoria = safeText(graf.categoria).trim();
  const blueprint = safeText(graf.blueprint).trim();
  const rawCapabilityKey = safeText(graf.capability_key).trim();
  const rawAuthoringMode = safeText(graf.authoring_mode).trim();
  const rawDataRequirement = safeText(graf.data_requirement).trim();
  const normalized: GraficadorMetadata = {
    name,
    titulo_humano: safeText(graf.titulo_humano, name).trim() || name,
    descripcion: safeText(graf.descripcion).trim(),
    icono_ui: safeText(graf.icono_ui, "BarChart").trim() || "BarChart",
    categoria: isGraficadorCategoria(categoria) ? categoria : "other",
    blueprint: isGraficadorBlueprintKind(blueprint) ? blueprint : "future",
    requisito: safeText(graf.requisito).trim(),
    feature_kind: safeText(graf.feature_kind).trim(),
    available: graf.available !== false,
    disabled_reason: safeText(graf.disabled_reason).trim(),
    ...(hasOwn(graf, "capability_key")
      ? { capability_key: isGraficadorCapabilityKey(rawCapabilityKey) ? rawCapabilityKey : "unknown" }
      : {}),
    ...(hasOwn(graf, "requirement_label")
      ? { requirement_label: safeText(graf.requirement_label).trim() }
      : {}),
    ...(hasOwn(graf, "authoring_mode")
      ? { authoring_mode: isGraficadorAuthoringMode(rawAuthoringMode) ? rawAuthoringMode : "unknown" }
      : {}),
    ...(hasOwn(graf, "data_requirement")
      ? { data_requirement: isGraficadorDataRequirement(rawDataRequirement) ? rawDataRequirement : "unknown" }
      : {}),
    ...(hasOwn(graf, "preset_key") ? { preset_key: safeText(graf.preset_key).trim() } : {}),
    args: Array.isArray(graf.args) ? graf.args.map(normalizeArgMetadata) : [],
    args_extra: normalizedStrings(graf.args_extra),
  };
  const contract = resolveGraficadorContract(normalized);
  return {
    ...normalized,
    capability_key: contract.capabilityKey,
    requirement_label: contract.requirementLabel,
    authoring_mode: contract.authoringMode,
    data_requirement: contract.dataRequirement,
  };
}

export function normalizeGraficosRegistry(value: unknown): Registry {
  const registry = asRecord(value) ?? {};
  return {
    slides: Array.isArray(registry.slides) ? registry.slides.map(normalizeSlideMetadata) : [],
    graficadores: Array.isArray(registry.graficadores)
      ? registry.graficadores.map(normalizeGraficadorMetadata)
      : [],
  };
}

export function normalizePresetsRegistry(value: unknown): PresetsRegistry {
  const registry = asRecord(value) ?? {};
  return {
    presets: Array.isArray(registry.presets)
      ? registry.presets.map((value) => {
          const preset = asRecord(value) ?? {};
          const name = safeText(preset.name).trim();
          return {
            name,
            titulo_humano: safeText(preset.titulo_humano, name).trim() || name,
            descripcion: safeText(preset.descripcion).trim(),
            icono_ui: safeText(preset.icono_ui, "Sliders").trim() || "Sliders",
            args: Array.isArray(preset.args) ? preset.args.map(normalizeArgMetadata) : [],
          };
        })
      : [],
  };
}
