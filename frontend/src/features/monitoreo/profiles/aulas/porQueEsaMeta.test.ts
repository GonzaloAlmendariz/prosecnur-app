import { describe, expect, it } from "vitest";

import { porQueEsaMeta, tiposDeDocente } from "./porQueEsaMeta";

describe("tiposDeDocente", () => {
  it("parte por «|» y NUNCA por « - »", () => {
    // El separador « - » es INTERNO de cada tipo —«DOCENTE ORDINARIO -
    // PRINCIPAL»—, así que partir por él convertiría un docente en dos. La
    // sesión de cálculo de muestra avisó de este matiz antes de que pasara.
    expect(tiposDeDocente("DOCENTE ORDINARIO - PRINCIPAL | DOCENTE CONTRATADO - CONTRATADO"))
      .toEqual(["DOCENTE ORDINARIO - PRINCIPAL", "DOCENTE CONTRATADO - CONTRATADO"]);
    expect(tiposDeDocente("DOCENTE ORDINARIO - PRINCIPAL"))
      .toEqual(["DOCENTE ORDINARIO - PRINCIPAL"]);
  });

  it("sin tipo, ninguno", () => {
    expect(tiposDeDocente("")).toEqual([]);
    expect(tiposDeDocente(null)).toEqual([]);
    expect(tiposDeDocente(" | ")).toEqual([]);
  });
});

describe("porQueEsaMeta", () => {
  it("devuelve los factores tal como vienen, sin recalcular", () => {
    // Recalcular la meta aquí sería tener dos fórmulas que se separan a la
    // primera corrección. Los factores vienen dados; esto sólo los ordena.
    const r = porQueEsaMeta({
      eligible_n: 24, p_aplicada_ref: 0.73, rendimiento_ref: 0.69,
      expected_valid: 12.1, teacher_type: "ORDINARIO - PRINCIPAL",
    })!;
    expect(r).toMatchObject({ elegibles: 24, pAplicada: 0.73, rendimiento: 0.69, meta: 12.1 });
    expect(r.variosDocentes).toBe(false);

    // **El caso que distingue leer de recalcular.** Arriba los factores dan
    // 12,09 y la meta declarada es 12,1: recalcular acertaba por redondeo y el
    // aserto no probaba nada. Aquí el productor declara 11 sobre unos factores
    // que darían 12,1 —un tope, otro redondeo, una corrección suya—: la meta
    // que manda es la que viene, porque ellos son los dueños de ese número.
    const distinta = porQueEsaMeta({
      eligible_n: 24, p_aplicada_ref: 0.73, rendimiento_ref: 0.69, expected_valid: 11,
    })!;
    expect(distinta.meta).toBe(11);
  });

  it("un aula con dos docentes lo dice: la tasa es la del más restrictivo", () => {
    const r = porQueEsaMeta({
      eligible_n: 30, p_aplicada_ref: 0.73, rendimiento_ref: 0.56, expected_valid: 12.3,
      teacher_type: "ORDINARIO - PRINCIPAL | CONTRATADO - CONTRATADO",
    })!;
    expect(r.variosDocentes).toBe(true);
    expect(r.docentes).toHaveLength(2);
  });

  it("sin los factores no explica nada, en vez de inventar el porqué", () => {
    // Es el caso de un plan que no viene del cálculo de muestra: la meta puede
    // existir —los elegibles— pero no hay descomposición que enseñar.
    expect(porQueEsaMeta({ eligible_n: 24, expected_valid: 24 })).toBeNull();
    expect(porQueEsaMeta({ eligible_n: 0, p_aplicada_ref: 0.7, rendimiento_ref: 0.7, expected_valid: 0 })).toBeNull();
  });
});
