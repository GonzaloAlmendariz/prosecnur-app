import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PREVIEW_CROQUIS_JSON } from "../features/recopiladores/editor/preview.fixture";
import {
  MaterialPreviewError,
  apiMaterialTemplatePreview,
  materialTemplatePreviewSrc,
  normalizeMaterialPreview,
  normalizeMaterialPreviewZone,
} from "./materialPreview";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("normalizeMaterialPreview", () => {
  it("lee la respuesta del contrato collection_material_preview/v1 tal cual", () => {
    const out = normalizeMaterialPreview(PREVIEW_CROQUIS_JSON);
    expect(out).toMatchObject({
      schema: "collection_material_preview/v1",
      draft: true,
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
      unit: { source: "plan", label: "CH 1" },
      access: { source: "deployment" },
      cache: "miss",
      elapsed_ms: 241,
    });
    expect(out.faces.map((f) => [f.page_id, f.layout_preset, f.blocks])).toEqual([
      ["ficha", "field_form", 5],
      ["croquis", "croquis_campus", 2],
    ]);
    expect(out.zones[0]).toEqual({
      block_id: "croquis",
      type: "campus_map",
      kind: "block",
      bbox: { x: 0.075, y: 0.04, w: 0.85, h: 0.875 },
      bbox_mm: { x: 15.8, y: 11.9, w: 178.5, h: 259.9 },
      editable: [],
      reorderable: false,
      fills_from: ["unit.venue"],
    });
    // La zona derivada (el enlace) se conserva, sin bloque.
    expect(out.zones[1]).toMatchObject({ block_id: null, kind: "derived", type: "link" });
    expect(out.undrawn).toEqual([{ block_id: "course2", type: "body", reason: "slot_taken" }]);
    expect(out.warnings).toEqual([{ code: "text_truncated", page: 1, block_id: "unit" }]);
  });

  it("acepta los escalares que R serializa como vector de largo uno", () => {
    const out = normalizeMaterialPreview({
      ...PREVIEW_CROQUIS_JSON,
      page: [2],
      draft: [false],
      zones: [{ ...PREVIEW_CROQUIS_JSON.zones[0], block_id: ["croquis"], reorderable: [true], editable: "binding", fills_from: "unit.venue" }],
    });
    expect(out.page).toBe(2);
    expect(out.draft).toBe(false);
    expect(out.zones[0]).toMatchObject({ block_id: "croquis", reorderable: true, editable: ["binding"], fills_from: ["unit.venue"] });
  });

  it("descarta la zona que cae fuera de la página o la de bloque sin bloque", () => {
    expect(normalizeMaterialPreviewZone({ block_id: "x", type: "body", kind: "block", bbox: { x: 0.5, y: 0.9, w: 0.6, h: 0.2 } })).toBeNull();
    expect(normalizeMaterialPreviewZone({ block_id: null, type: "body", kind: "block", bbox: { x: 0, y: 0, w: 0.1, h: 0.1 } })).toBeNull();
    expect(normalizeMaterialPreviewZone({ block_id: "x", type: "body", kind: "block", bbox: { x: 0, y: 0, w: -1, h: 0.1 } })).toBeNull();
  });

  it("un origen desconocido de la unidad o del acceso se lee como ejemplo, nunca como real", () => {
    const out = normalizeMaterialPreview({ ...PREVIEW_CROQUIS_JSON, unit: { source: "otra" }, access: { source: "resolved_access" } });
    expect(out.unit.source).toBe("ejemplo");
    expect(out.access.source).toBe("ejemplo");
  });

  it("sin imagen o sin cara no hay vista", () => {
    expect(() => normalizeMaterialPreview({ ...PREVIEW_CROQUIS_JSON, png_base64: "" })).toThrow(/imagen/);
    expect(() => normalizeMaterialPreview({ ...PREVIEW_CROQUIS_JSON, page_id: "" })).toThrow(/cara/);
    expect(() => normalizeMaterialPreview({ ...PREVIEW_CROQUIS_JSON, schema: "otra/v1" })).toThrow();
  });

  it("arma el src del <img>", () => {
    expect(materialTemplatePreviewSrc({ png_base64: "QUJD" })).toBe("data:image/png;base64,QUJD");
  });
});

describe("apiMaterialTemplatePreview", () => {
  it("manda página, dpi, unidad y borrador; y pasa la señal de cancelación", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(PREVIEW_CROQUIS_JSON));
    vi.stubGlobal("fetch", fetchMock);
    const control = new AbortController();
    const template = { schema: "collection_material_template/v1" } as never;
    await apiMaterialTemplatePreview({ page: 2, unit_id: "u1", template, dpi: 150 }, { signal: control.signal });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/api/recopiladores/material-template/preview");
    expect(init.method).toBe("POST");
    expect(init.signal).toBe(control.signal);
    expect(JSON.parse(String(init.body))).toEqual({ page: 2, dpi: 150, unit_id: "u1", template });
  });

  it("sin borrador ni unidad no los manda: dibuja la receta guardada con la primera titular", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(PREVIEW_CROQUIS_JSON));
    vi.stubGlobal("fetch", fetchMock);
    await apiMaterialTemplatePreview({ page: 1, template: null, unit_id: null });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ page: 1, dpi: 90 });
  });

  it("un 422 trae los problemas estructurados con su cara y su bloque", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({
      error: {
        code: "E_COLLECTION_MATERIAL_TEMPLATE_INVALID",
        message: "La receta tiene problemas.",
        details: {
          problems: [{
            path: "template.pages[1].blocks[2].quiet_zone", code: "bad_qr_quiet_zone",
            detail: "quiet_zone debe estar entre 4 y 12 modulos.", page: 1, page_id: "ficha", block_id: "qr",
          }],
        },
      },
    }, 422)));
    const fallo = await apiMaterialTemplatePreview({ page: 1 }).catch((e: unknown) => e);
    expect(fallo).toBeInstanceOf(MaterialPreviewError);
    const error = fallo as MaterialPreviewError;
    expect(error.status).toBe(422);
    expect(error.code).toBe("E_COLLECTION_MATERIAL_TEMPLATE_INVALID");
    expect(error.problems).toEqual([{
      path: "template.pages[1].blocks[2].quiet_zone", code: "bad_qr_quiet_zone",
      detail: "quiet_zone debe estar entre 4 y 12 modulos.", page: 1, page_id: "ficha", block_id: "qr",
    }]);
  });

  it("un 503 llega como error con su estado, sin problemas", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({
      error: { code: "E_COLLECTION_MATERIAL_PREVIEW_UNAVAILABLE", message: "No hay con qué dibujar." },
    }, 503)));
    const error = await apiMaterialTemplatePreview({ page: 1 }).catch((e: unknown) => e) as MaterialPreviewError;
    expect(error.status).toBe(503);
    expect(error.code).toBe("E_COLLECTION_MATERIAL_PREVIEW_UNAVAILABLE");
    expect(error.problems).toEqual([]);
  });
});
