import { describe, expect, test } from "vitest";
import { avisosVisibles, cuotasDescuadradas, textoDeAviso } from "./filtroDeAvisos";

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

describe("el texto de un aviso del motor sin «(s)»", () => {
  test("los conocidos concuerdan en número y verbo", () => {
    expect(textoDeAviso({ code: "W_EXTERNAL_DISTRICT_MISSING", message: "2 distrito(s) no tienen N externo." })).toBe("2 distritos no tienen N externo.");
    expect(textoDeAviso({ code: "W_EXTERNAL_DISTRICT_MISSING", message: "1 distrito(s) no tienen N externo." })).toBe("1 distrito no tiene N externo.");
    expect(textoDeAviso({ code: "W_DISTRICT_MARGIN_HIGH", message: "1 distrito(s) quedan con margen de error distrital alto." })).toBe("1 distrito queda con margen de error distrital alto.");
  });
  test("en los demás el «(s)» se resuelve por su número y el resto queda igual", () => {
    expect(textoDeAviso({ code: "OTRO", message: "3 manzana(s) no tienen ubicación en la cartografía." })).toBe("3 manzanas no tienen ubicación en la cartografía.");
    expect(textoDeAviso({ code: "OTRO", message: "Sin cambios." })).toBe("Sin cambios.");
  });
});
