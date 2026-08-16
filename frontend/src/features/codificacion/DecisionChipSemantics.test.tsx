import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import DecisionChip from "./DecisionChip";

// El chip pinta el motivo y la nota en la misma ranura, y colapsarlos en una
// sola variable produjo un `title` que decía «Motivo: 48 sin asignar». No
// había test de render que lo viera: los del módulo puro no llegan hasta acá.

function texto(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

describe("DecisionChip", () => {
  it("una decisión cerrada muestra su motivo y lo nombra como tal", () => {
    const html = renderToStaticMarkup(
      <DecisionChip decision="no_categorizar" motivo="n insuficiente (4 respuestas)" />,
    );
    expect(texto(html)).toContain("No se categoriza");
    expect(texto(html)).toContain("n insuficiente (4 respuestas)");
    expect(html).toContain("Motivo: n insuficiente (4 respuestas)");
  });

  it("lo que falta va en el chip, y NO se anuncia como un motivo", () => {
    const html = renderToStaticMarkup(<DecisionChip decision="pendiente_parcial" nota="48 sin asignar" />);
    expect(texto(html)).toContain("A medias");
    expect(texto(html)).toContain("48 sin asignar");
    // La regresión concreta: «Motivo: 48 sin asignar».
    expect(html).not.toContain("Motivo:");
    expect(html).toContain('data-nota="48 sin asignar"');
  });

  it("si llegaran los dos, gana el motivo y el título no se contamina", () => {
    // No debería pasar —motivo es de las cerradas y nota de las abiertas— pero
    // si pasara, mezclar los dos en la misma línea la vuelve ilegible.
    const html = renderToStaticMarkup(
      <DecisionChip decision="no_categorizar" motivo="no aporta" nota="9 sin asignar" />,
    );
    expect(texto(html)).toContain("no aporta");
    expect(texto(html)).not.toContain("9 sin asignar");
    expect(html).toContain("Motivo: no aporta");
  });

  it("sin coletilla el chip es sólo su etiqueta", () => {
    const html = renderToStaticMarkup(<DecisionChip decision="categorizada" />);
    expect(texto(html)).toBe("Categorizada");
    expect(html).not.toContain("·");
  });

  it("una pregunta que nadie marcó no pinta chip", () => {
    // El control: `sin_marcar` es la mayoría de la lista —29 de 30 en
    // acnur_acg—. Un chip ahí sería ruido en casi todas las tarjetas.
    expect(renderToStaticMarkup(<DecisionChip decision="sin_marcar" nota="5 sin asignar" />)).toBe("");
  });
});
