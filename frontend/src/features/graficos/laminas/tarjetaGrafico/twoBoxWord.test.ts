import { describe, expect, it } from "vitest";
import { DEFAULT_WORD_PRESETS, normalizeWordPresets } from "../../../../api/graficosConfigNormalizer";
import { mergeSlotArgsPatch } from "../../store";
import { leerTwoBox, patchTwoBox } from "./twoBox";
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
    // multi_apiladas ya tiene espejo de R: sale de DEFAULT_WORD_PRESETS, sin suelo propio.
    expect(chart.multi_apiladas.mostrar_barra_extra).toBe(false);
    expect(WORD_FABRICA.multi_apiladas).toEqual({ mostrar_barra_extra: chart.multi_apiladas.mostrar_barra_extra });
  });

  it("de fábrica el Word la lleva, como el recetario, con ajustes vacíos o normalizados", () => {
    expect(topHeredadoEnWord({ var: "p1" }, {}, {})).toBe(true);
    expect(topHeredadoEnWord({ var: "p1" }, {}, normalizeWordPresets({}))).toBe(true);
    expect(leerTopEnWord("p_barras_apiladas", { var: "p1" }, {}, normalizeWordPresets({}))).toEqual({
      aplica: true, sale: true, editable: true, motivo: "word_lo_da",
    });
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

  it("con el informe apagado, la lámina que la enciende la lleva al Word; quitarla sólo de allí no toca la lámina", () => {
    const presets = { barras_apiladas: { barra_extra_preset: "ninguno" } };
    const args = ida({ var: "p1" }, patchTwoBox("p_barras_apiladas", { var: "p1" }, presets, { caja: "top", activa: true }));
    const laminaAntes = { ...(args.overrides as R) };
    expect(leerTopEnWord("p_barras_apiladas", args, presets, {})).toEqual({
      aplica: true, sale: true, editable: true, motivo: "lamina_lo_necesita",
    });
    const off = ida(args, patchTopEnWord("p_barras_apiladas", args, presets, {}, false));
    // Lo heredado sin overrides tampoco la da, pero los overrides de la lámina sí: la clave hace falta.
    expect(topHeredadoEnWord(args, presets, {})).toBe(false);
    expect(off.overrides).toEqual({ ...laminaAntes, word_mostrar_barra_extra: false });
    expect(leerTwoBox("p_barras_apiladas", off, presets)?.top.activa).toBe(true);
    const back = ida(off, patchTopEnWord("p_barras_apiladas", off, presets, {}, true));
    expect(back.overrides).toEqual(laminaAntes);
  });

  it("si los ajustes Word la quitan, encenderla sólo en el Word escribe la clave TRUE; volver a lo heredado la borra", () => {
    const args = { var: "p1", overrides: { top2box_labels: ["A", "B"] } };
    expect(leerTopEnWord("p_barras_apiladas", args, {}, wSin)).toEqual({ aplica: true, sale: false, editable: true, motivo: "word_la_quita" });
    const on = ida(args, patchTopEnWord("p_barras_apiladas", args, {}, wSin, true));
    expect(on.overrides).toEqual({ top2box_labels: ["A", "B"], word_mostrar_barra_extra: true });
    expect(leerTopEnWord("p_barras_apiladas", on, {}, wSin)).toEqual({ aplica: true, sale: true, editable: true, motivo: "fijado" });
    const off = ida(on, patchTopEnWord("p_barras_apiladas", on, {}, wSin, false));
    expect(off.overrides).toEqual({ top2box_labels: ["A", "B"] });
    expect(leerTopEnWord("p_barras_apiladas", off, {}, wSin).sale).toBe(false);
  });

  it("apagar sólo en el Word escribe word_mostrar_barra_extra = FALSE y no toca mostrar_barra_extra de la lámina", () => {
    const args = { var: "p1", overrides: { top2box_labels: ["A", "B"] } };
    expect(leerTopEnWord("p_barras_apiladas", args, {}, {})).toMatchObject({ sale: true, editable: true, motivo: "word_lo_da" });
    const off = ida(args, patchTopEnWord("p_barras_apiladas", args, {}, {}, false));
    expect(off.overrides).toEqual({ top2box_labels: ["A", "B"], word_mostrar_barra_extra: false });
    expect((off.overrides as R).mostrar_barra_extra).toBeUndefined();
    expect(leerTwoBox("p_barras_apiladas", off, {})?.top.activa).toBe(true);
    expect(leerTopEnWord("p_barras_apiladas", off, {}, {})).toEqual({ aplica: true, sale: false, editable: true, motivo: "quitado" });
    // Volver a encender coincide con lo heredado: borra la clave en vez de escribir TRUE.
    const back = ida(off, patchTopEnWord("p_barras_apiladas", off, {}, {}, true));
    expect(back.overrides).toEqual({ top2box_labels: ["A", "B"] });
  });

  it("la clave sólo-Word manda sobre lo heredado al leer", () => {
    expect(leerTopEnWord("p_barras_apiladas", { var: "p1", overrides: { word_mostrar_barra_extra: false } }, {}, {}))
      .toMatchObject({ sale: false, motivo: "quitado" });
    expect(leerTopEnWord("p_barras_apiladas", { var: "p1", overrides: { word_mostrar_barra_extra: true } }, {}, wSin))
      .toMatchObject({ sale: true, motivo: "fijado" });
    // Un valor no lógico se ignora, como en el motor.
    expect(leerTopEnWord("p_barras_apiladas", { var: "p1", overrides: { word_mostrar_barra_extra: "no" } }, {}, {}))
      .toMatchObject({ sale: true, motivo: "word_lo_da" });
  });

  it("el par que la tarjeta escribía antes para el Word se limpia sólo si la lámina lo hereda igual", () => {
    // Lámina con Top Two Box por herencia: el par es redundante para ella y se reemplaza por la clave sólo-Word.
    const viejo = { var: "p1", overrides: { mostrar_barra_extra: true, barra_extra_preset: "top2box" } };
    const off = ida(viejo, patchTopEnWord("p_barras_apiladas", viejo, {}, {}, false));
    expect(off.overrides).toEqual({ word_mostrar_barra_extra: false });
    expect(leerTwoBox("p_barras_apiladas", off, {})?.top.activa).toBe(true);
    // Informe apagado: el par es la elección de la lámina y se conserva.
    const presets = { barras_apiladas: { barra_extra_preset: "ninguno" } };
    const off2 = ida(viejo, patchTopEnWord("p_barras_apiladas", viejo, presets, {}, false));
    expect(off2.overrides).toEqual({ mostrar_barra_extra: true, barra_extra_preset: "top2box", word_mostrar_barra_extra: false });
  });

  it("apagar el Top Two Box de la lámina se lleva también el TRUE sólo-Word", () => {
    const args = { var: "p1", overrides: { word_mostrar_barra_extra: true } };
    const off = ida(args, patchTwoBox("p_barras_apiladas", args, {}, { caja: "top", activa: false }));
    expect(off.overrides).toEqual({ mostrar_barra_extra: false });
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
    // Encenderla sólo en el Word con «Dividir por» también va por la clave.
    const on = ida(args, patchTopEnWord("p_barras_apiladas", args, {}, {}, true));
    expect(on.overrides).toEqual({ word_mostrar_barra_extra: true });
  });

  it("no aplica a la multiapilada (el constructor ya lo lleva al Word) ni con la columna apagada", () => {
    expect(leerTopEnWord("p_barras_multiapiladas", { modo: "var", top2box: true }, {}, {}).aplica).toBe(false);
    expect(leerTopEnWord("p_barras_apiladas", { overrides: { mostrar_barra_extra: false } }, {}, {}).aplica).toBe(false);
  });
});
