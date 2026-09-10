import { describe, expect, it } from "vitest";

import { mandoDeFacultadVisible } from "./mandoDeFacultad";

describe("mandoDeFacultadVisible", () => {
  it("se dibuja en las cuatro pestañas de Avance que tienen gráficos", () => {
    // «Mejor todo Avance debería tener el selector de facultad, y absolutamente
    // todos los gráficos deben ajustarse y ser robustos a mostrar o todas las
    // facultades o una en específica» (2026-09-10).
    for (const pestana of ["resumen", "cuotas", "rendimiento", "efectividad"]) {
      expect(mandoDeFacultadVisible("avance", pestana), pestana).toBe(true);
    }
  });

  it("NO se dibuja en Salidas, que publica y no dibuja", () => {
    // Un mando de facultad sobre un botón de publicar insinúa que se publicaría
    // sólo esa facultad. No es verdad.
    expect(mandoDeFacultadVisible("avance", "salidas")).toBe(false);
  });

  it("NO se dibuja en las otras secciones, ni siquiera sin pestaña", () => {
    for (const seccion of ["fuentes", "modelo", "calidad", "consultas"]) {
      expect(mandoDeFacultadVisible(seccion, ""), seccion).toBe(false);
      // Una sección con una pestaña que también se llama «resumen» no lo cuela.
      expect(mandoDeFacultadVisible(seccion, "resumen"), seccion).toBe(false);
    }
  });
});
