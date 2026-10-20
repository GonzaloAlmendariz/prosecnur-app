// Mata: Fin que deja el cursor donde estaba (macOS) y el texto nuevo cae a media cadena en la barra de fórmula.
import { describe, expect, test } from "vitest";
import { seleccionTrasInicioFin } from "./cursorTeclas";

describe("seleccionTrasInicioFin", () => {
  test("Fin lleva al final y Inicio al principio en una línea", () => {
    expect(seleccionTrasInicioFin("selected(${p1}, 'si')", "End", 3, 3, false)).toEqual([21, 21]);
    expect(seleccionTrasInicioFin("abc", "Home", 2, 2, false)).toEqual([0, 0]);
  });
  test("en varias líneas se queda en la línea del cursor", () => {
    expect(seleccionTrasInicioFin("uno\ndos\ntres", "End", 5, 5, false)).toEqual([7, 7]);
    expect(seleccionTrasInicioFin("uno\ndos\ntres", "Home", 6, 6, false)).toEqual([4, 4]);
  });
  test("con Mayús extiende la selección y otras teclas no aplican", () => {
    expect(seleccionTrasInicioFin("abcdef", "End", 2, 2, true)).toEqual([2, 6]);
    expect(seleccionTrasInicioFin("abcdef", "Home", 4, 4, true)).toEqual([0, 4]);
    expect(seleccionTrasInicioFin("abc", "a", 0, 0, false)).toBeNull();
  });
});
