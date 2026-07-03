import { describe, expect, test } from "vitest";
import { graficadorToPresetType } from "./graficadorPresetMap";

describe("graficadorToPresetType", () => {
  test("mantiene aliases legacy compatibles con modos por slot", () => {
    expect(graficadorToPresetType("p_barras")).toBe("barras_agrupadas");
    expect(graficadorToPresetType("p_barras_agrupadas")).toBe("barras_agrupadas");
  });
});
