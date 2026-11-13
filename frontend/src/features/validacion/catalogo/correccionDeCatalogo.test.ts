import { describe, expect, it } from "vitest";
import { correccionDeLugar, type ColumnasPorPapel } from "./correccionDeCatalogo";

const columnas: ColumnasPorPapel = { departamento: "P2_dep", provincia: "P2_prov", distrito: "P2_dist", ubigeo: "P2_ubigeo" };
const comas = { departamento: "Lima", provincia: "Lima", distrito: "Comas", ubigeo: "150110" };

describe("corrección de una combinación fuera de catálogo", () => {
  it("escribe cada papel en su columna, con el valor del lugar elegido", () => {
    expect(correccionDeLugar(comas, columnas)).toEqual([
      { columna: "P2_dep", valor: "Lima" },
      { columna: "P2_prov", valor: "Lima" },
      { columna: "P2_dist", valor: "Comas" },
      { columna: "P2_ubigeo", valor: "150110" },
    ]);
  });

  it("omite los papeles que la regla no usa", () => {
    const sinUbigeo: ColumnasPorPapel = { departamento: "dep", provincia: null, distrito: "dist", ubigeo: null };
    expect(correccionDeLugar(comas, sinUbigeo)).toEqual([
      { columna: "dep", valor: "Lima" },
      { columna: "dist", valor: "Comas" },
    ]);
  });

  it("un candidato de nivel provincia deja sin tocar distrito y ubigeo", () => {
    const provincia = { departamento: "Lima", provincia: "Huaral", distrito: null, ubigeo: null };
    expect(correccionDeLugar(provincia, columnas)).toEqual([
      { columna: "P2_dep", valor: "Lima" },
      { columna: "P2_prov", valor: "Huaral" },
    ]);
  });
});
