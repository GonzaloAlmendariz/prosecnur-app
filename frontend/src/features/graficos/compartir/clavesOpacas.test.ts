// Decisión 30 (docs/qa/paridad-retiro-editor-anterior-f6-2026-10-11.md): las claves persistidas de superficies retiradas
// pasan OPACAS. Ni se borran ni se migran: abrir un `.pulso` viejo no lo marca modificado, el productor único de la config
// (configSnapshot.ts) las devuelve tal cual, y exportar o importar el JSON por secciones conserva las del proyecto.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../slideCompositionPersistence", () => ({
  invalidateSlideCompositionPersistenceAck: () => undefined,
  acknowledgeSlideCompositionConfig: () => "",
}));

import { normalizeGraficosConfig } from "../../../api/graficosConfigNormalizer";
import { buildGraficosConfig, buildGraficosConfigFromStore, graficosConfigFromRemote, graficosConfigSource } from "../configSnapshot";
import { usePlanStore, type GraficosConfig } from "../store";
import { aplicarImportacionJson, prepararImportacionJson, type DepsCompartir } from "./accionesCompartir";
import { armarExportacionJson, componerImportacion, SECCIONES_JSON_POR_DEFECTO, todasLasSecciones } from "./seccionesJson";

const CLAVES_OPACAS = [
  "overrides_reusables", "debug_ph", "view_mode", "inspector_tab", "density", "canvas_viewport", "scope_rules",
] as const;

// Lo que guardó el editor anterior en un `.pulso` viejo: valores no default en todas las claves retiradas, y reglas por
// caso con claves que ningún front actual interpreta.
const OPACAS = {
  overrides_reusables: [{ id: "ov-1", nombre: "Barras cortas", chart: "barras", args: { size_ejes: 7 }, raro: [1, 2] }],
  debug_ph: { activo: true, color: "#00FF00", lwd: 1.2 },
  view_mode: "canvas",
  inspector_tab: "filters",
  density: "compact",
  canvas_viewport: { x: 120, y: -40, zoom: 1.75 },
} as const;

function viejo(): Record<string, unknown> {
  const presets = { barras: { size_ejes: 9 } };
  const paletas = { si_no: ["#111111", "#222222"] };
  return {
    version: "graficos/3",
    plan: { slides: [{ id: "s1", tipo: "p_slide_portada", payload: {} }] },
    presets,
    paletas,
    ...structuredClone(OPACAS),
    auto_otros_slides: true,
    scope_rules: {
      global: {
        presets, paletas,
        overrides_reusables: structuredClone(OPACAS.overrides_reusables),
        debug_ph: structuredClone(OPACAS.debug_ph),
        auto_otros_slides: true,
        profile_id: "acnur",
      },
      por_lista: { L1: { nota: "regla del editor anterior" } },
      por_slide: { s1: { forzar: true } },
    },
    _unknown: { campo_futuro: { a: 1 } },
  };
}

function opacasDe(cfg: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(CLAVES_OPACAS.map((k) => [k, cfg[k]]));
}

beforeEach(() => {
  usePlanStore.setState({ dirty: false, hydrated: false });
});

describe("claves opacas: abrir no borra, no migra ni marca modificado", () => {
  it("el normalizador devuelve las siete claves tal cual", () => {
    const entrada = viejo();
    const out = normalizeGraficosConfig(structuredClone(entrada));
    expect(opacasDe(out)).toEqual(opacasDe(entrada));
    expect(out._unknown).toEqual(entrada._unknown);
  });

  it("hidratar desde el backend y volver a producir la config las conserva (lo que escribiría el autosave)", () => {
    const entrada = viejo();
    const hidratada = graficosConfigFromRemote(structuredClone(entrada));
    expect(opacasDe(hidratada)).toEqual(opacasDe(entrada));
    const producida = buildGraficosConfig(graficosConfigSource(hidratada));
    expect(opacasDe(producida)).toEqual(opacasDe(entrada));
  });

  it("hidratar el store no lo marca modificado y el store las devuelve intactas", () => {
    const entrada = viejo();
    usePlanStore.getState().hydrate(graficosConfigFromRemote(structuredClone(entrada)));
    expect(usePlanStore.getState().dirty).toBe(false);
    expect(opacasDe(buildGraficosConfigFromStore())).toEqual(opacasDe(entrada));
  });
});

