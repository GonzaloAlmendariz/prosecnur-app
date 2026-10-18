// Mata: el «Se calcula en el teléfono» genérico para choice-name, join y sum (pendiente del motor) y la fecha ISO/UTC
// cruda de `once(now())` en el resultado de prueba (S13).
import { describe, expect, it } from "vitest";
import { dependeDelMomento, motivosEnTelefono, textoEnTelefono, valorLegible } from "./calculoTelefono";

describe("cálculos que se resuelven en el teléfono", () => {
  it("dice el porqué de choice-name, join y sum", () => {
    expect(textoEnTelefono("jr:choice-name(${HH03}, '${HH03}')")).toBe("Se calcula en el teléfono: toma el texto de la opción elegida, que el teléfono lee de la lista.");
    expect(textoEnTelefono("join(' ', ${HH01})")).toContain("une las respuestas de todas las filas de una repetición");
    expect(motivosEnTelefono("sum(${ingreso}) + count(${miembros})")).toEqual([
      "suma una pregunta en todas las filas de una repetición",
      "cuenta las filas de una repetición",
    ]);
    expect(textoEnTelefono("sum(${a}) + count(${b})")).toContain(" y cuenta las filas");
  });
  it("no confunde selected-at ni count-selected con count", () => {
    expect(motivosEnTelefono("count-selected(${a})")).toEqual([]);
    expect(motivosEnTelefono("selected-at(${a}, 0)")).toEqual(["toma una de las opciones marcadas por su posición"]);
  });
  it("una fórmula común no se manda al teléfono", () => {
    expect(motivosEnTelefono("${a} + ${b}")).toEqual([]);
  });
});

describe("resultado legible", () => {
  it("fechas en español, sin ISO ni UTC", () => {
    expect(valorLegible("2026-10-17")).toBe("17 de octubre de 2026");
    const r = valorLegible("2026-10-17T19:12:54.286Z");
    expect(r).toMatch(/^1[78] de octubre de 2026, \d{2}:\d{2}$/);
    expect(r).not.toContain("T");
    expect(r).not.toContain("Z");
  });
  it("lo que no es fecha queda igual", () => {
    expect(valorLegible("42")).toBe("42");
    expect(valorLegible("joven")).toBe("joven");
  });
  it("now y today dependen del momento", () => {
    expect(dependeDelMomento("once(now())")).toBe(true);
    expect(dependeDelMomento("${a} + 1")).toBe(false);
  });
});
