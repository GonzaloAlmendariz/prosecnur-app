import { describe, expect, it } from "vitest";
import {
  armarExportacionJson,
  componerImportacion,
  GRAFICOS_JSON_SECTIONS,
  pickGraficosConfigSections,
  rotuloSeccionesImportadas,
  seccionesElegidas,
  SECCIONES_JSON_POR_DEFECTO,
  todasLasSecciones,
} from "./seccionesJson";

const soloPlan = { ...todasLasSecciones(false), plan: true };

describe("secciones JSON del plan (C12)", () => {
  it("nueve secciones, todas incluidas por defecto", () => {
    expect(GRAFICOS_JSON_SECTIONS).toHaveLength(9);
    expect(seccionesElegidas(SECCIONES_JSON_POR_DEFECTO)).toHaveLength(9);
    expect(seccionesElegidas(todasLasSecciones(false))).toHaveLength(0);
  });

  it("sólo viaja lo elegido; la vista de trabajo arrastra sus cinco campos", () => {
    const cfg = { plan: { slides: [1] }, paletas: { a: 1 }, view_mode: "canvas", density: "compact", _unknown: { x: 1 } };
    expect(pickGraficosConfigSections(cfg, soloPlan, "merge")).toEqual({ version: "graficos/4", plan: { slides: [1] } });
    const ui = pickGraficosConfigSections(cfg, { ...todasLasSecciones(false), ui_state: true }, "replace");
    expect(ui).toMatchObject({ view_mode: "canvas", density: "compact", _unknown: { x: 1 } });
  });

  it("combinar mezcla en profundidad; reemplazar sustituye la sección entera", () => {
    const actual = { paletas: { a: { c: 1 }, b: 2 }, plan: { slides: [1] } };
    const entrante = { paletas: { a: { d: 3 } } };
    const secciones = { ...todasLasSecciones(false), paletas: true };
    const comb = componerImportacion(actual, entrante, secciones, "merge");
    expect(comb.paletas).toEqual({ a: { c: 1, d: 3 }, b: 2 });
    expect(comb.plan).toEqual({ slides: [1] });
    const reem = componerImportacion(actual, entrante, secciones, "replace");
    expect(reem.paletas).toEqual({ a: { d: 3 } });
    expect((reem.scope_rules as { global: Record<string, unknown> }).global.paletas).toEqual({ a: { d: 3 } });
  });

  it("el archivo exportado declara su alcance y se nombra completo o parcial", () => {
    const ahora = new Date("2026-10-11T12:00:00Z");
    const completo = armarExportacionJson({ plan: { slides: [] } }, SECCIONES_JSON_POR_DEFECTO, ahora);
    expect(completo.nombreArchivo).toBe(`pulso_graficos_completo_${ahora.getTime()}.json`);
    const parcial = armarExportacionJson({ plan: { slides: [] } }, soloPlan, ahora);
    expect(parcial.nombreArchivo).toMatch(/^pulso_graficos_parcial_/);
    expect(JSON.parse(parcial.texto)).toMatchObject({ version: "graficos/4", export_scope: ["plan"], config: { plan: { slides: [] } } });
  });

  it("rótulo con número", () => {
    expect(rotuloSeccionesImportadas(1)).toBe("1 sección importada");
    expect(rotuloSeccionesImportadas(3)).toBe("3 secciones importadas");
  });
});
