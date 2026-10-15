// Mata: volver a un tab stop por opción o perder aria-checked en el segmentado de la barra del Informe.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Segmentado } from "./Segmentado";

describe("segmentado del Informe", () => {
  it("sólo la opción elegida es tabulable y lleva aria-checked", () => {
    const html = renderToStaticMarkup(createElement(Segmentado<"a" | "b" | "c">, {
      etiqueta: "Tamaño", valor: "b", onCambiar: () => undefined,
      opciones: [{ clave: "a", rotulo: "A" }, { clave: "b", rotulo: "B" }, { clave: "c", rotulo: "C" }],
    }));
    expect(html.match(/tabindex="0"/g)?.length).toBe(1);
    expect(html.match(/tabindex="-1"/g)?.length).toBe(2);
    expect(html).toMatch(/aria-checked="true" tabindex="0"[^>]*>B</);
  });
});
