/**
 * E12 · A3 — cada término de la fórmula es un chip, resuelva o no el glosario.
 *
 * `p` iba con `termino: "proporción esperada"`, que no es prefijo de ninguna
 * entrada (el glosario la llama «p (proporción esperada)»), y TerminoChip caía
 * a texto desnudo: la fila de chips mostraba «p 0.3» sin marco entre cuatro
 * chips con estilo.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GLOSARIO } from "../../didactica/referencia/corpus";
import { FormulaLatex } from "./FormulaLatex";

const resuelve = (termino: string) =>
  GLOSARIO.some((g) => g.termino.toLowerCase().startsWith(termino.toLowerCase()));

function chips(html: string): number {
  return (html.match(/class="cmv2-uni-formula-term"/g) ?? []).length;
}

describe("E12 A3 · términos de la fórmula del diseño", () => {
  it("los cinco términos de Cochran resuelven en el glosario", () => {
    for (const termino of ["marco muestral", "nivel de confianza", "p (proporción", "margen de error", "deff"]) {
      expect(resuelve(termino), termino).toBe(true);
    }
  });

  it("un término sin entrada conserva el estilo de chip", () => {
    const html = renderToStaticMarkup(
      <FormulaLatex
        expression="n = p"
        terms={[
          { symbol: "p", termino: "p (proporción", value: "0.3" },
          { symbol: "q", termino: "término inexistente", value: "0.7" },
        ]}
      />,
    );
    expect(chips(html)).toBe(2);
    expect(html).toContain('<span class="cmv2-uni-formula-term"><code>q</code>');
  });
});
