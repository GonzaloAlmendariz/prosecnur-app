import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import type { ArgMetadata, GraficadorRef } from "../../../api/graficos";
import { usePlanStore, type GraficosConfig } from "../store";
import { camposDeDatos } from "./argsDatosGrafico";
import { conEspejoEnOverrides, FORMAL_EN, MANDOS_ESPEJO_OVERRIDES, valorDeMando } from "./mandosPorOverrides";

// U6 del checklist de mandos del mazo (2026-11-05): pista gris, un color por opción y marca de la mediana viajan por
// `overrides`. La tarjeta escribe en espejo y el backend completa lo que falte (test-graficos-migrar-args-overrides.R).

const choice = (name: string, values: string[], def: string): ArgMetadata =>
  ({ name, label: name, tipo_input: "choice", default: def, via_overrides: true, choices: values.map((v) => ({ value: v, label: v })) }) as ArgMetadata;
const PISTA = choice("pista_barras", ["auto", "siempre", "nunca"], "auto");
const COLOR = { name: "colorear_por_opcion", label: "x", tipo_input: "bool", default: false, via_overrides: true } as ArgMetadata;
const MEDIANA = choice("marca_mediana", ["linea", "triangulo"], "linea");

describe("conEspejoEnOverrides", () => {
  it("copia el mando a overrides y conserva lo que overrides ya tenía", () => {
    const p = conEspejoEnOverrides({ var: "p1", overrides: { decimales: 0 } }, { pista_barras: "nunca" });
    expect(p).toEqual({ pista_barras: "nunca", overrides: { decimales: 0, pista_barras: "nunca" } });
  });

  it("borrar el mando lo borra de los dos lados y un overrides vacío se borra", () => {
    expect(conEspejoEnOverrides({ overrides: { marca_mediana: "triangulo" } }, { marca_mediana: null }))
      .toEqual({ marca_mediana: null, overrides: null });
  });

  it("un parche sin mandos en espejo sale igual", () => {
    const parche = { var: "p2" };
    expect(conEspejoEnOverrides({ overrides: { a: 1 } }, parche)).toBe(parche);
  });

  it("la lista y su excepción son las del backend (`.GRAFICOS_ARGS_ESPEJO_OVERRIDES`, `.GRAFICOS_ARGS_ESPEJO_FORMAL_EN`)", () => {
    const r = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../../../api/R/graficos_migrar_args_overrides.R"), "utf8")
      .replace(/#[^\n]*/g, "");
    const cuerpo = (nombre: string) => r.match(new RegExp(`\\${nombre}\\s*<-\\s*(?:c|list)\\(([^)]*)\\)`))?.[1] ?? "";
    const espejo = [...cuerpo(".GRAFICOS_ARGS_ESPEJO_OVERRIDES").matchAll(/"([^"]+)"/g)].map((m) => m[1]).sort();
    expect(espejo).toEqual(["colorear_por_opcion", "marca_mediana", "mostrar_frecuencia", "pista_barras", "referencia_barra"]);
    expect([...MANDOS_ESPEJO_OVERRIDES].sort()).toEqual(espejo);
    const formal = Object.fromEntries([...cuerpo(".GRAFICOS_ARGS_ESPEJO_FORMAL_EN").matchAll(/(\w+)\s*=\s*"([^"]+)"/g)].map((m) => [m[1], [m[2]]]));
    expect(formal).toEqual({ referencia_barra: ["p_cobertura"] });
    expect(Object.fromEntries(Object.entries(FORMAL_EN).map(([k, v]) => [k, [...v]]))).toEqual(formal);
  });
});

describe("valorDeMando", () => {
  it("un mando en espejo se lee de overrides si lo trae (U10: el histograma del mazo)", () => {
    expect(valorDeMando({ overrides: { mostrar_frecuencia: true } }, "mostrar_frecuencia")).toBe(true);
    expect(valorDeMando({ mostrar_frecuencia: false, overrides: { mostrar_frecuencia: true } }, "mostrar_frecuencia")).toBe(true);
    expect(valorDeMando({ marca_mediana: "triangulo" }, "marca_mediana")).toBe("triangulo");
  });

  it("un campo que no va en espejo se lee de args", () => {
    expect(valorDeMando({ decimales: 1, overrides: { decimales: 2 } }, "decimales")).toBe(1);
  });
});

describe("la tarjeta escribe en overrides lo que el motor lee", () => {
  beforeEach(() => {
    const graf: GraficadorRef = { graficador: "p_barras_agrupadas", args: { var: "p1", overrides: { titulo: "T" } } };
    usePlanStore.getState().hydrate({
      version: "graficos/4",
      plan: { slides: [{ id: "a", tipo: "p_slide_1_grafico", payload: { titulo: "T", grafico: graf } }] },
      presets: {}, w_presets: {}, selected_slide_id: null, paletas: {}, iconos: [], overrides_reusables: [],
      debug_ph: { activo: false, color: "#FF00FF", lwd: 0.6 },
    } as unknown as GraficosConfig);
  });

  it("updateSlotArgs deja el valor en args y en overrides; el segundo cambio también llega", () => {
    const st = usePlanStore.getState();
    st.updateSlotArgs("a", "grafico", { pista_barras: "nunca" });
    st.updateSlotArgs("a", "grafico", { pista_barras: "siempre", colorear_por_opcion: true });
    const args = (usePlanStore.getState().plan.slides[0].payload.grafico as GraficadorRef).args as Record<string, unknown>;
    expect(args.pista_barras).toBe("siempre");
    expect(args.overrides).toEqual({ titulo: "T", pista_barras: "siempre", colorear_por_opcion: true });
  });
});

describe("camposDeDatos · mandos por overrides", () => {
  const nombres = (graficador: string) => camposDeDatos([PISTA, COLOR, MEDIANA], {}, graficador).map((c) => [c.arg.name, c.rotulo]);

  it("cada uno sale sólo en su graficador, con su rótulo", () => {
    expect(nombres("p_barras_agrupadas")).toEqual([["pista_barras", "Pista gris hasta el 100%"], ["colorear_por_opcion", "Un color por opción"]]);
    expect(nombres("p_barras_categoricas")).toEqual([["pista_barras", "Pista gris hasta el 100%"]]);
    expect(nombres("p_histograma")).toEqual([["marca_mediana", "Marca de la mediana"]]);
    expect(nombres("p_barras_apiladas")).toEqual([]);
  });

  it("U10: el histograma ofrece «Casos junto al %»; el ancho y los intervalos vacíos siguen retirados", () => {
    const num = (name: string, tipo: ArgMetadata["tipo_input"]) => ({ name, label: name, tipo_input: tipo, grupo: "datos" }) as ArgMetadata;
    const campos = camposDeDatos([MEDIANA, num("mostrar_frecuencia", "bool"), num("ancho_bin", "number"), num("mostrar_bins_vacios", "bool")], {}, "p_histograma");
    expect(campos.map((c) => c.arg.name)).toEqual(["marca_mediana", "mostrar_frecuencia"]);
  });
});
