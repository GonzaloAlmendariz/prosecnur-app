import { describe, expect, test } from "vitest";
import { normalizeSeriesColors } from "./ArgField";

describe("normalizeSeriesColors", () => {
  test("acepta el array posicional de colores del motor R", () => {
    // El override `colores_categorias` del donut de Sexo (ACNUR) llega así.
    expect(normalizeSeriesColors(["#0072BC", "#00A98F", "#8FA8C8"])).toEqual({
      "Serie 1": "#0072BC",
      "Serie 2": "#00A98F",
      "Serie 3": "#8FA8C8",
    });
  });

  test("mapea el array de colores sobre los nombres de categoría por posición", () => {
    expect(
      normalizeSeriesColors(
        ["#0072BC", "#00A98F", "#8FA8C8"],
        ["Hombre", "Mujer", "Otro"],
      ),
    ).toEqual({
      Hombre: "#0072BC",
      Mujer: "#00A98F",
      Otro: "#8FA8C8",
    });
  });

  test("no trunca: preserva la cantidad de colores del override", () => {
    const out = normalizeSeriesColors(["#0072BC", "#00A98F", "#8FA8C8"]);
    expect(Object.keys(out)).toHaveLength(3);
  });

  test("rellena con nombre posicional cuando faltan nombres", () => {
    expect(
      normalizeSeriesColors(["#0072BC", "#00A98F"], ["Hombre"]),
    ).toEqual({
      Hombre: "#0072BC",
      "Serie 2": "#00A98F",
    });
  });

  test("descarta strings que no son colores válidos", () => {
    expect(normalizeSeriesColors(["#0072BC", "no-es-color", "#8FA8C8"])).toEqual({
      "Serie 1": "#0072BC",
      "Serie 3": "#8FA8C8",
    });
  });

  test("acepta hex corto y hex sin numeral", () => {
    expect(normalizeSeriesColors(["#abc", "0072BC"])).toEqual({
      "Serie 1": "#abc",
      "Serie 2": "0072BC",
    });
  });

  test("sigue soportando el array de objetos {name,color}", () => {
    expect(
      normalizeSeriesColors([
        { name: "Hombre", color: "#0072BC" },
        { serie: "Mujer", value: "#00A98F" },
      ]),
    ).toEqual({
      Hombre: "#0072BC",
      Mujer: "#00A98F",
    });
  });

  test("sigue soportando el mapa nombrado", () => {
    expect(
      normalizeSeriesColors({ Hombre: "#0072BC", Mujer: "#00A98F" }),
    ).toEqual({
      Hombre: "#0072BC",
      Mujer: "#00A98F",
    });
  });

  test("sigue soportando el string por líneas", () => {
    expect(normalizeSeriesColors("Hombre: #0072BC\nMujer = #00A98F")).toEqual({
      Hombre: "#0072BC",
      Mujer: "#00A98F",
    });
  });

  test("devuelve vacío para valores nulos o no soportados", () => {
    expect(normalizeSeriesColors(null)).toEqual({});
    expect(normalizeSeriesColors(undefined)).toEqual({});
    expect(normalizeSeriesColors(42)).toEqual({});
  });
});
