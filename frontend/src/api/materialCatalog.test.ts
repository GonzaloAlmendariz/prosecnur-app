import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  MaterialCatalogSinPlantillaError,
  apiMaterialCatalog,
  apiMaterialCatalogPreview,
  apiMaterialCatalogUsar,
  materialPreviewSrc,
  normalizeMaterialCatalog,
  normalizeMaterialCatalogPreset,
  normalizeMaterialCatalogPreview,
} from "./materialCatalog";

const PRESET = {
  preset_id: "ficha_campo_qr_a4_v1",
  title: "Ficha de campo con croquis",
  family: "identifica_unidad",
  material_kind: "application_sheet",
  pages_per_unit: 2,
  orientation: "portrait",
  faces: 2,
  copies_per: "unit",
  compatible_unit_types: ["classroom_course_schedule"],
  compatible: true,
  blocks_count: 6,
  active: false,
};

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

describe("normalizeMaterialCatalog", () => {
  it("lee el contrato collection_material_catalog/v1", () => {
    const out = normalizeMaterialCatalog({ schema: "collection_material_catalog/v1", presets: [PRESET] });
    expect(out.presets).toHaveLength(1);
    expect(out.presets[0]).toMatchObject({
      preset_id: "ficha_campo_qr_a4_v1",
      faces: 2,
      orientation: "portrait",
      pages_per_unit: 2,
      copies_per: "unit",
      compatible: true,
      active: false,
      paper: null,
      template: null,
    });
  });

  it("rechaza otro schema", () => {
    expect(() => normalizeMaterialCatalog({ schema: "otro/v1", presets: [] })).toThrow(/collection_material_catalog/);
    expect(() => normalizeMaterialCatalog(null)).toThrow();
  });

  it("acepta el sobre `catalog` y un preset suelto (escalar de R)", () => {
    const out = normalizeMaterialCatalog({ catalog: { schema: "collection_material_catalog/v1", presets: PRESET } });
    expect(out.presets.map((p) => p.preset_id)).toEqual(["ficha_campo_qr_a4_v1"]);
  });

  it("descarta presets sin id y los ids repetidos", () => {
    const out = normalizeMaterialCatalog({
      schema: "collection_material_catalog/v1",
      presets: [PRESET, { ...PRESET, title: "copia" }, { title: "sin id" }, "basura"],
    });
    expect(out.presets).toHaveLength(1);
    expect(out.presets[0].title).toBe("Ficha de campo con croquis");
  });
});

describe("normalizeMaterialCatalogPreset", () => {
  it("es defensivo con los campos que faltan o vienen mal", () => {
    const p = normalizeMaterialCatalogPreset({
      preset_id: "x",
      orientation: "diagonal",
      faces: 3,
      pages_per_unit: "0",
      compatible_unit_types: "household",
      active: [true],
    });
    expect(normalizeMaterialCatalogPreset({ preset_id: "y", compatible: [] })?.compatible).toBe(true);
    expect(normalizeMaterialCatalogPreset({ preset_id: "y", compatible: [false] })?.compatible).toBe(false);
    expect(p).toMatchObject({
      title: "x",
      orientation: "portrait",
      faces: 1,
      pages_per_unit: 1,
      compatible_unit_types: ["household"],
      // Sin la marca no se atenúa: el backend no dijo que no aplique.
      compatible: true,
      active: true,
      copies_per: null,
    });
  });

  it("lee el papel de `paper` o `page_size` y una plantilla válida", () => {
    const template = { schema: "collection_material_template/v1", preset_id: "x", pages: [] };
    expect(normalizeMaterialCatalogPreset({ preset_id: "x", page_size: "A4", template })).toMatchObject({
      paper: "A4",
      template,
    });
    expect(normalizeMaterialCatalogPreset({ preset_id: "x", template: { schema: "otra" } })?.template).toBeNull();
  });
});

describe("normalizeMaterialCatalogPreview", () => {
  it("quita el prefijo data: y asegura pages >= page", () => {
    const v = normalizeMaterialCatalogPreview({
      preset_id: "x", page: 2, pages: 1, width: 600, height: 848, png_base64: "data:image/png;base64,QUJD",
    });
    expect(v).toMatchObject({ page: 2, pages: 2, width: 600, height: 848, png_base64: "QUJD" });
    expect(materialPreviewSrc(v)).toBe("data:image/png;base64,QUJD");
  });

  it("sin imagen es un contrato roto", () => {
    expect(() => normalizeMaterialCatalogPreview({ preset_id: "x", page: 1 })).toThrow(/imagen/);
  });
});

describe("fetchers", () => {
  it("GET del catálogo y POST de la vista previa", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.endsWith("/material-catalog")) {
        return jsonResponse({ schema: "collection_material_catalog/v1", presets: [PRESET] });
      }
      return jsonResponse({ preset_id: PRESET.preset_id, page: 1, pages: 2, width: 10, height: 14, png_base64: "QUJD" });
    }));
    const catalogo = await apiMaterialCatalog();
    expect(catalogo.presets).toHaveLength(1);
    const vista = await apiMaterialCatalogPreview({ preset_id: PRESET.preset_id, page: 1 });
    expect(vista.pages).toBe(2);
    expect(calls[0].url).toContain("/api/recopiladores/material-catalog");
    expect(calls[1].url).toContain("/api/recopiladores/material-catalog/preview");
    expect(calls[1].init?.method).toBe("POST");
    expect(JSON.parse(String(calls[1].init?.body))).toEqual({ preset_id: PRESET.preset_id, page: 1 });
  });
});

describe("apiMaterialCatalogUsar", () => {
  it("sin plantilla en el catálogo no llama a nada y lo dice", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const preset = normalizeMaterialCatalogPreset(PRESET)!;
    await expect(apiMaterialCatalogUsar({ preset, expected_revision: 3 }))
      .rejects.toBeInstanceOf(MaterialCatalogSinPlantillaError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("con plantilla la fija por el PUT de material-template", async () => {
    const template = {
      schema: "collection_material_template/v1",
      template_id: "t", revision: 1, preset_id: PRESET.preset_id, material_kind: "application_sheet",
      compatible_adapters: [], page: { size: "A4", orientation: "portrait" },
      pages: [{ page_id: "cara", layout_preset: "field_form", blocks: [] }],
      brand_ref: "pulso-default", sensitivity_policy: "operational",
    };
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), init });
      return jsonResponse({ ok: true, template, state_revision: 4 });
    }));
    const preset = normalizeMaterialCatalogPreset({ ...PRESET, template })!;
    await apiMaterialCatalogUsar({ preset, expected_revision: 3 });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain("/api/recopiladores/material-template");
    expect(calls[0].init?.method).toBe("PUT");
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ expected_revision: 3, template });
  });
});
