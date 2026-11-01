import { describe, expect, test } from "vitest";
import { avisosVisibles, cuotasDescuadradas } from "./filtroDeAvisos";

describe("los avisos del motor llegan al lienzo (P5 de la paridad)", () => {
  test("sin info y sin repetidos", () => {
    const v = avisosVisibles([
      { level: "info", code: "I", message: "dato" },
      { level: "warn", code: "W_RANGO", message: "Un rango sin población" },
      { level: "warn", code: "W_RANGO", message: "Un rango sin población" },
      { level: "error", code: "E_X", message: "Falta el marco" },
    ]);
    expect(v.map((a) => a.code)).toEqual(["W_RANGO", "E_X"]);
    expect(avisosVisibles(undefined)).toEqual([]);
  });

  test("las cuotas que no cuadran con el N se dicen; las que cuadran no", () => {
    expect(cuotasDescuadradas({ total_asignado: 1190, n_objetivo: 1200 })).toMatch(/1,190.*1,200/);
    expect(cuotasDescuadradas({ total_asignado: 1200, n_objetivo: 1200 })).toBeNull();
    expect(cuotasDescuadradas(null)).toBeNull();
  });
});
