import { describe, expect, it } from "vitest";
import { comoLeerAuto, ROTULO_COMO_LEER, type ConteoComoLeer } from "./comoLeerAuto";

const c = (p: Partial<ConteoComoLeer>): ConteoComoLeer => ({ escala: 0, topTwoBox: 0, bottomTwoBox: 0, cifrasPequenas: 0, ...p });

describe("comoLeerAuto (espejo de .word_como_leer_auto)", () => {
  it("sin escalas el capítulo se omite", () => {
    expect(comoLeerAuto(c({}))).toEqual([]);
  });
  it("una sola lámina de escala no alcanza el umbral", () => {
    expect(comoLeerAuto(c({ escala: 1, topTwoBox: 1 }))).toEqual([]);
  });
  it("dos láminas de escala: misma escala + Redondeo y Bases chicas acompañan", () => {
    expect(comoLeerAuto(c({ escala: 2 }))).toEqual(["redondeo", "misma_escala", "bases_chicas"]);
  });
  it("Top y Bottom entran antes de Redondeo, solo si llegan a 2", () => {
    expect(comoLeerAuto(c({ escala: 3, topTwoBox: 2, bottomTwoBox: 1 })))
      .toEqual(["top_two_box", "redondeo", "misma_escala", "bases_chicas"]);
    expect(comoLeerAuto(c({ escala: 1, topTwoBox: 2, bottomTwoBox: 2 })))
      .toEqual(["top_two_box", "bottom_two_box", "redondeo", "bases_chicas"]);
  });
  it("cifras pequeñas va tras misma escala", () => {
    expect(comoLeerAuto(c({ escala: 2, cifrasPequenas: 2 })))
      .toEqual(["redondeo", "misma_escala", "cifras_pequenas", "bases_chicas"]);
  });
  it("rótulos", () => {
    expect(ROTULO_COMO_LEER.bases_chicas).toBe("Bases chicas e información faltante");
  });
});
