// graficos.ts — gráficos (PPT/Word) y su configuración.
// Extraído de client.ts (split por dominio, 2026-07). Los consumidores
// importan del barrel ./client; este módulo no cambia el contrato.

import { apiFetch, handle, headers } from "./core";
import { normalizeGraficosConfigBundle } from "./graficosConfigNormalizer";
import type { JobStart } from "./jobs";

// ---------- Gráficos (PPT/Word) ----------
//
// El registry backend es ahora un catálogo RICO con copy humano, tipos
// de input por arg, agrupación semántica y choices. La UI construye todo
// el editor dinámicamente a partir de este metadata.
// La fuente de verdad vive en `api/R/graficos_metadata.R`.

// Nombres canónicos de los tipos de slide en prosecnur (en español).
// Reemplaza los nombres viejos en inglés (p_slide_title, p_slide_1, etc.).
export type SlideType =
  // Estructurales (sin slots de gráfico)
  | "p_slide_portada"
  | "p_slide_indice"
  | "p_slide_seccion"
  | "p_slide_objetivo_icono"
  | "p_slide_texto"
  | "p_slide_tabla_tecnica"
  | "p_slide_top_two_box"
  // 1 gráfico
  | "p_slide_1_grafico"
  | "p_slide_1_grafico_narrativo"
  | "p_slide_grafico_texto_derecha"
  | "p_slide_grafico_texto_izquierda"
  // 2 gráficos
  | "p_slide_2_graficos"
  | "p_slide_2_graficos_narrativo"
  | "p_slide_2_graficos_texto_izquierda"
  | "p_slide_2_graficos_texto_derecha"
  // Grid 4
  | "p_slide_4_graficos"
  // Población (con ícono central)
  | "p_slide_2_graficos_poblacion"
  | "p_slide_4_graficos_poblacion"
  | "p_slide_5_graficos_poblacion"
  | "p_slide_6_graficos_poblacion";

export type SlideCategoria =
  | "estructural"
  | "1grafico"
  | "2graficos"
  | "4graficos"
  | "poblacion"
  | "otro";

export type GraficadorRef = {
  graficador: string;
  args: Record<string, unknown>;
};

export type SlidePayload = Record<string, unknown>;

export type Slide = {
  id: string;
  tipo: SlideType;
  payload: SlidePayload;
};

export type PlanJson = {
  slides: Slide[];
};

// Tipos de input que el editor reconoce. Cada `tipo_input` mapea a un
// control UI específico en GraficadorForm/SlideEditor.
export type ArgTipoInput =
  | "variable"
  | "variable_opt"
  | "variables_list"
  | "string"
  | "textarea"
  | "technical_rows"
  | "number"
  | "bool"
  | "choice"
  | "codigos_list"
  // multiflag: multi-select de tokens con opciones cerradas.
  // El valor es un array de strings (mismos value que en `opciones`).
  // Ej. textos_negrita = c("titulo", "leyenda"). Se renderiza como
  // chips toggleables — ni texto libre ni radio exclusivo.
  | "multiflag"
  // color: picker de color (swatch + hex + popover con paletas del
  // estudio y presets comunes). Acepta hex (#RRGGBB / #RGB) o
  // keywords CSS (white, black, transparent). Se renderiza con
  // <input type="color"> nativo como fallback al popover custom.
  | "color"
  // series_colors: editor visual de pares serie → color. El valor viaja
  // como objeto nombrado { "Serie": "#RRGGBB" }, sin edición JSON.
  | "series_colors"
  // criteria_config: editor visual de criterios/conductores, cada uno
  // con titulo y variables asociadas.
  | "criteria_config"
  | "icono"
  | "overrides"
  | "filtros"
  | "base_config"
  | "meta";

