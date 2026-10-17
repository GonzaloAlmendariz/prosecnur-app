// materialPreview.ts — la página real de la receta, con sus zonas por bloque
// (E1b «Editor sobre la página real», Material de campo).
//
// Contrato `collection_material_preview/v1`:
//   POST /api/recopiladores/material-template/preview
//     { page, template?, unit_id?, dpi? }  → PNG de UNA página + zonas en npc
//
// Es de solo lectura: no escribe estado, no pide `expected_revision`. Sin
// `template` dibuja la receta guardada; con él, el borrador del editor. Sin
// `unit_id` el backend elige la primera titular del plan, o una unidad de
// ejemplo si no hay plan.
//
// El JSON no trae datos de la unidad salvo su rótulo operativo: lo que la
// unidad pone en el papel viaja solo dentro de la imagen.
//
// Vive aparte de `recopiladores.ts` (estado del despliegue) y de
// `materialCatalog.ts` (tipos de fábrica): es la vista de UNA receta concreta.
// Los normalizadores son defensivos; una zona fuera de la página se descarta
// en vez de dibujarse donde no está.

import { ApiError, apiFetch, handle, headers } from "./core";
import type { CollectionMaterialTemplate } from "./recopiladores";

export const MATERIAL_PREVIEW_SCHEMA = "collection_material_preview/v1";

/** Resoluciones que acepta el endpoint. */
export const MATERIAL_PREVIEW_DPIS = [72, 90, 150] as const;
export type MaterialPreviewDpi = (typeof MATERIAL_PREVIEW_DPIS)[number];

/** Caja en fracción de página, origen arriba-izquierda. */
export type MaterialPreviewBbox = { x: number; y: number; w: number; h: number };

export type MaterialPreviewZone = {
  /** `null` en zonas derivadas (el enlace bajo el QR, por ejemplo). */
  block_id: string | null;
  type: string;
  kind: "block" | "derived";
  bbox: MaterialPreviewBbox;
  bbox_mm: MaterialPreviewBbox | null;
  /** Propiedades del bloque que cambian la tinta en este layout. */
  editable: string[];
  /** Si el layout apila este bloque de verdad, y por lo tanto se puede mover. */
  reorderable: boolean;
  /** Bindings que llenan la zona (`unit.venue`, `access.qr_payload`…). */
  fills_from: string[];
};

export type MaterialPreviewFace = {
  page: number;
  page_id: string;
  layout_preset: string;
  blocks: number;
};

export type MaterialPreviewUndrawnReason = "slot_taken" | "not_drawn_by_layout";

export type MaterialPreviewUndrawn = {
  block_id: string;
  type: string;
  reason: MaterialPreviewUndrawnReason;
};

export type MaterialPreviewWarning = {
  code: string;
  page: number | null;
  block_id: string | null;
};

export type MaterialPreviewUnitSource = "plan" | "ejemplo";
export type MaterialPreviewAccessSource = "deployment" | "ejemplo" | "sin_enlace";

export type MaterialPreview = {
  schema: typeof MATERIAL_PREVIEW_SCHEMA;
  draft: boolean;
  template_sha256: string;
  page: number;
  pages: number;
  page_id: string;
  layout_preset: string;
  orientation: "portrait" | "landscape";
  paper: string;
  page_mm: { w: number; h: number };
  dpi: number;
  width: number;
  height: number;
  png_base64: string;
  faces: MaterialPreviewFace[];
  unit: { source: MaterialPreviewUnitSource; unit_id: string | null; label: string };
  access: { source: MaterialPreviewAccessSource };
  zones: MaterialPreviewZone[];
  undrawn: MaterialPreviewUndrawn[];
  warnings: MaterialPreviewWarning[];
  cache: string;
  elapsed_ms: number | null;
};

/** Un problema del borrador, con la cara y el bloque donde vive. */
export type MaterialPreviewProblem = {
  path: string;
  code: string;
  detail: string;
  page: number | null;
  page_id: string | null;
  block_id: string | null;
};

export type MaterialPreviewRequest = {
  page: number;
  /** El borrador; sin él se dibuja la receta guardada. */
  template?: CollectionMaterialTemplate | null;
  /** `null`: la primera titular del plan, o la unidad de ejemplo. */
  unit_id?: string | null;
  dpi?: MaterialPreviewDpi;
};

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** R serializa un escalar como vector de largo uno: se acepta `[x]`. */
function escalar(value: unknown): unknown {
  return Array.isArray(value) && value.length === 1 ? value[0] : value;
}

