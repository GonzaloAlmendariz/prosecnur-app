import { describe, expect, test } from "vitest";
import { normalizeWordFijado } from "./graficosWordFijado";
import { normalizePresetsRegistry } from "../features/graficos/metadataSanitizers";

const MOTIVO = "Lo fija el recetario en el Word: la leyenda va a 8 pt.";

describe("normalizeWordFijado: defensivo con el payload de presets-metadata", () => {
  test("ausente, null, objeto o texto → []", () => {
    expect(normalizeWordFijado(undefined)).toEqual([]);
    expect(normalizeWordFijado(null)).toEqual([]);
    expect(normalizeWordFijado({ arg: "size_leyenda", motivo: MOTIVO })).toEqual([]);
    expect(normalizeWordFijado("size_leyenda")).toEqual([]);
  });

  test("descarta entradas sin arg o sin motivo de texto", () => {
    const out = normalizeWordFijado([
      { arg: "size_leyenda", valor: 8, unidad: "pt", motivo: MOTIVO, aplica_si_marco: true },
      { valor: 8, motivo: MOTIVO },
      { arg: "", motivo: MOTIVO },
      { arg: "size_ejes", motivo: 3 },
      { arg: "size_ejes" },
      "size_ejes",
      null,
    ]);
    expect(out.map((e) => e.arg)).toEqual(["size_leyenda"]);
    expect(out[0]).toEqual({ arg: "size_leyenda", valor: 8, unidad: "pt", motivo: MOTIVO, aplica_si_marco: true });
  });

  test("sin valor = sin efecto: no inventa valor ni unidad; acepta escalares de largo 1 y repite arg sólo una vez", () => {
    const out = normalizeWordFijado([
      { arg: "barra_extra_umbral_alto", motivo: MOTIVO, aplica_si_marco: true },
      { arg: "mostrar_leyenda", valor: [true], motivo: [MOTIVO], aplica_si_marco: [true] },
      { arg: "mostrar_leyenda", valor: false, motivo: MOTIVO },
      { arg: "grosor_barras", valor: { x: 1 }, unidad: "proporción", motivo: MOTIVO },
    ]);
    expect(out).toEqual([
      { arg: "barra_extra_umbral_alto", motivo: MOTIVO, aplica_si_marco: true },
      { arg: "mostrar_leyenda", valor: true, motivo: MOTIVO, aplica_si_marco: true },
      { arg: "grosor_barras", motivo: MOTIVO, aplica_si_marco: true },
    ]);
  });

  test("normalizePresetsRegistry conserva word_fijado y no lo agrega a quien no lo trae", () => {
    const reg = normalizePresetsRegistry({
      presets: [
        { name: "barras_apiladas", args: [], word_fijado: [{ arg: "size_leyenda", valor: 8, unidad: "pt", motivo: MOTIVO, aplica_si_marco: true }] },
        { name: "barras_agrupadas", args: [], word_fijado: "nada" },
        { name: "torta", args: [] },
      ],
    });
    expect(reg.presets[0].word_fijado).toEqual([{ arg: "size_leyenda", valor: 8, unidad: "pt", motivo: MOTIVO, aplica_si_marco: true }]);
    expect(reg.presets[1]).not.toHaveProperty("word_fijado");
    expect(reg.presets[2]).not.toHaveProperty("word_fijado");
  });
});