export type ArgGrupo =
  | "datos"
  | "lectura"
  | "valores"
  | "leyenda"
  | "espacio"
  | "diagnostico"
  | "textos"
  | "estilo"
  | "filtro"
  | "semaforo"
  | "canvas"   // dimensiones del canvas interno (canvas_w_*, canvas_h_*,
               // alto_por_categoria…) — concentra ~10 args por preset que
               // antes iban a "avanzado" y lo saturaban.
  | "tabla"    // específico de radar_tabla: todo lo que afecta la tabla
               // derecha (tabla_header_fill, tabla_body_size, …).
  | "avanzado";

export type ArgChoice = {
  value: string;
  label: string;
  hint?: string;
};

export type ArgMetadata = {
  name: string;
  label: string;
  tipo_input: ArgTipoInput;
  grupo: ArgGrupo;
  descripcion?: string;
  unidad?: string;
  min?: number;
  max?: number;
  step?: number;
  control?: "stepper" | "slider" | string;
  relacionados?: string[];
  efecto?: string;
  choices?: ArgChoice[];
  // Opciones para `multiflag` (multi-select cerrado). Cada entry define
  // un token aceptable. Si el arg es `multiflag` y `opciones` no viene,
  // el UI lo degrada a texto libre como fallback de compat.
  opciones?: ArgChoice[];
  // Valor por defecto documentado en el registry. Puede ser string/number/
  // bool. Usado por el PresetsEditor como placeholder visual.
  default?: unknown;
};

export type SlideMetadata = {
  name: SlideType;
  titulo_humano: string;
  descripcion: string;
  icono_ui: string;
  categoria: SlideCategoria;
  slots: string[];
  args: ArgMetadata[];
  // args del formals() de la función R que no están en el catálogo curado
  // (el backend los usa con defaults; el frontend normalmente no los expone)
  args_extra: string[];
};

export type GraficadorMetadata = {
  name: string;
  titulo_humano: string;
  descripcion: string;
  icono_ui: string;
  // "dimensiones" indica que requiere reporte_dimensiones() ejecutado primero
  requisito?: string;
  feature_kind?: string;
  available?: boolean;
  disabled_reason?: string;
  args: ArgMetadata[];
  args_extra: string[];
};

export type Registry = {
  slides: SlideMetadata[];
  graficadores: GraficadorMetadata[];
};

export type VarInfo = {
  name: string;
  label: string;
  tipo: string;
  seccion: string;
  list_name?: string;
  choices?: { name: string; label: string }[];
  scale_signature?: string;
  graphable?: boolean;
  exclusion_reason?: string;
  is_recoded?: boolean;
  raw_parent?: string | null;
  preferred_variable?: string | null;
  covered_by?: string | null;
  integrated_in?: string | null;
  is_preferred?: boolean;
  data_available?: boolean;
  n_non_empty?: number;
  source_kind?: string;
  group_path?: string;
  section_reliable?: boolean;
  status?: string;
  coverage_countable?: boolean;
};

export async function apiGraficosRegistry() {
  return handle<Registry>(await apiFetch("/api/graficos/registry", { headers: headers() }));
}

// Metadata de los presets globales (p_presets). Cada entrada es un tipo
// (base, barras_apiladas, pie, dim_radar, …) con args curados para el
// PresetsEditor. Complementa a /registry (que cubre slides y graficadores,
// no presets globales).
export type PresetMetadata = {
  name: string;
  titulo_humano: string;
  descripcion: string;
  icono_ui: string;
  args: ArgMetadata[];
};

export type PresetsRegistry = {
  presets: PresetMetadata[];
};

export async function apiGraficosPresetsMetadata() {
  return handle<PresetsRegistry>(
    await apiFetch("/api/graficos/presets-metadata", { headers: headers() })
  );
}

// "Guardar como default" / "Restaurar fábrica" para los presets.
//
// El backend mantiene dos niveles de default:
//   1. factory: `.PRESETS_DEFAULT_PULSO` (hardcoded, del QMD).
//   2. user: lo que el analista guardó con POST /presets-defaults.
// El `apiGraficosConfigGet` inicial usa (2) si existe, sino (1).

export async function apiGraficosPresetsDefaultsGet() {
  return handle<{ ok: true; presets: Record<string, Record<string, unknown>>; es_custom: boolean }>(
    await apiFetch("/api/graficos/presets-defaults", { headers: headers() })
  );
}

