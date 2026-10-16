import { describe, expect, it } from "vitest";
import { resumenCambiosDeRespuestas } from "./nuevaVersionRespuestasModel";

describe("resumenCambiosDeRespuestas", () => {
  it("con la misma cantidad de casos nombra la columna nueva", () => {
    const l = resumenCambiosDeRespuestas({
      casos: { antes: 3318, despues: 3318, clave: "_uuid", se_mantienen: 3318, nuevos: 0, ya_no_vienen: 0 },
      columnas_nuevas: ["seleccionado"],
      columnas_que_no_vienen: [],
      codificacion_por_readaptar: false,
    });
    expect(l[0]).toBe("Sigue con 3,318 respuestas.");
    expect(l).toContain("Columna nueva: «seleccionado».");
    expect(l.some((x) => x.startsWith("Por _uuid"))).toBe(false);
  });

  it("dice cuántos casos llegan y cuántos dejan de venir por identificador", () => {
    const l = resumenCambiosDeRespuestas({
      casos: { antes: 40, despues: 30, clave: "_uuid", nuevos: 2, ya_no_vienen: 12 },
      columnas_nuevas: [],
      columnas_que_no_vienen: ["a", "b", "c", "d", "e", "f"],
      codificacion_por_readaptar: true,
    });
    expect(l[0]).toBe("Pasó de 40 a 30 respuestas.");
    expect(l[1]).toBe("Por _uuid: 2 casos nuevos y 12 casos que ya no vienen.");
    expect(l[2]).toBe("Ya no vienen: «a», «b», «c», «d» y 2 más.");
  });
});
