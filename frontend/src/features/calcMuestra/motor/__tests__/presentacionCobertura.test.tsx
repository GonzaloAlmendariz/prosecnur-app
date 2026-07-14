import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PerfilInstitucional } from "../../dominio";
import { TabCobertura } from "../pestanas/TabCobertura";

const perfil = {
  etiquetaUnidad: "facultad",
  marcoAulas: 2483,
} as PerfilInstitucional;

describe("presentación de Cobertura", () => {
  it("usa cabecera compacta, escala local y tres columnas cuando no hay anotaciones", () => {
    const html = renderToStaticMarkup(
      <TabCobertura
        perfil={perfil}
        cob={{
          totalElegibles: 9734,
          totalAlcanzables: null,
          pctGlobal: null,
          filas: [
            { facultadId: "a", nombre: "Facultad A", elegibles: 6400, alcanzables: null, pct: null, sobremuestra: 0, factible: null },
            { facultadId: "b", nombre: "Facultad B", elegibles: 3334, alcanzables: null, pct: null, sobremuestra: 0, factible: null },
          ],
        }}
      />,
    );

    expect(html).toContain("rec-cobertura-cabecera");
    expect(html).toContain('data-variante="cobertura"');
    expect(html).toContain("Máximo · 6,400");
    expect(html).not.toContain("50% del máximo");
    expect(html).not.toContain("rec-barras-anotacion");
    expect(html).not.toContain("¿Cómo se mide la fracción alcanzable?");
  });

  it("activa la cuarta columna solo cuando existe una prueba de factibilidad", () => {
    const html = renderToStaticMarkup(
      <TabCobertura
        perfil={perfil}
        cob={{
          totalElegibles: 1000,
          totalAlcanzables: 800,
          pctGlobal: 0.8,
          filas: [
            { facultadId: "a", nombre: "Facultad A", elegibles: 1000, alcanzables: 800, pct: 0.8, sobremuestra: 700, factible: true },
          ],
        }}
      />,
    );

    expect(html).toContain('data-anotaciones="true"');
    expect(html).toContain('data-anotacion="true"');
    expect(html).toContain("cubre 700");
    expect(html).not.toContain("Lectura de la factibilidad");
  });
});
