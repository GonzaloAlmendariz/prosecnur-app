import { describe, expect, it } from "vitest";

import { rotuloDeCartografia } from "../../../../api/hojasRuta";

describe("la cartografía se dice por ciudad", () => {
  it("nombra la cobertura y el año de cada provincia, y la que no tiene", () => {
    expect(rotuloDeCartografia([{ provincia: "0401", disponible: true, cobertura: "AREQUIPA, AREQUIPA", anio: 2017, fuente: "INEI" }])).toBe("AREQUIPA, AREQUIPA 2017");
    expect(rotuloDeCartografia([{ provincia: "2501", disponible: false, cobertura: "", anio: null, fuente: "" }])).toBe("sin cartografía de manzanas");
    // Varias provincias, con punto y coma: la cobertura de cada una ya lleva comas (y nunca « · »).
    expect(rotuloDeCartografia([
      { provincia: "1501", disponible: true, cobertura: "Lima Metropolitana", anio: 2017, fuente: "INEI" },
      { provincia: "0701", disponible: true, cobertura: "Callao", anio: 2019, fuente: "INEI" },
    ])).toBe("Lima Metropolitana 2017; Callao 2019");
    expect(rotuloDeCartografia([])).toBe("");
  });
});