export async function apiGraficosPresetsDefaultsSave(presets?: Record<string, Record<string, unknown>>) {
  return handle<{ ok: true; saved_at: string }>(
    await apiFetch("/api/graficos/presets-defaults", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(presets ? { presets } : {}),
    })
  );
}

export async function apiGraficosPresetsDefaultsReset() {
  return handle<{ ok: true }>(
    await apiFetch("/api/graficos/presets-defaults", {
      method: "DELETE",
      headers: headers(),
    })
  );
}

// Overrides defaults — mismo contrato que presets defaults, pero para
// la lista de overrides reusables que arrancan en cualquier estudio
// nuevo. El shape es un array (no un record) porque los overrides
// tienen id propio y pueden duplicarse por `tipo_preset`.
export type OverrideDefaultEntry = {
  id: string;
  nombre: string;
  tipo_preset: string;
  args: Record<string, unknown>;
};

export async function apiGraficosOverridesDefaultsGet() {
  return handle<{ ok: true; overrides: OverrideDefaultEntry[]; es_custom: boolean }>(
    await apiFetch("/api/graficos/overrides-defaults", { headers: headers() })
  );
}

export async function apiGraficosOverridesDefaultsSave(overrides?: OverrideDefaultEntry[]) {
  return handle<{ ok: true; saved_at: string }>(
    await apiFetch("/api/graficos/overrides-defaults", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(overrides ? { overrides } : {}),
    })
  );
}

export async function apiGraficosOverridesDefaultsReset() {
  return handle<{ ok: true }>(
    await apiFetch("/api/graficos/overrides-defaults", {
      method: "DELETE",
      headers: headers(),
    })
  );
}

// Templates de plan (planes pre-armados). Lo trae el backend como
// JSON plano; los ids de los slides son placeholders que el frontend
// regenera al aplicar el template para evitar colisiones.
export type TemplateMeta = {
  name: string;
  titulo_humano: string;
  descripcion: string;
  icono_ui: string;
  n_slides: number;
  plan: PlanJson;
};

export async function apiGraficosTemplates() {
  return handle<{ templates: TemplateMeta[] }>(
    await apiFetch("/api/graficos/templates", { headers: headers() })
  );
}

// Perfiles visuales de presentación. No modifican el plan de slides:
// aplican presets PPT, paletas, overrides y reglas de alcance al estado actual.
export type PptStyleProfileMeta = {
  name: string;
  titulo_humano: string;
  descripcion: string;
  icono_ui: string;
  preview_colors: string[];
  presets: Record<string, Record<string, unknown>>;
  paletas?: Record<string, Record<string, string>>;
  overrides_reusables?: OverrideDefaultEntry[];
  scope_rules?: Record<string, unknown>;
};

export async function apiGraficosPptStyleProfiles() {
  return handle<{ style_profiles: PptStyleProfileMeta[] }>(
    await apiFetch("/api/graficos/ppt-style-profiles", { headers: headers() })
  );
}

// Config persistida del plan de gráficos. Patrón idéntico a /analitica/config.
// Autosave debounced 2s vía `useGraficosAutosave`. Export/import como respaldo.
export async function apiGraficosConfigGet() {
  return handle<{ ok: true; config: unknown }>(
    await apiFetch("/api/graficos/config", { headers: headers() })
  );
}

export async function apiGraficosConfigPut(config: unknown) {
  return handle<{ ok: true; saved_at: string }>(
    await apiFetch("/api/graficos/config", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ config }),
    })
  );
}

export type GraficosConsolidadoDraft = {
  ok: true;
  schema: "graficos_consolidado_draft/v1" | string;
  revision: number;
  config: unknown;
};

export async function apiGraficosConsolidadoDraftGet() {
  return handle<GraficosConsolidadoDraft>(
    await apiFetch("/api/graficos/consolidado/draft", { headers: headers() }),
  );
}

