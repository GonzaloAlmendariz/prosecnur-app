import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CategoriaEvidencia, dominioCategorias } from "../CategoriaEvidencia";
import type { AporteCategoria } from "../controles";

/**
 * El gráfico es un dibujo: quien no lo ve necesita sus cifras.
 *
 * F111 · Son tres capas —densidad, boxplot y cuantiles— dibujadas con
 * posiciones en píxeles. Sin equivalente en texto no dicen nada a un lector de
 * pantalla, y este módulo produce entregables que se auditan.
 */
const aporte: AporteCategoria = {
  ch: 120,
  chContraste: 200,
  elegibles: 3400,
  tasaAsistencia: null,
  // F111 · Con histograma: sin él `Densidad` devuelve null —y hace bien, porque
  // interpolar una forma entre cuantiles es inventarla—, así que un fixture sin
  // `hist_*` no ejercita la capa que esta prueba dice comprobar.
  distribucion: {
    media: 28, p10: 10, p25: 18, p50: 26, p75: 38, p90: 55,
    bigote_inf: 8, bigote_sup: 60, n_atipicos: 2,
    hist_breaks: [0, 20, 40, 60], hist_counts: [12, 40, 9],
  } as never,
};

describe("CategoriaEvidencia · accesibilidad", () => {
  it("la caja describe sus cinco estadísticos, no sólo que es un gráfico", () => {
    const html = renderToStaticMarkup(
      <CategoriaEvidencia aporte={aporte} dominio={dominioCategorias([aporte])!} />,
    );
    // F111 · El gráfico son ahora tres capas, y su equivalente en texto las
    // resume: quien no lo ve no puede recibir menos que quien lo ve. Se busca
    // en el `aria-label` del `role="img"`, no en cualquier `aria-label` del
    // HTML —los hay en los títulos de las cifras— porque una aserción sobre el
    // primero que aparezca pasaría sin probar nada del gráfico.
    const etiqueta = /role="img" aria-label="([^"]+)"/.exec(html)?.[1] ?? "";
    expect(etiqueta).toContain("media");
    expect(etiqueta).toContain("mediana");
    expect(etiqueta).toContain("mitad central");
  });

  it("declara que es un gráfico para que se anuncie como tal", () => {
    const html = renderToStaticMarkup(
      <CategoriaEvidencia aporte={aporte} dominio={dominioCategorias([aporte])!} />,
    );
    expect(html).toContain('role="img"');
  });

  it("lo decorativo del gráfico no se dicta dos veces", () => {
    // Las cifras ya viajan en el `aria-label` del gráfico; repetirlas como
    // marcas sueltas haría que un lector las dictara dos veces seguidas. La
    // densidad y los ticks son puro dibujo.
    const html = renderToStaticMarkup(
      <CategoriaEvidencia aporte={aporte} dominio={dominioCategorias([aporte])!} />,
    );
    const densidad = html.slice(html.indexOf("cmv2-dist-densidad"));
    expect(densidad.slice(0, 160)).toContain('aria-hidden="true"');
    // La sonda anterior buscaba `cmv2-dist-ticks`; con `indexOf` en −1 el
    // `slice` devolvía el último carácter y la aserción fallaba sin decir por
    // qué. Se comprueba la EXISTENCIA antes de medir sobre ella.
    expect(html).toContain("cmv2-dist-ticks");
    const ticks = html.slice(html.indexOf("cmv2-dist-ticks"));
    expect(ticks.slice(0, 80)).toContain('aria-hidden="true"');
  });
});
