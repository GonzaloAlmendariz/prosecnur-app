// «Cuánto recorta cada criterio» (M8) — protege: mordidas independientes
// (jamás sumadas), la capa declarada, el orden por mordida y el null honesto.
import { describe, expect, it } from "vitest";
import { mordidasEstudiante } from "../mordidasEstudianteModel";

describe("mordidasEstudiante", () => {
  it("mide cada criterio por separado y ordena por mordida descendente", () => {
    const out = mordidasEstudiante({
      activa: true,
      filas_total: 1000,
      criterios: {
        formation: { layer: "marco", filas_pasan: 900, evaluable: true },
        level: { layer: "instrumento", filas_pasan: 700, evaluable: true },
        age: { layer: "marco", filas_pasan: 950, evaluable: true },
      },
    });
    expect(out).not.toBeNull();
    expect(out!.mordidas.map((m) => m.clave)).toEqual(["level", "formation", "age"]);
    const nivel = out!.mordidas[0];
    expect(nivel).toMatchObject({ fuera: 300, capa: "instrumento", etiqueta: "Ciclo o nivel curricular" });
    expect(nivel.pctFuera).toBeCloseTo(30);
  });

  it("excluye los no evaluables y devuelve null sin reporte activo", () => {
    expect(mordidasEstudiante(null)).toBeNull();
    expect(mordidasEstudiante({ activa: false, filas_total: 10, criterios: {} })).toBeNull();
    const out = mordidasEstudiante({
      activa: true,
      filas_total: 100,
      criterios: {
        sex: { layer: "marco", filas_pasan: 90, evaluable: false },
        age: { layer: "marco", filas_pasan: 80, evaluable: true },
      },
    });
    expect(out!.mordidas.map((m) => m.clave)).toEqual(["age"]);
  });
});
