import { describe, expect, it } from "vitest";
import { efectividadExplicada, etiquetaDocente, fuenteEfectividad, radiografiaAula, radiografiaAulaTau } from "../efectividadExplicadaModel";

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
    // **Ya no se reconstruye ningún τ dividiendo por la p.** `tasaGlobal` ES la
    // tasa del dimensionamiento —`Σesperadas / Σelegibles`— porque desde la V7
    // el esperado es `elegibles × rendimiento × factor_facultad` y el tipo de
    // docente no entra. Dividirla por `pAplicadaMedia` inflaba el número hasta
    // un τ que ya no existe en ninguna parte del motor.
    expect(m!.tasaGlobal).toBeCloseTo(m!.totalEsperadas / m!.totalElegibles, 10);
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

describe("etiquetaDocente", () => {
  it("formaliza el tipo y compone el aula con dos docentes", () => {
    expect(etiquetaDocente("DOCENTE ORDINARIO - PRINCIPAL")).toBe("Ordinario - Principal");
    expect(
      etiquetaDocente("DOCENTE ORDINARIO - PRINCIPAL | DOCENTE CONTRATADO - CONTRATADO"),
    ).toBe("Ordinario - Principal y Contratado - Contratado (manda el más restrictivo)");
    expect(etiquetaDocente("")).toBe("Sin tipo declarado");
  });
});

describe("radiografiaAula", () => {
  const porTamano = [
    { tasa: 0.69, minElegibles: 16, maxElegibles: 25, nAulas: 56 },
    { tasa: 0.44, minElegibles: 52, maxElegibles: 91, nAulas: 31 },
  ];

  it("redacta la cuenta completa de un titular, con tramo y producto exacto", () => {
    const r = radiografiaAula(
      {
        course_name: "PROSPECCIÓN Y EXPLORACIÓN MINERA",
        course_id: "GEM284",
        schedule: "09G1",
        faculty_aula: "CIENCIAS E INGENIERIA",
        sample_role: "titular",
        eligible_n: 24,
        p_aplicada_ref: 0.73,
        rendimiento_ref: 0.69,
        efectivas_esperadas: 16.6,
        teacher_type: "DOCENTE ORDINARIO - PRINCIPAL",
      },
      porTamano,
    );
    expect(r).toMatchObject({
      rol: "Titular",
      elegibles: 24,
      tramo: "16–25",
      docente: "Ordinario - Principal",
      esperadas: 16.6,
    });
    // V7: la cuenta es CONDICIONAL (sin docente): 24 × 0,69 = 16,56.
    expect(r!.productoExacto).toBeCloseTo(16.56, 4);
  });

  it("un reemplazo lleva su ordinal y una fila sin tasas no se inventa", () => {
    const r = radiografiaAula(
      {
        course_id: "X1",
        sample_role: "chain_reserve",
        replacement_order: 3,
        eligible_n: 60,
        p_aplicada_ref: 0.87,
        rendimiento_ref: 0.44,
        efectivas_esperadas: 26.4,
        teacher_type: "DOCENTE CONTRATADO - CONTRATADO",
      },
      porTamano,
    );
    expect(r!.rol).toBe("Reemplazo 3");
    expect(r!.tramo).toBe("52–91");
    expect(radiografiaAula({ course_id: "Y", eligible_n: 10 }, porTamano)).toBeNull();
  });
});

describe("fuenteEfectividad", () => {
  it("lee la procedencia de la fila y las filas viejas se declaran embebidas", () => {
    expect(
      fuenteEfectividad([{ efectividad_fuente: "historico", efectividad_periodo: "2025" }]),
    ).toEqual({ tipo: "historico", periodo: "2025", tau: null });
    expect(
      fuenteEfectividad([{ efectividad_fuente: "tau_global", efectividad_tau: 0.5 }]),
    ).toEqual({ tipo: "tau_global", periodo: "", tau: 0.5 });
    // Sin columna (data guardada antes del contrato): la verdad es que las
    // tasas venian embebidas — se declara, no se disfraza de historico.
    expect(fuenteEfectividad([{ course_id: "A" }]).tipo).toBe("calibracion_embebida");
  });
});

describe("radiografiaAulaTau", () => {
  it("redacta la via global en dos factores y no inventa sin tau", () => {
    const r = radiografiaAulaTau({
      course_name: "CURSO NUEVO",
      course_id: "CN1",
      sample_role: "titular",
      eligible_n: 41,
      efectividad_tau: 0.5,
      efectivas_esperadas: 20.5,
    });
    expect(r).toMatchObject({ rol: "Titular", elegibles: 41, tau: 0.5, esperadas: 20.5 });
    expect(r!.productoExacto).toBeCloseTo(20.5, 6);
    expect(radiografiaAulaTau({ course_id: "X", eligible_n: 10, efectivas_esperadas: 5 })).toBeNull();
  });
});

