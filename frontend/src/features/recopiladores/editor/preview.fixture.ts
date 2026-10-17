// Fixtures del editor de la página real (E1b).
//
// `PREVIEW_CROQUIS_JSON` es, al pie de la letra, la respuesta 200 del contrato
// congelado de `POST /api/recopiladores/material-template/preview` (dorso de la
// ficha de campo). `TEMPLATE_FICHA_CAMPO` es la receta que la produce: la de
// `collection_material_field_sheet_template()` con careta, dos caras y el
// footer repetido en ambas (block_id único sólo dentro de su página).
//
// `PREVIEW_FRENTE_JSON` no está en el contrato: es el frente de la misma ficha,
// armado con la misma forma, para probar la cara con bloques editables.

import type { CollectionMaterialTemplate } from "../../../api/recopiladores";

/** PNG transparente de 1×1: basta para que el `<img>` tenga `src`. */
const PNG_1X1 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

export const PREVIEW_CROQUIS_JSON = {
  schema: "collection_material_preview/v1",
  draft: true,
  template_sha256: "sha256:…",
  page: 2,
  pages: 2,
  page_id: "croquis",
  layout_preset: "croquis_campus",
  orientation: "portrait",
  paper: "A4",
  page_mm: { w: 210, h: 297 },
  dpi: 90,
  width: 744,
  height: 1052,
  png_base64: "iVBOR…",
  faces: [
    { page: 1, page_id: "ficha", layout_preset: "field_form", blocks: 5 },
    { page: 2, page_id: "croquis", layout_preset: "croquis_campus", blocks: 2 },
  ],
  unit: { source: "plan", unit_id: "…", label: "CH 1" },
  access: { source: "deployment" },
  zones: [
    {
      block_id: "croquis",
      type: "campus_map",
      kind: "block",
      bbox: { x: 0.075, y: 0.04, w: 0.85, h: 0.875 },
      bbox_mm: { x: 15.8, y: 11.9, w: 178.5, h: 259.9 },
      editable: [],
      reorderable: false,
      fills_from: ["unit.venue"],
    },
    {
      block_id: null,
      type: "link",
      kind: "derived",
      bbox: { x: 0, y: 0, w: 0, h: 0 },
      editable: [],
      reorderable: false,
      fills_from: ["access.qr_payload"],
    },
  ],
  undrawn: [{ block_id: "course2", type: "body", reason: "slot_taken" }],
  warnings: [{ code: "text_truncated", page: 1, block_id: "unit" }],
  cache: "miss",
  elapsed_ms: 241,
} as const;

/** El frente de la ficha de campo: careta, título, QR, renglones y pie. */
export const PREVIEW_FRENTE_JSON = {
  ...PREVIEW_CROQUIS_JSON,
  page: 1,
  page_id: "ficha",
  layout_preset: "field_form",
  png_base64: PNG_1X1,
  zones: [
    { block_id: "careta", type: "brand_strip", kind: "block", bbox: { x: 0.08, y: 0.03, w: 0.84, h: 0.05 }, editable: ["assets", "align", "max_height_mm"], reorderable: false, fills_from: [] },
    { block_id: "titulo", type: "heading", kind: "block", bbox: { x: 0.08, y: 0.09, w: 0.84, h: 0.06 }, editable: ["binding"], reorderable: false, fills_from: ["unit.codigo_ficha"] },
    { block_id: "qr", type: "access_qr", kind: "block", bbox: { x: 0.25, y: 0.16, w: 0.5, h: 0.36 }, editable: ["correction", "quiet_zone"], reorderable: false, fills_from: ["access.qr_payload"] },
    { block_id: null, type: "link", kind: "derived", bbox: { x: 0.2, y: 0.52, w: 0.6, h: 0.02 }, editable: [], reorderable: false, fills_from: ["access.qr_payload"] },
    { block_id: "registro", type: "form_lines", kind: "block", bbox: { x: 0.08, y: 0.56, w: 0.84, h: 0.36 }, editable: ["rows"], reorderable: false, fills_from: ["unit.faculty", "unit.venue"] },
    { block_id: "footer", type: "footer", kind: "block", bbox: { x: 0.08, y: 0.94, w: 0.84, h: 0.03 }, editable: [], reorderable: false, fills_from: [] },
  ],
  undrawn: [],
  warnings: [{ code: "text_truncated", page: 1, block_id: "titulo" }],
} as const;

export const TEMPLATE_FICHA_CAMPO: CollectionMaterialTemplate = {
  schema: "collection_material_template/v1",
  template_id: "template-ficha-campo-qr-a4-v1",
  revision: 3,
  preset_id: "ficha_campo_qr_a4_v1",
  material_kind: "application_sheet",
  compatible_adapters: ["aulas_v1"],
  page: { size: "A4", orientation: "portrait" },
  pages: [
    {
      page_id: "ficha",
      layout_preset: "field_form",
      blocks: [
        { block_id: "careta", type: "brand_strip", assets: ["pulso", "unsa"], align: "center", max_height_mm: 11 },
        { block_id: "titulo", type: "heading", binding: "unit.codigo_ficha", max_lines: 2 },
        { block_id: "qr", type: "access_qr", binding: "access.qr_payload", required: true, correction: "M", quiet_zone: 4, min_size_mm: 70 },
        {
          block_id: "registro",
          type: "form_lines",
          rows: [
            { fields: [{ label: "Facultad", span: 0.5, binding: "unit.faculty" }, { label: "Pabellón y aula:", span: 0.5, binding: "unit.venue" }] },
            { fields: [{ label: "Aplicador/a", span: 1 }] },
          ],
        },
        { block_id: "footer", type: "footer", binding: "project.name" },
      ],
    },
    {
      page_id: "croquis",
      layout_preset: "croquis_campus",
      blocks: [
        { block_id: "croquis", type: "campus_map", binding: "unit.venue" },
        { block_id: "footer", type: "footer", binding: "project.name" },
      ],
    },
  ],
  brand_ref: "project-brand",
  sensitivity_policy: "operational",
  template_sha256: "sha256:receta",
};
