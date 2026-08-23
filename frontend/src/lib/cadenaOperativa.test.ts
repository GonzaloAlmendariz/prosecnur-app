// La regla del orden operativo, en un solo sitio y con sus tres respaldos.
//
// Vive en `lib/` porque el defecto que más se ha repetido en este dominio es que
// una regla del operativo se implemente en cada pantalla por separado: «el banco
// no se agenda» estaba escrita en cinco sitios y el libro de campo se olvidó de
// ella —2 121 filas donde debían ser 191—.
import { describe, expect, it } from "vitest";
import { cadenaDesdeCodigo, ordenarPorCadenaOperativa } from "./cadenaOperativa";

type Fila = { codigo: string; rol: string; secuencia?: number; orden?: number; de?: string };
const leer = (f: Fila) => ({
  rol: f.rol, secuencia: f.secuencia, orden: f.orden, codigo: f.codigo, reemplazaA: f.de,
});
const codigos = (fs: Fila[]) => ordenarPorCadenaOperativa(fs, leer).map((f) => f.codigo);

describe("cadenaDesdeCodigo", () => {
  it("lee la cadena y el lugar del propio código", () => {
    expect(cadenaDesdeCodigo("AULA 12")).toEqual({ cadena: 12, dentro: 0 });
    expect(cadenaDesdeCodigo("R1.6")).toEqual({ cadena: 1, dentro: 6 });
    expect(cadenaDesdeCodigo("CH 3")).toEqual({ cadena: 3, dentro: 0 });
  });

  it("un código sin número no inventa una cadena", () => {
    expect(cadenaDesdeCodigo("SIN NUMERO").cadena).toBe(Number.POSITIVE_INFINITY);
    expect(cadenaDesdeCodigo(null).cadena).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("ordenarPorCadenaOperativa", () => {
  it("con secuencia declarada agrupa cada cadena", () => {
    expect(codigos([
      { codigo: "CH 2", rol: "titular", secuencia: 2 },
      { codigo: "R 1.1", rol: "chain_reserve", secuencia: 1, orden: 1 },
      { codigo: "CH 1", rol: "titular", secuencia: 1 },
    ])).toEqual(["CH 1", "R 1.1", "CH 2"]);
  });

  it("sin secuencia, el propio código basta", () => {
    // El plan real del estudio: ni `operational_sequence` ni `replacement_for`.
    expect(codigos([
      { codigo: "AULA 2", rol: "titular" },
      { codigo: "R1.6", rol: "chain_reserve" },
      { codigo: "AULA 1", rol: "titular" },
      { codigo: "R1.1", rol: "chain_reserve" },
    ])).toEqual(["AULA 1", "R1.1", "R1.6", "AULA 2"]);
  });

  it("el banco va al final", () => {
    expect(codigos([
      { codigo: "EXTRA 1", rol: "extra_reserve_pool", secuencia: 1 },
      { codigo: "CH 9", rol: "titular", secuencia: 9 },
    ])).toEqual(["CH 9", "EXTRA 1"]);
  });

  it("no mezcla la escala del rango con la del código", () => {
    // El rango del titular empieza en 0 y el número del código en 1: con las dos
    // a la vez, «AULA 2» se colaba entre «AULA 1» y sus reservas.
    expect(codigos([
      { codigo: "AULA 1", rol: "titular" },
      { codigo: "AULA 2", rol: "titular" },
      { codigo: "R1.1", rol: "chain_reserve" },
    ])).toEqual(["AULA 1", "R1.1", "AULA 2"]);
  });

  it("una unidad sin nada que la sitúe conserva su posición", () => {
    expect(codigos([
      { codigo: "CH 1", rol: "titular", secuencia: 1 },
      { codigo: "RARO", rol: "titular" },
      { codigo: "CH 2", rol: "titular", secuencia: 2 },
    ])).toEqual(["CH 1", "CH 2", "RARO"]);
  });

  it("una lista vacía no rompe", () => {
    expect(ordenarPorCadenaOperativa([], leer)).toEqual([]);
  });
});
