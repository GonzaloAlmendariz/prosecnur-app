import { describe, expect, it } from "vitest";

import { textoDeCobertura, tipoDeFila } from "./datosColumnas";

describe("columnas de Analítica › Datos (L28)", () => {
  it("la celda de cobertura no repite el nombre de la columna", () => {
    expect(textoDeCobertura("1,241 de 1,283 con dato")).toBe("1,241 de 1,283");
    expect(textoDeCobertura("no llegó en la base")).toBe("no llegó en la base");
  });

  it("un dummy dice de qué pregunta es opción en vez de su tipo", () => {
    expect(tipoDeFila({ tipo_xlsform: "integer", dummy_parent: "p5" })).toBe("opción de p5");
    expect(tipoDeFila({ tipo_xlsform: "select_one sexo", dummy_parent: null })).toBe("select_one sexo");
    expect(tipoDeFila({ tipo_xlsform: "", dummy_parent: null })).toBe("data");
  });
});