function str(value: unknown): string {
  const v = escalar(value);
  return typeof v === "string" ? v.trim() : "";
}

function strOrNull(value: unknown): string | null {
  return str(value) || null;
}

function num(value: unknown): number | null {
  const v = escalar(value);
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : Number.NaN;
  return Number.isFinite(n) ? n : null;
}

function entero(value: unknown, fallback: number): number {
  const n = num(value);
  return n === null ? fallback : Math.trunc(n);
}

function bool(value: unknown): boolean {
  const v = escalar(value);
  return v === true || v === "true" || v === 1;
}

function lista(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  return isRecord(value) ? [value] : [];
}

function textos(value: unknown): string[] {
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  if (!Array.isArray(value)) return [];
  return value.map(str).filter(Boolean);
}

function contractError(detail: string): Error {
  return new Error(`La vista de la página llegó incompleta: ${detail}`);
}

function bbox(value: unknown): MaterialPreviewBbox | null {
  if (!isRecord(value)) return null;
  const x = num(value.x);
  const y = num(value.y);
  const w = num(value.w);
  const h = num(value.h);
  if (x === null || y === null || w === null || h === null) return null;
  if (w < 0 || h < 0) return null;
  return { x, y, w, h };
}

const EPS = 1e-6;

/** Una zona fuera de la página no se dibuja: estaría señalando otra cosa. */
function dentroDeLaPagina(caja: MaterialPreviewBbox): boolean {
  return caja.x >= -EPS && caja.y >= -EPS && caja.x + caja.w <= 1 + EPS && caja.y + caja.h <= 1 + EPS;
}

export function normalizeMaterialPreviewZone(value: unknown): MaterialPreviewZone | null {
  if (!isRecord(value)) return null;
  const caja = bbox(value.bbox);
  if (!caja || !dentroDeLaPagina(caja)) return null;
  const kind = str(value.kind) === "derived" ? "derived" : "block";
  const blockId = strOrNull(value.block_id);
  // Una zona de bloque sin bloque no se puede seleccionar ni editar.
  if (kind === "block" && !blockId) return null;
  return {
    block_id: blockId,
    type: str(value.type),
    kind,
    bbox: caja,
    bbox_mm: bbox(value.bbox_mm),
    editable: textos(value.editable),
    reorderable: bool(value.reorderable),
    fills_from: textos(value.fills_from),
  };
}

function face(value: unknown): MaterialPreviewFace | null {
  if (!isRecord(value)) return null;
  const pageId = str(value.page_id);
  if (!pageId) return null;
  return {
    page: Math.max(1, entero(value.page, 1)),
    page_id: pageId,
    layout_preset: str(value.layout_preset),
    blocks: Math.max(0, entero(value.blocks, 0)),
  };
}

function undrawn(value: unknown): MaterialPreviewUndrawn | null {
  if (!isRecord(value)) return null;
  const blockId = str(value.block_id);
  if (!blockId) return null;
  return {
    block_id: blockId,
    type: str(value.type),
    reason: str(value.reason) === "slot_taken" ? "slot_taken" : "not_drawn_by_layout",
  };
}

function warning(value: unknown): MaterialPreviewWarning | null {
  if (!isRecord(value)) return null;
  const code = str(value.code);
  if (!code) return null;
  const page = num(value.page);
  return { code, page: page === null ? null : Math.trunc(page), block_id: strOrNull(value.block_id) };
}

function compactar<T>(items: Array<T | null>): T[] {
  return items.filter((item): item is T => item !== null);
}

