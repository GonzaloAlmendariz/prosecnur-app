import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CategoriaEvidencia, dominioCategorias } from "../CategoriaEvidencia";
import type { AporteCategoria } from "../controles";

/**
 * Una caja percentilar es un gráfico: quien no la ve necesita sus cifras.
 *
 * La caja dibuja P25–P75, la mediana, la media y los bigotes P10–P90 con
 * posiciones en píxeles. Sin `aria-label` no dice nada a un lector de pantalla,
 * y este módulo produce entregables que se auditan.
 */
const aporte: AporteCategoria = {
  ch: 120,
  chContraste: 200,
  elegibles: 3400,
  tasaAsistencia: null,
  distribucion: { media: 28, p10: 10, p25: 18, p50: 26, p75: 38, p90: 55 } as never,
};

describe("CategoriaEvidencia · accesibilidad", () => {
  it("la caja describe sus cinco estadísticos, no sólo que es un gráfico", () => {
    const html = renderToStaticMarkup(
      <CategoriaEvidencia aporte={aporte} dominio={dominioCategorias([aporte])!} />,
    );
    const etiqueta = /aria-label="([^"]+)"/.exec(html)?.[1] ?? "";
    expect(etiqueta).toContain("P25");
    expect(etiqueta).toContain("P75");
    expect(etiqueta).toContain("mediana");
    expect(etiqueta).toContain("media");
  });

  it("declara que es un gráfico para que se anuncie como tal", () => {
    const html = renderToStaticMarkup(
      <CategoriaEvidencia aporte={aporte} dominio={dominioCategorias([aporte])!} />,
    );
    expect(html).toContain('role="img"');
  });

  it("los extremos de la escala son decorativos y no se leen dos veces", () => {
    // Los números ya viajan en el aria-label de la caja; repetirlos como texto
    // haría que un lector de pantalla los dictara dos veces seguidas.
    const html = renderToStaticMarkup(
      <CategoriaEvidencia aporte={aporte} dominio={dominioCategorias([aporte])!} />,
    );
    const escala = html.slice(html.indexOf("cmv2-cat-escala"));
    expect(escala.slice(0, 120)).toContain('aria-hidden="true"');
  });
});