export async function apiGraficosConsolidadoDraftPut(config: unknown, expectedRevision: number) {
  return handle<GraficosConsolidadoDraft>(
    await apiFetch("/api/graficos/consolidado/draft", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ config, expected_revision: expectedRevision }),
    }),
  );
}

export async function apiGraficosConfigExport() {
  return handle<{ ok: true; version: string; exported_at: string; config: unknown }>(
    await apiFetch("/api/graficos/config/export", { headers: headers() })
  );
}

export async function apiGraficosConfigImport(bundle: unknown) {
  return handle<{ ok: true; imported_at: string }>(
    await apiFetch("/api/graficos/config/import", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(normalizeGraficosConfigBundle(bundle, { includeLegacyAliases: true })),
    })
  );
}

export type GraficosShareMissingVariable = {
  code: string;
  label: string;
};

export type GraficosShareSkippedSlide = {
  slide_id: string;
  slide_title: string;
  tipo: string;
  missing_variables: GraficosShareMissingVariable[];
};

export type GraficosShareAffectedSlide = GraficosShareSkippedSlide;

export type GraficosShareBasePlan = {
  base_name: string;
  base_label?: string;
  action: "replace_graficos_plan" | string;
  selected_default: boolean;
  blocking: boolean;
  current: {
    n_slides: number;
    xlsform?: string;
    data?: string;
  };
  incoming: {
    n_slides_total: number;
    n_slides_applicable: number;
    n_slides_skipped: number;
  };
  impact: {
    variables_expected: number;
    variables_available: number;
    variables_missing: number;
    missing_variables: GraficosShareMissingVariable[];
    skipped_slides: GraficosShareSkippedSlide[];
    affected_slides: GraficosShareAffectedSlide[];
    effects: string[];
  };
  warnings: string[];
};

export type GraficosShareInspectResult = {
  ok: true;
  package_file_id: string;
  filename: string;
  manifest: {
    version: string;
    source_project_name: string;
    source_active_base?: string;
    created_at: string;
    n_slides: number;
    n_assets: number;
  };
  summary: {
    n_bases: number;
    n_compatible: number;
    n_blocking: number;
    n_warnings: number;
  };
  default_selected_bases: string[];
  bases: GraficosShareBasePlan[];
};

export type GraficosShareExportResult = {
  ok: true;
  file_id: string;
  filename: string;
  size: number;
  exported_at: string;
};

export type GraficosShareImportResult = {
  ok: true;
  imported_at: string;
  applied_bases: Array<{
    base_name: string;
    n_slides_applicable: number;
    n_slides_skipped: number;
    missing_variables: GraficosShareMissingVariable[];
    skipped_slides: GraficosShareSkippedSlide[];
    affected_slides: GraficosShareAffectedSlide[];
  }>;
  inspection: GraficosShareInspectResult;
};

export function normalizeShareArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function normalizeGraficosShareSlideWarnings(value: unknown): GraficosShareAffectedSlide[] {
  return normalizeShareArray<any>(value).map((slide) => ({
    slide_id: String(slide.slide_id ?? ""),
    slide_title: String(slide.slide_title ?? "Slide"),
    tipo: String(slide.tipo ?? ""),
    missing_variables: normalizeShareArray<any>(slide.missing_variables).map((v) => ({
      code: String(v.code ?? ""),
      label: String(v.label ?? v.code ?? ""),
    })),
  }));
}

