import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { BloquePregunta, tipoEnPalabras } from "./BloquePregunta";
import type { TipoDePregunta } from "./FichaPregunta";

describe("BloquePregunta", () => {
  test("pinta el código, el tipo en palabras y la cifra en un renglón, y debajo la pregunta", () => {
    const html = renderToStaticMarkup(
      <BloquePregunta tipo="texto" codigo="p3_otro" etiqueta="Otra carrera, especifique" detalle="23 respuestas, 14 únicas" />,
    );
    expect(html).toBe(
      '<span class="pulso-bloque-pregunta" data-tipo="texto" data-ancho="lado">' +
        '<span class="pulso-bloque-pregunta-cab"><code class="pulso-bloque-pregunta-codigo">p3_otro</code>' +
        '<span class="pulso-bloque-pregunta-tipo">Texto</span>' +
        '<span class="pulso-bloque-pregunta-detalle">23 respuestas, 14 únicas</span></span>' +
        '<span class="pulso-bloque-pregunta-etiqueta" title="Otra carrera, especifique">Otra carrera, especifique</span></span>',
    );
  });

  test("el tipo decide el atributo que tiñe el bloque y se dice también en palabras", () => {
    const tipos: TipoDePregunta[] = ["unica", "multiple", "numerica", "texto"];
    const vistos = tipos.map((tipo) => {
      const html = renderToStaticMarkup(<BloquePregunta tipo={tipo} codigo="p1" etiqueta="Sector" />);
      return [/data-tipo="([a-z]+)"/.exec(html)?.[1], /pulso-bloque-pregunta-tipo">([^<]+)</.exec(html)?.[1]];
    });
    expect(vistos).toEqual([["unica", "Única"], ["multiple", "Múltiple"], ["numerica", "Numérica"], ["texto", "Texto"]]);
    expect(tipos.map(tipoEnPalabras)).toEqual(["Única", "Múltiple", "Numérica", "Texto"]);
  });

  test("la pregunta entera va en el title: a la vista se corta en dos líneas", () => {
    const larga = "¿Cuáles fueron los motivos principales por los cuales decidió acudir a este Espacio de Protección?";
    const html = renderToStaticMarkup(<BloquePregunta tipo="multiple" codigo="reason_edp" etiqueta={larga} />);
    expect(html).toContain(`title="${larga}"`);
    expect(html).toContain(`>${larga}</span>`);
  });

  test("sin dato no hay línea de cifra, y un cero sí se pinta", () => {
    expect(renderToStaticMarkup(<BloquePregunta tipo="unica" codigo="p3" etiqueta="Carrera" />)).not.toContain("pulso-bloque-pregunta-detalle");
    expect(renderToStaticMarkup(<BloquePregunta tipo="unica" codigo="p3" etiqueta="Carrera" detalle="" />)).not.toContain("pulso-bloque-pregunta-detalle");
    expect(renderToStaticMarkup(<BloquePregunta tipo="unica" codigo="p3" etiqueta="Carrera" detalle={0} />)).toContain('pulso-bloque-pregunta-detalle">0<');
  });

  test("sin código no hay <code>", () => {
    const html = renderToStaticMarkup(<BloquePregunta tipo="texto" etiqueta="D1_otro" />);
    expect(html).not.toContain("<code");
    expect(html).toContain(">Texto<");
  });

  test("el ancho completo y la clase del llamador salen en el marcado", () => {
    const html = renderToStaticMarkup(<BloquePregunta tipo="texto" codigo="p9" etiqueta="Ocupación" ancho="completo" className="en-fila" />);
    expect(html).toContain('class="pulso-bloque-pregunta en-fila" data-tipo="texto" data-ancho="completo"');
  });

  test("solo usa span y code: puede ir dentro de un botón", () => {
    const html = renderToStaticMarkup(<BloquePregunta tipo="numerica" codigo="p4" etiqueta="Año" detalle="12 respuestas" />);
    expect(html.match(/<([a-z]+)/g)?.every((t) => t === "<span" || t === "<code")).toBe(true);
  });
});
