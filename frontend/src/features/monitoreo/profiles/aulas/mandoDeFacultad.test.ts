import { describe, expect, it } from "vitest";

import { mandoDeFacultadVisible } from "./mandoDeFacultad";

describe("mandoDeFacultadVisible", () => {
  it("se dibuja en Resumen, que es quien lo maneja", () => {
    expect(mandoDeFacultadVisible("avance", "resumen")).toBe(true);
  });

  it("NO se dibuja en las otras cuatro pestañas de Avance", () => {
    for (const pestana of ["cuotas", "rendimiento", "efectividad", "salidas"]) {
      expect(mandoDeFacultadVisible("avance", pestana), pestana).toBe(false);
    }
  });

  it("NO se dibuja en las otras secciones, ni siquiera sin pestaña", () => {
    for (const seccion of ["fuentes", "modelo", "calidad", "consultas"]) {
      expect(mandoDeFacultadVisible(seccion, ""), seccion).toBe(false);
      // Una sección con una pestaña que también se llama «resumen» no lo cuela.
      expect(mandoDeFacultadVisible(seccion, "resumen"), seccion).toBe(false);
    }
  });
});
