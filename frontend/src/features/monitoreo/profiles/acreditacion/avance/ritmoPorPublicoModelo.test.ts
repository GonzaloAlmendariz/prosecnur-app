import { describe, expect, it } from "vitest";
import { ritmoPorPublico } from "./ritmoPorPublicoModelo";

const serie = {
  fechas: ["2026-10-29", "2026-10-30"],
  totales: [400, 100],
  capas: [
    { publico: "Administrativos", valores: [163, 24], total: 187 },
    { publico: "Estudiantes de pregrado", valores: [220, 104], total: 324 },
    { publico: "Otros 2 públicos", valores: [17, 0], total: 17, otros: true },
  ],
};
const actores = [
  { Actor: "Administrativos", Meta: 1115 },
  { Actor: "Estudiantes de pregrado", Meta: 4542 },
];

describe("Avance › Ritmo por público", () => {
  it("cada público con su meta, su ritmo y los días que le faltan, los más rezagados primero", () => {
    const ritmo = ritmoPorPublico(serie, actores);
    expect(ritmo.map((item) => item.publico)).toEqual(["Estudiantes de pregrado", "Administrativos"]);
    const pregrado = ritmo[0];
    expect(pregrado.capa).toBe(2);
    expect(pregrado.meta).toBe(4542);
    expect(pregrado.faltan).toBe(4542 - 324);
    // Dos días de campo: el promedio de «7 días» es el de los días que hay.
    expect(pregrado.promedio7).toBe(162);
    expect(pregrado.diasALaMeta).toBe(Math.ceil((4542 - 324) / 162));
    expect(pregrado.ultimos).toEqual([220, 104]);
    expect(pregrado.diasDelPromedio).toBe(2);
  });

  it("«Otros públicos» no lleva tarjeta y sin meta no se proyecta", () => {
    const ritmo = ritmoPorPublico(serie, [{ Actor: "Administrativos", Meta: 1115 }]);
    expect(ritmo.some((item) => item.publico.startsWith("Otros"))).toBe(false);
    const pregrado = ritmo.find((item) => item.publico === "Estudiantes de pregrado");
    expect(pregrado?.meta).toBeNull();
    expect(pregrado?.diasALaMeta).toBeNull();
  });

  it("sin efectivas recientes no hay ritmo con qué proyectar", () => {
    const quieta = { ...serie, capas: [{ publico: "Administrativos", valores: [5, 0, 0, 0, 0, 0, 0, 0], total: 5 }] };
    expect(ritmoPorPublico(quieta, actores)[0].diasALaMeta).toBeNull();
  });

  it("con exactamente siete públicos el séptimo lleva la capa 7 (no hay «Otros»)", () => {
    const siete = {
      fechas: ["2026-10-29"], totales: [70],
      capas: Array.from({ length: 7 }, (_, i) => ({ publico: `P${i + 1}`, valores: [10 - i], total: 10 - i })),
    };
    const capas = ritmoPorPublico(siete, []).map((item) => item.capa).sort((a, b) => a - b);
    expect(capas).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
});
