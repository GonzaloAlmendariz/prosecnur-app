import { describe, expect, test } from "vitest";
import {
  buildActiveChartStylePatch,
  collectActiveChartStyleValues,
  resolveActiveChartLayoutOrigin,
} from "./chartLayoutOrigin";

describe("resolveActiveChartLayoutOrigin", () => {
  test("un slot activo sólo es Base PPT sin overrides; todo snapshot propio es ajuste", () => {
    const savedStyleSnapshot = {
      canvas_w_etiquetas: 0.45,
      canvas_w_bars: 0.52,
    };

    expect({
      empty: resolveActiveChartLayoutOrigin({}),
      identicalToSavedStyle: resolveActiveChartLayoutOrigin({ ...savedStyleSnapshot }),
      savedStyleSubsetPlusOwnValue: resolveActiveChartLayoutOrigin({
        ...savedStyleSnapshot,
        alto_por_categoria: 0.48,
      }),
    }).toEqual({
      empty: { kind: "base_ppt" },
      identicalToSavedStyle: { kind: "chart_adjustment" },
      savedStyleSubsetPlusOwnValue: { kind: "chart_adjustment" },
    });
  });
});

describe("compatibilidad de estilo legacy en slots activos", () => {
  test("une nested y visuales top-level sin atribuir datos, con nested como autoridad", () => {
    const slotArgs = {
      var: "p1",
      cruces: ["sexo"],
      filtro: { region: "norte" },
      canvas_w_bars: 0.41,
      canvas_w_etiquetas: 0.33,
      canvas_h_caption_in: null,
      titulo: "Título visual legacy",
      overrides: {
        canvas_w_bars: 0.52,
        alto_por_categoria: 0.48,
        mostrar_leyenda: null,
      },
    };

    expect(collectActiveChartStyleValues(slotArgs, [
      "canvas_w_bars",
      "canvas_w_etiquetas",
      "canvas_h_caption_in",
      "titulo",
    ])).toEqual({
      canvas_w_bars: 0.52,
      alto_por_categoria: 0.48,
      canvas_w_etiquetas: 0.33,
      titulo: "Título visual legacy",
    });
  });

  test("Base PPT y copia reemplazan overrides y limpian sólo visuales legacy presentes", () => {
    const slotArgs = {
      var: "p1",
      vars: ["p1", "p2"],
      cruces: ["sexo"],
      filtro: { region: "norte" },
      canvas_w_bars: 0.41,
      titulo: "Título visual legacy",
      overrides: { canvas_w_bars: 0.52, alto_por_categoria: 0.48 },
    };
    const visualArgNames = ["canvas_w_bars", "titulo", "canvas_h_caption_in"];
    const copiedOverrides = { canvas_w_bars: 0.6, alto_por_categoria: 0.44 };

    expect({
      base: buildActiveChartStylePatch(slotArgs, visualArgNames, {}),
      copied: buildActiveChartStylePatch(slotArgs, visualArgNames, copiedOverrides),
    }).toEqual({
      base: {
        overrides: {},
        canvas_w_bars: null,
        titulo: null,
      },
      copied: {
        overrides: copiedOverrides,
        canvas_w_bars: null,
        titulo: null,
      },
    });
  });
});
