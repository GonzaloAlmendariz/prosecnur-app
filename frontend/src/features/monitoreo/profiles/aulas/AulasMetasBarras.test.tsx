import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AulasMetasBarras } from "./AulasMetasBarras";
import type { MonitoreoAulasProyeccionFila } from "../../../../api/monitoreo";

const fila = (extra: Partial<MonitoreoAulasProyeccionFila> = {}): MonitoreoAulasProyeccionFila => ({
  facultad: "DERECHO",
  meta: 363, meta_M: 126, meta_F: 237,
  obtenidas: 51, obtenidas_M: 17, obtenidas_F: 34,
  aulas_aplicadas: 3, aulas_agendadas: 9, elegibles_agendados: 320,
  tasa_usada: 0.568, tasa_es_del_diseno: true, tasa_diseno: 0.568, tasa_obtenida: 0.408,
  elegibles_aplicados: 125, desvio_de_la_del_diseno: -0.282,
  proyectadas: 181.9, proyectadas_M: 63, proyectadas_F: 118.9,
  total: 232.9, brecha: -130.1, llega: false,
  meta_elegida: "muestra", factor_meta: 1,
  supuesto_meta: "", supuesto_sexo: "…",
  ...extra,
});

/** Los altos de los `rect` de una clase. El orden de atributos que emite React
 *  es el del JSX, así que se busca el `rect` entero y se leen los dos dentro:
 *  anclar el regex a «class antes de height» ataba el test a ese orden. */
const alturas = (html: string, clase: string): number[] =>
  [...html.matchAll(/<rect\b[^>]*>/g)]
    .map((m) => m[0])
    .filter((r) => r.includes(`class="${clase}"`))
    .map((r) => Number(/height="([0-9.]+)"/.exec(r)?.[1] ?? NaN));

describe("«Metas por facultad»", () => {
  it("dos barras por facultad: la meta en contorno y lo conseguido en relleno", () => {
    const html = renderToStaticMarkup(<AulasMetasBarras filas={[fila()]} />);
    expect(alturas(html, "aulas-metas-barra-meta")).toHaveLength(2);
    expect(alturas(html, "aulas-metas-barra-logro")).toHaveLength(2);
  });

  it("la escala es COMÚN: una facultad chica no se estira a su propio techo", () => {
    // Es la diferencia con el gauge, y la razón de que sean dos gráficos: aquí
    // el alto compara el tamaño del trabajo ENTRE facultades.
    const html = renderToStaticMarkup(
      <AulasMetasBarras filas={[
        fila({ facultad: "AAA", meta_M: 20, meta_F: 20, obtenidas_M: 20, obtenidas_F: 20 }),
        fila({ facultad: "ZZZ", meta_M: 800, meta_F: 800, obtenidas_M: 0, obtenidas_F: 0 }),
      ]} />,
    );
    const metas = alturas(html, "aulas-metas-barra-meta");
    // 20 contra 800: la barra chica tiene que ser ~40 veces menor, no igual.
    expect(Math.max(...metas) / Math.min(...metas)).toBeGreaterThan(30);
  });

  it("el techo lo fija la META, no lo conseguido: la barra más alta cabe entera", () => {
    const html = renderToStaticMarkup(<AulasMetasBarras filas={[fila()]} />);
    const util = 300 - 14 - 96;
    // Con el 8 % de aire, ninguna barra llega al alto útil completo.
    expect(Math.max(...alturas(html, "aulas-metas-barra-meta"))).toBeLessThan(util);
  });

  it("una facultad de nombre largo se recorta para que quepa el pie", () => {
    const html = renderToStaticMarkup(
      <AulasMetasBarras filas={[fila({ facultad: "CIENCIAS Y ARTES DE LA COMUNICACIÓN" })]} />,
    );
    expect(html).toContain("…");
    expect(html).not.toContain("CIENCIAS Y ARTES DE LA COMUNICACIÓN<");
  });

  it("el lienzo crece con las facultades: quince no caben en el de una", () => {
    // Se lee del viewBox y del `min-width`, no de un atributo `width` en
    // píxeles: el SVG ocupa el 100 % del panel desde el 2026-09-09 —iba fijo y
    // dejaba un vacío a la derecha en pantallas anchas— y su tamaño intrínseco
    // vive ahora en esos dos sitios.
    const una = renderToStaticMarkup(<AulasMetasBarras filas={[fila()]} />);
    const quince = renderToStaticMarkup(
      <AulasMetasBarras filas={Array.from({ length: 15 }, (_, i) => fila({ facultad: `F${i}` }))} />,
    );
    const ancho = (h: string) => Number(/viewBox="0 0 (\d+)/.exec(h)?.[1] ?? 0);
    expect(ancho(quince)).toBeGreaterThan(ancho(una));
    expect(quince).toContain("min-width:");
  });

  it("sin filas no pinta un lienzo vacío", () => {
    expect(renderToStaticMarkup(<AulasMetasBarras filas={null} />)).toBe("");
    expect(renderToStaticMarkup(<AulasMetasBarras filas={[]} />)).toBe("");
  });
});
