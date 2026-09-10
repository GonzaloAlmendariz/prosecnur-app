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
    // La geometría cambió el 2026-09-10: el pie bajó de 96 a 54 —los nombres
    // dejaron de ir en diagonal— y ese alto se fue a la barra, que es lo que se
    // compara. Él: «las barras pueden tener más alto».
    const util = 340 - 22 - 54;
    // Con el 8 % de aire, ninguna barra llega al alto útil completo.
    expect(Math.max(...alturas(html, "aulas-metas-barra-meta"))).toBeLessThan(util);
  });

  it("una facultad de nombre largo cabe ENTERA repartida en líneas", () => {
    // **El tope pasó de dos líneas a cinco el 2026-09-10** (Gonzalo: «el eje
    // puede tener más de dos filas hasta 5 con tal de que entre bien»). Con dos,
    // «CIENCIAS Y ARTES DE LA COMUNICACIÓN» salía cortada con puntos
    // suspensivos y se pisaba con su vecina: el rótulo dejaba de distinguir una
    // facultad de otra, que es para lo único que está.
    //
    // El recorte NO desapareció —sigue abajo, para lo que ni en cinco cabe—,
    // pero deja de ser lo normal.
    const html = renderToStaticMarkup(
      <AulasMetasBarras filas={[fila({ facultad: "CIENCIAS Y ARTES DE LA COMUNICACIÓN" })]} />,
    );
    expect(html).not.toContain("…");
    expect(html).toContain(">COMUNICACIÓN</tspan>");
    // El nombre entero sigue en el `title`, que es donde no estorba.
    expect(html).toContain("<title>CIENCIAS Y ARTES DE LA COMUNICACIÓN</title>");
    // Y no se pinta de corrido como una sola línea, que es lo que no cabía.
    expect(html).not.toContain(">CIENCIAS Y ARTES DE LA COMUNICACIÓN</tspan>");
  });

  it("lo que no cabe ni en cinco líneas SIGUE recortándose", () => {
    // El techo no es decorativo: sin él, un nombre absurdo empujaría el pie del
    // gráfico sin límite.
    const largo = "UNO DOS TRES CUATRO CINCO SEIS SIETE OCHO NUEVE DIEZ ONCE DOCE";
    const html = renderToStaticMarkup(<AulasMetasBarras filas={[fila({ facultad: largo })]} />);
    expect(html).toContain("…");
    expect(html).toContain(`<title>${largo}</title>`);
  });

  it("el pie crece con las líneas, y no a costa de las barras", () => {
    // Subir el tope sin esto le habría robado a la barra el alto que se le había
    // devuelto al quitar los rótulos en diagonal.
    const corto = renderToStaticMarkup(<AulasMetasBarras filas={[fila({ facultad: "DERECHO" })]} />);
    const largo = renderToStaticMarkup(
      <AulasMetasBarras filas={[fila({ facultad: "CIENCIAS Y ARTES DE LA COMUNICACIÓN" })]} />,
    );
    const alto = (html: string) => Number(/viewBox="0 0 [0-9.]+ ([0-9.]+)"/.exec(html)?.[1] ?? 0);
    expect(alto(largo)).toBeGreaterThan(alto(corto));
    // Y con un nombre corto el gráfico queda EXACTAMENTE como estaba.
    expect(alto(corto)).toBe(340);
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

/**
 * **Los rótulos del eje, horizontales y contraídos.**
 *
 * Gonzalo: «las etiquetas del eje x pueden tener wrap y tener mayor contracción
 * para que no estén dispuestas de forma diagonal, y las barras pueden tener más
 * alto y mostrar mejor los porcentajes de cada barra en su parte superior con el
 * color de su coloreado».
 */
describe("el pie del gráfico y los porcentajes", () => {
  it("ningún rótulo va en diagonal", () => {
    const html = renderToStaticMarkup(<AulasMetasBarras filas={[fila()]} />);
    expect(html).not.toContain("rotate(45)");
  });

  it("el nombre se parte en dos líneas, sin las palabras que no distinguen", () => {
    const html = renderToStaticMarkup(
      <AulasMetasBarras filas={[fila({ facultad: "GESTIÓN Y ALTA DIRECCIÓN" })]} />,
    );
    // «Y» no separa una facultad de otra y se lleva sitio de las que sí. Se cae
    // del RÓTULO, no del `title`, que conserva el nombre entero — por eso la
    // comprobación mira los `tspan` y no el html suelto.
    expect(html).toContain(">GESTIÓN ALTA</tspan>");
    expect(html).toContain(">DIRECCIÓN</tspan>");
    expect(html).toContain("<title>GESTIÓN Y ALTA DIRECCIÓN</title>");
  });

  it("cada barra lleva su porcentaje encima, con el tono de su sexo", () => {
    const html = renderToStaticMarkup(
      <AulasMetasBarras filas={[fila({ meta_M: 100, obtenidas_M: 25, meta_F: 100, obtenidas_F: 60 })]} />,
    );
    expect(html).toContain('class="aulas-metas-pct" data-sexo="hombres"');
    expect(html).toContain('class="aulas-metas-pct" data-sexo="mujeres"');
    expect(html).toContain(">25%<");
    expect(html).toContain(">60%<");
  });

  it("una meta en cero no publica un porcentaje sin denominador", () => {
    const html = renderToStaticMarkup(
      <AulasMetasBarras filas={[fila({ meta_M: 0, obtenidas_M: 0, meta_F: 100, obtenidas_F: 60 })]} />,
    );
    expect(html).not.toContain("NaN");
    expect(html).not.toContain("Infinity");
  });
});
