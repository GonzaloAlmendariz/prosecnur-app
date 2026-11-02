import { describe, expect, test } from "vitest";

import { normalizarPlannerModos } from "../../api/planner";
import { perfilDeOpcion } from "./copiaDelEstudio";

// ADR 0125 §3: aulas es siempre cursos-horario; el marco de alumnos es un atributo.
describe("Ficha del estudio · aulas con o sin marco de alumnos", () => {
  test("sin marco declara cursos-horario anónimo", () => {
    expect(perfilDeOpcion("aulas", false, undefined)).toMatchObject({ tipo: "aulas", seleccion: "conglomerados", diseno: "calc-muestra" });
  });

  test("con marco guarda el atributo en `seleccion` y no cambia el diseño", () => {
    expect(perfilDeOpcion("aulas", true, undefined)).toMatchObject({ tipo: "aulas", seleccion: "marco", diseno: "calc-muestra" });
  });

  test("otro tipo no arrastra el marco", () => {
    expect(perfilDeOpcion("telefonico", true, undefined).seleccion).toBeNull();
  });

  test("los modos leen el marco y el propósito de acreditación", () => {
    const m = normalizarPlannerModos({ aulas: { con_marco: true }, material: { campanas: ["correo", "telefonica", "aulas"], proposito: "acreditacion" } });
    expect(m.aulas.conMarco).toBe(true);
    expect(m.material).toMatchObject({ campanas: ["correo", "telefonica", "aulas"], proposito: "acreditacion" });
    const vacio = normalizarPlannerModos({});
    expect(vacio.aulas.conMarco).toBe(false);
    expect(vacio.material.proposito).toBeNull();
  });
});
