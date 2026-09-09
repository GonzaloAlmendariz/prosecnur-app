import { describe, expect, test } from "vitest";

import { brechaConcentrada } from "./brechaConcentrada";

const fila = (etiqueta: string, brecha: number, validas = 0, aulas = 1) => ({
  stratum: etiqueta, brecha, respuestas_validas: validas, aulas,
});

describe("dónde se concentra la brecha del sorteo", () => {
  test("ordena de más brecha a menos y recorta la cola", () => {
    const r = brechaConcentrada(
      [fila("A", 10), fila("B", 50), fila("C", 30), fila("D", 5)],
      2,
    );
    expect(r.cabeza.map((e) => e.etiqueta)).toEqual(["B", "C"]);
    expect(r.restantes).toBe(2);
    expect(r.brechaRestante).toBe(15);
    expect(r.brechaTotal).toBe(95);
    // 80 de 95 = 84,2 → 84
    expect(r.concentracionPct).toBe(84);
  });

  test("un estrato ya cerrado NO entra en una lista de «dónde falta más»", () => {
    // Dibujarlo con barra de cero le da el mismo peso visual que a los que
    // exigen acción, que es lo contrario de lo que el panel existe para decir.
    const r = brechaConcentrada([fila("cerrado", 0, 30), fila("abierto", 20)], 12);
    expect(r.cabeza.map((e) => e.etiqueta)).toEqual(["abierto"]);
    expect(r.estratos).toBe(2);
  });

  test("`sinEmpezar` cuenta los que no tienen NINGUNA respuesta, cerrados incluidos", () => {
    const r = brechaConcentrada([fila("a", 5, 0), fila("b", 5, 3), fila("c", 0, 0)], 12);
    expect(r.sinEmpezar).toBe(2);
  });

  test("sin brecha no divide por cero y no inventa concentración", () => {
    const r = brechaConcentrada([fila("a", 0, 10), fila("b", 0, 4)], 12);
    expect(r.brechaTotal).toBe(0);
    expect(r.concentracionPct).toBe(0);
    expect(r.cabeza).toEqual([]);
  });

  test("una lista vacía da ceros y no revienta", () => {
    const r = brechaConcentrada([], 12);
    expect(r.estratos).toBe(0);
    expect(r.brechaTotal).toBe(0);
    expect(r.restantes).toBe(0);
  });

  test("el estrato sin etiqueta se nombra, no se publica en blanco", () => {
    const r = brechaConcentrada([{ brecha: 7 }], 12);
    expect(r.cabeza[0].etiqueta).toBe("Sin estrato declarado");
  });
});
