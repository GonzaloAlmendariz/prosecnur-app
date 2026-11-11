import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { FrecuenciasPreview, FrecuenciasPreviewTabla } from "../../../api/analitica";
import { cajasDeLaHoja } from "../../../test/cajasPropias";
import { cifrasDeCabeceraDeFrecuencias } from "./cifrasDeFrecuencias";
import { CifrasDeCabecera } from "./CifrasDeCabecera";
import { respuestaDosBases, respuestaReal, respuestaSinPesos, tablaReal } from "./ejemploDeVistaPrevia.test-util";
import { HojaDeFrecuencias } from "./HojaDeFrecuencias";
import { MarcoDeTablas } from "./MarcoDeTablas";
import { PanelDeZona } from "./PanelDeZona";
import type { Lectura } from "./useLecturaPorBase";

/**
 * Contrato de la superficie de tablas de Analítica (Frecuencias y Cruces), en
 * la forma del prototipo del rediseño de Procesamiento: la cabecera de la
 * pestaña y una mesa de tres columnas (preguntas, la tabla de la elegida, y
 * ajustes con el archivo).
 *
 * Lo que la composición promete y ninguna prueba de modelo ve: que el marco
 * declara su geometría (C1) con el nombre de la pestaña, que cada contenedor
 * tiene dueño de su vacío, que la tabla conserva su cabecera con una y muchas
 * opciones (C2), que la opción se lee por su etiqueta con el código como dato
 * secundario, que la cabecera no repite lo que ya dicen los paneles y que las
 * cifras de la tabla son las del servicio, sin un espejo de sus reglas.
 */

const aqui = path.dirname(fileURLToPath(import.meta.url));
const fuentes = [
  ...readdirSync(aqui).filter((f) => /\.tsx?$/.test(f) && !/\.test(-util)?\.tsx?$/.test(f)).map((f) => path.join(aqui, f)),
  path.join(aqui, "..", "panes", "FrecuenciasPane.tsx"),
];
const leer = (f: string) => readFileSync(f, "utf8");
const nombre = (f: string) => path.basename(f);

