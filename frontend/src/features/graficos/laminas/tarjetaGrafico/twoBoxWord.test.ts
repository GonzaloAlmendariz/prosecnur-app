import { describe, expect, it } from "vitest";
import { DEFAULT_WORD_PRESETS, normalizeWordPresets } from "../../../../api/graficosConfigNormalizer";
import { mergeSlotArgsPatch } from "../../store";
import { patchTwoBox } from "./twoBox";
import { WORD_FABRICA, informeLaApago, leerTopEnWord, patchTopEnWord, topHeredadoEnWord } from "./twoBoxWord";

type R = Record<string, unknown>;
const ida = (args: R, patch: R) => JSON.parse(JSON.stringify(mergeSlotArgsPatch(args, patch))) as R;
/** Ajustes Word del informe que quitan la columna de las apiladas (lo que antes era de fábrica). */
const wSin = { chart_presets: { barras_apiladas: { mostrar_barra_extra: false, barra_extra_preset: "ninguno" } } };

describe("Top Two Box de las apiladas en el Word", () => {
  it("WORD_FABRICA sale de DEFAULT_WORD_PRESETS, espejo de .WORD_CHART_PRESETS_DEFAULT_PULSO", () => {
    const chart = DEFAULT_WORD_PRESETS.chart_presets as Record<string, R>;
    expect(WORD_FABRICA.barras_apiladas).toEqual({
      mostrar_barra_extra: chart.barras_apiladas.mostrar_barra_extra,
      barra_extra_preset: chart.barras_apiladas.barra_extra_preset,
    });
    expect(WORD_FABRICA.barras_apiladas).toEqual({ mostrar_barra_extra: true, barra_extra_preset: "top2box" });
    // multi_apiladas aún no tiene espejo en el front: suelo de R (FALSE) salvo que el espejo lo declare.
    const multi = chart.multi_apiladas ?? {};
    expect(WORD_FABRICA.multi_apiladas.mostrar_barra_extra).toBe(multi.mostrar_barra_extra ?? false);
  });

  it("de fábrica el Word la lleva, como el recetario, con ajustes vacíos o normalizados", () => {
    expect(topHeredadoEnWord({ var: "p1" }, {}, {})).toBe(true);
    expect(topHeredadoEnWord({ var: "p1" }, {}, normalizeWordPresets({}))).toBe(true);
    expect(leerTopEnWord("p_barras_apiladas", { var: "p1" }, {}, normalizeWordPresets({}))).toEqual({
      aplica: true, sale: true, editable: false, motivo: "word_lo_da",
    });
    expect(patchTopEnWord("p_barras_apiladas", { var: "p1" }, {}, {}, false)).toEqual({});
  });

  it("si el informe apagó la columna, el Word no la enciende (.word_patch_respetar_apagado)", () => {
    for (const presets of [
      { barras_apiladas: { mostrar_barra_extra: false } },
      { barras_apiladas: { barra_extra_preset: "ninguno" } },
    ]) {
      expect(informeLaApago(presets)).toBe(true);
      expect(topHeredadoEnWord({ var: "p1" }, presets, normalizeWordPresets({}))).toBe(false);
      // Sin Top Two Box en la lámina no hay nada que decidir para el Word.
      expect(leerTopEnWord("p_barras_apiladas", { var: "p1" }, presets, {}).aplica).toBe(false);
    }
    expect(informeLaApago({ barras_apiladas: { mostrar_barra_extra: true, barra_extra_preset: "top2box" } })).toBe(false);
  });

  it("con el informe apagado, la lámina que la enciende la lleva también al Word y no se quita sólo de allí", () => {
    const presets = { barras_apiladas: { barra_extra_preset: "ninguno" } };
    const args = ida({ var: "p1" }, patchTwoBox("p_barras_apiladas", { var: "p1" }, presets, { caja: "top", activa: true }));
    expect(leerTopEnWord("p_barras_apiladas", args, presets, {})).toEqual({
      aplica: true, sale: true, editable: false, motivo: "lamina_lo_necesita",
    });
  });

  it("si los ajustes Word la quitan, encenderla fija el par por gráfico; apagarla lo borra y vuelve a lo heredado", () => {
    const args = { var: "p1", overrides: { top2box_labels: ["A", "B"] } };
    expect(leerTopEnWord("p_barras_apiladas", args, {}, wSin)).toEqual({ aplica: true, sale: false, editable: true, motivo: "word_la_quita" });
    const on = ida(args, patchTopEnWord("p_barras_apiladas", args, {}, wSin, true));
    expect(on.overrides).toEqual({ top2box_labels: ["A", "B"], mostrar_barra_extra: true, barra_extra_preset: "top2box" });
    expect(leerTopEnWord("p_barras_apiladas", on, {}, wSin)).toEqual({ aplica: true, sale: true, editable: true, motivo: "fijado" });
    const off = ida(on, patchTopEnWord("p_barras_apiladas", on, {}, wSin, false));
    expect(off.overrides).toEqual({ top2box_labels: ["A", "B"] });
    expect(leerTopEnWord("p_barras_apiladas", off, {}, wSin).sale).toBe(false);
  });

  it("apagar sólo en el Word cuando el Word la da solo no tiene canal en el motor: no escribe nada", () => {
    // Los overrides del gráfico mandan igual en la lámina: mostrar_barra_extra = FALSE la apagaría en las dos.
    const args = { var: "p1" };
    const r = leerTopEnWord("p_barras_apiladas", args, {}, {});
    expect(r).toMatchObject({ sale: true, editable: false, motivo: "word_lo_da" });
    expect(patchTopEnWord("p_barras_apiladas", args, {}, {}, false)).toEqual({});
  });

  it("apagar y volver a encender la columna conserva el «también en el Word»", () => {
    const args = { var: "p1", overrides: { mostrar_barra_extra: true, barra_extra_preset: "top2box" } };
    const off = ida(args, patchTwoBox("p_barras_apiladas", args, {}, { caja: "top", activa: false }));
    expect(off.overrides).toEqual({ mostrar_barra_extra: false, barra_extra_preset: "top2box" });
    expect(leerTopEnWord("p_barras_apiladas", off, {}, {}).aplica).toBe(false);
    const on = ida(off, patchTwoBox("p_barras_apiladas", off, {}, { caja: "top", activa: true }));
    expect(on.overrides).toEqual({ mostrar_barra_extra: true, barra_extra_preset: "top2box" });
    expect(leerTopEnWord("p_barras_apiladas", on, {}, {}).sale).toBe(true);
  });

  it("un preset PPT que pide otra columna que la de fábrica se conserva en el Word", () => {
    const presets = { barras_apiladas: { barra_extra_preset: "bottom2box" } };
    expect(leerTopEnWord("p_barras_apiladas", {}, presets, {}).aplica).toBe(false);
    expect(topHeredadoEnWord({}, presets, {})).toBe(false);
  });

  it("con «Dividir por» hereda también el Word de multiapiladas, que apaga la columna de fábrica", () => {
    const args = { var: "p1", cruces: "sexo" };
    expect(topHeredadoEnWord(args, {}, {})).toBe(false);
    expect(leerTopEnWord("p_barras_apiladas", args, {}, {})).toMatchObject({ sale: false, editable: true });
  });

  it("no aplica a la multiapilada (el constructor ya lo lleva al Word) ni con la columna apagada", () => {
    expect(leerTopEnWord("p_barras_multiapiladas", { modo: "var", top2box: true }, {}, {}).aplica).toBe(false);
    expect(leerTopEnWord("p_barras_apiladas", { overrides: { mostrar_barra_extra: false } }, {}, {}).aplica).toBe(false);
  });
});
