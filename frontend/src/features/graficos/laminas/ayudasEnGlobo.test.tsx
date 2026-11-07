// ADR 0135 §8: la ayuda de un control va en el «?» de su rótulo (globo con id, nombrado por el control en
// aria-describedby), nunca en un párrafo visible debajo. Los estados (vacío, aviso) siguen visibles, con role note.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AYUDA_COLORES, ListaColores } from "./colores/ColoresGrafico";
import { coloresEfectivos } from "./colores/coloresGraficoModel";
import { CasosNombrados } from "./diferencias/CasosNombrados";

const globo = (html: string, texto: string) => html.includes(`role="tooltip" class="pulso-f6-ayuda-globo">${texto}</span>`);
const parrafo = (html: string, texto: string) => html.includes(`class="pulso-f6-dato-ayuda">${texto}`);

describe("ayudas en el «?»", () => {
  it("Colores por serie: la ayuda en el globo y la lista la nombra; el vacío sigue visible", () => {
    const html = renderToStaticMarkup(<ListaColores rotulo="Colores por serie" filas={coloresEfectivos(["Acceso"], {})} onElegir={() => undefined} />);
    expect(globo(html, AYUDA_COLORES)).toBe(true);
    expect(parrafo(html, AYUDA_COLORES)).toBe(false);
    const id = html.match(/<span id="([^"]+)" role="tooltip"/)?.[1];
    expect(html).toContain(`class="pulso-f6-colores-lista" aria-describedby="${id}"`);
    const vacio = renderToStaticMarkup(<ListaColores rotulo="Colores por serie" filas={[]} onElegir={() => undefined} />);
    expect(vacio).toContain('role="note">Este gráfico aún no tiene series');
    expect(vacio).not.toContain('role="tooltip"');
  });

  it("Cómo se nombran los casos: el campo nombra su globo", () => {
    const html = renderToStaticMarkup(<CasosNombrados valor="" onCambio={() => undefined} />);
    const texto = "En la lectura de cada tarjeta, p. ej. «estudiantes».";
    expect(globo(html, texto)).toBe(true);
    expect(parrafo(html, texto)).toBe(false);
    const id = html.match(/<span id="([^"]+)" role="tooltip"/)?.[1];
    expect(html).toMatch(new RegExp(`<input[^>]*aria-describedby="${id}"`));
  });
});
