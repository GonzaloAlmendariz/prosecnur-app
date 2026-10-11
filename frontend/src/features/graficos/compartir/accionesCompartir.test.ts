import { beforeEach, describe, expect, it, vi } from "vitest";

const persistencia = vi.hoisted(() => ({ orden: [] as string[] }));
vi.mock("../slideCompositionPersistence", () => ({
  invalidateSlideCompositionPersistenceAck: (sid: string | null, scope: string) => { persistencia.orden.push(`invalidar:${sid}:${scope}`); },
  acknowledgeSlideCompositionConfig: (sid: string | null, scope: string) => { persistencia.orden.push(`ack:${sid}:${scope}`); return ""; },
}));

import type { GraficosShareInspectResult } from "../../../api/graficos";
import {
  aplicarImportacionJson,
  aplicarPlanPortatil,
  basesAplicables,
  exportarSeccionesJson,
  prepararImportacionJson,
  type DepsCompartir,
} from "./accionesCompartir";
import { SECCIONES_JSON_POR_DEFECTO, todasLasSecciones } from "./seccionesJson";

function archivo(texto: string, nombre = "plan.json"): File {
  return new File([texto], nombre, { type: "application/json" });
}

function deps(over: Partial<DepsCompartir> = {}): DepsCompartir & { llamadas: string[] } {
  const llamadas: string[] = [];
  return {
    llamadas,
    configExport: vi.fn(async () => { llamadas.push("export"); return { config: { plan: { slides: [{ id: "x", tipo: "p_slide_portada", payload: {} }] } } }; }),
    configImport: vi.fn(async () => { llamadas.push("import"); return {}; }),
    configGet: vi.fn(async () => { llamadas.push("get"); return { config: { plan: { slides: [] } } }; }),
    shareExport: vi.fn(async () => ({ file_id: "f1", filename: "" })),
    shareInspect: vi.fn(),
    shareImport: vi.fn(async () => { llamadas.push("share-import"); return {}; }),
    downloadUrl: (id) => `/api/files/${id}/download`,
    getSession: () => "sid-1",
    hydrate: vi.fn(() => { llamadas.push("hydrate"); }),
    descargar: vi.fn(),
    crearUrlBlob: () => ({ href: "blob:1", liberar: vi.fn() }),
    ahora: () => new Date("2026-10-11T00:00:00Z"),
    ...over,
  };
}

beforeEach(() => { persistencia.orden = []; });

describe("importar secciones JSON: valida antes y escribe sólo al confirmar", () => {
  it("rechaza un archivo que no es JSON sin llamar a la API", async () => {
    await expect(prepararImportacionJson(archivo("{no"), SECCIONES_JSON_POR_DEFECTO, "merge")).rejects.toThrow(/^JSON inválido/);
  });

  it("rechaza un JSON que no es un objeto de config", async () => {
    await expect(prepararImportacionJson(archivo("[1,2]"), SECCIONES_JSON_POR_DEFECTO, "merge")).rejects.toThrow(/no contiene un plan/);
  });

  it("rechaza si no se eligió ninguna sección", async () => {
    await expect(prepararImportacionJson(archivo("{}"), todasLasSecciones(false), "merge")).rejects.toThrow(/al menos una sección/);
  });

  it("normaliza el sobre exportado: lo entrante es la config interior", async () => {
    const sobre = { version: "graficos/4", export_scope: ["plan"], config: { plan: { slides: [{ id: "n", tipo: "p_slide_portada", payload: {} }] } } };
    const prep = await prepararImportacionJson(archivo(JSON.stringify(sobre)), SECCIONES_JSON_POR_DEFECTO, "replace");
    expect((prep.entrante.plan as { slides: Array<{ id: string }> }).slides.map((s) => s.id)).toEqual(["n"]);
    expect(prep.entrante).not.toHaveProperty("config");
    expect(prep).toMatchObject({ nombreArchivo: "plan.json", modo: "replace" });
  });

  it("al aplicar: lee lo actual, invalida, escribe compuesto, relee e hidrata con el mismo sid", async () => {
    const d = deps();
    const sobre = { config: { plan: { slides: [{ id: "n", tipo: "p_slide_portada", payload: {} }] } } };
    const prep = await prepararImportacionJson(archivo(JSON.stringify(sobre)), { ...todasLasSecciones(false), plan: true }, "replace");
    expect(d.llamadas).toEqual([]);
    const mensaje = await aplicarImportacionJson(prep, d);
    expect(mensaje).toBe("1 sección importada");
    expect(d.llamadas).toEqual(["export", "import", "get", "hydrate"]);
    expect(persistencia.orden).toEqual(["invalidar:sid-1:active", "ack:sid-1:active"]);
    const enviado = vi.mocked(d.configImport).mock.calls[0][0] as { config: { plan: { slides: Array<{ id: string }> } } };
    expect(enviado.config.plan.slides.map((s) => s.id)).toEqual(["n"]);
  });
});

describe("exportar secciones JSON", () => {
  it("descarga el blob con nombre parcial y lo libera", async () => {
    const liberar = vi.fn();
    const d = deps({ crearUrlBlob: () => ({ href: "blob:9", liberar }) });
    await exportarSeccionesJson({ ...todasLasSecciones(false), plan: true }, d);
    expect(d.descargar).toHaveBeenCalledWith("blob:9", expect.stringMatching(/^pulso_graficos_parcial_\d+\.json$/));
    expect(liberar).toHaveBeenCalled();
  });
});

describe("plan portátil", () => {
  const plan = {
    package_file_id: "pkg",
    bases: [
      { base_name: "a", blocking: false, selected_default: true },
      { base_name: "b", blocking: true, selected_default: true },
    ],
  } as unknown as GraficosShareInspectResult;

  it("sólo se aplican bases elegidas y no bloqueadas", () => {
    expect(basesAplicables(plan, { a: true, b: true })).toEqual(["a"]);
    expect(basesAplicables(null, { a: true })).toEqual([]);
  });

  it("sin bases no escribe", async () => {
    const d = deps();
    await expect(aplicarPlanPortatil(plan, [], d)).rejects.toThrow(/al menos una base/);
    expect(d.shareImport).not.toHaveBeenCalled();
  });

  it("aplica, relee e hidrata", async () => {
    const d = deps();
    expect(await aplicarPlanPortatil(plan, ["a"], d)).toBe("Plan aplicado a 1 base");
    expect(d.shareImport).toHaveBeenCalledWith("pkg", ["a"]);
    expect(d.llamadas).toEqual(["share-import", "get", "hydrate"]);
    expect(persistencia.orden).toEqual(["invalidar:sid-1:active", "ack:sid-1:active"]);
  });
});
