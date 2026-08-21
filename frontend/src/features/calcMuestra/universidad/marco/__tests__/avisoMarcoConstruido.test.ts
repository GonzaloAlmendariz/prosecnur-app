import { describe, expect, it } from "vitest";
import { avisoMarcoConstruido } from "../avisoMarcoConstruido";

const base = { estFrag: "566 estudiantes únicos elegibles", chFrag: "33 cursos-horario elegibles" };

describe("avisoMarcoConstruido", () => {
  it("con marco poblado cierra diciendo que el cálculo puede seguir", () => {
    const a = avisoMarcoConstruido({ ...base, estratos: 3, elegiblesEstudiantes: 566, elegiblesCursosHorario: 33 });
    expect(a.kind).toBe("info");
    expect(a.text).toContain("en 3 facultades");
    expect(a.text).toContain("N y estratos listos");
  });

  it("sin cursos-horario elegibles NO dice «listos» y nombra la causa", () => {
    // Con criterios que no dejan pasar ninguna aula, ese cierre mandaba a
    // Cálculo a chocarse con un marco vacío.
    const a = avisoMarcoConstruido({ ...base, chFrag: "0 cursos-horario elegibles", estratos: 3, elegiblesEstudiantes: 566, elegiblesCursosHorario: 0 });
    expect(a.kind).toBe("warn");
    expect(a.text).not.toContain("listos");
    expect(a.text).toContain("Ningún curso-horario pasó los criterios");
    expect(a.text).toContain("revísalos en Marco");
  });

  it("sin estudiantes elegibles avisa por el otro lado", () => {
    const a = avisoMarcoConstruido({ ...base, estFrag: "0 estudiantes únicos elegibles", estratos: 0, elegiblesEstudiantes: 0, elegiblesCursosHorario: 33 });
    expect(a.kind).toBe("warn");
    expect(a.text).toContain("Ningún estudiante pasó los criterios");
  });

  it("sin sincronía de estratos no inventa facultades", () => {
    const a = avisoMarcoConstruido({ ...base, estratos: 0, elegiblesEstudiantes: 566, elegiblesCursosHorario: 33 });
    expect(a.text).not.toContain("facultades");
    expect(a.kind).toBe("info");
  });

  it("una sola facultad se dice en singular", () => {
    const a = avisoMarcoConstruido({ ...base, estratos: 1, elegiblesEstudiantes: 566, elegiblesCursosHorario: 33 });
    expect(a.text).toContain("en 1 facultad y");
  });
});
