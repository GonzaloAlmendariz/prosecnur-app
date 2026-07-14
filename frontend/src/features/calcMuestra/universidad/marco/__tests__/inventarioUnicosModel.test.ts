import { describe, expect, it } from "vitest";
import type { CalcMuestraAulasState } from "../../../../../api/client";
import { computeInventarioUnicos } from "../inventarioUnicosModel";

type Frame = NonNullable<CalcMuestraAulasState["frame"]>;

function frameWith(overrides: Partial<Frame>): Frame {
  return {
    schema: "calc_muestra_aulas_frame_v1",
    generated_at: "2026-07-14T00:00:00Z",
    input_mode: "base_madre",
    config: {},
    frame_hash: "hash",
    aula_frame: [],
    audit: [],
    warnings: [],
    ...overrides,
  } as Frame;
}

describe("computeInventarioUnicos", () => {
  it("marca sin datos cuando no hay frame", () => {
    const out = computeInventarioUnicos(null);
    expect(out.hasData).toBe(false);
    expect(out.filasLeidas).toBe(0);
    expect(out.alumnos.unicos).toBe(0);
    expect(out.cursosHorario.unicos).toBe(0);
  });

  it("prioriza los agregados del perfil y calcula colapso y razón por alumno y CH", () => {
    const frame = frameWith({
      audit: [{ metric: "input_rows", value: "136284" }] as unknown as Frame["audit"],
      perfil: {
        schema: "calc_muestra_aulas_perfil_v1",
        universo: 29090,
        poblacion_n: 28000,
        aulas_totales: 5263,
        marco_aulas: 5000,
        sexo_labels: [],
        embudo_alumno: [],
        embudo_aula: [],
        facultades: [],
        cobertura: { elegibles: 0, alcanzables: 0, pct: null },
      },
    });
    const out = computeInventarioUnicos(frame);
    expect(out.hasData).toBe(true);
    expect(out.filasLeidas).toBe(136284);
    // Alumnos: 136284 → 29090
    expect(out.alumnos.unicos).toBe(29090);
    expect(out.alumnos.colapso).toBe(136284 - 29090);
    expect(out.alumnos.filasPorUnidad).toBeCloseTo(136284 / 29090, 4);
    // Cursos-horario: 136284 → 5263
    expect(out.cursosHorario.unicos).toBe(5263);
    expect(out.cursosHorario.colapso).toBe(136284 - 5263);
    expect(out.cursosHorario.filasPorUnidad).toBeCloseTo(136284 / 5263, 4);
    // La fracción única del CH es pequeña pero > 0.
    expect(out.cursosHorario.fraccionUnica).toBeGreaterThan(0);
    expect(out.cursosHorario.fraccionUnica).toBeLessThan(0.1);
  });

  it("cae a la longitud de population_pool y aula_frame cuando falta perfil", () => {
    const frame = frameWith({
      audit: [{ metric: "input_rows", value: "10" }] as unknown as Frame["audit"],
      population_pool: [{ student_id: "a" }, { student_id: "b" }, { student_id: "c" }] as unknown as Frame["population_pool"],
      aula_frame: [
        { classroom_id: "A", eligible_n: 4 },
        { classroom_id: "B", eligible_n: 6 },
      ] as unknown as Frame["aula_frame"],
    });
    const out = computeInventarioUnicos(frame);
    expect(out.alumnos.unicos).toBe(3);
    expect(out.cursosHorario.unicos).toBe(2);
    // Matrículas elegibles = suma de eligible_n del aula_frame.
    expect(out.matriculasElegibles).toBe(10);
    // 10 matrículas / 3 alumnos.
    expect(out.matriculasPorAlumno).toBeCloseTo(10 / 3, 4);
  });

  it("nunca produce colapso negativo si los únicos superan las filas leídas", () => {
    const frame = frameWith({
      audit: [{ metric: "input_rows", value: "2" }] as unknown as Frame["audit"],
      population_pool: [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }] as unknown as Frame["population_pool"],
    });
    const out = computeInventarioUnicos(frame);
    expect(out.alumnos.colapso).toBe(0);
    expect(out.alumnos.fraccionUnica).toBe(1);
  });
});
