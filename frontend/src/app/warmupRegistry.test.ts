import { describe, expect, test } from "vitest";
import { warmupModuleIds, WARMUP_MODULES } from "./warmupRegistry";

describe("warmup registry", () => {
  test("incluye todos los modulos instalados y librerias pesadas", () => {
    expect(warmupModuleIds()).toEqual(expect.arrayContaining([
      "carga",
      "validacion",
      "codificacion",
      "analitica",
      "graficos",
      "graficos_datos",
      "hojas_ruta",
      "hojas_ruta_datos",
      "hojas_ruta_cartografia",
      "muestra",
      "calc_muestra",
      "monitoreo",
      "monitoreo_datos",
      "dashboard",
      "dashboard_datos",
      "editor_xlsform",
      "enciclopedia",
      "plotly",
      "html_to_image",
    ]));
  });

  test("no duplica ids de precarga", () => {
    const ids = warmupModuleIds();
    expect(new Set(ids).size).toBe(ids.length);
    expect(WARMUP_MODULES.every((entry) => typeof entry.load === "function")).toBe(true);
  });
});
