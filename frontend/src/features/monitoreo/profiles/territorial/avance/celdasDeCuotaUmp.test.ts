import { describe, expect, it } from "vitest";

import { aplicadorCorto, hayAlgunSaldo, quienCubreCorto } from "./celdasDeCuotaUmp";

describe("celdas de la tabla «Cuota de cada UMP» (formato de Monitoreo, vista 7)", () => {
  it("el aplicador va con su código y su nombre corto; el completo, al título", () => {
    expect(aplicadorCorto("P884, Norma Flores Bustamante")).toEqual({ codigo: "P884", nombre: "Norma Flores", completo: "P884, Norma Flores Bustamante" });
    expect(aplicadorCorto("Ana María Flores Bustamante").nombre).toBe("Ana Flores");
    expect(aplicadorCorto("Sin asignar")).toEqual({ codigo: "", nombre: "Sin asignar", completo: "Sin asignar" });
  });

  it("«Sin excedente compatible cerca» se acorta en la tabla y queda entero en el título", () => {
    expect(quienCubreCorto({ tipo: "sin-excedente" })).toEqual({ texto: "Sin excedente", titulo: "Sin excedente compatible cerca" });
  });

  it("«Saldo» se pinta sólo si alguna UMP recibió o cedió", () => {
    expect(hayAlgunSaldo([{ ganancia: 0, perdida: 0 }])).toBe(false);
    expect(hayAlgunSaldo([{ ganancia: 0, perdida: 0 }, { ganancia: 0, perdida: 1 }])).toBe(true);
  });
});
