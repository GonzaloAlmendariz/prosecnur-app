import { describe, expect, it } from "vitest";
import { mergeSlotArgsPatch } from "../../store";
import { admiteTitulo, aplicaRotuloWord, patchRotuloWord, repiteRotuloWord, tituloDeFigura, tituloWordPorDefecto } from "./enElWord";

describe("«En el Word»: rótulo de la barra (word_ocultar_etiqueta_categoria)", () => {
  it("aplica a apiladas sin cruce y a multiapiladas «Comparar preguntas»", () => {
    expect(aplicaRotuloWord("p_barras_apiladas", {})).toBe(true);
    expect(aplicaRotuloWord("p_barras_apiladas", { cruces: "sexo" })).toBe(false);
    expect(aplicaRotuloWord("p_barras_multiapiladas", {})).toBe(true);
    expect(aplicaRotuloWord("p_barras_multiapiladas", { modo: "cruce" })).toBe(false);
    expect(aplicaRotuloWord("p_barras_agrupadas", {})).toBe(false);
  });

  it("por defecto el Word no repite la pregunta (el título ya la nombra)", () => {
    expect(repiteRotuloWord("p_barras_apiladas", {}, {}, {})).toBe(false);
  });

  it("hereda de los ajustes Word del informe y del preset del gráfico, en ese orden inverso", () => {
    const w = { chart_options: { ocultar_etiqueta_si_titulo: false } };
    expect(repiteRotuloWord("p_barras_apiladas", {}, {}, w)).toBe(true);
    expect(repiteRotuloWord("p_barras_apiladas", {}, { barras_apiladas: { word_ocultar_etiqueta_categoria: true } }, w)).toBe(false);
    expect(repiteRotuloWord("p_barras_multiapiladas", {}, { barras_apiladas: { word_ocultar_etiqueta_categoria: false } }, {})).toBe(false);
  });

  it("el patch escribe overrides sólo al apartarse de lo heredado y sobrevive guardar y leer", () => {
    const args = { var: "p1", overrides: { top2box_labels: ["A", "B"] } };
    const on = JSON.parse(JSON.stringify(mergeSlotArgsPatch(args, patchRotuloWord("p_barras_apiladas", args, {}, {}, true)))) as Record<string, unknown>;
    expect(on.overrides).toEqual({ top2box_labels: ["A", "B"], word_ocultar_etiqueta_categoria: false });
    expect(repiteRotuloWord("p_barras_apiladas", on, {}, {})).toBe(true);
    const off = mergeSlotArgsPatch(on, patchRotuloWord("p_barras_apiladas", on, {}, {}, false));
    expect(off.overrides).toEqual({ top2box_labels: ["A", "B"] });
    const solo = mergeSlotArgsPatch({}, patchRotuloWord("p_barras_apiladas", { overrides: { word_ocultar_etiqueta_categoria: false } }, {}, {}, false));
    expect(solo.overrides).toBeUndefined();
  });
});

describe("«En el Word»: título de la figura", () => {
  it("se ofrece si el registro declara `titulo`", () => {
    expect(admiteTitulo([{ name: "var" }, { name: "titulo" }])).toBe(true);
    expect(admiteTitulo([{ name: "var" }])).toBe(false);
  });
  it("el título propio sólo manda en láminas de dos o más gráficos; la multiapilada titula cada pregunta", () => {
    expect(tituloDeFigura("p_barras_apiladas", 1)).toBe("lamina");
    expect(tituloDeFigura("p_barras_apiladas", 2)).toBe("propio");
    expect(tituloDeFigura("p_pie", 4)).toBe("propio");
    expect(tituloDeFigura("p_barras_multiapiladas", 1)).toBe("lamina_y_pregunta");
    expect(tituloDeFigura("p_barras_multiapiladas", 3)).toBe("lamina_y_pregunta");
  });
  it("vacío usa la etiqueta corta y si no la pregunta", () => {
    expect(tituloWordPorDefecto(" Corta ", "Pregunta larga")).toBe("Corta");
    expect(tituloWordPorDefecto("", "Pregunta larga")).toBe("Pregunta larga");
  });
});
