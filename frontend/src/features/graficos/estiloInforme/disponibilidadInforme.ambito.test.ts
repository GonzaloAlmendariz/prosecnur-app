import { describe, expect, test } from "vitest";
import { AMBITO_BASE_ACTIVA, AMBITO_COMPARTIDO, AMBITO_INFORME, disponibilidadInforme } from "./disponibilidadInforme";

// G15/U6 (2026-10-13): el informe conjunto de las tres bases de Arte decía «valen para el PPT y el Word de esta base».
describe("alcance del estilo del informe", () => {
  test("un informe conjunto (o de una sola base) habla del informe", () => {
    expect(disponibilidadInforme("active").ambito).toBe(AMBITO_INFORME);
  });
  test("sólo con un informe por base habla de la base", () => {
    expect(disponibilidadInforme("active", true).ambito).toBe(AMBITO_BASE_ACTIVA);
  });
  test("el compartido conserva su texto", () => {
    expect(disponibilidadInforme("consolidated").ambito).toBe(AMBITO_COMPARTIDO);
  });
});