function normalizeGraficosShareInspect(raw: any): GraficosShareInspectResult {
  const bases = normalizeShareArray<any>(raw.bases).map((base): GraficosShareBasePlan => ({
    base_name: String(base.base_name ?? ""),
    base_label: base.base_label == null ? undefined : String(base.base_label),
    action: String(base.action ?? "replace_graficos_plan"),
    selected_default: Boolean(base.selected_default),
    blocking: Boolean(base.blocking),
    current: {
      n_slides: Number(base.current?.n_slides ?? 0),
      xlsform: base.current?.xlsform == null ? undefined : String(base.current.xlsform),
      data: base.current?.data == null ? undefined : String(base.current.data),
    },
    incoming: {
      n_slides_total: Number(base.incoming?.n_slides_total ?? 0),
      n_slides_applicable: Number(base.incoming?.n_slides_applicable ?? 0),
      n_slides_skipped: Number(base.incoming?.n_slides_skipped ?? 0),
    },
    impact: {
      variables_expected: Number(base.impact?.variables_expected ?? 0),
      variables_available: Number(base.impact?.variables_available ?? 0),
      variables_missing: Number(base.impact?.variables_missing ?? 0),
      missing_variables: normalizeShareArray<any>(base.impact?.missing_variables).map((v) => ({
        code: String(v.code ?? ""),
        label: String(v.label ?? v.code ?? ""),
      })),
      skipped_slides: normalizeGraficosShareSlideWarnings(base.impact?.skipped_slides),
      affected_slides: normalizeGraficosShareSlideWarnings(base.impact?.affected_slides),
      effects: normalizeShareArray<any>(base.impact?.effects).map(String),
    },
    warnings: normalizeShareArray<any>(base.warnings).map(String),
  }));

  return {
    ok: true,
    package_file_id: String(raw.package_file_id ?? ""),
    filename: String(raw.filename ?? ""),
    manifest: {
      version: String(raw.manifest?.version ?? ""),
      source_project_name: String(raw.manifest?.source_project_name ?? ""),
      source_active_base: raw.manifest?.source_active_base == null ? undefined : String(raw.manifest.source_active_base),
      created_at: String(raw.manifest?.created_at ?? ""),
      n_slides: Number(raw.manifest?.n_slides ?? 0),
      n_assets: Number(raw.manifest?.n_assets ?? 0),
    },
    summary: {
      n_bases: Number(raw.summary?.n_bases ?? bases.length),
      n_compatible: Number(raw.summary?.n_compatible ?? bases.filter((b) => !b.blocking).length),
      n_blocking: Number(raw.summary?.n_blocking ?? bases.filter((b) => b.blocking).length),
      n_warnings: Number(raw.summary?.n_warnings ?? 0),
    },
    default_selected_bases: normalizeShareArray<any>(raw.default_selected_bases).map(String),
    bases,
  };
}

async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export async function apiGraficosShareExport() {
  return handle<GraficosShareExportResult>(
    await apiFetch("/api/graficos/share/export", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({}),
    })
  );
}

export async function apiGraficosShareInspect(input: File | { file_id?: string; filename?: string; data_base64?: string }) {
  const payload = typeof File !== "undefined" && input instanceof File
    ? { filename: input.name, data_base64: await fileToBase64(input) }
    : input;
  const raw = await handle<any>(
    await apiFetch("/api/graficos/share/inspect", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    })
  );
  return normalizeGraficosShareInspect(raw);
}

export async function apiGraficosShareImport(packageFileId: string, selectedBases: string[]) {
  const raw = await handle<any>(
    await apiFetch("/api/graficos/share/import", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ package_file_id: packageFileId, selected_bases: selectedBases }),
    })
  );
  return {
    ok: true,
    imported_at: String(raw.imported_at ?? ""),
    applied_bases: normalizeShareArray<any>(raw.applied_bases).map((base) => ({
      base_name: String(base.base_name ?? ""),
      n_slides_applicable: Number(base.n_slides_applicable ?? 0),
      n_slides_skipped: Number(base.n_slides_skipped ?? 0),
      missing_variables: normalizeShareArray<any>(base.missing_variables).map((v) => ({
        code: String(v.code ?? ""),
        label: String(v.label ?? v.code ?? ""),
      })),
      skipped_slides: normalizeGraficosShareSlideWarnings(base.skipped_slides),
      affected_slides: normalizeGraficosShareSlideWarnings(base.affected_slides),
    })),
    inspection: normalizeGraficosShareInspect(raw.inspection ?? {}),
  } as GraficosShareImportResult;
}

