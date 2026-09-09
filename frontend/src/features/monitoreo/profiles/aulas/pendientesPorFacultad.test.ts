import { describe, expect, test } from "vitest";

import { pendientesPorFacultad } from "./pendientesPorFacultad";

describe("los pendientes, agrupados por facultad", () => {
  test("la prevista del grupo se PONDERA por elegibles, no se promedia", () => {
    // 60 alumnos al 40 % y 10 al 80 % no dan un grupo al 60 %: dan 32 de 70.
    // Promediar tasas de tamaños distintos contradice el rótulo, y es el error
    // que ya hubo que corregir en la tasa por facultad.
    const [f] = pendientesPorFacultad([
      { facultad: "DERECHO", elegibles: 60, tasaPrevista: 0.4 },
      { facultad: "DERECHO", elegibles: 10, tasaPrevista: 0.8 },
    ]);
    expect(f.elegibles).toBe(70);
    expect(f.tasaPrevista).toBeCloseTo(32 / 70, 6);
    expect(f.tasaPrevista).not.toBeCloseTo(0.6, 3);
  });

  test("ordena de más cursos-horario pendientes a menos", () => {
    const r = pendientesPorFacultad([
      { facultad: "A", elegibles: 10, tasaPrevista: 0.5 },
      { facultad: "B", elegibles: 10, tasaPrevista: 0.5 },
      { facultad: "B", elegibles: 10, tasaPrevista: 0.5 },
    ]);
    expect(r.map((f) => f.facultad)).toEqual(["B", "A"]);
    expect(r[0].cursosHorario).toBe(2);
  });

  test("un curso-horario sin tasa cuenta en el grupo pero NO vota en la tasa", () => {
    const [f] = pendientesPorFacultad([
      { facultad: "A", elegibles: 100, tasaPrevista: 0.5 },
      { facultad: "A", elegibles: 100, tasaPrevista: null },
    ]);
    expect(f.cursosHorario).toBe(2);
    expect(f.elegibles).toBe(200);
    // Si el sin-tasa votara con un cero implícito, saldría 0,25.
    expect(f.tasaPrevista).toBeCloseTo(0.5, 6);
  });

  test("sin ninguna tasa declarada la publica nula, no un cero", () => {
    const [f] = pendientesPorFacultad([{ facultad: "A", elegibles: 30 }]);
    expect(f.tasaPrevista).toBeNull();
    expect(f.elegibles).toBe(30);
  });

  test("un curso-horario sin elegibles no rompe ni infla la cuenta", () => {
    const [f] = pendientesPorFacultad([
      { facultad: "A", elegibles: 0, tasaPrevista: 0.9 },
      { facultad: "A", elegibles: null, tasaPrevista: 0.9 },
    ]);
    expect(f.cursosHorario).toBe(2);
    expect(f.elegibles).toBe(0);
    expect(f.tasaPrevista).toBeNull();
  });

  test("la facultad sin nombre se nombra, no se publica en blanco", () => {
    const [f] = pendientesPorFacultad([{ elegibles: 5, tasaPrevista: 0.5 }]);
    expect(f.facultad).toBe("Sin facultad declarada");
  });

  test("una lista vacía da una lista vacía", () => {
    expect(pendientesPorFacultad([])).toEqual([]);
  });
});
