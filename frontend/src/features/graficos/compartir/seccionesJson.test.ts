import { describe, expect, it } from "vitest";
import {
  armarExportacionJson,
  componerImportacion,
  estiloClienteDecisiones,
  GRAFICOS_JSON_SECTIONS,
  pickGraficosConfigSections,
  resumenImportacion,
  rotuloSeccionesImportadas,
  seccionesElegidas,
  SECCIONES_JSON_POR_DEFECTO,
  todasLasSecciones,
} from "./seccionesJson";

const soloPlan = { ...todasLasSecciones(false), plan: true };
const solo = (id: keyof typeof SECCIONES_JSON_POR_DEFECTO) => ({ ...todasLasSecciones(false), [id]: true });

describe("secciones JSON del plan (C12, decisión 30)", () => {
  it("diez secciones, todas incluidas por defecto", () => {
    expect(GRAFICOS_JSON_SECTIONS).toHaveLength(10);
    expect(seccionesElegidas(SECCIONES_JSON_POR_DEFECTO)).toHaveLength(10);
    expect(seccionesElegidas(todasLasSecciones(false))).toHaveLength(0);
  });

  it("suma estilo del cliente, documento Word y «Otros»; no ofrece guías de edición ni vista de trabajo", () => {
    const ids = GRAFICOS_JSON_SECTIONS.map((s) => s.id as string);
    expect(ids).toEqual(expect.arrayContaining(["estilo_cliente", "documento_word", "auto_otros_slides"]));
    expect(ids).not.toContain("debug_ph");
    expect(ids).not.toContain("ui_state");
    const rotulos = GRAFICOS_JSON_SECTIONS.map((s) => s.label);
    expect(rotulos).not.toContain("Guías de edición");
    expect(rotulos).not.toContain("Vista de trabajo");
  });

  it("sólo viaja lo elegido; las claves de la vista de trabajo y las guías no viajan nunca", () => {
    const cfg = {
      plan: { slides: [1] }, paletas: { a: 1 }, view_mode: "canvas", inspector_tab: "data", density: "compact",
      canvas_viewport: { x: 1, y: 2, zoom: 3 }, debug_ph: { activo: true }, selected_slide_id: "s1", _unknown: { x: 1 },
    };
    expect(pickGraficosConfigSections(cfg, soloPlan, "merge")).toEqual({ version: "graficos/4", plan: { slides: [1] } });
    const todo = pickGraficosConfigSections(cfg, SECCIONES_JSON_POR_DEFECTO, "replace");
    for (const k of ["view_mode", "inspector_tab", "density", "canvas_viewport", "debug_ph", "selected_slide_id"]) {
      expect(todo).not.toHaveProperty(k);
    }
    expect(todo._unknown).toEqual({ x: 1 });
  });

  it("combinar mezcla en profundidad; reemplazar sustituye la sección entera", () => {
    const actual = { paletas: { a: { c: 1 }, b: 2 }, plan: { slides: [1] } };
    const entrante = { paletas: { a: { d: 3 } } };
    const secciones = solo("paletas");
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

describe("estilo del cliente en el JSON (ADR 0094)", () => {
  const completo = {
    version: 1, ambito: "base",
    logos: { portada_izquierda: { file_id: "logo-1", nombre: "UNSA" } },
    letra: { paso: "estandar", roles: { titulos: "grande", cifras: "estandar" } },
    extra: { a: 1 },
  };

  it("el export lleva sólo las decisiones: ni ámbito, ni paso del recetario, ni roles que heredan", () => {
    expect(estiloClienteDecisiones(completo)).toEqual({
      version: 1,
      logos: { portada_izquierda: { file_id: "logo-1", nombre: "UNSA" } },
      letra: { roles: { titulos: "grande" } },
      extra: { a: 1 },
    });
    expect(estiloClienteDecisiones({ version: 1, ambito: "proyecto", logos: {}, letra: { paso: "estandar", roles: {} } })).toEqual({});
    const texto = armarExportacionJson({ estilo_cliente: completo }, solo("estilo_cliente"), new Date(0)).texto;
    expect(JSON.parse(texto).config.estilo_cliente).toEqual(estiloClienteDecisiones(completo));
  });

  it("un logo cuyo file_id no existe en el proyecto se descarta y se avisa; no rompe la importación", () => {
    const actual = { estilo_cliente: { version: 1, ambito: "proyecto", logos: { contraportada: { file_id: "propio" } } } };
    const entrante = {
      estilo_cliente: {
        version: 1,
        logos: { portada_izquierda: { file_id: "ajeno", nombre: "UNSA" }, contraportada: { file_id: "propio" } },
        letra: { paso: "grande" },
      },
      _unknown: { __bundle: { export_scope: ["estilo_cliente"] } },
    };
    const resumen = resumenImportacion(actual, entrante, solo("estilo_cliente"));
    expect(resumen.logosDescartados).toEqual([{ lugar: "portada_izquierda", fileId: "ajeno", rotulo: "«UNSA» (portada, izquierda)" }]);
    for (const modo of ["merge", "replace"] as const) {
      const out = componerImportacion(actual, entrante, solo("estilo_cliente"), modo);
      const estilo = out.estilo_cliente as { ambito?: string; logos?: Record<string, { file_id: string }>; letra?: { paso?: string } };
      expect(estilo.logos?.portada_izquierda, modo).toBeUndefined();
      expect(estilo.logos?.contraportada?.file_id, modo).toBe("propio");
      expect(estilo.letra?.paso, modo).toBe("grande");
      expect(estilo.ambito, modo).toBe("proyecto");
    }
  });

  it("documento Word y «Otros» viajan; «Otros» queda también en las reglas globales", () => {
    const cfg = { documento_word: { portada: "B" }, auto_otros_slides: true };
    const ida = JSON.parse(armarExportacionJson(cfg, { ...todasLasSecciones(false), documento_word: true, auto_otros_slides: true }, new Date(0)).texto);
    expect(ida.config).toMatchObject({ documento_word: { portada: "B" }, auto_otros_slides: true });
    const entrante = { ...ida.config, _unknown: { __bundle: { export_scope: ida.export_scope } } };
    const out = componerImportacion({ auto_otros_slides: false, documento_word: {} }, entrante, SECCIONES_JSON_POR_DEFECTO, "merge");
    expect(out).toMatchObject({ documento_word: { portada: "B" }, auto_otros_slides: true });
    expect((out.scope_rules as { global: Record<string, unknown> }).global.auto_otros_slides).toBe(true);
  });

  it("un archivo anterior que no declara las secciones nuevas no apaga «Otros» ni borra el estilo", () => {
    // Lo que deja el normalizador al leer un archivo viejo: defaults en las claves nuevas.
    const viejo = { plan: { slides: [] }, auto_otros_slides: false, estilo_cliente: {}, documento_word: {},
      _unknown: { __bundle: { export_scope: ["plan", "debug_ph", "ui_state"] } } };
    const actual = { auto_otros_slides: true, documento_word: { portada: "C" }, estilo_cliente: { letra: { paso: "grande" } } };
    const resumen = resumenImportacion(actual, viejo, SECCIONES_JSON_POR_DEFECTO);
    expect(resumen.ausentes.map((s) => s.id)).toEqual(expect.arrayContaining(["auto_otros_slides", "estilo_cliente", "documento_word"]));
    const out = componerImportacion(actual, viejo, SECCIONES_JSON_POR_DEFECTO, "replace");
    expect(out).toMatchObject({ auto_otros_slides: true, documento_word: { portada: "C" }, estilo_cliente: { letra: { paso: "grande" } } });
    // Sin sobre (archivo editado a mano): las nuevas sólo cuentan si traen algo propio.
    const sinSobre = { plan: { slides: [] }, auto_otros_slides: false, estilo_cliente: {}, documento_word: {} };
    expect(componerImportacion(actual, sinSobre, SECCIONES_JSON_POR_DEFECTO, "replace").auto_otros_slides).toBe(true);
  });
});