export function normalizeMaterialPreview(value: unknown): MaterialPreview {
  if (!isRecord(value)) throw contractError("la respuesta no es un objeto.");
  if (str(value.schema) !== MATERIAL_PREVIEW_SCHEMA) throw contractError(`no cumple ${MATERIAL_PREVIEW_SCHEMA}.`);
  const png = str(value.png_base64).replace(/^data:image\/png;base64,/, "");
  if (!png) throw contractError("no trae la imagen.");
  const page = Math.max(1, entero(value.page, 1));
  const pageId = str(value.page_id);
  if (!pageId) throw contractError("no dice qué cara es.");
  const mm = isRecord(value.page_mm) ? value.page_mm : {};
  const unit = isRecord(value.unit) ? value.unit : {};
  const access = isRecord(value.access) ? value.access : {};
  const accessSource = str(access.source);
  return {
    schema: MATERIAL_PREVIEW_SCHEMA,
    draft: bool(value.draft),
    template_sha256: str(value.template_sha256),
    page,
    pages: Math.max(entero(value.pages, page), page),
    page_id: pageId,
    layout_preset: str(value.layout_preset),
    orientation: str(value.orientation) === "landscape" ? "landscape" : "portrait",
    paper: str(value.paper) || "A4",
    page_mm: { w: num(mm.w) ?? 210, h: num(mm.h) ?? 297 },
    dpi: entero(value.dpi, 90),
    width: Math.max(0, entero(value.width, 0)),
    height: Math.max(0, entero(value.height, 0)),
    png_base64: png,
    faces: compactar(lista(value.faces).map(face)),
    unit: {
      source: str(unit.source) === "plan" ? "plan" : "ejemplo",
      unit_id: strOrNull(unit.unit_id),
      label: str(unit.label),
    },
    access: {
      source: accessSource === "deployment" || accessSource === "sin_enlace" ? accessSource : "ejemplo",
    },
    zones: compactar(lista(value.zones).map(normalizeMaterialPreviewZone)),
    undrawn: compactar(lista(value.undrawn).map(undrawn)),
    warnings: compactar(lista(value.warnings).map(warning)),
    cache: str(value.cache),
    elapsed_ms: num(value.elapsed_ms),
  };
}

export function normalizeMaterialPreviewProblems(details: unknown): MaterialPreviewProblem[] {
  if (!isRecord(details)) return [];
  return compactar(lista(details.problems).map((raw) => {
    if (!isRecord(raw)) return null;
    const detail = str(raw.detail);
    const path = str(raw.path);
    if (!detail && !path) return null;
    const page = num(raw.page);
    return {
      path,
      code: str(raw.code),
      detail,
      page: page === null ? null : Math.trunc(page),
      page_id: strOrNull(raw.page_id),
      block_id: strOrNull(raw.block_id),
    };
  }));
}

/** Rechazo del endpoint con su estado HTTP y los problemas del borrador. */
export class MaterialPreviewError extends ApiError {
  readonly status: number;
  readonly problems: MaterialPreviewProblem[];
  constructor(code: string, message: string, status: number, details: unknown) {
    super(code, message);
    this.name = "MaterialPreviewError";
    this.status = status;
    this.problems = normalizeMaterialPreviewProblems(details);
  }
}

export const PREVIEW_TEMPLATE_INVALID = "E_COLLECTION_MATERIAL_TEMPLATE_INVALID";
export const PREVIEW_PAGE = "E_COLLECTION_MATERIAL_PREVIEW_PAGE";
export const PREVIEW_UNIT = "E_COLLECTION_MATERIAL_PREVIEW_UNIT";
export const PREVIEW_UNAVAILABLE = "E_COLLECTION_MATERIAL_PREVIEW_UNAVAILABLE";

async function handlePreview(res: Response): Promise<unknown> {
  if (res.ok) return handle<unknown>(res);
  const raw = await res.clone().text().catch(() => "");
  let details: unknown = null;
  let message = "";
  try {
    const body: unknown = raw.trim() ? JSON.parse(raw) : null;
    const error = isRecord(body) && isRecord(body.error) ? body.error : null;
    details = error?.details ?? null;
    message = str(error?.message);
  } catch {
    details = null;
  }
  try {
    // `handle` conserva sus efectos (sesión perdida, sid nuevo) y arma el código.
    await handle<unknown>(res);
  } catch (cause) {
    if (cause instanceof ApiError) {
      const plain = message || cause.message.replace(new RegExp(`\\s·\\s${cause.code}$`), "");
      throw new MaterialPreviewError(cause.code, plain, res.status, details);
    }
    throw cause;
  }
  throw new MaterialPreviewError(`HTTP_${res.status}`, `HTTP ${res.status}`, res.status, details);
}

export async function apiMaterialTemplatePreview(
  input: MaterialPreviewRequest,
  opts: { signal?: AbortSignal } = {},
): Promise<MaterialPreview> {
  const body: Record<string, unknown> = { page: input.page, dpi: input.dpi ?? 90 };
  if (input.template) body.template = input.template;
  if (input.unit_id) body.unit_id = input.unit_id;
  const raw = await handlePreview(await apiFetch(
    "/api/recopiladores/material-template/preview",
    {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
      signal: opts.signal,
    },
  ));
  return normalizeMaterialPreview(raw);
}

/** `src` listo para un `<img>`. */
export function materialTemplatePreviewSrc(preview: Pick<MaterialPreview, "png_base64">): string {
  return `data:image/png;base64,${preview.png_base64}`;
}
