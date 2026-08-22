/**
 * La columna dice contra qué compara, no lo que conviene suponer.
 *
 * Rotulaba siempre «Su cuota pide» mientras el motor declara `referencia =
 * "marco_incluido"`: la cifra es la proporción del marco, que coincide con la
 * cuota sólo porque este diseño usa afijación proporcional. Y el normalizador
 * descartaba ese campo, así que la UI no podía saberlo aunque quisiera.
 */
import { describe, expect, it } from "vitest";
import { etiquetaReferencia } from "../SexoPorFacultadCard";

describe("el rótulo de la columna de referencia", () => {
  it("cuando el motor compara contra el marco, lo dice", () => {
    expect(etiquetaReferencia("marco_incluido")).toBe("El marco tiene");
  });

  it("una referencia desconocida se nombra, no se disfraza de cuota", () => {
    // Suponer «cuota» sobre una referencia que no conocemos es exactamente el
    // rótulo que promete otro número.
    expect(etiquetaReferencia("matricula_total")).toContain("matricula_total");
    expect(etiquetaReferencia("matricula_total")).not.toContain("cuota");
  });

  it("sin referencia declarada conserva el rótulo histórico", () => {
    // Un `.pulso` viejo no trae el campo; cambiarle el rótulo sería inventar.
    for (const vacio of [undefined, ""]) {
      expect(etiquetaReferencia(vacio)).toBe("Su cuota pide");
    }
  });
});
