import { describe, expect, it } from "vitest";

import { TONOS_DE_PABELLON, letraDePabellon, tonoDePabellon } from "./chipDePabellon";

/**
 * El color del chip de pabellón se DERIVA de la letra (dictado 2026-09-02:
 * «los pabellones con números en recuadros elegantes de colores en función de
 * la letra»). El contrato es determinismo puro: misma letra, mismo tono,
 * siempre — sin reloj, sin azar, sin orden de llegada.
 */
describe("letraDePabellon", () => {
  it("saca la letra del edificio, mayúscula y sin tilde", () => {
    expect(letraDePabellon("A703")).toBe("A");
    expect(letraDePabellon("z101")).toBe("Z");
    expect(letraDePabellon("LFIA")).toBe("L");
    expect(letraDePabellon("Ñ201")).toBe("N");
  });

  it("sin letra inicial no hay letra que valga", () => {
    expect(letraDePabellon("101")).toBe("");
    expect(letraDePabellon("")).toBe("");
    expect(letraDePabellon("  ")).toBe("");
  });
});

describe("tonoDePabellon", () => {
  it("misma letra, mismo tono — determinista", () => {
    expect(tonoDePabellon("A703")).toBe(tonoDePabellon("A206"));
    expect(tonoDePabellon("a703")).toBe(tonoDePabellon("A703"));
  });

  it("la paleta es cíclica por letra: A y la letra a N posiciones comparten tono", () => {
    const a = tonoDePabellon("A100");
    const ciclada = String.fromCharCode(65 + TONOS_DE_PABELLON);
    expect(tonoDePabellon(`${ciclada}100`)).toBe(a);
    // Y dos letras contiguas no comparten: el ciclo reparte, no aplasta.
    expect(tonoDePabellon("B100")).not.toBe(a);
  });

  it("todo tono cae dentro de la paleta declarada", () => {
    for (let i = 0; i < 26; i += 1) {
      const tono = tonoDePabellon(`${String.fromCharCode(65 + i)}100`);
      expect(tono).not.toBeNull();
      expect(tono!).toBeGreaterThanOrEqual(0);
      expect(tono!).toBeLessThan(TONOS_DE_PABELLON);
    }
  });

  it("sin letra el chip queda neutro, no inventa un color", () => {
    expect(tonoDePabellon("101")).toBeNull();
    expect(tonoDePabellon("")).toBeNull();
  });
});
