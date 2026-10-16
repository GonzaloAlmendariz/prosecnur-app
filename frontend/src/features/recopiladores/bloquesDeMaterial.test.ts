import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  apiRecopiladoresMaterialTemplateGet,
  apiRecopiladoresMaterialTemplatePut,
  COLLECTION_BLOCK_TYPES,
  type CollectionMaterialTemplate,
} from "../../api/recopiladores";
import {
  opcionesDeTipo,
  resumenDelBloque,
  rotuloDeBloque,
  ROTULOS_DE_BLOQUE,
  TIPOS_QUE_SE_AGREGAN,
} from "./bloquesDeMaterial";
import { createTemplateHistory, templateHistoryReducer } from "./templateHistory";

const aqui = path.dirname(fileURLToPath(import.meta.url));

/** Los tipos que el backend acepta, leídos de su fuente. */
function tiposDelBackend(): string[] {
  const r = fs.readFileSync(path.join(aqui, "../../../../api/R/collection_materials.R"), "utf8");
  const bloque = r.match(/COLLECTION_MATERIAL_BLOCK_TYPES\s*<-\s*c\(([\s\S]*?)\)/);
  if (!bloque) throw new Error("No se encontró COLLECTION_MATERIAL_BLOCK_TYPES en collection_materials.R");
  return [...bloque[1].matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);
}

// El afiche tal como lo deja «Usar este tipo»: la careta va primero.
const AFICHE: CollectionMaterialTemplate = {
  schema: "collection_material_template/v1",
  template_id: "template-afiche-qr-a4-v1",
  revision: 3,
  preset_id: "afiche_qr_a4_v1",
  material_kind: "access_poster",
  compatible_adapters: ["aulas_v1"],
  page: { size: "A4", orientation: "portrait" },
  pages: [{
    page_id: "afiche",
    layout_preset: "poster_qr",
    blocks: [
      { block_id: "careta", type: "brand_strip", assets: ["pulso", "pucp"], align: "center", max_height_mm: 14 },
      { block_id: "titulo", type: "heading", binding: "project.name", max_lines: 3 },
      { block_id: "qr", type: "access_qr", binding: "access.qr_payload", required: true },
      { block_id: "footer", type: "footer", binding: "project.name" },
    ],
  }],
  brand_ref: "pulso-default",
  sensitivity_policy: "operational",
  template_sha256: "abc",
};

describe("vocabulario de bloques", () => {
  it("el frontend conoce los mismos tipos que el backend, en el mismo orden", () => {
    expect([...COLLECTION_BLOCK_TYPES]).toEqual(tiposDelBackend());
  });

  it("cada tipo tiene rótulo en castellano, distinto de su clave", () => {
    for (const type of COLLECTION_BLOCK_TYPES) {
      const rotulo = ROTULOS_DE_BLOQUE[type];
      expect(rotulo.trim().length).toBeGreaterThan(0);
      expect(rotulo).not.toContain("_");
    }
    expect(rotuloDeBloque("brand_strip")).toBe("Careta de logos");
    expect(new Set(Object.values(ROTULOS_DE_BLOQUE)).size).toBe(COLLECTION_BLOCK_TYPES.length);
  });

  it("un tipo desconocido no sale en blanco", () => {
    expect(rotuloDeBloque("tipo_futuro")).toBe("Bloque tipo_futuro");
  });

  it("el inspector ofrece la opción del tipo real (no cae a la primera)", () => {
    const opciones = opcionesDeTipo("brand_strip");
    expect(opciones.map((o) => o.value)).toContain("brand_strip");
    expect(opciones.find((o) => o.value === "brand_strip")?.label).toBe("Careta de logos");
    expect(opcionesDeTipo("tipo_futuro").at(-1)).toEqual({ value: "tipo_futuro", label: "Bloque tipo_futuro" });
  });

  it("«Añadir bloque» no ofrece lo que no puede sembrar válido", () => {
    expect(TIPOS_QUE_SE_AGREGAN).not.toContain("brand_strip");
    expect(TIPOS_QUE_SE_AGREGAN).not.toContain("form_lines");
    expect(TIPOS_QUE_SE_AGREGAN).not.toContain("campus_map");
    expect(TIPOS_QUE_SE_AGREGAN).toContain("heading");
  });

  it("la careta y los renglones dicen qué pintan", () => {
    expect(resumenDelBloque({ type: "brand_strip", assets: ["a", "b"], align: "left" })).toBe("2 logos · a la izquierda");
    expect(resumenDelBloque({ type: "form_lines", rows: [{}, {}, {}] })).toBe("3 renglones que se llenan a mano");
    expect(resumenDelBloque({ type: "heading" })).toBe("");
  });
});

describe("«Guardar plantilla» no reescribe un tipo en otro", () => {
  let enviado: unknown = null;

  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v); },
      removeItem: (k: string) => { store.delete(k); },
    });
    enviado = null;
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "PUT") {
        enviado = JSON.parse(String(init.body));
        return new Response(JSON.stringify({ ok: true, template: (enviado as { template: unknown }).template }), {
          status: 200, headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: true, template: AFICHE, state_revision: 7 }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }));
  });

  afterEach(() => { vi.unstubAllGlobals(); });

  it("leer → editar → guardar conserva brand_strip y sus campos", async () => {
    const leido = await apiRecopiladoresMaterialTemplateGet();
    expect(leido.template?.pages[0].blocks[0].type).toBe("brand_strip");

    // Lo que hace el editor: reemplaza con lo leído y commitea una edición
    // de otro bloque (el título).
    let historia = templateHistoryReducer(createTemplateHistory(AFICHE), { type: "replace", template: leido.template! });
    const actual = historia.present;
    const bloques = actual.pages[0].blocks.map((b) => (b.block_id === "titulo" ? { ...b, max_lines: 2 } : b));
    historia = templateHistoryReducer(historia, {
      type: "commit",
      template: { ...actual, pages: [{ ...actual.pages[0], blocks: bloques }], template_sha256: null },
    });

    const guardado = await apiRecopiladoresMaterialTemplatePut({ expected_revision: 7, template: historia.present });
    const careta = (enviado as { template: CollectionMaterialTemplate }).template.pages[0].blocks[0];
    expect(careta).toEqual(AFICHE.pages[0].blocks[0]);
    expect(guardado.template?.pages[0].blocks.map((b) => b.type)).toEqual(["brand_strip", "heading", "access_qr", "footer"]);
  });
});
