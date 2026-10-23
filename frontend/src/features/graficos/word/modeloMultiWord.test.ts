import { describe, expect, it } from "vitest";
import { conModoInforme, leerModoInforme, leerModoLamina, MODOS_MULTI_INFORME, MODOS_MULTI_LAMINA, rotuloModo } from "./modeloMultiWord";

// W6: el modo de las multiapiladas en el Word, con el contrato del motor (f134ba5ad).
describe("multiapiladas en el Word", () => {
  it("N8b: el informe es «por pregunta» (criterio B) salvo decisión; ese valor no se guarda y «automatico» sí, explícito", () => {
    expect(leerModoInforme({})).toBe("mismo_actor_escala");
    const w = conModoInforme({ chart_options: { ocultar_etiqueta_si_titulo: true } }, "por_barra");
    expect(w.chart_options).toEqual({ ocultar_etiqueta_si_titulo: true, multiapiladas_word: "por_barra" });
    expect(leerModoInforme(w)).toBe("por_barra");
    expect(conModoInforme(w, "mismo_actor_escala").chart_options).toEqual({ ocultar_etiqueta_si_titulo: true });
    const antes = conModoInforme(w, "automatico");
    expect(antes.chart_options).toEqual({ ocultar_etiqueta_si_titulo: true, multiapiladas_word: "automatico" });
    expect(leerModoInforme(antes)).toBe("automatico");   // un proyecto guardado con automático no cambia
  });
  it("la lámina sigue al informe si no elige o si el valor no es válido", () => {
    expect(leerModoLamina({})).toBe("");
    expect(leerModoLamina({ word_multiapiladas: "x" })).toBe("");
    expect(leerModoLamina({ word_multiapiladas: "un_grafico" })).toBe("un_grafico");
  });
  it("el informe conoce mismo público; el alias del N8 y un valor desconocido son el criterio por defecto", () => {
    expect(leerModoInforme({ chart_options: { multiapiladas_word: "un_grafico_mismo_publico" } })).toBe("un_grafico_mismo_publico");
    expect(leerModoInforme(conModoInforme({}, "un_grafico_mismo_publico"))).toBe("un_grafico_mismo_publico");
    expect(conModoInforme({}, "un_grafico_mismo_publico").chart_options).toEqual({ multiapiladas_word: "un_grafico_mismo_publico" });
    expect(leerModoInforme({ chart_options: { multiapiladas_word: "un_grafico_mismo_actor" } })).toBe("mismo_actor_escala");
    expect(leerModoInforme({ chart_options: { multiapiladas_word: "otro" } })).toBe("mismo_actor_escala");
  });
  it("el selector ofrece el criterio nuevo como recomendado y «como antes» para automatico", () => {
    expect(MODOS_MULTI_INFORME[0]).toMatchObject({ clave: "mismo_actor_escala", rotulo: "Por pregunta (recomendado)" });
    expect(MODOS_MULTI_INFORME[0].detalle).toContain("la misma pregunta con varios actores va en una figura con una fila por actor");
    expect(MODOS_MULTI_INFORME.find((m) => m.clave === "automatico")?.rotulo).toBe("Como antes (una figura por tema)");
    expect(rotuloModo("automatico")).toBe("Como antes (una figura por tema)");
  });
  it("la lámina no ofrece lo que el motor rechaza en el slot", () => {
    expect(MODOS_MULTI_LAMINA.map((m) => m.clave)).toEqual(["un_grafico", "por_tema", "por_barra"]);
    expect(leerModoLamina({ word_multiapiladas: "un_grafico_mismo_publico" })).toBe("");
  });
});
