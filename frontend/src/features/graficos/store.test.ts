import { describe, expect, test } from "vitest";
import { buildActiveChartStylePatch } from "./chartLayoutOrigin";
import * as storeModule from "./store";

type MergeSlotArgsPatch = (
  currentArgs: Record<string, unknown>,
  patch: Record<string, unknown>,
) => Record<string, unknown>;

const mergeSlotArgsPatch = (
  storeModule as typeof storeModule & { mergeSlotArgsPatch: MergeSlotArgsPatch }
).mergeSlotArgsPatch;

describe("mergeSlotArgsPatch — tombstones visuales legacy", () => {
  test("Base y copia eliminan la key visual top-level sin tocar datos ni nested", () => {
    const legacyArgs = {
      var: "p1",
      cruces: ["sexo"],
      filtro: { activo: false, minimo: 0, nota: "" },
      canvas_w_bars: 0.41,
      overrides: {},
    };
    const visualArgNames = ["canvas_w_bars"];
    const copiedOverrides = { canvas_w_bars: 0.6, alto_por_categoria: 0.44 };

    const base = mergeSlotArgsPatch(
      legacyArgs,
      buildActiveChartStylePatch(legacyArgs, visualArgNames, {}),
    );
    const copied = mergeSlotArgsPatch(
      legacyArgs,
      buildActiveChartStylePatch(legacyArgs, visualArgNames, copiedOverrides),
    );

    expect({
      base,
      baseHasLegacyKey: Object.prototype.hasOwnProperty.call(base, "canvas_w_bars"),
      baseJson: JSON.parse(JSON.stringify(base)),
      copied,
      copiedHasLegacyKey: Object.prototype.hasOwnProperty.call(copied, "canvas_w_bars"),
      copiedJson: JSON.parse(JSON.stringify(copied)),
    }).toEqual({
      base: {
        var: "p1",
        cruces: ["sexo"],
        filtro: { activo: false, minimo: 0, nota: "" },
        overrides: {},
      },
      baseHasLegacyKey: false,
      baseJson: {
        var: "p1",
        cruces: ["sexo"],
        filtro: { activo: false, minimo: 0, nota: "" },
        overrides: {},
      },
      copied: {
        var: "p1",
        cruces: ["sexo"],
        filtro: { activo: false, minimo: 0, nota: "" },
        overrides: copiedOverrides,
      },
      copiedHasLegacyKey: false,
      copiedJson: {
        var: "p1",
        cruces: ["sexo"],
        filtro: { activo: false, minimo: 0, nota: "" },
        overrides: copiedOverrides,
      },
    });
  });
});
