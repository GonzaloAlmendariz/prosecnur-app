// B8 (ronda 20): «Referencia de las barras» en la tarjeta. Sólo barras agrupadas, categóricas y cobertura («ojo no en las
// apiladas»); tres estados en segmentado («Como el gráfico» = sin valor); en las barras viaja por `overrides` y en la
// cobertura es formal del constructor.
import { beforeEach, describe, expect, it } from "vitest";
import type { ArgMetadata, GraficadorRef } from "../../../api/graficos";
import { usePlanStore, type GraficosConfig } from "../store";
import { camposDeDatos } from "./argsDatosGrafico";
import { valorDeMando } from "./mandosPorOverrides";
import { claveConVacio, segmentacionConVacio, valorConVacio } from "./opcionesEnSegmentado";

const REFERENCIA = {
  name: "referencia_barra", label: "Referencia de las barras", tipo_input: "choice", grupo: "estilo", via_overrides: true,
  choices: [{ value: "pista", label: "Fondo gris hasta el 100%" }, { value: "eje", label: "Eje abajo" }],
} as ArgMetadata;

describe("referencia de las barras · dónde sale", () => {
  const campo = (g: string) => camposDeDatos([REFERENCIA], {}, g).find((c) => c.arg.name === "referencia_barra");

  it("en agrupadas, categóricas y cobertura, con la opción vacía «Como el gráfico»", () => {
    for (const g of ["p_barras_agrupadas", "p_barras_categoricas", "p_cobertura"]) {
      expect(campo(g)?.rotulo).toBe("Referencia de las barras");
      expect(campo(g)?.opcionVacia).toBe("Como el gráfico");
    }
    expect(camposDeDatos([REFERENCIA], { modo: "categorias" }, "p_cobertura").map((c) => c.arg.name)).toContain("referencia_barra");
  });

  it("nunca en apiladas, multiapiladas ni divergentes", () => {
    for (const g of ["p_barras_apiladas", "p_multi_apiladas", "p_barras_divergentes"]) expect(campo(g)).toBeUndefined();
  });

  it("el segmentado tiene tres estados en orden y la vacía borra el valor", () => {
    const s = segmentacionConVacio("Como el gráfico", REFERENCIA.choices ?? []);
    expect(s.opciones.map((o) => o.rotulo)).toEqual(["Como el gráfico", "Fondo gris hasta el 100%", "Eje abajo"]);
    expect(s.apilado).toBe(true);
    expect(claveConVacio(undefined, REFERENCIA.choices ?? [])).toBe("");
    expect(claveConVacio("eje", REFERENCIA.choices ?? [])).toBe("eje");
    expect(claveConVacio("otro", REFERENCIA.choices ?? [])).toBe("");
    expect(valorConVacio("")).toBeNull();
    expect(valorConVacio("pista")).toBe("pista");
  });
});

describe("referencia de las barras · dónde se escribe", () => {
  const hidratar = (graf: GraficadorRef) => usePlanStore.getState().hydrate({
    version: "graficos/4",
    plan: { slides: [{ id: "a", tipo: "p_slide_1_grafico", payload: { titulo: "T", grafico: graf } }] },
    presets: {}, w_presets: {}, selected_slide_id: null, paletas: {}, iconos: [], overrides_reusables: [],
    debug_ph: { activo: false, color: "#FF00FF", lwd: 0.6 },
  } as unknown as GraficosConfig);
  const argsDelPlan = () => (usePlanStore.getState().plan.slides[0].payload.grafico as GraficadorRef).args as Record<string, unknown>;

  describe("barras agrupadas y categóricas: por overrides", () => {
    for (const g of ["p_barras_agrupadas", "p_barras_categoricas"]) {
      beforeEach(() => hidratar({ graficador: g, args: { var: "p1", overrides: { titulo: "T" } } }));
      it(`${g}: «Eje abajo» llega a overrides.referencia_barra; «Como el gráfico» lo borra`, () => {
        usePlanStore.getState().updateSlotArgs("a", "grafico", { referencia_barra: "eje" });
        expect(argsDelPlan().overrides).toEqual({ titulo: "T", referencia_barra: "eje" });
        expect(valorDeMando(argsDelPlan(), "referencia_barra", g)).toBe("eje");
        usePlanStore.getState().updateSlotArgs("a", "grafico", { referencia_barra: valorConVacio("") });
        expect(argsDelPlan().overrides).toEqual({ titulo: "T" });
        expect(argsDelPlan()).not.toHaveProperty("referencia_barra");
      });
    }
  });

  describe("cobertura: formal en args", () => {
    beforeEach(() => hidratar({ graficador: "p_cobertura", args: { bases: ["a", "b"] } }));
    it("«Fondo gris hasta el 100%» queda en args.referencia_barra, sin tocar overrides", () => {
      usePlanStore.getState().updateSlotArgs("a", "grafico", { referencia_barra: "pista" });
      expect(argsDelPlan().referencia_barra).toBe("pista");
      expect(argsDelPlan()).not.toHaveProperty("overrides");
      // La lectura de la tarjeta en la cobertura es la de args aunque un overrides viejo traiga otra cosa.
      expect(valorDeMando({ referencia_barra: "pista", overrides: { referencia_barra: "eje" } }, "referencia_barra", "p_cobertura")).toBe("pista");
      usePlanStore.getState().updateSlotArgs("a", "grafico", { referencia_barra: null });
      expect(argsDelPlan()).not.toHaveProperty("referencia_barra");
    });
  });
});
