import { describe, expect, it } from "vitest";
import type { CriterioVariable } from "../../../../../api/client";
import {
  CONDICION_CURSO_AVISO_UMBRAL,
  condicionCursoCobertura,
} from "../condicionCursoAvisoModel";

function variableCondicion(sinCondicion: number, resto: Array<[string, number]>): CriterioVariable {
  return {
    id: "condicion_curso",
    scope: "aula",
    label: "Condición del curso",
    kind: "flat",
    mappedColumn: "Condición del curso",
    categories: [
      ...resto.map(([key, aulas]) => ({ key, label: key.toUpperCase(), aulas })),
      ...(sinCondicion > 0 ? [{ key: "sin_condicion", label: "Sin condición", aulas: sinCondicion }] : []),
    ],
  };
}

describe("condicionCursoCobertura — gating del aviso de calidad", () => {
  it("muestra el aviso cuando 'Sin condición' alcanza el 30% del total", () => {
    const variable = variableCondicion(30, [["obligatorio", 40], ["electivo", 30]]);
    const cobertura = condicionCursoCobertura(variable);
    expect(cobertura).not.toBeNull();
    expect(cobertura?.sinDato).toBe(30);
    expect(cobertura?.total).toBe(100);
    expect(cobertura?.share).toBeCloseTo(0.3, 10);
  });

  it("no muestra el aviso por debajo del umbral (29%)", () => {
    const variable = variableCondicion(29, [["obligatorio", 41], ["electivo", 30]]);
    expect(condicionCursoCobertura(variable)).toBeNull();
  });

  it("bucket dominante (80%) sí dispara el aviso", () => {
    const variable = variableCondicion(80, [["obligatorio", 20]]);
    const cobertura = condicionCursoCobertura(variable);
    expect(cobertura?.share).toBeCloseTo(0.8, 10);
  });

  it("sin bucket 'Sin condición' no hay aviso", () => {
    const variable = variableCondicion(0, [["obligatorio", 60], ["electivo", 40]]);
    expect(condicionCursoCobertura(variable)).toBeNull();
  });

  it("solo aplica a condicion_curso (otras variables devuelven null)", () => {
    const variable = { ...variableCondicion(90, [["a", 10]]), id: "session_type" };
    expect(condicionCursoCobertura(variable)).toBeNull();
  });

  it("catálogo vacío o variable ausente devuelven null (nada que avisar)", () => {
    expect(condicionCursoCobertura(null)).toBeNull();
    expect(condicionCursoCobertura(variableCondicion(0, []))).toBeNull();
  });

  it("el umbral del contrato es 30%", () => {
    expect(CONDICION_CURSO_AVISO_UMBRAL).toBe(0.3);
  });
});