// Paletas sugeridas: el backend devuelve las listas de choices del
// instrumento XLSForm para que la UI pre-pueble el editor de paletas con
// los value-labels reales. El analista asigna colores y el store guarda
// `paletas: { list_name: { label: hex } }`.
export type PaletaChoiceItem = { name: string; label: string };
export type PaletaSugeridaEntry = {
  list_name: string;
  choices: PaletaChoiceItem[];
  /** Bases del estudio donde vive la lista (multibase). Ausente en configs
   *  viejas o proyectos de base única. */
  fuentes?: string[];
};

export async function apiGraficosPaletasSugeridas() {
  return handle<{ listas: PaletaSugeridaEntry[] }>(
    await apiFetch("/api/graficos/paletas-sugeridas", { headers: headers() })
  );
}

// Upload de ícono PNG. El frontend lee el archivo, lo pasa a base64,
// manda POST con `{nombre, data_base64}`. Respuesta: `{id, file_id, nombre}`.
// El store guarda la referencia en `iconos`; el archivo vive en
// `session/$sid/icons/*.png` y se sirve via `downloadUrl(file_id)`.
export type IconoUploadResponse = {
  ok: true;
  id: string;
  file_id: string;
  nombre: string;
  uploaded_at: string;
};

export async function apiGraficosIconoUpload(nombre: string, dataBase64: string) {
  return handle<IconoUploadResponse>(
    await apiFetch("/api/graficos/icons/upload", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ nombre, data_base64: dataBase64 }),
    })
  );
}

// Preview de UN slide: genera un mini-PPTX de 1 slide usando el mismo
// pipeline que el export completo. El backend intenta rasterizar ese PPTX
// con un renderer headless; si no hay renderer, mantiene el PPTX interno
// como fallback técnico pero la UI no obliga a descargarlo.
// Imagen PNG embebida en el .pptx del preview — una por slot de
// graficador (prosecnur con `usar_canvas=TRUE` renderiza cada slot como
// un PNG dentro del ZIP). El backend las extrae y devuelve inline como
// data-URL para que el frontend las muestre como <img> sin otra request.
export type PreviewImage = {
  filename: string;           // "image1.png", "image2.png", …
  png_base64: string;          // data:image/png;base64,…
  size: number;
};

export type SlideRenderedPreview = {
  png_base64: string;          // data:image/png;base64,… del slide completo
  width: number | null;
  height: number | null;
  renderer: string;            // "soffice+pdftoppm", "soffice+magick", …
};

export type PreviewSlideOptions = {
  preview_quality?: "quick" | "normal";
  include_images?: boolean;
  render_slide_preview?: boolean;
  scope?: "consolidated";
};

export type PreviewSlideResponse = {
  ok: true;
  file_id: string;             // id interno del mini-PPTX generado
  size: number;
  type: "pptx";
  images: PreviewImage[];      // vacío si el slide no tiene gráficos (ej. portada)
  slide_preview?: SlideRenderedPreview | null;
};

export type GraficosPreviewRendererStatus = {
  ok: true;
  available: boolean;
  renderer: string | null;
  platform: string | null;
  desktop_automation: boolean;
  message: string;
  renderers: Array<{
    id: string;
    available: boolean;
    configured: boolean;
    command?: string | null;
    script?: string | null;
    module?: string | null;
  }>;
};

export type GraficosSlideLayoutPlaceholder = {
  key: string;
  payload_key?: string | null;
  label?: string | null;
  role?: "chart" | "text" | "note" | "icon" | "shape" | string;
  type?: string | null;
  type_idx?: number | null;
  hidden?: boolean;
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

export type GraficosSlideLayoutPreview = {
  ok: true;
  tipo: string;
  contract?: string | null;
  layout?: string | null;
  aspectRatio: number;
  source?: "template" | "reference_local" | string;
  reason?: string | null;
  placeholders: GraficosSlideLayoutPlaceholder[];
};

export type GraficosSlideLayoutPreviewOptions = {
  profile_id?: string;
  template_id?: string;
};

export async function apiGraficosPreviewSlide(
  slide: Slide,
  config?: unknown,
  options?: PreviewSlideOptions
) {
  return handle<PreviewSlideResponse>(
    await apiFetch("/api/graficos/preview-slide", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ slide, config, ...options }),
    })
  );
}

