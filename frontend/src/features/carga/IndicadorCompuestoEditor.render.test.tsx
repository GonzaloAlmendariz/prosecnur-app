// ADR 0105: el editor del indicador compuesto, base por base.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { VariableDeBase } from "../../api/equivalencias";
import { BaseCompuesta } from "./IndicadorCompuestoEditor";

const opciones: VariableDeBase[] = [
  { name: "P28_1", label: "¿Recurrió a la Defensoría?", seccion: "", opciones: [{ codigo: "1", etiqueta: "Sí" }, { codigo: "2", etiqueta: "No" }] },
  { name: "P28_2", label: "¿Recurrió a la Comisión?", seccion: "" },
];

describe("una base del editor", () => {
  const render = (variables: string[], conteo?: string | null) => renderToStaticMarkup(createElement(BaseCompuesta, {
    base: "2024",
    entrada: { variables, codigosTexto: "1" },
    opciones,
    conteo,
    despachar: () => undefined,
  }));

  it("los conteos de lo guardado van bajo las preguntas; sin ellos, nada de relleno", () => {
    expect(render(["P28_1"], "Sí 120, No 80, Sin dato 5")).toContain('<p class="pulso-compuesto-conteos">Sí 120, No 80, Sin dato 5</p>');
    expect(render(["P28_1"], null)).not.toContain("pulso-compuesto-conteos");
    expect(render([], "Sí 1, No 0, Sin dato 0")).not.toContain("pulso-compuesto-conteos");
  });

  it("C3: sin preguntas elegidas, el vacío vive en su sección", () => {
    const html = render([]);
    expect(html).toContain("Sin preguntas elegidas: 2024 queda sin declarar");
    expect(html).toContain("is-vacia");
    expect(html).not.toContain("Códigos &quot;sí&quot;");
  });

  it("con preguntas: las lista, ofrece quitarlas y los códigos con la ayuda de la primera", () => {
    const html = render(["P28_1", "P28_2"]);
    expect(html).toContain('aria-label="Quitar P28_1 de 2024"');
    expect(html).toContain("Códigos &quot;sí&quot;");
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('aria-pressed="false"');
  });
});
