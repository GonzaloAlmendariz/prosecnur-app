// H10: la fila nueva queda entera a la vista dentro de su dueño de scroll, sin mover nada más.
import { describe, expect, test } from "vitest";
import { desplazamientoParaVer, selectorFila } from "./revelarFila";

describe("desplazamientoParaVer", () => {
  const dueno = { top: 100, bottom: 400 };
  test("una fila ya visible no mueve nada", () => {
    expect(desplazamientoParaVer(dueno, { top: 150, bottom: 200 })).toBe(0);
  });
  test("una fila debajo baja lo justo para verla con aire", () => {
    expect(desplazamientoParaVer(dueno, { top: 500, bottom: 560 })).toBe(560 - 400 + 12);
  });
  test("una fila más alta que la vista deja su comienzo arriba", () => {
    expect(desplazamientoParaVer(dueno, { top: 450, bottom: 900 })).toBe(450 - 100 - 12);
  });
  test("una fila arriba sube hasta su comienzo", () => {
    expect(desplazamientoParaVer(dueno, { top: 40, bottom: 80 })).toBe(40 - 100 - 12);
  });
});

describe("selectorFila", () => {
  test("escapa comillas de rótulos del formulario", () => {
    expect(selectorFila('Dijo "no"')).toBe('[data-fila="Dijo \\"no\\""]');
  });
});
