import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { anchoDeTexto, AulasMetasBarras } from "./AulasMetasBarras";
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

/**
 * **Las quince del estudio, con sus nombres reales.**
 *
 * El eje se rompió con éstos y no con nombres de laboratorio: «ARQUITECTURA» y
 * «GASTRONOMÍA,» son las dos palabras sueltas más anchas del marco y son las que
 * se salían de su columna. Un `F0…F14` no habría fallado nunca.
 */
const FACULTADES = [
  "ARQUITECTURA Y URBANISMO", "ARTE Y DISEÑO", "ARTES ESCÉNICAS",
  "CIENCIAS CONTABLES", "CIENCIAS E INGENIERÍA", "CIENCIAS SOCIALES",
  "CIENCIAS Y ARTES DE LA COMUNICACIÓN", "DERECHO", "EDUCACIÓN",
  "ESTUDIOS GENERALES CIENCIAS", "ESTUDIOS GENERALES LETRAS",
  "GASTRONOMÍA, HOTELERÍA Y TURISMO", "GESTIÓN Y ALTA DIRECCIÓN",
  "LETRAS Y CIENCIAS HUMANAS", "PSICOLOGÍA",
];
const QUINCE = FACULTADES.map((facultad) => fila({ facultad }));

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
    // El alto de una fila de barras, `UTIL_FILA`. Con el 8 % de aire ninguna
    // barra llega al alto útil completo.
    expect(Math.max(...alturas(html, "aulas-metas-barra-meta"))).toBeLessThan(158);
  });

  it("una facultad de nombre largo cabe ENTERA repartida en líneas", () => {
    // **El eje se arregló partiendo el gráfico, no partiendo las palabras**
    // (2026-09-10). Con las quince facultades en una sola fila la columna medía
    // 62 unidades y «ARQUITECTURA» medía 78,6: las etiquetas se pisaban unas con
    // otras y el eje dejaba de decir qué facultad era cuál. Él: «la otra
    // solución es darle más alto, deshacernos de todo este espacio muerto y
    // darle dos filas al gráfico, la mitad de las facultades arriba y la otra
    // abajo». Ocho columnas en vez de quince: 116 unidades cada una.
    //
    // Se mide sobre el caso real —quince— porque una facultad sola tiene el
    // lienzo entero para ella y no probaría nada.
    const html = renderToStaticMarkup(<AulasMetasBarras filas={QUINCE} />);
    expect(html).not.toContain("…");
    // El nombre entero sigue en el `title`, que es donde no estorba.
    expect(html).toContain("<title>CIENCIAS Y ARTES DE LA COMUNICACIÓN</title>");
  });

  it("NINGÚN rótulo se sale de su columna: es el defecto que se vio en pantalla", () => {
    // La regresión concreta, medida con `getComputedTextLength()` sobre el
    // gráfico vivo: 78,6 unidades de rótulo en una columna de 62. Aquí se mide
    // con la misma estimación que usa el componente para repartir.
    const html = renderToStaticMarkup(<AulasMetasBarras filas={QUINCE} />);
    // El número de columnas se DERIVA de lo pintado, no se cocina: con «8» a
    // mano el test seguiría en verde si alguien volviese a la fila única, que
    // es exactamente el defecto que vigila. Cada fila de barras trae su rejilla
    // de cinco guías.
    const guias = [...html.matchAll(/class="aulas-metas-rejilla"/g)].length;
    const columnas = Math.ceil(15 / (guias / 5));
    const lienzo = Number(/viewBox="0 0 ([\d.]+)/.exec(html)?.[1] ?? 0);
    const grupo = (lienzo - 42 - 8) / columnas;
    const lineas = [...html.matchAll(/<tspan[^>]*>([^<]+)<\/tspan>/g)].map((m) => m[1]);
    expect(lineas.length).toBeGreaterThan(15);
    const desbordadas = lineas.filter((l) => anchoDeTexto(l) > grupo - 4);
    expect(desbordadas, `rótulos más anchos que su columna: ${desbordadas.join(" | ")}`).toEqual([]);
  });

  it("desde nueve facultades se parte en dos filas, y por debajo no", () => {
    // Él: «que sea robusto: eso no pasa siempre, pasa que haya más de 8
    // facultades en adelante y se parte a la mitad a partir de allí».
    const filasDe = (n: number) => Array.from({ length: n }, (_, i) => fila({ facultad: `F${i}` }));
    // Con dos filas hay dos rejillas: cinco líneas de guía por fila.
    const guias = (h: string) => [...h.matchAll(/class="aulas-metas-rejilla"/g)].length;
    expect(guias(renderToStaticMarkup(<AulasMetasBarras filas={filasDe(8)} />))).toBe(5);
    expect(guias(renderToStaticMarkup(<AulasMetasBarras filas={filasDe(9)} />))).toBe(10);
    expect(guias(renderToStaticMarkup(<AulasMetasBarras filas={QUINCE} />))).toBe(10);
  });

  it("la segunda fila lleva la otra mitad, y las dos comparten escala", () => {
    const html = renderToStaticMarkup(<AulasMetasBarras filas={QUINCE} />);
    // Quince en dos filas: ocho arriba, siete abajo. Ninguna se pierde.
    expect([...html.matchAll(/class="aulas-metas-etiqueta"/g)]).toHaveLength(15);
    // Escala común: la facultad más grande de la fila de abajo mide contra el
    // mismo techo que la de arriba, o los altos dejarían de compararse.
    const grandeArriba = fila({ facultad: "AAA", meta_M: 800, meta_F: 800 });
    const grandeAbajo = fila({ facultad: "ZZZ", meta_M: 800, meta_F: 800 });
    const conAmbas = renderToStaticMarkup(
      <AulasMetasBarras filas={[
        grandeArriba,
        ...Array.from({ length: 13 }, (_, i) => fila({ facultad: `M${i}`, meta_M: 10, meta_F: 10 })),
        grandeAbajo,
      ]} />,
    );
    const metas = alturas(conAmbas, "aulas-metas-barra-meta").filter((h) => h > 100);
    // Las cuatro barras de 800 (dos por facultad) miden lo mismo, arriba y abajo.
    expect(metas).toHaveLength(4);
    expect(new Set(metas.map((h) => Math.round(h)))).toHaveProperty("size", 1);
  });

  it("lo que no cabe en dos líneas SIGUE recortándose", () => {
    // El techo no es decorativo: sin él, un nombre absurdo empujaría el pie del
    // gráfico sin límite.
    const largo = "UNO DOS TRES CUATRO CINCO SEIS SIETE OCHO NUEVE DIEZ ONCE DOCE TRECE CATORCE";
    const html = renderToStaticMarkup(
      <AulasMetasBarras filas={[...QUINCE.slice(1), fila({ facultad: largo })]} />,
    );
    expect(html).toContain("…");
    expect(html).toContain(`<title>${largo}</title>`);
  });

  it("el pie crece con las líneas, y no a costa de las barras", () => {
    const corto = renderToStaticMarkup(<AulasMetasBarras filas={[fila({ facultad: "DERECHO" })]} />);
    const largo = renderToStaticMarkup(
      <AulasMetasBarras filas={[fila({ facultad: "CIENCIAS ARTES COMUNICACIÓN AUDIOVISUAL DIGITAL" })]} />,
    );
    const alto = (html: string) => Number(/viewBox="0 0 [0-9.]+ ([0-9.]+)"/.exec(html)?.[1] ?? 0);
    expect(alto(largo)).toBeGreaterThan(alto(corto));
  });

  it("el lienzo no se encoge con pocas facultades: engordan las barras", () => {
    // **Por qué NO crece de una a quince.** El SVG ocupa el 100 % del panel, así
    // que un `viewBox` estrecho lo escala el navegador: con una sola facultad
    // medía 112 y la escala se iba a ×10 —el «33 %» de una barra ocupaba media
    // pantalla—. Visto en pantalla el 2026-09-10 con DERECHO en el selector.
    const ancho = (h: string) => Number(/viewBox="0 0 ([\d.]+)/.exec(h)?.[1] ?? 0);
    const una = renderToStaticMarkup(<AulasMetasBarras filas={[fila()]} />);
    const quince = renderToStaticMarkup(<AulasMetasBarras filas={QUINCE} />);
    const veinte = renderToStaticMarkup(
      <AulasMetasBarras filas={Array.from({ length: 20 }, (_, i) => fila({ facultad: `F${i}` }))} />,
    );
    expect(ancho(una)).toBe(ancho(quince));
    // **Y veinte tampoco lo ensanchan, desde que se parte en dos filas**: diez
    // columnas por fila caben en el mismo lienzo. Antes crecía y aparecía el
    // scroll con veinte; ahora hace falta llegar a que la columna no baje del
    // ancho nominal, que es lo que protege al rótulo.
    expect(ancho(veinte)).toBe(ancho(quince));
    const cuarenta = renderToStaticMarkup(
      <AulasMetasBarras filas={Array.from({ length: 40 }, (_, i) => fila({ facultad: `F${i}` }))} />,
    );
    expect(ancho(cuarenta)).toBeGreaterThan(ancho(quince));
    expect(quince).toContain("min-width:");
  });

  it("con una sola facultad la barra engorda, pero con tope", () => {
    const grosor = (h: string) => Number(/width="([\d.]+)"/.exec(h)?.[1] ?? 0);
    const una = renderToStaticMarkup(<AulasMetasBarras filas={[fila()]} />);
    const quince = renderToStaticMarkup(<AulasMetasBarras filas={QUINCE} />);
    // El tope es `GRUPO * ENGORDE_MAXIMO`: sin él, dos facultades darían
    // columnas de media pantalla.
    expect(grosor(una)).toBeCloseTo(62 * 4 * 0.3, 5);
    expect(grosor(una)).toBeGreaterThan(grosor(quince));
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
    // Sobre las quince: una facultad sola tiene el lienzo entero y cabría de
    // corrido, así que no probaría el reparto.
    const html = renderToStaticMarkup(<AulasMetasBarras filas={QUINCE} />);
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