export async function apiGraficosPreviewRenderer() {
  return handle<GraficosPreviewRendererStatus>(
    await apiFetch("/api/graficos/preview-renderer", {
      headers: headers(),
    })
  );
}

export async function apiGraficosSlideLayoutPreview(
  tipo: string,
  options: GraficosSlideLayoutPreviewOptions = {},
) {
  const params = new URLSearchParams({ tipo });
  if (options.profile_id) params.set("profile_id", options.profile_id);
  if (options.template_id) params.set("template_id", options.template_id);
  return handle<GraficosSlideLayoutPreview>(
    await apiFetch(`/api/graficos/slide-layout-preview?${params.toString()}`, {
      headers: headers(),
    })
  );
}

// Respuesta del endpoint de variables: agrupada por fuente (multi-base).
// Cuando hay una sola base, `multi` es false y el frontend puede mostrar
// los pickers sin dropdown de fuente.
export type VariablesBySource = {
  sources: { name: string; source_kind?: string; variables: VarInfo[] }[];
  multi: boolean;
  active_base?: string | null;
  processing_mode?: string | null;
};

export async function apiGraficosVariables(scope: "active" | "consolidated" = "active") {
  const query = scope === "consolidated" ? "?scope=consolidado" : "";
  return handle<VariablesBySource>(
    await apiFetch(`/api/graficos/variables${query}`, { headers: headers() })
  );
}

export type GraficosCoverageStatus =
  | "cubierta"
  | "sin_usar"
  | "no_graficable"
  | "cubierta_por_recodificada"
  | "integrada_en_otra_variable"
  | "excluida_intencionalmente"
  | "vacía"
  | string;

export type GraficosCoverageVariable = VarInfo & {
  status: GraficosCoverageStatus;
  coverage_countable?: boolean;
};

export type GraficosCoverageSource = {
  name: string;
  source_kind?: string;
  variables: GraficosCoverageVariable[];
};

export type GraficosCoverageSummary = {
  total_variables: number;
  graphable_variables: number;
  included_graphable: number;
  unused_graphable: number;
  not_graphable: number;
  empty: number;
  covered_by_recod: number;
  integrated: number;
  excluded_intentionally: number;
  included_refs: number;
};

export type GraficosCoverageResponse = {
  ok: true;
  summary: GraficosCoverageSummary;
  sources: GraficosCoverageSource[];
  warnings: string[];
};

export type GraficosReportTechnicalRow = {
  criterio: string;
  detalle: string;
};

export type GraficosReportDerivedVariable = {
  name: string;
  label: string;
  origin: string;
  source?: string;
};

export type GraficosReportInputs = {
  period: string;
  period_source: string;
  technical_rows: GraficosReportTechnicalRow[];
  derived_variables: GraficosReportDerivedVariable[];
  profile: {
    available: boolean;
    sex_variable?: string;
    age_variable?: string;
  };
  map_included: boolean;
  comparison_mode: string;
};

export type GraficosSuggestedPlanResponse = {
  ok: true;
  plan: PlanJson;
  profile_id?: string;
  template_id?: string;
  acnur_mode?: "general" | "territorial" | string;
  report_scope?: string;
  meta?: Record<string, unknown>;
  report_inputs?: GraficosReportInputs;
  coverage: GraficosCoverageResponse;
  warnings: string[];
  /** ADR 0063: qué generó esta propuesta. `equivalencias` = mazo declarado. */
  fuente?: string;
  declarada?: boolean;
  /** ADR 0063: revisión de la declaración de la que salió el mazo. */
  revision?: string;
  n_diapositivas?: number;
  /** Filas que no entraron al mazo, con su motivo. */
  fuera?: { etiqueta: string; motivo: string; detalle?: string }[];
};

export async function apiGraficosPlanCoverage(
  plan: PlanJson,
  config?: unknown,
  scope: "active" | "consolidated" = "active",
) {
  return handle<GraficosCoverageResponse>(
    await apiFetch("/api/graficos/plan/coverage", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        plan,
        config,
        ...(scope === "consolidated" ? { scope: "consolidado" } : {}),
      }),
    })
  );
}

