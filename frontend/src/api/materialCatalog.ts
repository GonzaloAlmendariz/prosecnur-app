// materialCatalog.ts — catálogo de tipos de material de Material de campo
// (ADR 0109 §3, pestaña Catálogo › Tipos).
//
// Contrato `collection_material_catalog/v1`:
//   GET  /api/recopiladores/material-catalog          → lista de tipos (presets)
//   POST /api/recopiladores/material-catalog/preview  → PNG de una página real
//
// Vive aparte de `recopiladores.ts` porque es un dominio propio —qué materiales
// existen y cómo se ven—, no el estado del despliegue. Los normalizadores son
// defensivos: un campo que falta se lee como ausente, no se inventa.
//
// «Usar este tipo» no tiene endpoint propio: fija la plantilla activa con el
// PUT de `/material-template` que ya usa el editor. Para eso hace falta la
// plantilla del tipo, y esa la arma el backend. Mientras el catálogo no la
// traiga en `template`, la función lo dice con un error explícito
// (`MaterialCatalogSinPlantillaError`) en vez de improvisar una plantilla en el
// frontend, que se desincronizaría del registro cerrado de presets.

import { apiFetch, handle, headers } from "./core";
import {
  apiRecopiladoresMaterialTemplatePut,
  type CollectionMaterialTemplate,
  type CollectionMaterialTemplatePayload,
} from "./recopiladores";

export const MATERIAL_CATALOG_SCHEMA = "collection_material_catalog/v1";

export type MaterialCatalogOrientation = "portrait" | "landscape";

export type MaterialCatalogPreset = {
  preset_id: string;
  title: string;
  family: string;
  /** Rótulo de la familia si el backend lo manda; si no, se deriva de `family`. */
  family_label: string | null;
  material_kind: string;
  pages_per_unit: number;
  orientation: MaterialCatalogOrientation;
  faces: 1 | 2;
  /** Cada cuánto se imprime una copia: `unit`, `survey`, `site`, `once` o un número. */
  copies_per: string | number | null;
  /** Tamaño de papel si el backend lo declara (`A4`, `Letter`…). */
  paper: string | null;
  compatible_unit_types: string[];
  compatible: boolean;
  blocks_count: number;
  active: boolean;
  /** Plantilla lista para fijar como activa; opcional en el contrato. */
  template: CollectionMaterialTemplate | null;
};

export type MaterialCatalogPayload = {
  schema: typeof MATERIAL_CATALOG_SCHEMA;
  presets: MaterialCatalogPreset[];
};

