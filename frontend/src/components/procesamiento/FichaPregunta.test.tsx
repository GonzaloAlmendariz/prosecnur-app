import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { FichaPregunta, type TipoDePregunta } from "./FichaPregunta";

describe("FichaPregunta", () => {
  test("pinta el código y la etiqueta, cada uno en su elemento", () => {
    const html = renderToStaticMarkup(<FichaPregunta tipo="numerica" codigo="p4" etiqueta="Año de egreso" />);
    expect(html).toBe(
      '<span class="pulso-ficha-pregunta" data-tipo="numerica"><code class="pulso-ficha-pregunta-codigo">p4</code><span class="pulso-ficha-pregunta-etiqueta">Año de egreso</span></span>',
    );
  });

  test("sin código no hay <code>", () => {
    const html = renderToStaticMarkup(<FichaPregunta tipo="texto" etiqueta="Fecha de respuesta" />);
    expect(html).not.toContain("<code");
    expect(html).toContain(">Fecha de respuesta<");
  });

  test("el tipo decide el atributo que tiñe la ficha", () => {
    const tipos: TipoDePregunta[] = ["unica", "multiple", "numerica", "texto"];
    const atributos = tipos.map((tipo) => /data-tipo="([a-z]+)"/.exec(renderToStaticMarkup(<FichaPregunta tipo={tipo} etiqueta="Sector" />))?.[1]);
    expect(atributos).toEqual(["unica", "multiple", "numerica", "texto"]);
  });

  test("una clase del llamador se suma a la de la ficha", () => {
    const html = renderToStaticMarkup(<FichaPregunta tipo="multiple" etiqueta="Sector" className="en-celda" />);
    expect(html).toContain('class="pulso-ficha-pregunta en-celda" data-tipo="multiple"');
  });
});
