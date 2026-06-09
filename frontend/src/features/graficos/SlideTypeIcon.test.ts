import { describe, expect, test } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SlideTypeIcon, slideLayoutIconVariant } from "./SlideTypeIcon";

describe("slideLayoutIconVariant", () => {
  test("distingue el lado real del texto en layouts de grafico", () => {
    expect(slideLayoutIconVariant("p_slide_grafico_texto_izquierda")).toBe("grafico-texto-izquierda");
    expect(slideLayoutIconVariant("p_slide_grafico_texto_derecha")).toBe("grafico-texto-derecha");
    expect(slideLayoutIconVariant("p_slide_2_graficos_texto_izquierda")).toBe("dos-graficos-texto-izquierda");
    expect(slideLayoutIconVariant("p_slide_2_graficos_texto_derecha")).toBe("dos-graficos-texto-derecha");
  });

  test("deja el resto de slides en el fallback Lucide", () => {
    expect(slideLayoutIconVariant("p_slide_portada")).toBeNull();
    expect(slideLayoutIconVariant("p_slide_indice")).toBeNull();
  });

  test("usa pictogramas especificos para narrativa y poblacion", () => {
    expect(slideLayoutIconVariant("p_slide_1_grafico_narrativo")).toBe("grafico-narrativa");
    expect(slideLayoutIconVariant("p_slide_2_graficos_narrativo")).toBe("dos-graficos-narrativa");
    expect(slideLayoutIconVariant("p_slide_4_graficos")).toBe("cuatro-graficos");
    expect(slideLayoutIconVariant("p_slide_6_graficos_poblacion")).toBe("poblacion-6");
  });

  test("renderiza pictogramas SVG compactos para layouts conocidos", () => {
    const markup = renderToStaticMarkup(createElement(SlideTypeIcon, {
      tipo: "p_slide_2_graficos_texto_izquierda",
      size: 23,
    }));

    expect(markup).toContain("<svg");
    expect(markup).toContain('viewBox="0 0 24 24"');
  });
});
