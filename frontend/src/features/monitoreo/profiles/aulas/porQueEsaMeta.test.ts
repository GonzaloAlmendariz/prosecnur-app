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

    // **Cuando los factores NO reproducen la meta, no se explica.**
    //
    // Aquí el productor declara 11 sobre unos factores que darían 12,1. Antes
    // esto devolvía el desglose con meta 11, o sea una frase que no cuadra con
    // su propio número. La fórmula del esperado la escriben ellos y ya cambió
    // una vez —el factor de facultad—, así que perseguirla desde aquí garantiza
    // volver a quedarse atrás: se comprueba y, si no cuadra, se calla.
    expect(porQueEsaMeta({
      eligible_n: 24, p_aplicada_ref: 0.73, rendimiento_ref: 0.69, expected_valid: 11,
    })).toBeNull();
  });

  it("el factor de facultad entra en la comprobación", () => {
    // Desde el 2026-08-20 la meta lleva un cuarto factor —«no todas las
    // facultades tienen la misma naturaleza»— y con él cuadran 191 de las 197
    // titulares del marco 2026; sin él, sólo 62. Sin contarlo, el desglose
    // dejaría de explicar 135 aulas.
    const conFactor = porQueEsaMeta({
      eligible_n: 24, p_aplicada_ref: 0.73, rendimiento_ref: 0.69,
      factor_facultad: 0.81, facultad_k: 26, expected_valid: 9.8,
      efectividad_fuente: "historico", efectividad_periodo: "2025",
    })!;
    expect(conFactor.factorFacultad).toBe(0.81);
    expect(conFactor.facultadK).toBe(26);
    expect(conFactor.fuente).toBe("historico");

    // El control: esa misma meta SIN el factor no cuadra, así que no se explica.
    expect(porQueEsaMeta({
      eligible_n: 24, p_aplicada_ref: 0.73, rendimiento_ref: 0.69, expected_valid: 9.8,
    })).toBeNull();
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
  it("la ecuación condicional del rediseño «1b» se explica sin p_aplicada", () => {
    // Aviso de la sesión de Cálculo de muestra (2026-08-20): el esperado pasa a
    // ser `elegibles × R(tramo) × F(facultad)`; el tipo de docente salió con
    // evidencia y `p_aplicada_ref` queda como dato operativo. Los bins de
    // rendimiento son 0,809 / 0,642 / 0,566 / 0,500 / 0,409.
    const pq = porQueEsaMeta({
      eligible_n: 40,
      rendimiento_ref: 0.5,
      factor_facultad: 1,
      // Sigue viajando en la fila, pero YA NO multiplica.
      p_aplicada_ref: 0.73,
      expected_valid: 20,
    });
    expect(pq).not.toBeNull();
    expect(pq?.entraPAplicada).toBe(false);
    expect(pq?.pAplicada).toBeNull();
    expect(pq?.meta).toBe(20);
  });

  it("un plan ya guardado con la ecuación anterior sigue explicándose", () => {
    // 24 × 0,73 × 0,69 = 12,09 → la fila declara 12,1.
    const pq = porQueEsaMeta({
      eligible_n: 24, p_aplicada_ref: 0.73, rendimiento_ref: 0.69, expected_valid: 12.1,
    });
    expect(pq?.entraPAplicada).toBe(true);
    expect(pq?.pAplicada).toBe(0.73);
  });

  it("con p_aplicada presente gana la ecuación que reproduce la meta, no la primera", () => {
    // El caso que separa las dos reglas: aquí la meta SÓLO cuadra con
    // p_aplicada, así que declararla fuera sería explicar mal un número que
    // está bien.
    const conP = porQueEsaMeta({
      eligible_n: 40, rendimiento_ref: 0.5, p_aplicada_ref: 0.6, expected_valid: 12,
    });
    expect(conP?.entraPAplicada).toBe(true);
    // Y con la misma fila, si la meta es la de la ecuación nueva, se elige esa.
    const sinP = porQueEsaMeta({
      eligible_n: 40, rendimiento_ref: 0.5, p_aplicada_ref: 0.6, expected_valid: 20,
    });
    expect(sinP?.entraPAplicada).toBe(false);
  });

  it("sin p_aplicada y sin cuadrar tampoco se inventa una explicación", () => {
    expect(porQueEsaMeta({
      eligible_n: 40, rendimiento_ref: 0.5, factor_facultad: 1, expected_valid: 33,
    })).toBeNull();
  });
});
