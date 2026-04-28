import { describe, expect, test } from "vitest";
import {
  colorOfScore,
  plotlyColorscale,
  semaforoFromConfig,
  type SemaforoConfig,
} from "./semaforo";

const sem: SemaforoConfig = {
  modo: "cortes",
  red: "#000000",
  amber: "#666666",
  green: "#ffffff",
  redMax: 60,
  amberMax: 80,
  stopsExtra: [],
};

describe("semaforoFromConfig", () => {
  test("aplica defaults cuando config y fallback vienen vacios", () => {
    expect(semaforoFromConfig({})).toEqual({
      modo: "cortes",
      red: "#D84B55",
      amber: "#E0B44C",
      green: "#3A9A5B",
      redMax: 60,
      amberMax: 80,
      stopsExtra: [],
    });
  });

  test("prioriza overrides y usa fallback solo para campos ausentes", () => {
    expect(
      semaforoFromConfig(
        {
          semaforo_modo: "gradiente",
          semaforo_red_color: "#111111",
          semaforo_amber_max: 75,
          semaforo_stops_extra: [{ value: 72, color: "#777777" }],
        },
        {
          red_color: "#aa0000",
          amber_color: "#bbbbbb",
          green_color: "#00aa00",
          red_max: 55,
          amber_max: 85,
        },
      ),
    ).toEqual({
      modo: "gradiente",
      red: "#111111",
      amber: "#bbbbbb",
      green: "#00aa00",
      redMax: 55,
      amberMax: 75,
      stopsExtra: [{ value: 72, color: "#777777" }],
    });
  });
});

describe("colorOfScore", () => {
  test("modo cortes devuelve colores correctos en rangos y bordes", () => {
    expect(colorOfScore(-5, sem)).toBe("#000000");
    expect(colorOfScore(59.99, sem)).toBe("#000000");
    expect(colorOfScore(60, sem)).toBe("#666666");
    expect(colorOfScore(79.99, sem)).toBe("#666666");
    expect(colorOfScore(80, sem)).toBe("#ffffff");
    expect(colorOfScore(130, sem)).toBe("#ffffff");
    expect(colorOfScore(null, sem)).toBeNull();
  });

  test("modo gradiente interpola entre stops base", () => {
    const grad = { ...sem, modo: "gradiente" as const };

    expect(colorOfScore(0, grad)).toBe("#000000");
    expect(colorOfScore(30, grad)).toBe("#333333");
    expect(colorOfScore(70, grad)).toBe("#b3b3b3");
  });

  test("stopsExtra se intercalan y pueden sobreescribir un stop base", () => {
    const custom = {
      ...sem,
      stopsExtra: [
        { value: 70, color: "#123456" },
        { value: 80, color: "#abcdef" },
      ],
    };

    expect(colorOfScore(69, custom)).toBe("#666666");
    expect(colorOfScore(70, custom)).toBe("#123456");
    expect(colorOfScore(79, custom)).toBe("#123456");
    expect(colorOfScore(80, custom)).toBe("#abcdef");
  });
});

describe("plotlyColorscale", () => {
  test("modo cortes duplica stops para saltos abruptos", () => {
    const scale = plotlyColorscale(sem);
    expect(scale.map(([, color]) => color)).toEqual([
      "#000000",
      "#000000",
      "#666666",
      "#666666",
      "#ffffff",
      "#ffffff",
      "#ffffff",
    ]);
    expect(scale.map(([t]) => t)).toEqual([
      0,
      0.59999,
      0.6,
      0.79999,
      0.8,
      expect.closeTo(0.99999, 5),
      1,
    ]);
  });

  test("modo gradiente produce stops unicos y monotonicos", () => {
    const scale = plotlyColorscale({
      ...sem,
      modo: "gradiente",
      stopsExtra: [
        { value: 40, color: "#444444" },
        { value: 60, color: "#777777" },
      ],
    });

    expect(scale).toEqual([
      [0, "#000000"],
      [0.4, "#444444"],
      [0.6, "#777777"],
      [0.8, "#ffffff"],
      [1, "#ffffff"],
    ]);
    expect(scale.map(([t]) => t)).toEqual([...new Set(scale.map(([t]) => t))]);
    expect(scale.every(([t], i, arr) => i === 0 || arr[i - 1][0] < t)).toBe(true);
  });
});
