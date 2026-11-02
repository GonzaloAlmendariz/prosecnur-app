import { describe, expect, it } from "vitest";

import { rotuloDeCartografia } from "../../../../api/hojasRuta";

describe("la cartografía se dice por ciudad", () => {
  it("nombra la cobertura y el año de cada provincia, y la que no tiene", () => {
    expect(rotuloDeCartografia([{ provincia: "0401", disponible: true, cobertura: "AREQUIPA, AREQUIPA", anio: 2017, fuente: "INEI" }])).toBe("AREQUIPA, AREQUIPA 2017");
    expect(rotuloDeCartografia([{ provincia: "2501", disponible: false, cobertura: "", anio: null, fuente: "" }])).toBe("sin cartografía de manzanas");
    expect(rotuloDeCartografia([])).toBe("");
  });
});
