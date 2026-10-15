// ID8 (2026-10-15). Mata: una muestra que no pinta la lámina con los colores de la paleta, que no aplica el paso de letra
// a la página del Word o que baja una letra de 8 pt.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MuestraIdentidad, ptConPaso } from "./MuestraIdentidad";

const datos = (paso: number) => ({
  titulo: "Acreditación", desplazamientoPt: paso, colores: ["#F4B183", "#FFD965", "#ADD493"], respuestas: ["Nada útil", "Útil", "Muy útil"],
  logos: { izquierda: { src: null, nombre: "PUCP" }, derecha: { src: "/logos-estandar/pulso.png", nombre: "PULSO PUCP" } },
});

describe("muestra viva de Identidad", () => {
  it("la lámina usa los colores de la paleta y la portada del Word los logos", () => {
    const html = renderToStaticMarkup(createElement(MuestraIdentidad, { datos: datos(0) }));
    expect(html).toContain("background:#F4B183");
    expect(html).toContain(">PUCP<");
    expect(html).toContain('src="/logos-estandar/pulso.png"');
  });

  it("el paso de letra llega a la página del Word, sin bajar de 8 pt", () => {
    expect(renderToStaticMarkup(createElement(MuestraIdentidad, { datos: datos(2) }))).toContain('data-letra-pt="12.5"');
    expect(ptConPaso(6, 0)).toBe(8);
  });
});
