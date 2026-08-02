import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CategoriaEvidencia, dominioCategorias, EjeCategorias } from "../CategoriaEvidencia";
import type { AporteCategoria } from "../controles";

/**
 * ADR 0057 · La categoría es la unidad de decisión.
 *
 * Estos casos fijan las dos reglas que más veces se rompieron en el módulo: la
 * escala es del criterio y no de cada caja, y React no calcula lo que el motor
 * no publicó.
 */
function aporte(over: Partial<AporteCategoria> = {}): AporteCategoria {
  return {
    ch: 120,
    chContraste: 200,
    elegibles: 3400,
    tasaAsistencia: 0.7,
    distribucion: { media: 28, p10: 10, p25: 18, p50: 26, p75: 38, p90: 55 } as never,
    ...over,
  };
}

describe("CategoriaEvidencia", () => {
  it("comparte una sola escala entre categorías, no una por caja", () => {
    // Una caja normalizada contra su propio rango sale del mismo ancho que las
    // demás y sugiere que todas las categorías se parecen. Comparar es lo único
    // para lo que este gráfico existe.
    const dominio = dominioCategorias([
      aporte(),
      aporte({ distribucion: { media: 90, p10: 70, p25: 80, p50: 88, p75: 96, p90: 120 } as never }),
    ]);
    expect(dominio).toEqual({ min: 10, max: 120 });
  });

  it("sin ninguna distribución publicada no inventa una escala", () => {
    expect(dominioCategorias([aporte({ distribucion: null }), null, undefined])).toBeNull();
  });

  it("publica CH, alumnos, cuantiles y presentes esperados en el mismo bloque", () => {
    const dominio = dominioCategorias([aporte()])!;
    const html = renderToStaticMarkup(<CategoriaEvidencia aporte={aporte()} dominio={dominio} />);
    expect(html).toContain("CH");
    expect(html).toContain("alumnos");
    expect(html).toContain("Mediana");
    expect(html).toContain("P25");
    // Presentes esperados = elegibles × tasa, redondeado. 3400 × 0,7 = 2.380.
    expect(html).toContain("2,380");
    expect(html).toContain("70% asistencia");
  });

  it("sin tasa de asistencia no estima presentes", () => {
    const dominio = dominioCategorias([aporte()])!;
    const html = renderToStaticMarkup(
      <CategoriaEvidencia aporte={aporte({ tasaAsistencia: null })} dominio={dominio} />,
    );
    expect(html).not.toContain("presentes");
  });

  it("declara la ausencia en vez de dibujar una caja vacía", () => {
    const html = renderToStaticMarkup(
      <CategoriaEvidencia
        aporte={aporte({ distribucion: { media: null, p25: null, p75: null } as never })}
        dominio={{ min: 0, max: 10 }}
      />,
    );
    expect(html).toContain("sin distribución publicada");
  });

  it("el eje se declara una vez y dice de qué es la escala", () => {
    const html = renderToStaticMarkup(<EjeCategorias dominio={{ min: 10, max: 120 }} />);
    expect(html).toContain("escala común del criterio");
    expect(html).toContain("alumnos elegibles por curso-horario");
  });
});

describe("CategoriaEvidencia · categoría sin cursos en la facultad", () => {
  it("dice que no hay cursos y calla los cuantiles vacíos", () => {
    // Cinco guiones (P10 — P25 — Mediana — …) no informan nada cuando la
    // categoría tiene 0 CH: sólo gastan atención. Quitarlos no quita
    // información; dejarlos sí quita foco de las categorías que sí deciden.
    const html = renderToStaticMarkup(
      <CategoriaEvidencia aporte={aporte({ ch: 0, elegibles: 0 })} dominio={{ min: 10, max: 60 }} />,
    );
    expect(html).toContain("sin cursos-horario en esta facultad");
    expect(html).not.toContain("Mediana");
    expect(html).not.toContain("cmv2-cat-caja");
  });

  it("con cursos, los cuantiles siguen enteros", () => {
    const html = renderToStaticMarkup(
      <CategoriaEvidencia aporte={aporte()} dominio={{ min: 10, max: 60 }} />,
    );
    expect(html).toContain("Mediana");
    expect(html).not.toContain("sin cursos-horario en esta facultad");
  });
});