export type MaterialCatalogPreview = {
  preset_id: string;
  page: number;
  pages: number;
  width: number;
  height: number;
  png_base64: string;
};

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function contractError(detail: string): Error {
  return new Error(`El backend devolvió un catálogo de materiales inválido: ${detail}`);
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function strOrNull(value: unknown): string | null {
  const text = str(value);
  return text ? text : null;
}

function nonNegativeInt(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : fallback;
}

function positiveInt(value: unknown, fallback: number): number {
  const n = nonNegativeInt(value, fallback);
  return n >= 1 ? n : fallback;
}

function stringList(value: unknown): string[] {
  // R serializa un vector de largo uno como escalar: se acepta como lista.
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  if (!Array.isArray(value)) return [];
  return value.map(str).filter(Boolean);
}

function bool(value: unknown): boolean {
  if (Array.isArray(value)) return bool(value[0]);
  return value === true || value === "true" || value === 1;
}

function templateOrNull(value: unknown): CollectionMaterialTemplate | null {
  if (!isRecord(value) || value.schema !== "collection_material_template/v1") return null;
  if (!str(value.preset_id) || !Array.isArray(value.pages)) return null;
  return value as unknown as CollectionMaterialTemplate;
}

export function normalizeMaterialCatalogPreset(value: unknown): MaterialCatalogPreset | null {
  if (!isRecord(value)) return null;
  const presetId = str(value.preset_id);
  if (!presetId) return null;
  const copies = value.copies_per;
  return {
    preset_id: presetId,
    title: str(value.title) || presetId,
    family: str(value.family),
    family_label: strOrNull(value.family_label),
    material_kind: str(value.material_kind),
    pages_per_unit: positiveInt(value.pages_per_unit, 1),
    orientation: value.orientation === "landscape" ? "landscape" : "portrait",
    faces: Number(value.faces) === 2 ? 2 : 1,
    copies_per: typeof copies === "number" && Number.isFinite(copies)
      ? copies
      : strOrNull(copies),
    paper: strOrNull(value.paper) ?? strOrNull(value.page_size),
    compatible_unit_types: stringList(value.compatible_unit_types),
    // Sin la marca —o con el `logical(0)` que R serializa como `[]` cuando no
    // hay plan— el tipo se trata como compatible: atenuarlo sin un motivo
    // sería afirmar algo que el backend no dijo.
    compatible: value.compatible === undefined || value.compatible === null
      || (Array.isArray(value.compatible) && value.compatible.length === 0)
      ? true
      : bool(value.compatible),
    blocks_count: nonNegativeInt(value.blocks_count, 0),
    active: bool(value.active),
    template: templateOrNull(value.template),
  };
}

export function normalizeMaterialCatalog(value: unknown): MaterialCatalogPayload {
  if (!isRecord(value)) throw contractError("la respuesta no es un objeto.");
  const raw = isRecord(value.catalog) ? value.catalog : value;
  if (raw.schema !== MATERIAL_CATALOG_SCHEMA) {
    throw contractError(`no cumple ${MATERIAL_CATALOG_SCHEMA}.`);
  }
  const lista = Array.isArray(raw.presets) ? raw.presets : isRecord(raw.presets) ? [raw.presets] : [];
  const vistos = new Set<string>();
  const presets: MaterialCatalogPreset[] = [];
  for (const item of lista) {
    const preset = normalizeMaterialCatalogPreset(item);
    // Un id repetido haría que dos tarjetas compartan selección y miniatura.
    if (!preset || vistos.has(preset.preset_id)) continue;
    vistos.add(preset.preset_id);
    presets.push(preset);
  }
  return { schema: MATERIAL_CATALOG_SCHEMA, presets };
}

export function normalizeMaterialCatalogPreview(value: unknown): MaterialCatalogPreview {
  if (!isRecord(value)) throw contractError("la vista previa no es un objeto.");
  const png = str(value.png_base64).replace(/^data:image\/png;base64,/, "");
  if (!png) throw contractError("la vista previa no trae imagen.");
  const page = positiveInt(value.page, 1);
  return {
    preset_id: str(value.preset_id),
    page,
    pages: Math.max(positiveInt(value.pages, 1), page),
    width: nonNegativeInt(value.width, 0),
    height: nonNegativeInt(value.height, 0),
    png_base64: png,
  };
}

/** `src` listo para un `<img>`. */
export function materialPreviewSrc(preview: MaterialCatalogPreview): string {
  return `data:image/png;base64,${preview.png_base64}`;
}

export async function apiMaterialCatalog(): Promise<MaterialCatalogPayload> {
  const raw = await handle<unknown>(await apiFetch(
    "/api/recopiladores/material-catalog",
    { headers: headers() },
  ));
  return normalizeMaterialCatalog(raw);
}

export async function apiMaterialCatalogPreview(input: {
  preset_id: string;
  page: number;
}): Promise<MaterialCatalogPreview> {
  const raw = await handle<unknown>(await apiFetch(
    "/api/recopiladores/material-catalog/preview",
    {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(input),
    },
  ));
  return normalizeMaterialCatalogPreview(raw);
}

/** El catálogo no trae la plantilla del tipo: el backend todavía no la expone. */
export class MaterialCatalogSinPlantillaError extends Error {
  readonly preset_id: string;
  constructor(presetId: string) {
    super("Este tipo todavía no se puede fijar desde el catálogo. Ábrelo en el editor.");
    this.name = "MaterialCatalogSinPlantillaError";
    this.preset_id = presetId;
  }
}

/**
 * Fija el tipo como plantilla activa con el PUT de `/material-template`.
 *
 * Pendiente de backend: requiere que el catálogo traiga `template` por tipo
 * (`collection_material_template/v1`). Sin ella rechaza con
 * `MaterialCatalogSinPlantillaError` y no toca nada.
 */
export async function apiMaterialCatalogUsar(input: {
  preset: MaterialCatalogPreset;
  expected_revision: number;
}): Promise<CollectionMaterialTemplatePayload> {
  if (!input.preset.template) throw new MaterialCatalogSinPlantillaError(input.preset.preset_id);
  return apiRecopiladoresMaterialTemplatePut({
    expected_revision: input.expected_revision,
    template: input.preset.template,
  });
}