describe("claves opacas en el JSON por secciones", () => {
  function deps(proyecto: Record<string, unknown>): DepsCompartir {
    return {
      configExport: vi.fn(async () => ({ config: structuredClone(proyecto) })),
      configImport: vi.fn(async () => ({})),
      configGet: vi.fn(async () => ({ config: structuredClone(proyecto) })),
      shareExport: vi.fn(async () => ({ file_id: "f", filename: "" })),
      shareInspect: vi.fn(),
      shareImport: vi.fn(async () => ({})),
      downloadUrl: (id) => `/api/files/${id}/download`,
      getSession: () => "sid",
      hydrate: vi.fn(),
      descargar: vi.fn(),
      crearUrlBlob: () => ({ href: "blob:1", liberar: vi.fn() }),
      ahora: () => new Date(0),
    };
  }

  it("ida y vuelta completa sobre el mismo proyecto: lo enviado conserva claves opacas y `_unknown`", async () => {
    const proyecto = viejo();
    const actual = normalizeGraficosConfig(structuredClone(proyecto), { includeLegacyAliases: true });
    const { texto } = armarExportacionJson(actual, SECCIONES_JSON_POR_DEFECTO, new Date(0));
    const archivo = JSON.parse(texto) as { config: Record<string, unknown> };
    for (const k of ["debug_ph", "view_mode", "inspector_tab", "density", "canvas_viewport"]) expect(archivo.config).not.toHaveProperty(k);

    for (const modo of ["merge", "replace"] as const) {
      const d = deps(proyecto);
      const prep = await prepararImportacionJson(new File([texto], "plan.json"), SECCIONES_JSON_POR_DEFECTO, modo);
      await aplicarImportacionJson(prep, d);
      const enviado = (vi.mocked(d.configImport).mock.calls[0][0] as { config: Record<string, unknown> }).config;
      expect(opacasDe(enviado), modo).toEqual(opacasDe(proyecto));
      expect(enviado._unknown, modo).toEqual(proyecto._unknown);
    }
  });

  it("un archivo de otro proyecto con vista de trabajo, guías y `_unknown` propios no pisa los del proyecto", async () => {
    const proyecto = viejo();
    const ajeno = {
      version: "graficos/4",
      export_scope: ["plan", "debug_ph", "ui_state"],
      config: {
        plan: { slides: [] },
        debug_ph: { activo: false, color: "#FF00FF", lwd: 0.6 },
        view_mode: "timeline", inspector_tab: "content", density: "comfortable", canvas_viewport: { x: 0, y: 0, zoom: 1 },
        _unknown: { de_otro: true },
      },
    };
    for (const modo of ["merge", "replace"] as const) {
      const d = deps(proyecto);
      const prep = await prepararImportacionJson(new File([JSON.stringify(ajeno)], "ajeno.json"), SECCIONES_JSON_POR_DEFECTO, modo);
      await aplicarImportacionJson(prep, d);
      const enviado = (vi.mocked(d.configImport).mock.calls[0][0] as { config: Record<string, unknown> }).config;
      expect(enviado.plan, modo).toEqual({ slides: [] });
      for (const k of ["debug_ph", "view_mode", "inspector_tab", "density", "canvas_viewport", "overrides_reusables"] as const) {
        expect(enviado[k], `${modo} ${k}`).toEqual(OPACAS[k]);
      }
      expect(enviado._unknown, modo).toEqual(proyecto._unknown);
    }
  });

  it("componer no muta lo actual", () => {
    const actual = normalizeGraficosConfig(viejo()) as GraficosConfig & Record<string, unknown>;
    const copia = structuredClone(actual);
    const globalAntes = (actual.scope_rules as { global: unknown }).global;
    for (const modo of ["merge", "replace"] as const) {
      componerImportacion(actual, normalizeGraficosConfig({ plan: { slides: [] } }), SECCIONES_JSON_POR_DEFECTO, modo);
      componerImportacion(actual, normalizeGraficosConfig({ plan: { slides: [] } }), { ...todasLasSecciones(false), plan: true }, modo);
      expect(actual, modo).toEqual(copia);
      expect((actual.scope_rules as { global: unknown }).global, modo).toBe(globalAntes);
    }
  });
});
