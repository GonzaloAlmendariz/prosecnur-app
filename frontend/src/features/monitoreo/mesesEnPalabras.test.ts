import { describe, expect, it } from "vitest";

import { MES_CORTO, MES_LARGO, mesCortoDe } from "./mesesEnPalabras";

describe("los meses del perfil", () => {
  it("tiene doce de cada uno", () => {
    expect(MES_CORTO).toHaveLength(12);
    expect(MES_LARGO).toHaveLength(12);
  });

  it("dice «setiembre», que es como lo escribe el libro del operativo", () => {
    expect(MES_LARGO[8]).toBe("setiembre");
    expect(MES_CORTO[8]).toBe("set");
  });

  it("saca el mes corto de una fecha ISO sin pasar por Date", () => {
    expect(mesCortoDe("2026-09-10")).toBe("set");
    expect(mesCortoDe("2026-01-01")).toBe("ene");
  });

  it("con una fecha sin forma devuelve vacío en vez de `undefined`", () => {
    expect(mesCortoDe("")).toBe("");
    expect(mesCortoDe("mañana")).toBe("");
  });
});
