import { describe, expect, it } from "vitest";
import { etiquetaTolerante, etiquetasAmbiguas, indicePorEtiqueta } from "./etiquetaTolerante";

const casan = (a: string, b: string) => etiquetaTolerante(a) === etiquetaTolerante(b);

describe("etiquetaTolerante: ignora lo que no cambia el significado", () => {
  it("raya y guion entre números son el mismo rango", () => {
    expect(casan("18–20 años", "18-20 años")).toBe(true);
    expect(casan("18 — 20 años", "18-20 años")).toBe(true);
    expect(casan("18 − 20", "18-20")).toBe(true);
  });

  it("barra y coma entre palabras son separadores", () => {
    expect(casan("No sé / Prefiero no decir", "No se, prefiero no decir")).toBe(true);
  });

  it("tildes, mayúsculas, espacios, puntos finales, comillas y marcado Kobo", () => {
    expect(casan("¿Dos a tres veces?", "dos a tres veces")).toBe(true);
    expect(casan("  NUNCA. ", "nunca")).toBe(true);
    expect(casan("«Otro»", "\"otro\"")).toBe(true);
    expect(casan("*21 años a más.*", "21 años a más")).toBe(true);
    expect(casan("**Sí**", "si")).toBe(true);
  });

  it("los signos conservados admiten espacios", () => {
    expect(casan("≥ 60", "≥60")).toBe(true);
    expect(casan(">= 60", "≥ 60")).toBe(true);
    expect(casan("<= 17", "≤17")).toBe(true);
    expect(casan("5 %", "5%")).toBe(true);
  });
});

describe("etiquetaTolerante: conserva lo que cambia el significado", () => {
  const distintas = (...etiquetas: string[]) => {
    const claves = etiquetas.map(etiquetaTolerante);
    expect(new Set(claves).size).toBe(etiquetas.length);
  };

  it("«<18», «>18», «+18» y «18» son cuatro categorías", () => distintas("<18", ">18", "+18", "18"));
  it("«≥ 60» no es «≤ 60» (ni «60»)", () => distintas("≥ 60", "≤ 60", "60"));
  it("«-1» no es «1», con guion, raya o signo menos", () => {
    distintas("-1", "1");
    expect(casan("–1", "1")).toBe(false);
    expect(casan("−1", "1")).toBe(false);
    expect(casan("−1", "-1")).toBe(true);
  });
  it("«A+», «A-» y «A» son tres categorías", () => distintas("A+", "A-", "A"));
  it("«1/2» no es «1-2»", () => distintas("1/2", "1-2"));
  it("«5%» no es «5»", () => distintas("5%", "5"));
  it("un rango no es un número negativo", () => distintas("18-20", "-20", "20"));
});

describe("ambigüedad: dos códigos con la misma etiqueta tolerante", () => {
  const lista = [
    { codigo: "1", etiqueta: "Otro" },
    { codigo: "2", etiqueta: "otro." },
    { codigo: "3", etiqueta: "Sí" },
    { codigo: "3", etiqueta: "si" },
  ];

  it("se reconoce sólo si los códigos difieren", () => {
    expect([...etiquetasAmbiguas(lista)]).toEqual(["otro"]);
  });

  it("no entra al índice; lo que no es ambiguo sí", () => {
    expect(Object.fromEntries(indicePorEtiqueta(lista))).toEqual({ si: "3" });
  });

  it("«<18» y «18» no son ambiguas entre sí", () => {
    expect(etiquetasAmbiguas([{ codigo: "1", etiqueta: "<18" }, { codigo: "2", etiqueta: "18" }]).size).toBe(0);
  });
});
