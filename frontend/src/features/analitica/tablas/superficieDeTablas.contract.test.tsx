import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { FrecuenciasPreview, FrecuenciasPreviewTabla } from "../../../api/analitica";
import { cajasDeLaHoja } from "../../../test/cajasPropias";
import { BandaDeFrecuencias } from "./BandaDeFrecuencias";
import { respuestaDosBases, respuestaReal, respuestaSinPesos, tablaReal } from "./ejemploDeVistaPrevia.test-util";
import { HojaDeFrecuencias } from "./HojaDeFrecuencias";
import { MarcoDeTablas } from "./MarcoDeTablas";
import { PanelDeZona } from "./PanelDeZona";
import type { Lectura } from "./useLecturaPorBase";

/**
 * Contrato de la superficie de tablas de Analítica (etapa P5b del rediseño de
 * Procesamiento): el marco de tres zonas que usa Frecuencias y usará Cruces.
 *
 * Lo que la composición promete y ninguna prueba de modelo ve: que el marco
 * declara su geometría (C1) con el nombre de la pestaña, que cada contenedor
 * tiene dueño de su vacío, que la hoja conserva su cabecera con cero, una y
 * muchas variables (C2), que la categoría se lee por su etiqueta con el código
 * como dato secundario, que la banda no repite lo que ya dicen los paneles y
 * que las cifras de la hoja son las del servicio, sin un espejo de sus reglas.
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

describe("marco de tres zonas", () => {
  const marco = (pestana: string) => renderToStaticMarkup(createElement(MarcoDeTablas, {
    pestana,
    banda: createElement("i", { id: "banda" }),
    tabla: createElement("i", { id: "tabla" }),
    ajustes: createElement("i", { id: "ajustes" }),
    archivo: createElement("i", { id: "archivo" }),
  }));

  it("C1: la mesa declara grupo y contrato con el nombre de la pestaña", () => {
    expect(marco("frecuencias")).toMatch(/data-qa-geometry-group="analitica\/frecuencias-mesa" data-qa-geometry-contract="intrinsic"/);
    expect(marco("cruces")).toContain('data-qa-geometry-group="analitica/cruces-mesa"');
  });

  it("la tabla y los ajustes van dentro de la mesa; la banda antes y el archivo después, fuera de ella", () => {
    const html = marco("frecuencias");
    const mesa = html.slice(html.indexOf('class="tablas-mesa"'), html.indexOf('id="archivo"'));
    expect(mesa).toContain('id="tabla"');
    expect(mesa).toContain('id="ajustes"');
    expect(mesa.indexOf('id="tabla"')).toBeLessThan(mesa.indexOf('id="ajustes"'));
    expect(html.indexOf('id="banda"')).toBeLessThan(html.indexOf('class="tablas-mesa"'));
    expect(mesa).not.toContain('id="banda"');
    // El archivo cierra el marco: es hermano de la mesa, no uno de sus contenedores.
    expect(html).toMatch(/<i id="archivo"><\/i><\/div><\/div>$/);
  });

  it("C3 y C4: el cuerpo de cada contenedor es dueño del vacío y una región con nombre que se desplaza con el teclado", () => {
    const zona = (ocupado: boolean) => renderToStaticMarkup(createElement(PanelDeZona, {
      zona: "tabla", titulo: "Vista previa", icono: null, ocupado, grupo: "analitica/x", pie: "nota al pie", children: "contenido",
    }));
    const html = zona(false);
    expect(html).toContain('data-qa-geometry-capacity="owned"');
    expect(html).toContain('data-qa-geometry-group="analitica/x"');
    expect(html).toMatch(/role="region" aria-label="Vista previa" tabindex="0"/);
    expect(html).not.toContain("aria-busy");
    expect(zona(true)).toContain('aria-busy="true"');
    // La cabecera y el pie quedan fuera del cuerpo que se desplaza.
    const cuerpo = html.slice(html.indexOf("tablas-panel-cuerpo"), html.indexOf("tablas-panel-pie"));
    expect(cuerpo).toContain("contenido");
    expect(cuerpo).not.toContain("pulso-panel-title");
    expect(html.indexOf("pulso-panel-title")).toBeLessThan(html.indexOf("tablas-panel-cuerpo"));
  });
});

const tablas = () => respuestaReal().tablas;
const conTablas = (lista: FrecuenciasPreviewTabla[]) => lista;
const muchas = () => Array.from({ length: 40 }, (_, i) => ({ ...tablas()[1], variable: `p${i}` }));

describe("hoja de frecuencias", () => {
  const hoja = (lista: FrecuenciasPreviewTabla[], extra: Partial<Parameters<typeof HojaDeFrecuencias>[0]> = {}) =>
    renderToStaticMarkup(createElement(HojaDeFrecuencias, { tablas: lista, elegida: null, ponderado: true, ...extra }));
  const cabeceras = (html: string) => html.match(/role="columnheader"/g)?.length ?? 0;
  const grupos = (html: string) => html.match(/class="tablas-grupo"/g)?.length ?? 0;
  const grupo = (html: string, variable: string) => {
    const desde = html.indexOf(`data-variable="${variable}"`);
    const hasta = html.indexOf('class="tablas-grupo"', desde);
    return html.slice(desde, hasta < 0 ? undefined : hasta);
  };

  it("C2: la cabecera de columnas es la misma con cero, una y muchas tablas", () => {
    expect(cabeceras(hoja([]))).toBe(4);
    expect(cabeceras(hoja(conTablas([tablas()[1]])))).toBe(4);
    expect(cabeceras(hoja(muchas()))).toBe(4);
    expect(grupos(hoja([]))).toBe(0);
    expect(grupos(hoja(muchas()))).toBe(40);
  });

  it("cada categoría se lee por su etiqueta, con el código delante y como llave de la fila", () => {
    const html = hoja(tablas());
    expect(html).toMatch(/<div class="tablas-fila" role="row" data-categoria="1"><span class="tablas-categoria" role="rowheader"><code class="tablas-codigo"[^>]*>1<\/code>Trabaja en empleo formal/);
    // Los códigos especiales llevan su marca.
    expect(html).toMatch(/class="tablas-fila is-especial" role="row" data-categoria="99"/);
  });

  it("una fila sin código no lo inventa: solo su etiqueta", () => {
    const html = hoja(respuestaSinPesos().tablas);
    expect(html).toContain('<div class="tablas-fila" role="row"><span class="tablas-categoria" role="rowheader">No trabaja actualmente, pero está buscando trabajo</span>');
  });

  it("casos enteros y porcentajes con dos decimales, como el archivo, celda por celda", () => {
    // Respuesta real con pesos: la fila 1 de M4_employment trae n 558.1145... y pct 0.4350074...
    const empleo = grupo(hoja(tablas()), "M4_employment");
    const celdas = Array.from(empleo.matchAll(/data-categoria="(\w+)"[\s\S]*?<span class="tablas-cifra" role="cell">([^<]*)<\/span><span class="tablas-cifra is-porcentaje" role="cell">([^<]*)</g))
      .map((m) => [m[1], m[2], m[3]]);
    expect(celdas).toEqual([
      ["1", "558", "43.50"], ["2", "350", "27.30"], ["3", "71", "5.52"], ["4", "241", "18.80"], ["98", "4", "0.34"], ["99", "58", "4.55"],
    ]);
    expect(empleo).toContain('<span class="tablas-categoria" role="rowheader">Total</span><span role="cell" aria-hidden="true"></span><span class="tablas-cifra" role="cell">1,283</span><span class="tablas-cifra is-porcentaje" role="cell">100.00</span>');
    expect(empleo).toContain("Respondieron 1,283 de 1,283 casos (100.0 %)");
    expect(empleo).toContain("<span>Fuente: Pulso PUCP.</span>");
  });

  it("una suma de pesos de 1.75 se lee 2 y una proporción de 0.17303 se lee 17.30", () => {
    const t: FrecuenciasPreviewTabla = {
      ...tablaReal("M5_district", false),
      filas: [{ codigo: "smp", etiqueta: "SMP", n: 1.75, pct: 0.17303, especial: false }],
    };
    const html = hoja([t]);
    expect(html).toContain('<span class="tablas-cifra" role="cell">2</span><span class="tablas-cifra is-porcentaje" role="cell">17.30</span>');
  });

  it("los porcentajes y el total son los del servicio: no se recalculan desde los casos", () => {
    // Una respuesta donde ninguna cifra cuadra con la aritmética del frontend:
    // 10 de 32 sería 31.25 (no 31.30) y 20 de 32, 62.50 (no 68.75); la suma de
    // las filas es 30, no el total 32.
    const t: FrecuenciasPreviewTabla = {
      ...tablas()[2],
      variable: "x",
      filas: [
        { codigo: "1", etiqueta: "Radio", n: 10, pct: 0.3125, especial: false },
        { codigo: "2", etiqueta: "Televisión", n: 20, pct: 0.6875, especial: false },
      ],
      total: { n: 32, pct: 1 },
      base: { n: 32, de: 64, denominador: "marcaron_alguna_opcion" },
    };
    const html = hoja([t]);
    expect(html).toContain('role="cell">31.25</span>');
    expect(html).toContain('role="cell">68.75</span>');
    expect(html).not.toContain('role="cell">62.50</span>');
    expect(html).toContain('<span class="tablas-cifra" role="cell">32</span>');
    expect(html).not.toContain('role="cell">30</span>');
    expect(html).toContain("--tablas-barra:31.25%");
  });

  it("la múltiple: sus porcentajes suman más de 100, su Total dice quiénes son y su base va en casos", () => {
    const medios = grupo(hoja(tablas()), "D1_information");
    const pcts = Array.from(medios.matchAll(/class="tablas-cifra is-porcentaje" role="cell">([\d.]+)</g)).map((m) => m[1]);
    // Nueve opciones y el total, con dos decimales.
    expect(pcts).toEqual(["65.32", "30.28", "4.13", "11.89", "7.18", "6.97", "18.16", "9.57", "5.59", "100.00"]);
    expect(pcts.slice(0, 9).reduce((a, b) => a + Number(b), 0)).toBeGreaterThan(100);
    expect(medios).toContain('<span class="tablas-categoria" role="rowheader">Total (marcaron alguna opción)</span>');
    expect(medios).toContain('role="cell">575</span>');
    expect(medios).toContain("Marcaron alguna opción 560 de 1,283 casos (43.6 %)");
    expect(medios).toContain('data-forma="multiple"');
    // En la única el Total es solo "Total".
    expect(grupo(hoja(tablas()), "M4_employment")).toContain('role="rowheader">Total</span>');
  });

  it("la numérica: sus ocho estadísticos tal como vienen, sin columnas de porcentaje", () => {
    const edad = grupo(hoja(tablas()), "E1_age");
    const estadisticos = Array.from(edad.matchAll(/<dt>([^<]+)<\/dt><dd>([^<]+)<\/dd>/g)).map((m) => [m[1], m[2]]);
    // "Casos válidos" sale una sola vez: en su celda, con la base debajo; la cabecera no repite el conteo.
    expect(edad).toContain('<dd class="tablas-resumen-base">de 1,283 casos (100.0 %)</dd>');
    expect(edad.match(/1,283/g)).toHaveLength(2);
    expect(edad).not.toContain("pulso-bloque-pregunta-detalle");
    expect(estadisticos).toEqual([
      ["Casos válidos", "1,283"], ["Promedio", "47.8"], ["Desviación estándar", "16.3"], ["Mínimo", "18.0"],
      ["Percentil 25", "35.0"], ["Mediana (Percentil 50)", "46.0"], ["Percentil 75", "59.0"], ["Máximo", "91.0"],
    ]);
    expect(edad).not.toContain("is-porcentaje");
    expect(edad).not.toContain(">Total<");
  });

  it("la cabecera dice N ponderado con pesos y Casos sin ellos; nada llama casos a una suma de pesos", () => {
    const con = hoja(tablas(), { ponderado: true });
    expect(con).toContain('role="columnheader">N ponderado</span>');
    expect(con).not.toContain("casos ponderados");
    expect(con).not.toContain(">Casos<");
    // Con pesos, "casos" solo aparece en las bases, que son conteos sin ponderar.
    const conCasos = Array.from(con.matchAll(/[^>]*\bcasos?\b[^<]*/g)).map((m) => m[0]);
    expect(conCasos.every((t) => /^(Respondieron|Marcaron alguna opción) [\d,]+ de [\d,]+ casos? \([\d.]+ %\)$|^de [\d,]+ casos? \([\d.]+ %\)$|^Casos válidos$/.test(t))).toBe(true);
    expect(hoja(respuestaSinPesos().tablas, { ponderado: false })).toContain('role="columnheader">Casos</span>');
  });

  it("sin pesos, las dos frases de base nuevas", () => {
    const html = hoja(respuestaSinPesos().tablas, { ponderado: false });
    expect(html).toContain("Respondió el 100.0 % de los 1,283 casos");
    expect(html).toContain("Marcó alguna opción el 43.6 % de los 1,283 casos");
  });

  it("el código especial atenúa su rótulo y su porcentaje sigue como los demás", () => {
    const html = grupo(hoja(tablas()), "M4_employment");
    expect(html).toMatch(/class="tablas-fila is-especial" role="row" data-categoria="98"/);
    const css = leer(path.join(aqui, "tablas.css"));
    expect(css).toMatch(/\.tablas-fila\.is-especial > \.tablas-categoria \{/);
    expect(css).not.toMatch(/\.is-especial[^{]*is-porcentaje/);
    expect(css).not.toMatch(/\.is-especial[^{]*tablas-barra/);
  });

  it("una variable que sale en dos secciones no repite clave de React", () => {
    const [, empleo, medios] = tablas();
    const otra = { ...empleo, seccion: { nombre: "Otra sección", rotulo: null } };
    const errores: unknown[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => { errores.push(args.join(" ")); };
    try {
      renderToStaticMarkup(createElement(HojaDeFrecuencias, { tablas: [empleo, medios, otra, { ...otra }], elegida: null, ponderado: true }));
    } finally {
      console.error = original;
    }
    expect(errores.filter((e) => String(e).includes("same key"))).toEqual([]);
  });

  it("una tabla sin datos lo dice y no pinta filas ni total", () => {
    const vacia: FrecuenciasPreviewTabla = { ...tablas()[1], sin_datos: true, filas: [], total: { n: 0, pct: null }, notas: [] };
    const html = hoja([vacia]);
    expect(html).toContain(">Sin datos<");
    expect(html).not.toContain("tablas-total");
  });

  it("la fila de sección sigue a las tablas y se marca cuando el archivo la escribe", () => {
    expect(hoja(tablas()).match(/class="tablas-seccion-de-hoja"/g)).toHaveLength(2);
    expect(hoja(tablas())).not.toContain("data-en-archivo");
    const conRotulo = tablas().map((t) => ({ ...t, seccion: { ...t.seccion, rotulo: t.seccion.nombre.toUpperCase() } }));
    const html = hoja(conRotulo);
    expect(html).toContain('class="tablas-seccion-de-hoja" role="rowgroup" data-en-archivo=""');
    // Se lee en castellano normal, no en las mayúsculas del archivo.
    expect(html).toContain(">Datos Generales<");
    expect(html).not.toContain("DATOS GENERALES");
  });

  it("es una tabla para quien la lee con lector de pantalla: tabla, grupos por variable, filas y celdas", () => {
    const html = hoja(tablas());
    expect(html).toMatch(/^<div class="tablas-hoja" role="table" aria-label="Tablas de frecuencias del archivo">/);
    expect(html).toContain('role="rowgroup" aria-label="¿Cuál describe mejor su situación laboral actual?" data-variable="M4_employment"');
    const fila = html.slice(html.indexOf('data-categoria="1"'), html.indexOf('data-categoria="2"'));
    expect(fila.match(/role="rowheader"/g)).toHaveLength(1);
    expect(fila.match(/role="cell"/g)).toHaveLength(3);
    expect(html).not.toMatch(/<table[\s>]/);
  });

  it("la pregunta elegida se marca, también por su nombre original, y la pedida aparte va al final", () => {
    expect(hoja(tablas())).not.toContain("aria-current");
    expect(hoja(tablas(), { elegida: "D1_information" })).toMatch(/data-variable="D1_information" data-forma="multiple" aria-current="true"/);
    const recod = [{ ...tablas()[1], variable: "M4_employment_recod", variable_origen: "M4_employment" }];
    expect(hoja(recod, { elegida: "M4_employment" })).toContain('aria-current="true"');
    const aparte = { ...tablas()[1], variable: "q99", etiqueta: "Ingresos del hogar" };
    const html = hoja(tablas(), { elegida: "q99", aparte });
    expect(html.indexOf(">Pregunta elegida<")).toBeGreaterThan(html.indexOf('data-variable="D1_information"'));
    expect(html).toMatch(/data-variable="q99" data-forma="unica" aria-current="true"/);
  });

  it("lo que se relee se anuncia como ocupado", () => {
    expect(hoja(tablas())).not.toContain("data-releyendo");
    const releyendo = hoja(tablas(), { releyendo: true });
    expect(releyendo).toContain('aria-busy="true"');
    expect(releyendo).toContain('data-releyendo=""');
  });
});

describe("banda de Frecuencias", () => {
  const lectura = (datos: FrecuenciasPreview | null): Lectura<FrecuenciasPreview> =>
    ({ fase: datos ? "lista" : "leyendo", datos, causa: "", codigo: "", reintentar: () => undefined });
  const banda = (datos: FrecuenciasPreview | null) => renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: ["/analitica?pestana=frecuencias"] },
    createElement(BandaDeFrecuencias, {
      vistaPrevia: lectura(datos), resumen: { modo: "declaradas", activas: 8 }, seccionesDeclaradas: 9, excluidas: 5,
    })));

  it("cada cifra con su base, y enlazada a donde se decide", () => {
    const html = banda(respuestaReal());
    expect(html).toContain("Tablas en el archivo");
    expect(html).toContain(">26<");
    expect(html).toContain("8 de 9 visibles");
    expect(html).toMatch(/href="\/analitica\?pestana=frecuencias&amp;panel=excluidas">5<\/a>/);
    expect(html).toMatch(/pestana=ponderacion[^>]*>Con ponderación<\/a>/);
    expect(html).toContain('title="Porcentajes, N y estadísticos ponderados; los casos que respondieron, sin ponderar. n efectivo: 499."');
    expect(html).not.toContain("Tamaño efectivo");
    expect(html).toMatch(/Datos<\/span>[^]*>Base codificada</);
    expect(banda(respuestaSinPesos())).toContain("Sin ponderación");
    expect(banda({ ...respuestaSinPesos(), fuente: "originales" })).toContain(">Base cargada<");
  });

  it("con dos bases la cifra de tablas dice que son de esta base", () => {
    expect(banda(respuestaDosBases())).toContain("Tablas de esta base");
    expect(banda(respuestaDosBases())).not.toContain("Tablas en el archivo");
  });

  it("no muestra la fuente cruda ni el sello con sus comillas angulares", () => {
    const html = banda(respuestaReal());
    expect(html).not.toContain("adaptados");
    expect(html).not.toMatch(/[«»]/);
    expect(html).not.toContain("Resultados ponderados por la columna");
  });

  it("no repite lo que ya dice el panel de ajustes", () => {
    const html = banda(respuestaReal());
    for (const delPanel of ["Orden", "Formulario", "Mayor a menor", "Todas las opciones", "resumen numérico"]) {
      expect(html, delPanel).not.toContain(delPanel);
    }
  });
});
