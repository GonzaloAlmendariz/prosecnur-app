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

// ADR 0143 (2026-11-11): sólo las acreditaciones que se declaran ahora abren Cálculo de muestra.
describe("Ficha del estudio · acreditación", () => {
  test("una acreditación nueva la diseña Cálculo de muestra", () => {
    expect(perfilDeOpcion("acreditacion", false, undefined)).toMatchObject({ tipo: "acreditacion", diseno: "calc-muestra" });
  });

  test("una acreditación ya guardada conserva quién diseña", () => {
    const previo = { tipo: "acreditacion" as const, seleccion: null, diseno: "cliente" as const, canales: [], poblaciones: [] };
    expect(perfilDeOpcion("acreditacion", false, previo).diseno).toBe("cliente");
  });
});