export async function apiGraficosPlanSugerido(config?: unknown) {
  return handle<GraficosSuggestedPlanResponse>(
    await apiFetch("/api/graficos/plan/sugerido", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ config }),
    })
  );
}

export async function apiGraficosValidar(plan: PlanJson) {
  return handle<{ ok: boolean; errors: string[]; warnings: string[]; n_slides: number }>(
    await apiFetch("/api/graficos/validar", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ plan }),
    })
  );
}

export async function apiGraficosPpt(plan: PlanJson, presets?: Record<string, unknown>, w_presets?: Record<string, unknown>, config?: unknown) {
  return handle<JobStart>(
    await apiFetch("/api/graficos/ppt", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ plan, presets, w_presets, config }),
    })
  );
}

export async function apiGraficosWord(plan: PlanJson, presets?: Record<string, unknown>, w_presets?: Record<string, unknown>, config?: unknown) {
  return handle<JobStart>(
    await apiFetch("/api/graficos/word", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ plan, presets, w_presets, config }),
    })
  );
}

/** Exporta el PPT de TODAS las bases de un proyecto multi-base en un solo ZIP.
    Usa la config ya guardada por base (no el `plan` que esté abierto en el
    editor); requiere >= 2 bases con datos. */
export async function apiGraficosPptAll() {
  return handle<JobStart>(
    await apiFetch("/api/graficos/ppt-all", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      // El proxy de Vite reenvia POST con Content-Type JSON pero sin body
      // (Content-Length: 0 explicito) de forma distinta a una request
      // directa sin ese header — Plumber responde 400 antes de llegar al
      // handler. Un body explicito evita esa ambiguedad.
      body: JSON.stringify({}),
    })
  );
}

export type GraficosConsolidadoPreflight = {
  ok: true;
  schema: "graficos_consolidado/v1" | string;
  ready: boolean;
  blockers: Array<{
    code: string;
    message: string;
    bases?: string[];
    refs?: string[];
    requirements?: Array<{
      base: string;
      actor: string;
      status: string;
      ready: boolean;
      blockers: Array<{ code: string; message: string }>;
    }>;
  }>;
  source_order: string[];
  releases: Array<{
    base: string;
    actor: string;
    release_id: string;
    input_fingerprint: string;
    n_rows: number;
    weighting_sha256: string;
  }>;
  input_fingerprint: string;
  plan_sha256: string;
  n_slides: number;
  n_comparison_slides: number;
  warnings: string[];
  /** Solo con `includePlan`: el plan sugerido que respalda `n_slides`. */
  plan?: { slides: unknown[] };
};

/**
 * Un único PPTX que compone todas las bases hermanas aprobadas.
 *
 * `includePlan` trae además el plan sugerido que el backend ya armó para
 * contar `n_slides`. Es opt-in porque pesa ~48 KB contra los ~4 KB de los
 * contadores: el menú del conjunto se abre muchas veces y no lo necesita; el
 * editor compartido sí, para sembrar sus diapositivas sin recalcular nada.
 */
export async function apiGraficosConsolidadoPreflight(
  options: { includePlan?: boolean } = {},
) {
  const query = options.includePlan ? "?include_plan=1" : "";
  return handle<GraficosConsolidadoPreflight>(
    await apiFetch(`/api/graficos/consolidado/preflight${query}`, { headers: headers() }),
  );
}

export async function apiGraficosPptConsolidado(
  presets?: Record<string, unknown>,
  expectedRevision?: number,
) {
  return handle<JobStart>(
    await apiFetch("/api/graficos/consolidado/ppt", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ presets, expected_revision: expectedRevision }),
    }),
  );
}

export async function apiAnaliticaEnumeradores(col_enumerador: string) {
  return handle<JobStart>(
    await apiFetch("/api/analitica/enumeradores", {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ col_enumerador }),
    })
  );
}
