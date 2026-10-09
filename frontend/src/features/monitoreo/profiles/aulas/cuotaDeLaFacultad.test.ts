import { describe, expect, it } from "vitest";

import { brechaDeLaFacultad, cuotaDeLaFacultad } from "./brechaDeLaFacultad";

/**
 * **Dos cifras ciertas para «lo que debe una facultad».**
 *
 * Gonzalo, 2026-09-11: «dice déficit de 65 pero en la otra ventana el déficit
 * es de 6, no entiendo».
 *
 * Las dos eran verdad y median cosas distintas. Con Ciencias Sociales del
 * corte real:
 *
 * - **El ranking**: de las aulas YA VISITADAS se esperaban 40,3 mujeres y
 *   llegaron 33 → −7. Es rendimiento.
 * - **El popover**: la cuota de la facultad son 79 mujeres y lleva 33 → faltan
 *   46. Es lo que queda para cerrar, contando lo que aún no se ha visitado.
 *
 * Ninguna decía cuál era, y el botón saltaba de una a otra. La cifra que no
 * puede explicarse a sí misma acaba contradiciendo a la de al lado, así que
 * `cuotaDeLaFacultad` publica además la meta y lo logrado.
 */

const celda = (sexo: string, meta: number, falta: number, extra: Record<string, unknown> = {}) => ({
  faculty: "CIENCIAS SOCIALES", sex_key: sexo, target: meta, missing: falta, ...extra,
});

describe("la cuota de una facultad trae su contexto", () => {
  it("el caso real: 79 de meta, 46 que faltan, 33 logradas", () => {
    const c = cuotaDeLaFacultad([celda("F", 79, 46), celda("M", 70, 36)], "CIENCIAS SOCIALES")!;
    expect(c.mujeres).toBe(46);
    expect(c.meta.mujeres).toBe(79);
    expect(c.logrado.mujeres).toBe(33);
    expect(c.logrado.hombres).toBe(34);
  });

  it("usa `achieved` cuando el motor lo publica, en vez de restar por su cuenta", () => {
    // Dos restas del mismo dato empiezan a discrepar; si el backend ya lo dice,
    // se lee lo que dice.
    const c = cuotaDeLaFacultad([celda("F", 79, 46, { achieved: 31 })], "CIENCIAS SOCIALES")!;
    expect(c.logrado.mujeres).toBe(31);
  });

  it("lo que falta no cambia: sigue siendo el `missing` del motor", () => {
    const celdas = [celda("F", 79, 46), celda("M", 70, 36)];
    const base = brechaDeLaFacultad(celdas, "CIENCIAS SOCIALES")!;
    const c = cuotaDeLaFacultad(celdas, "CIENCIAS SOCIALES")!;
    expect({ mujeres: c.mujeres, hombres: c.hombres }).toEqual(base);
  });

  it("una facultad que no está devuelve undefined, no ceros", () => {
    // Con ceros, el popover pintaría «la cuota está cubierta» sobre una
    // facultad de la que no sabe nada.
    expect(cuotaDeLaFacultad([celda("F", 79, 46)], "DERECHO")).toBeUndefined();
    expect(cuotaDeLaFacultad([], "CIENCIAS SOCIALES")).toBeUndefined();
  });
});
