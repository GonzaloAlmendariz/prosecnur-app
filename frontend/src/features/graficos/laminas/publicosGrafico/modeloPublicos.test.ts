// Q2-11: los públicos de un gráfico de resumen se leen de `base$*`, se ordenan y conservan las preguntas sueltas.
import { describe, expect, it } from "vitest";
import { conPublicos, esComodin, maxPublicos, moverPublicoEn, publicosDe, sueltasDe, usaPublicos } from "./modeloPublicos";

describe("públicos de un gráfico de resumen", () => {
  it("reconoce base$* y no confunde una pregunta suelta", () => {
    expect(esComodin("docentes$*")).toBe(true);
    expect(esComodin("*")).toBe(false);
    expect(esComodin("docentes$p1")).toBe(false);
    expect(usaPublicos(["docentes$*", "estudiantes$p4"])).toBe(true);
    expect(usaPublicos(["docentes$p1"])).toBe(false);
    expect(usaPublicos({ tema: ["docentes$p1"] })).toBe(false);
  });

  it("lee los públicos en su orden y conserva las sueltas detrás al reordenar", () => {
    const vars = ["docentes$*", "estudiantes$p4", "estudiantes$*", "docentes$*"];
    expect(publicosDe(vars)).toEqual(["docentes", "estudiantes"]);
    expect(sueltasDe(vars)).toEqual(["estudiantes$p4"]);
    expect(conPublicos(vars, moverPublicoEn(publicosDe(vars), 1, -1))).toEqual(["estudiantes$*", "docentes$*", "estudiantes$p4"]);
  });

  it("Fortalezas y alertas lee un solo público", () => {
    expect(maxPublicos("p_fortalezas")).toBe(1);
    expect(maxPublicos("p_panorama")).toBe(Number.POSITIVE_INFINITY);
  });
});
