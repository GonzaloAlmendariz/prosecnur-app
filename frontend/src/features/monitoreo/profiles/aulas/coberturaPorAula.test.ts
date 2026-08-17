import { describe, expect, it } from "vitest";

import { coberturaPorAula } from "./coberturaPorAula";
import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";

const aula = (validas: number, meta: number) =>
  ({ respuestas_validas: validas, expected_valid: meta }) as unknown as MonitoreoAulasPlanRow;

describe("cobertura por curso-horario", () => {
  it("separa «sin respuestas» de «poquísimas»", () => {
    // Es la distinción que decide si el aula ni siquiera se abrió. Con un
    // reparto puramente proporcional, 0 y 1 de 20 caerían en el mismo tramo.
    const r = coberturaPorAula([aula(0, 20), aula(1, 20)]);
    expect(r.tramos[0]).toMatchObject({ etiqueta: "Sin respuestas", aulas: 1 });
    expect(r.tramos[1]).toMatchObject({ etiqueta: "1–25 %", aulas: 1 });
  });

  it("la meta cumplida incluye pasarse de ella", () => {
    // Un aula puede superar su meta: entra en el mismo tramo que la cumple
    // exacta, porque operativamente ya no hay nada que hacer allí.
    const r = coberturaPorAula([aula(20, 20), aula(25, 20)]);
    expect(r.tramos[4]).toMatchObject({ etiqueta: "Meta cumplida", aulas: 2 });
  });

  it("un aula sin meta se cuenta aparte, no se fuerza a un tramo", () => {
    // Meterla en 0 % o en 100 % serían dos mentiras distintas.
    const r = coberturaPorAula([aula(5, 0), aula(5, 10)]);
    expect(r.sinMeta).toBe(1);
    expect(r.tramos.reduce((a, t) => a + t.aulas, 0)).toBe(1);
  });

  it("la forma distingue dos avances globales idénticos", () => {
    // 60 al 50 % y 60 al 100 % promedian lo mismo que 120 al 75 %, y piden
    // decisiones opuestas. El gráfico existe para que eso se vea.
    const mitad = Array.from({ length: 60 }, () => aula(10, 20));
    const llenas = Array.from({ length: 60 }, () => aula(20, 20));
    const medias = Array.from({ length: 120 }, () => aula(15, 20));

    const a = coberturaPorAula([...mitad, ...llenas]);
    const b = coberturaPorAula(medias);
    expect(a.tramos[2].aulas).toBe(60);
    expect(a.tramos[4].aulas).toBe(60);
    expect(b.tramos[3].aulas).toBe(120);
    expect(b.tramos[4].aulas).toBe(0);
  });

  it("sin aulas no inventa tramos con contenido", () => {
    const r = coberturaPorAula([]);
    expect(r.total).toBe(0);
    expect(r.tramos.every((t) => t.aulas === 0)).toBe(true);
  });
});
