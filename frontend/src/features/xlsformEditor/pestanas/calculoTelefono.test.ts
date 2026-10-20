// Mata: el «Se calcula en el teléfono» genérico para choice-name, join y sum (pendiente del motor) y la fecha ISO/UTC
// cruda de `once(now())` en el resultado de prueba (S13).
import { describe, expect, it } from "vitest";
import { dependeDelMomento, motivosEnTelefono, textoEnTelefono, valorLegible } from "./calculoTelefono";

describe("cálculos que se resuelven en el teléfono", () => {
  it("dice el porqué de choice-name, join y sum", () => {
    expect(textoEnTelefono("jr:choice-name(${HH03}, '${HH03}')")).toBe("Se calcula en el teléfono: lee el texto de la opción elegida.");
    expect(textoEnTelefono("join(' ', ${HH01})")).toContain("une las filas de una repetición");
    expect(motivosEnTelefono("sum(${ingreso}) + count(${miembros})")).toEqual([
      "suma las filas de una repetición",
      "cuenta las filas de una repetición",
    ]);
    // Una sola línea con el motivo principal: indexed-repeat no suma «y depende de la fila…».
    expect(textoEnTelefono("sum(${a}) + count(${b})")).toBe("Se calcula en el teléfono: suma las filas de una repetición.");
    expect(textoEnTelefono("indexed-repeat(${HH01_2_aux}, ${rpt}, position(..))")).toBe("Se calcula en el teléfono: lee una fila de una repetición.");
  });
  it("no confunde selected-at ni count-selected con count", () => {
    expect(motivosEnTelefono("count-selected(${a})")).toEqual([]);
    expect(motivosEnTelefono("selected-at(${a}, 0)")).toEqual(["toma una opción marcada por su posición"]);
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
