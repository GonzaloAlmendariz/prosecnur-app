import { describe, expect, test } from "vitest";

import { brechaConcentrada, sexoDeLaCelda } from "./brechaConcentrada";

const celda = (faculty: string, sex: string, cuota: number, logrado = 0) => ({
  faculty, sex, cuota, logrado,
});

describe("dónde se concentra lo que falta, por facultad y sexo", () => {
  test("el estrato es facultad × SEXO DEL ALUMNO, no el sexo dominante del aula", () => {
    // Gonzalo, dos veces: «los estratos son hombre y mujer de cada facultad,
    // punto». La versión anterior leía `avance_por_estrato`, que es la clave del
    // sorteo —`facultad / sexo dominante / tramo de tamaño`— y publicaba
    // «mayoría mujeres · 41 alumnos o más» como si fuera un estrato.
    const r = brechaConcentrada([celda("DERECHO", "F", 237)], 12);
    expect(r.cabeza[0].etiqueta).toBe("DERECHO · Mujeres");
  });

  test("ordena por lo que falta y recorta la cola", () => {
    const r = brechaConcentrada(
      [celda("A", "M", 10), celda("B", "F", 50), celda("C", "M", 30), celda("D", "F", 5)],
      2,
    );
    expect(r.cabeza.map((c) => c.etiqueta)).toEqual(["B · Mujeres", "C · Hombres"]);
    expect(r.restantes).toBe(2);
    expect(r.faltaRestante).toBe(15);
    expect(r.faltaTotal).toBe(95);
    expect(r.concentracionPct).toBe(84);
  });

  test("`falta` es lo que falta HOY: cuota menos logrado, nunca negativo", () => {
    // Una celda que ya se pasó de su cuota no resta de lo que falta en otra: son
    // cuotas independientes y compensarlas escondería la que sigue abierta.
    const r = brechaConcentrada([celda("A", "M", 10, 25), celda("B", "F", 40, 10)], 12);
    expect(r.faltaTotal).toBe(30);
    expect(r.cabeza.map((c) => c.etiqueta)).toEqual(["B · Mujeres"]);
  });

  test("una celda ya cumplida NO entra en una lista de «dónde falta más»", () => {
    const r = brechaConcentrada([celda("A", "M", 10, 10), celda("B", "F", 20)], 12);
    expect(r.cabeza.map((c) => c.etiqueta)).toEqual(["B · Mujeres"]);
    expect(r.celdas).toBe(2);
  });

  test("`sinEmpezar` cuenta las que no tienen NINGUNA respuesta", () => {
    const r = brechaConcentrada([celda("A", "M", 5), celda("B", "F", 5, 3), celda("C", "M", 4)], 12);
    expect(r.sinEmpezar).toBe(2);
  });

  test("sin nada que falte no divide por cero ni inventa concentración", () => {
    const r = brechaConcentrada([celda("A", "M", 10, 10)], 12);
    expect(r.faltaTotal).toBe(0);
    expect(r.concentracionPct).toBe(0);
    expect(r.cabeza).toEqual([]);
  });

  test("una lista vacía da ceros y no revienta", () => {
    const r = brechaConcentrada([], 12);
    expect(r.celdas).toBe(0);
    expect(r.faltaTotal).toBe(0);
  });

  test("la celda sin facultad o sin sexo se nombra, no se publica en blanco", () => {
    const r = brechaConcentrada([{ cuota: 7 }], 12);
    expect(r.cabeza[0].etiqueta).toBe("Sin facultad declarada · Sin sexo declarado");
  });

  test("el sexo se traduce desde las formas que usa el motor", () => {
    expect(sexoDeLaCelda("F")).toBe("Mujeres");
    expect(sexoDeLaCelda("m")).toBe("Hombres");
    expect(sexoDeLaCelda("Mujer")).toBe("Mujeres");
    expect(sexoDeLaCelda("")).toBe("Sin sexo declarado");
  });
});
