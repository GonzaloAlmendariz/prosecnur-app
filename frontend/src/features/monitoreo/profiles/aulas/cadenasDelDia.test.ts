import { describe, expect, it } from "vitest";

import { cadenasDelDia, tramoDeCadena } from "./cadenasDelDia";
import type { DiaDeReparto } from "./repartoDeAplicadores";

/**
 * Dictado 2026-09-04: «algún tipo de raíz o conexión que aparezca cuando haya
 * más de una aplicación seguida que la misma persona haga en el día, para poder
 * mapear esas secuencias, sabiendo que puede haber más de una en el día».
 */
const dia = (aplicadores: string[]): DiaDeReparto => ({
  fecha: "2026-09-07",
  etiqueta: "Lunes 07/09",
  asignaciones: aplicadores.map((aplicador, i) => ({
    codigo: `CH ${i + 1}`,
    aplicador,
    inicio: `${String(8 + i).padStart(2, "0")}:00`,
    fin: `${String(8 + i).padStart(2, "0")}:30`,
    recojo: "",
    salida: "",
    fijada: false,
    advertencia: "" as const,
  })),
  noCubiertos: [],
  porConfirmar: [],
});

describe("cadenasDelDia", () => {
  it("una cita suelta no es secuencia: sin cadenas no hay canalón", () => {
    const { cadenas, carriles } = cadenasDelDia(dia(["Ana", "Berta", "Zoe"]));
    expect(cadenas).toEqual([]);
    expect(carriles).toBe(0);
  });

  it("dos citas de la misma persona forman su cadena, con las filas donde para", () => {
    const { cadenas, carriles } = cadenasDelDia(dia(["Ana", "Berta", "Ana"]));
    expect(carriles).toBe(1);
    expect(cadenas).toEqual([
      { aplicador: "Ana", filas: [0, 2], desde: 0, hasta: 2, carril: 0, tono: 0 },
    ]);
  });

  it("la cadena ABARCA el hueco: entre sus dos paradas cruza la cita de otro", () => {
    const [c] = cadenasDelDia(dia(["Ana", "Berta", "Ana"])).cadenas;
    // La fila del medio es de Berta: la línea pasa, pero no marca parada.
    expect(tramoDeCadena(c, 1)).toEqual({ parada: false, cabeza: false, cola: false });
    expect(tramoDeCadena(c, 0)).toEqual({ parada: true, cabeza: true, cola: false });
    expect(tramoDeCadena(c, 2)).toEqual({ parada: true, cabeza: false, cola: true });
  });

  it("fuera de su recorrido la cadena no dibuja nada", () => {
    const [c] = cadenasDelDia(dia(["Berta", "Ana", "Ana", "Zoe"])).cadenas;
    expect(tramoDeCadena(c, 0)).toBeNull();
    expect(tramoDeCadena(c, 3)).toBeNull();
  });

  it("dos secuencias que se solapan van en carriles distintos y tonos distintos", () => {
    // Ana en 0 y 2, Berta en 1 y 3: se cruzan, así que no pueden compartir línea.
    const { cadenas, carriles } = cadenasDelDia(dia(["Ana", "Berta", "Ana", "Berta"]));
    expect(carriles).toBe(2);
    expect(cadenas.map((c) => [c.aplicador, c.carril, c.tono])).toEqual([
      ["Ana", 0, 0],
      ["Berta", 1, 1],
    ]);
  });

  it("dos secuencias que NO se solapan reusan el mismo carril", () => {
    // Ana termina en la fila 1 y Berta empieza en la 2: cabe una debajo de otra.
    const { cadenas, carriles } = cadenasDelDia(dia(["Ana", "Ana", "Berta", "Berta"]));
    expect(carriles).toBe(1);
    expect(cadenas.map((c) => [c.aplicador, c.carril])).toEqual([
      ["Ana", 0],
      ["Berta", 0],
    ]);
    // Pero el TONO sí cambia: son dos secuencias distintas aunque compartan carril.
    expect(cadenas.map((c) => c.tono)).toEqual([0, 1]);
  });

  it("el orden es el de aparición al bajar por la tabla, no el alfabético", () => {
    const { cadenas } = cadenasDelDia(dia(["Zoe", "Ana", "Zoe", "Ana"]));
    expect(cadenas.map((c) => c.aplicador)).toEqual(["Zoe", "Ana"]);
  });

  it("tres paradas de la misma persona son UNA cadena, no dos", () => {
    const { cadenas } = cadenasDelDia(dia(["Ana", "Berta", "Ana", "Zoe", "Ana"]));
    expect(cadenas).toHaveLength(1);
    expect(cadenas[0].filas).toEqual([0, 2, 4]);
    expect(cadenas[0].hasta).toBe(4);
  });

  it("una asignación sin aplicador no fabrica cadena de los sin nombre", () => {
    const { cadenas } = cadenasDelDia(dia(["", "", "Ana"]));
    expect(cadenas).toEqual([]);
  });
});
