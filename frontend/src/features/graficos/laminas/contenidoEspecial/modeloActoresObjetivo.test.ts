import { describe, expect, test } from "vitest";
import { actoresDesdeTexto, actoresQueSalen, textoDeActores } from "./modeloActoresObjetivo";

// G6 (2026-10-13): los actores consultados del objetivo se escriben uno por línea y viajan en `meta.actores`.
describe("actores del objetivo", () => {
  test("ida y vuelta entre el textarea y el plan", () => {
    const actores = actoresDesdeTexto("Estudiantes\nDocentes\nEgresados");
    expect(actores).toEqual(["Estudiantes", "Docentes", "Egresados"]);
    expect(textoDeActores(actores)).toBe("Estudiantes\nDocentes\nEgresados");
  });

  test("un Enter al final abre la línea siguiente, y esa línea vacía no cuenta como actor", () => {
    const actores = actoresDesdeTexto("Estudiantes\n");
    expect(textoDeActores(actores)).toBe("Estudiantes\n");
    expect(actoresQueSalen(actores)).toBe(1);
    expect(actoresDesdeTexto("")).toEqual([]);
  });
});
