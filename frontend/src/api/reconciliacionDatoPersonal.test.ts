import { describe, expect, it } from "vitest";
import { normalizeDatoPersonal } from "./reconciliacionDatoPersonal";

describe("normalizeDatoPersonal", () => {
  it("lee la sospecha y su causa, con escalares de R como vectores de largo uno", () => {
    expect(normalizeDatoPersonal({ sospecha: [true], causa: ["Parece DNI: 8 dígitos en el 100 % de los casos con dato"] })).toEqual({
      sospecha: true,
      causa: "Parece DNI: 8 dígitos en el 100 % de los casos con dato",
    });
  });
  it("sin sospecha o sin bloque no devuelve nada", () => {
    expect(normalizeDatoPersonal({ sospecha: false, causa: "" })).toBeUndefined();
    expect(normalizeDatoPersonal(undefined)).toBeUndefined();
  });
});
