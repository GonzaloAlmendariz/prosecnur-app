import { describe, expect, it } from "vitest";
import { efectividadExplicada } from "../efectividadExplicadaModel";

const fila = (over: Record<string, unknown>) => ({
  course_name: "CURSO",
  eligible_n: 24,
  p_aplicada_ref: 0.87,
  rendimiento_ref: 0.69,
  efectivas_esperadas: 14.4,
  teacher_type: "DOCENTE CONTRATADO - CONTRATADO",
  ...over,
});

describe("efectividadExplicada", () => {
  it("agrupa por las tasas que el motor escribió, no por curvas copiadas", () => {
    const m = efectividadExplicada([
      fila({ eligible_n: 24, efectivas_esperadas: 14.4 }),
      fila({ eligible_n: 20, efectivas_esperadas: 12.0 }),
      fila({
        eligible_n: 60,
        p_aplicada_ref: 0.73,
        rendimiento_ref: 0.44,
        efectivas_esperadas: 19.3,
        teacher_type: "DOCENTE ORDINARIO - PRINCIPAL",
      }),
    ]);
    expect(m).not.toBeNull();
    // Dos grupos de docente, ordenados por tasa descendente, con su etiqueta real.
    expect(m!.porDocente.map((g) => [g.tasa, g.nAulas])).toEqual([
      [0.87, 2],
      [0.73, 1],
    ]);
    expect(m!.porDocente[1].etiqueta).toContain("ORDINARIO");
    // El grupo de tamaño registra el rango observado, no un bin inventado.
    const g69 = m!.porTamano.find((g) => g.tasa === 0.69);
    expect(g69).toMatchObject({ minElegibles: 20, maxElegibles: 24, nAulas: 2 });
    // La coherencia macro: Σesperadas/Σelegibles-por-aula = P(aplicada) × τ.
    expect(m!.totalEsperadas).toBeCloseTo(45.7, 5);
    expect(m!.tasaGlobal).toBeCloseTo(45.7 / 104, 5);
    // P media ponderada por elegibles: (44×0,87 + 60×0,73) / 104.
    expect(m!.pAplicadaMedia).toBeCloseTo((44 * 0.87 + 60 * 0.73) / 104, 5);
    // La identidad se cierra: tasaGlobal = pMedia × tauImplicito.
    expect(m!.pAplicadaMedia * m!.tauImplicito).toBeCloseTo(m!.tasaGlobal, 10);
    // El ejemplo es la primera fila, con su cuenta completa Y sus referencias
    // concretas (qué docente, qué rango de tamaño) — «nunca se especifica qué
    // tamaño ni a qué haces referencia» (Gonzalo, 2026-08-20).
    expect(m!.ejemplo).toMatchObject({
      elegibles: 24,
      pAplicada: 0.87,
      esperadas: 14.4,
      docente: "DOCENTE CONTRATADO - CONTRATADO",
      rangoTamano: "20–24",
    });
  });

  it("sin columnas de efectividad no inventa nada (anti-fallback)", () => {
    expect(efectividadExplicada(null)).toBeNull();
    expect(efectividadExplicada([{ course_name: "X", eligible_n: 10 }])).toBeNull();
  });
});
