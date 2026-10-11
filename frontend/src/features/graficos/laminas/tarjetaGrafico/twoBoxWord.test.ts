import { describe, expect, it } from "vitest";
import { mergeSlotArgsPatch } from "../../store";
import { patchTwoBox } from "./twoBox";
import { leerTopEnWord, patchTopEnWord } from "./twoBoxWord";

type R = Record<string, unknown>;
const ida = (args: R, patch: R) => JSON.parse(JSON.stringify(mergeSlotArgsPatch(args, patch))) as R;

describe("Top Two Box de las apiladas en el Word", () => {
  it("de fábrica el Word lo quita (WORD_CHART_PRESETS) aunque la lámina lo lleve", () => {
    expect(leerTopEnWord("p_barras_apiladas", { var: "p1" }, {}, {})).toEqual({ aplica: true, sale: false, editable: true });
  });

  it("encenderlo fija en el gráfico el par que el Word lee; apagarlo lo quita y la lámina sigue igual", () => {
    const args = { var: "p1", overrides: { top2box_labels: ["A", "B"] } };
    const on = ida(args, patchTopEnWord("p_barras_apiladas", args, {}, {}, true));
    expect(on.overrides).toEqual({ top2box_labels: ["A", "B"], mostrar_barra_extra: true, barra_extra_preset: "top2box" });
    expect(leerTopEnWord("p_barras_apiladas", on, {}, {})).toEqual({ aplica: true, sale: true, editable: true });
    const off = ida(on, patchTopEnWord("p_barras_apiladas", on, {}, {}, false));
    expect(off.overrides).toEqual({ top2box_labels: ["A", "B"] });
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

  it("si los ajustes Word ya la dejan, sale sola y no se puede quitar desde el gráfico", () => {
    const w = { chart_presets: { barras_apiladas: { mostrar_barra_extra: true, barra_extra_preset: "top2box" } } };
    expect(leerTopEnWord("p_barras_apiladas", {}, {}, w)).toEqual({ aplica: true, sale: true, editable: false });
    expect(patchTopEnWord("p_barras_apiladas", {}, {}, w, false)).toEqual({});
  });

  it("un preset PPT que pide otra columna que la de fábrica se conserva en el Word", () => {
    const presets = { barras_apiladas: { barra_extra_preset: "bottom2box" } };
    // La lámina muestra Bottom Two Box como columna extra: el Top Two Box no está activo y no aplica.
    expect(leerTopEnWord("p_barras_apiladas", {}, presets, {}).aplica).toBe(false);
  });

  it("si la lámina necesitó las fijaciones para encender el Top Two Box, no se apaga sólo en el Word", () => {
    const presets = { barras_apiladas: { mostrar_barra_extra: false } };
    const args = ida({}, patchTwoBox("p_barras_apiladas", {}, presets, { caja: "top", activa: true }));
    expect(args.overrides).toEqual({ mostrar_barra_extra: true });
    // Con mostrar = TRUE pero sin preset, el Word pone «ninguno»: no sale; fijarlo agrega el preset.
    expect(leerTopEnWord("p_barras_apiladas", args, presets, {})).toEqual({ aplica: true, sale: false, editable: true });
    const on = ida(args, patchTopEnWord("p_barras_apiladas", args, presets, {}, true));
    expect(leerTopEnWord("p_barras_apiladas", on, presets, {})).toEqual({ aplica: true, sale: true, editable: false });
  });

  it("no aplica a la multiapilada (el constructor ya lo lleva al Word) ni con la columna apagada", () => {
    expect(leerTopEnWord("p_barras_multiapiladas", { modo: "var", top2box: true }, {}, {}).aplica).toBe(false);
    expect(leerTopEnWord("p_barras_apiladas", { overrides: { mostrar_barra_extra: false } }, {}, {}).aplica).toBe(false);
  });
});