/** Los patrones que este contrato prohíbe, como funciones para probarlos contra un caso que los rompe. */
const tieneAcordeon = (fuente: string) => /<details\b|<summary\b|Collapsible/.test(fuente);
const tieneCasilla = (fuente: string) => /type=["']checkbox["']/.test(fuente);
const iconoFueraDelShim = (fuente: string) => /from ["']lucide-react["']/.test(fuente);
/** La vista previa leía la revisión de variables y replicaba las reglas del motor. */
const leeLaRevision = (fuente: string) => /apiAnaliticaDataReview|DataReviewVariable|tablasDelArchivo/.test(fuente);

describe("superficie de tablas: reglas de la casa", () => {
  it("el barrido ve las piezas (centinela)", () => {
    expect(fuentes.length).toBeGreaterThanOrEqual(12);
  });

  it("sin acordeones propios, sin casillas y con los íconos del shim", () => {
    expect(fuentes.filter((f) => tieneAcordeon(leer(f))).map(nombre)).toEqual([]);
    expect(fuentes.filter((f) => tieneCasilla(leer(f))).map(nombre)).toEqual([]);
    expect(fuentes.filter((f) => iconoFueraDelShim(leer(f))).map(nombre)).toEqual([]);
  });

  it("sin espejo de las reglas del motor: nada lee la revisión de variables para pintar tablas", () => {
    expect(fuentes.filter((f) => leeLaRevision(leer(f))).map(nombre)).toEqual([]);
  });

  it("los detectores reconocen lo que prohíben", () => {
    expect(tieneAcordeon("<details open>")).toBe(true);
    expect(tieneAcordeon('<Collapsible title="Notas">')).toBe(true);
    expect(tieneAcordeon('<section className="tablas-seccion">')).toBe(false);
    expect(tieneCasilla('<input type="checkbox" />')).toBe(true);
    expect(iconoFueraDelShim('import { X } from "lucide-react";')).toBe(true);
    expect(iconoFueraDelShim('import { X } from "../../../vendor/lucide-react";')).toBe(false);
    expect(leeLaRevision("const r = await apiAnaliticaDataReview();")).toBe(true);
    expect(leeLaRevision('import { tablaDeFrecuencia } from "./tablasDelArchivo";')).toBe(true);
    expect(leeLaRevision("apiAnaliticaFrecuenciasPreview({ limite })")).toBe(false);
  });

  it("la hoja de estilos no dibuja cajas: el marco es el Panel del kit", () => {
    expect(cajasDeLaHoja(leer(path.join(aqui, "tablas.css")))).toBe(0);
  });

  it("FrecuenciasPane compone y no pinta: sin marcado propio ni estado local", () => {
    const pane = leer(path.join(aqui, "..", "panes", "FrecuenciasPane.tsx"));
    expect(pane).not.toMatch(/<(div|section|span|table|button|p)\b/);
    expect(pane).not.toMatch(/\buseState\b/);
    expect(pane.split("\n").length).toBeLessThan(180);
  });
});

describe("marco de tres columnas", () => {
  const marco = (pestana: "frecuencias" | "cruces") => renderToStaticMarkup(createElement(MarcoDeTablas, {
    pestana,
    cabecera: createElement("i", { id: "cabecera" }),
    preguntas: createElement("i", { id: "preguntas" }),
    tabla: createElement("i", { id: "tabla" }),
    ajustes: createElement("i", { id: "ajustes" }),
    archivo: createElement("i", { id: "archivo" }),
  }));

  it("C1: la mesa y la columna derecha declaran grupo y contrato con el nombre de la pestaña", () => {
    expect(marco("frecuencias")).toMatch(/data-qa-geometry-group="analitica\/frecuencias-mesa" data-qa-geometry-contract="intrinsic"/);
    expect(marco("frecuencias")).toMatch(/data-qa-geometry-group="analitica\/frecuencias-lateral" data-qa-geometry-contract="intrinsic"/);
    expect(marco("cruces")).toContain('data-qa-geometry-group="analitica/cruces-mesa"');
  });

  it("la cabecera antes de la mesa; en la mesa, preguntas, tabla y la columna de ajustes y archivo, en ese orden", () => {
    const html = marco("frecuencias");
    const mesa = html.slice(html.indexOf('class="tablas-mesa"'));
    expect(html.indexOf('id="cabecera"')).toBeLessThan(html.indexOf('class="tablas-mesa"'));
    expect(mesa).not.toContain('id="cabecera"');
    const orden = ["preguntas", "tabla", "ajustes", "archivo"].map((z) => mesa.indexOf(`id="${z}"`));
    expect(orden.every((i) => i > 0)).toBe(true);
    expect([...orden].sort((a, b) => a - b)).toEqual(orden);
    // Ajustes y archivo comparten la columna derecha.
    const lateral = mesa.slice(mesa.indexOf('class="tablas-lateral"'));
    expect(lateral).toContain('id="ajustes"');
    expect(lateral).toContain('id="archivo"');
    expect(lateral).not.toContain('id="tabla"');
  });

  it("C3 y C4: el cuerpo de cada contenedor es dueño del vacío y una región con nombre que se desplaza con el teclado", () => {
    const zona = (ocupado: boolean) => renderToStaticMarkup(createElement(PanelDeZona, {
      zona: "tabla", titulo: "Así sale en el archivo", icono: null, ocupado, grupo: "analitica/x", pie: "nota al pie", children: "contenido",
    }));
    const html = zona(false);
    expect(html).toContain('data-qa-geometry-capacity="owned"');
    expect(html).toContain('data-qa-geometry-group="analitica/x"');
    expect(html).toMatch(/role="region" aria-label="Así sale en el archivo" tabindex="0"/);
    expect(html).not.toContain("aria-busy");
    expect(zona(true)).toContain('aria-busy="true"');
    // La cabecera y el pie quedan fuera del cuerpo que se desplaza.
    const cuerpo = html.slice(html.indexOf("tablas-panel-cuerpo"), html.indexOf("tablas-panel-pie"));
    expect(cuerpo).toContain("contenido");
    expect(cuerpo).not.toContain("pulso-panel-title");
    expect(html.indexOf("pulso-panel-title")).toBeLessThan(html.indexOf("tablas-panel-cuerpo"));
  });

  it("la lista dice cuántas preguntas tiene junto a su título", () => {
    const html = renderToStaticMarkup(createElement(PanelDeZona, { zona: "preguntas", titulo: "Preguntas", icono: null, conteo: 1283, children: "x" }));
    expect(html).toMatch(/<span>Preguntas<\/span><span class="tablas-conteo">1,283<\/span>/);
  });
});

const tablas = () => respuestaReal().tablas;
const tablaDe = (variable: string, lista = tablas()) => {
  const t = lista.find((x) => x.variable === variable);
  if (!t) throw new Error(`Sin tabla ${variable}`);
  return t;
};

describe("tabla de frecuencias de la pregunta elegida", () => {
  const hoja = (tabla: FrecuenciasPreviewTabla, extra: Partial<Parameters<typeof HojaDeFrecuencias>[0]> = {}) =>
    renderToStaticMarkup(createElement(HojaDeFrecuencias, { tabla, ponderado: true, ...extra }));
  const cabeceras = (html: string) => html.match(/role="columnheader"/g)?.length ?? 0;
  const filas = (html: string) => html.match(/class="tablas-fila( is-especial)?" role="row"/g)?.length ?? 0;
  const muchas = (): FrecuenciasPreviewTabla => {
    const base = tablaDe("M4_employment");
    return { ...base, filas: Array.from({ length: 40 }, (_, i) => ({ ...base.filas[0], codigo: `c${i}`, etiqueta: `Opción ${i}` })) };
  };

  it("C2: la cabecera de columnas es la misma con una y con muchas opciones", () => {
    const una = { ...tablaDe("M4_employment"), filas: [tablaDe("M4_employment").filas[0]] };
    expect(cabeceras(hoja(una))).toBe(4);
    expect(cabeceras(hoja(muchas()))).toBe(4);
    expect(filas(hoja(una))).toBe(1);
    expect(filas(hoja(muchas()))).toBe(40);
  });

  it("cada opción se lee por su etiqueta, sin el código delante: el código va en el title y es la llave de la fila", () => {
    const html = hoja(tablaDe("M4_employment"));
    expect(html).toMatch(/<div class="tablas-fila" role="row" data-categoria="1"><span class="tablas-categoria" role="rowheader" title="Código 1">Trabaja en empleo formal/);
    expect(html).not.toContain('<code class="tablas-codigo"');
    // Los códigos especiales llevan su marca.
    expect(html).toMatch(/class="tablas-fila is-especial" role="row" data-categoria="99"/);
  });

  it("una fila sin código no lo inventa: solo su etiqueta, sin title ni llave de código", () => {
    const html = hoja(tablaDe("M4_employment", respuestaSinPesos().tablas), { ponderado: false });
    expect(html).toContain('<div class="tablas-fila" role="row"><span class="tablas-categoria" role="rowheader">No trabaja actualmente, pero está buscando trabajo</span>');
  });

  it("el título lleva el código de la pregunta y su pregunta; debajo, sobre quiénes va el porcentaje", () => {
    const html = hoja(tablaDe("M4_employment"));
    expect(html).toMatch(/<h3 id="[^"]+"><code class="tablas-grupo-codigo">M4_employment<\/code> ¿Cuál describe mejor su situación laboral actual\?<\/h3><p>Porcentaje ponderado sobre quienes respondieron\.<\/p>/);
    expect(hoja(tablaDe("M4_employment", respuestaSinPesos().tablas), { ponderado: false })).toContain("<p>Porcentaje sobre quienes respondieron.</p>");
    expect(hoja(tablaDe("D1_information"))).toContain("<p>Porcentaje ponderado sobre quienes marcaron alguna opción; las opciones suman más de 100.</p>");
  });

  it("casos enteros y porcentajes con dos decimales, como el archivo, celda por celda", () => {
    // Respuesta real con pesos: la fila 1 de M4_employment trae n 558.1145... y pct 0.4350074...
    const empleo = hoja(tablaDe("M4_employment"));
    const celdas = Array.from(empleo.matchAll(/data-categoria="(\w+)"[\s\S]*?<span class="tablas-cifra" role="cell">([^<]*)<\/span><span class="tablas-cifra is-porcentaje" role="cell">([^<]*)</g))
      .map((m) => [m[1], m[2], m[3]]);
    expect(celdas).toEqual([
      ["1", "558", "43.50"], ["2", "350", "27.30"], ["3", "71", "5.52"], ["4", "241", "18.80"], ["98", "4", "0.34"], ["99", "58", "4.55"],
    ]);
    expect(empleo).toContain('<span class="tablas-categoria" role="rowheader">Total</span><span role="cell" aria-hidden="true"></span><span class="tablas-cifra" role="cell">1,283</span><span class="tablas-cifra is-porcentaje" role="cell">100.00</span>');
    expect(empleo).toContain("Respondieron 1,283 de 1,283 casos (100.0 %)");
    expect(empleo).toContain("<span>Fuente: Pulso PUCP.</span>");
  });

  it("el conmutador de cifras quita la columna que no se lee, con su cabecera, sin tocar las cifras de la otra", () => {
    const empleo = tablaDe("M4_employment");
    const casos = hoja(empleo, { cifras: "casos" });
    const pct = hoja(empleo, { cifras: "porcentaje" });
    expect(cabeceras(casos)).toBe(3);
    expect(cabeceras(pct)).toBe(3);
    expect(casos).not.toContain("is-porcentaje");
    expect(casos).toContain('role="columnheader">N ponderado</span>');
    expect(casos).toContain('<span class="tablas-cifra" role="cell">558</span>');
    expect(pct).not.toContain('role="columnheader">N ponderado</span>');
    expect(pct).toContain('<span class="tablas-cifra is-porcentaje" role="cell">43.50</span>');
    expect(pct).not.toContain('role="cell">558</span>');
    // Las barras no dependen del conmutador.
    expect(casos.match(/class="tablas-barra"/g)?.length).toBe(pct.match(/class="tablas-barra"/g)?.length);
    expect(casos).toContain('data-cifras="casos"');
  });

  it("una suma de pesos de 1.75 se lee 2 y una proporción de 0.17303 se lee 17.30", () => {
    const t: FrecuenciasPreviewTabla = {
      ...tablaReal("M5_district", false),
      filas: [{ codigo: "smp", etiqueta: "SMP", n: 1.75, pct: 0.17303, especial: false }],
    };
    expect(hoja(t)).toContain('<span class="tablas-cifra" role="cell">2</span><span class="tablas-cifra is-porcentaje" role="cell">17.30</span>');
  });

  it("los porcentajes, las barras y el total son los del servicio: no se recalculan desde los casos", () => {
    // Una respuesta donde ninguna cifra cuadra con la aritmética del frontend:
    // 10 de 32 sería 31.25 (no 31.30) y 20 de 32, 62.50 (no 68.75); la suma de
    // las filas es 30, no el total 32.
    const t: FrecuenciasPreviewTabla = {
      ...tablaDe("D1_information"),
      variable: "x",
      filas: [
        { codigo: "1", etiqueta: "Radio", n: 10, pct: 0.3125, especial: false },
        { codigo: "2", etiqueta: "Televisión", n: 20, pct: 0.6875, especial: false },
      ],
      total: { n: 32, pct: 1 },
      base: { n: 32, de: 64, denominador: "marcaron_alguna_opcion" },
    };
    const html = hoja(t);
    expect(html).toContain('role="cell">31.25</span>');
    expect(html).toContain('role="cell">68.75</span>');
    expect(html).not.toContain('role="cell">62.50</span>');
    expect(html).toContain('<span class="tablas-cifra" role="cell">32</span>');
    expect(html).not.toContain('role="cell">30</span>');
    expect(html).toContain("--tablas-barra:31.25%");
    expect(html).toContain("--tablas-barra:68.75%");
  });

  it("la múltiple: sus porcentajes suman más de 100, su Total dice quiénes son y su base va en casos", () => {
    const medios = hoja(tablaDe("D1_information"));
    const pcts = Array.from(medios.matchAll(/class="tablas-cifra is-porcentaje" role="cell">([\d.]+)</g)).map((m) => m[1]);
    // Nueve opciones y el total, con dos decimales.
    expect(pcts).toEqual(["65.32", "30.28", "4.13", "11.89", "7.18", "6.97", "18.16", "9.57", "5.59", "100.00"]);
    expect(pcts.slice(0, 9).reduce((a, b) => a + Number(b), 0)).toBeGreaterThan(100);
    expect(medios).toContain('<span class="tablas-categoria" role="rowheader">Total (marcaron alguna opción)</span>');
    expect(medios).toContain('role="cell">575</span>');
    expect(medios).toContain("Marcaron alguna opción 560 de 1,283 casos (43.6 %)");
    expect(medios).toContain('data-forma="multiple"');
    // En la única el Total es solo "Total".
    expect(hoja(tablaDe("M4_employment"))).toContain('role="rowheader">Total</span>');
  });

  it("la numérica: sus ocho estadísticos tal como vienen, sin columnas de porcentaje ni tabla de opciones", () => {
    const edad = hoja(tablaDe("E1_age"));
    const estadisticos = Array.from(edad.matchAll(/<dt>([^<]+)<\/dt><dd>([^<]+)<\/dd>/g)).map((m) => [m[1], m[2]]);
    // "Casos válidos" sale una sola vez: en su celda, con la base debajo; la cabecera no repite el conteo.
    expect(edad).toContain('<dd class="tablas-resumen-base">de 1,283 casos (100.0 %)</dd>');
    expect(edad.match(/1,283/g)).toHaveLength(2);
    expect(estadisticos).toEqual([
      ["Casos válidos", "1,283"], ["Promedio", "47.8"], ["Desviación estándar", "16.3"], ["Mínimo", "18.0"],
      ["Percentil 25", "35.0"], ["Mediana (Percentil 50)", "46.0"], ["Percentil 75", "59.0"], ["Máximo", "91.0"],
    ]);
    expect(edad).not.toContain("is-porcentaje");
    expect(edad).not.toContain('role="table"');
    expect(edad).toContain("<p>Resumen numérico; los estadísticos van ponderados.</p>");
    // C1: las celdas del resumen son pares.
    expect(edad).toContain('data-qa-geometry-group="analitica/frecuencias-resumen" data-qa-geometry-contract="equal"');
  });

  it("la cabecera dice N ponderado con pesos y Casos sin ellos; nada llama casos a una suma de pesos", () => {
    const con = hoja(tablaDe("M4_employment"), { ponderado: true });
    expect(con).toContain('role="columnheader">N ponderado</span>');
    expect(con).not.toContain("casos ponderados");
    expect(con).not.toContain(">Casos<");
    // Con pesos, "casos" solo aparece en las bases, que son conteos sin ponderar.
    const conCasos = Array.from(con.matchAll(/[^>]*\bcasos?\b[^<]*/g)).map((m) => m[0]);
    expect(conCasos.every((t) => /^(Respondieron|Marcaron alguna opción) [\d,]+ de [\d,]+ casos? \([\d.]+ %\)$/.test(t))).toBe(true);
    expect(hoja(tablaDe("M4_employment", respuestaSinPesos().tablas), { ponderado: false })).toContain('role="columnheader">Casos</span>');
  });

  it("sin pesos, la misma frase de base que con pesos: conteo y porcentaje juntos", () => {
    const sin = respuestaSinPesos().tablas;
    expect(hoja(tablaDe("M4_employment", sin), { ponderado: false })).toContain("Respondieron 1,283 de 1,283 casos (100.0 %)");
    expect(hoja(tablaDe("D1_information", sin), { ponderado: false })).toContain("Marcaron alguna opción 560 de 1,283 casos (43.6 %)");
  });

  it("el código especial atenúa su rótulo y su porcentaje sigue como los demás", () => {
    const html = hoja(tablaDe("M4_employment"));
    expect(html).toMatch(/class="tablas-fila is-especial" role="row" data-categoria="98"/);
    const css = leer(path.join(aqui, "tablas.css"));
    expect(css).toMatch(/\.tablas-fila\.is-especial > \.tablas-categoria \{/);
    expect(css).not.toMatch(/\.is-especial[^{]*is-porcentaje/);
    expect(css).not.toMatch(/\.is-especial[^{]*tablas-barra/);
  });

  it("una tabla sin datos lo dice y no pinta filas ni total", () => {
    const vacia: FrecuenciasPreviewTabla = { ...tablaDe("M4_employment"), sin_datos: true, filas: [], total: { n: 0, pct: null }, notas: [] };
    const html = hoja(vacia);
    expect(html).toContain(">Sin datos<");
    expect(html).not.toContain("tablas-total");
    expect(html).not.toContain('role="table"');
  });

  it("es una tabla para quien la lee con lector de pantalla: nombrada por su título, con filas y celdas", () => {
    const html = hoja(tablaDe("M4_employment"));
    const id = html.match(/<h3 id="([^"]+)"/)?.[1];
    expect(id).toBeTruthy();
    expect(html).toContain(`<article class="tablas-grupo" aria-labelledby="${id}" data-variable="M4_employment"`);
    expect(html).toMatch(new RegExp(`<div class="tablas-hoja" role="table" aria-labelledby="${id}" data-cifras="ambos" data-qa-geometry-group="analitica/frecuencias-hoja" data-qa-geometry-contract="intrinsic" data-qa-geometry-exento="[^"]+">`));
    const fila = html.slice(html.indexOf('data-categoria="1"'), html.indexOf('data-categoria="2"'));
    expect(fila.match(/role="rowheader"/g)).toHaveLength(1);
    expect(fila.match(/role="cell"/g)).toHaveLength(3);
    expect(html).not.toMatch(/<table[\s>]/);
  });

  it("una recodificación se lee con el código de su pregunta", () => {
    const recod = { ...tablaDe("M4_employment"), variable: "M4_employment_recod", variable_origen: "M4_employment" };
    const html = hoja(recod);
    expect(html).toContain('<code class="tablas-grupo-codigo">M4_employment</code>');
    expect(html).toContain('data-variable="M4_employment_recod" data-origen="M4_employment"');
  });

  it("lo que se relee se anuncia como ocupado", () => {
    expect(hoja(tablaDe("M4_employment"))).not.toContain("data-releyendo");
    const releyendo = hoja(tablaDe("M4_employment"), { releyendo: true });
    expect(releyendo).toContain('aria-busy="true"');
    expect(releyendo).toContain('data-releyendo=""');
  });
});

describe("cabecera de Frecuencias", () => {
  const lectura = (datos: FrecuenciasPreview | null): Lectura<FrecuenciasPreview> =>
    ({ fase: datos ? "lista" : "leyendo", datos, causa: "", codigo: "", reintentar: () => undefined });
  const cabecera = (datos: FrecuenciasPreview | null, numericas = 3) => renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: ["/analitica?pestana=frecuencias"] },
    createElement(CifrasDeCabecera, { ariaLabel: "Cifras", cifras: cifrasDeCabeceraDeFrecuencias(lectura(datos), numericas) })));

  it("cada cifra con lo que cuenta; la de los pesos lleva a Ponderación y dice de qué base salen las tablas", () => {
    const html = cabecera(respuestaReal());
    expect(html).toContain("<dt>preguntas en el archivo</dt><dd>26</dd>");
    expect(html).toContain("<dt>con resumen numérico</dt><dd>3</dd>");
    expect(html).toMatch(/<dt>base codificada<\/dt><dd><a href="[^"]*pestana=ponderacion[^"]*">Ponderada<\/a>/);
    expect(html).toContain('title="Porcentajes, N y estadísticos ponderados; los casos que respondieron, sin ponderar. n efectivo: 499."');
    expect(html).not.toContain("Tamaño efectivo");
    expect(cabecera(respuestaSinPesos())).toContain(">Sin ponderar<");
    expect(cabecera({ ...respuestaSinPesos(), fuente: "originales" })).toContain("<dt>base cargada</dt>");
    // El orden del prototipo: preguntas, resumen numérico y pesos.
    expect(html.indexOf("preguntas en el archivo")).toBeLessThan(html.indexOf("con resumen numérico"));
    expect(html.indexOf("con resumen numérico")).toBeLessThan(html.indexOf("base codificada"));
  });

  it("mientras se lee no afirma cifras del archivo", () => {
    const html = cabecera(null);
    expect(html).toContain("<dt>preguntas en el archivo</dt><dd>Leyendo</dd>");
    expect(html).toMatch(/<dt>pesos<\/dt><dd><a [^>]*>Leyendo<\/a><\/dd>/);
  });

  it("con dos bases la cifra de preguntas dice que son de esta base", () => {
    expect(cabecera(respuestaDosBases())).toContain("preguntas de esta base");
    expect(cabecera(respuestaDosBases())).not.toContain("preguntas en el archivo");
  });

  it("no muestra la fuente cruda ni el sello con sus comillas angulares", () => {
    const html = cabecera(respuestaReal());
    expect(html).not.toContain("adaptados");
    expect(html).not.toMatch(/[«»]/);
    expect(html).not.toContain("Resultados ponderados por la columna");
  });

  it("no repite lo que ya dicen los ajustes", () => {
    const html = cabecera(respuestaReal());
    for (const delPanel of ["Orden", "Formulario", "Mayor a menor", "Todas las opciones"]) {
      expect(html, delPanel).not.toContain(delPanel);
    }
  });
});
