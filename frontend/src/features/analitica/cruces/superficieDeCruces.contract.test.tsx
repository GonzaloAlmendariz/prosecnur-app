// @vitest-environment happy-dom
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { CrucesPreviewTabla } from "../../../api/analitica";
import { cajasDeLaHoja } from "../../../test/cajasPropias";
import { TODAS_LAS_VARIABLES } from "./crucesModelo";
import { respuestaBaseHija, respuestaConPesos, respuestaSinPesos, tablaDe } from "./ejemploDeCruces.test-util";
import { HojaDeCruces } from "./HojaDeCruces";
import { TablaCruzada } from "./TablaCruzada";

/**
 * Contrato de la pantalla de Cruces (etapa P5c): lo que la composición promete
 * y ninguna prueba de modelo ve. Las cifras son las del servicio, cada celda
 * va con su fila por código, la cabecera dice N ponderado con pesos, la base
 * dice su unidad, "frente al resto" no pinta letra de columna, una fila no
 * probada se distingue de una sin diferencia y la superficie declara su
 * geometría sin tablas fuera del kit.
 */

const aqui = path.dirname(fileURLToPath(import.meta.url));
const fuentes = [
  ...readdirSync(aqui).filter((f) => /\.tsx?$/.test(f) && !/\.test(-util)?\.tsx?$/.test(f)).map((f) => path.join(aqui, f)),
  path.join(aqui, "..", "panes", "CrucesPane.tsx"),
];
const leer = (f: string) => readFileSync(f, "utf8");
const nombre = (f: string) => path.basename(f);

const tieneAcordeon = (fuente: string) => /<details\b|<summary\b|Collapsible/.test(fuente);
const tieneCasilla = (fuente: string) => /type=["']checkbox["']/.test(fuente);
const iconoFueraDelShim = (fuente: string) => /from ["']lucide-react["']/.test(fuente);
/** Calcular un porcentaje o un total en la pantalla: dividir un `n` o sumar celdas. */
const DIVIDE_UN_N = /(?:\.|\b)n\s*\/\s*\w|\/\s*(?:\w+\.)*n\b/g;
const recalcula = (fuente: string) => new RegExp(DIVIDE_UN_N.source).test(fuente) || /reduce\([^\n]*?\.(n|pct)\b/.test(fuente);

describe("Cruces: reglas de la casa", () => {
  it("el barrido ve las piezas (centinela)", () => {
    expect(fuentes.length).toBeGreaterThanOrEqual(12);
  });

  it("sin acordeones, sin casillas, con los íconos del shim y sin cajas propias", () => {
    expect(fuentes.filter((f) => tieneAcordeon(leer(f))).map(nombre)).toEqual([]);
    expect(fuentes.filter((f) => tieneCasilla(leer(f))).map(nombre)).toEqual([]);
    expect(fuentes.filter((f) => iconoFueraDelShim(leer(f))).map(nombre)).toEqual([]);
    expect(cajasDeLaHoja(leer(path.join(aqui, "cruces.css")))).toBe(0);
  });

  it("la pantalla no calcula porcentajes ni totales: solo la proporción de la línea de base", () => {
    const culpables = fuentes.filter((f) => recalcula(leer(f))).map(nombre);
    expect(culpables).toEqual(["crucesModelo.ts"]);
    // Una sola división: `n / de` de la línea de base.
    expect(leer(path.join(aqui, "crucesModelo.ts")).match(DIVIDE_UN_N)).toEqual(["n / d"]);
  });

  it("los detectores reconocen lo que prohíben", () => {
    expect(tieneAcordeon("<details open>")).toBe(true);
    expect(tieneCasilla('<input type="checkbox" />')).toBe(true);
    expect(iconoFueraDelShim('import { X } from "lucide-react";')).toBe(true);
    expect(recalcula("const pct = celda.n / columna.n;")).toBe(true);
    expect(recalcula("const total = celdas.reduce((s, c) => s + c.n, 0);")).toBe(true);
    expect(recalcula("porcentajeDeCelda(celda.pct)")).toBe(false);
  });

  it("CrucesPane compone y no pinta: sin marcado propio ni estado local, y más corto que antes", () => {
    const pane = leer(path.join(aqui, "..", "panes", "CrucesPane.tsx"));
    expect(pane).not.toMatch(/<(div|section|span|table|button|p)\b/);
    expect(pane).not.toMatch(/\buseState\b/);
    expect(pane.split("\n").length).toBeLessThan(180);
  });

  it("generar envía el pedido con el cuerpo vacío: la config viaja por el autosave", () => {
    const pane = leer(path.join(aqui, "..", "panes", "CrucesPane.tsx"));
    expect(pane).toMatch(/apiAnaliticaCruces\(\)/);
    expect(pane).not.toMatch(/apiAnaliticaCruces\([^)]/);
  });
});

const tabla = (t: CrucesPreviewTabla, extra: Partial<Parameters<typeof TablaCruzada>[0]> = {}) =>
  renderToStaticMarkup(createElement(TablaCruzada, { tabla: t, cruces: t.cruces, ponderado: false, elegida: false, notaComun: null, ...extra }));
const dom = (html: string) => {
  const d = document.createElement("div");
  d.innerHTML = html;
  return d;
};
/** El texto de las celdas de una fila de datos, por el código de su categoría. */
const fila = (html: string, codigo: string) =>
  Array.from(dom(html).querySelector(`[data-categoria="${codigo}"]`)?.querySelectorAll('[role="cell"]') ?? [])
    .map((c) => (c.textContent ?? "").replace(/\s+/g, " ").trim());

describe("la tabla cruzada pinta lo que el servicio entrega", () => {
  it("porcentajes con dos decimales y letras tal como llegan, celda por celda", () => {
    const t = tablaDe(respuestaSinPesos(), "D1_information");
    const html = tabla(t);
    // Total, seis distritos y tres columnas de sexo (Otro excluida).
    expect(fila(html, "1")).toEqual(["63.33", "65.83 e", "51.09", "76.09 BE", "74.19 BE", "43.04", "66.27 e", "63.57", "63.12", ""]);
    expect(fila(html, "4")[3]).toBe("35.87 ABDEF");
    // El Total sale del servicio: la pantalla no lo suma ni lo promedia.
    expect(fila(html, "96")).toEqual(["5.90", "4.17", "0.00", "7.61", "7.53", "8.86", "8.43", "5.81", "5.98", ""]);
  });

  it("no recalcula: con cifras que no cuadran pinta las del servicio", () => {
    const t = tablaDe(respuestaSinPesos(), "E6_impact");
    const col = t.cruces[0].columnas[0];
    // 1 de 3 sería 33.33; el servicio dice 50 % y manda. El Total tampoco es la suma de las columnas.
    col.celdas[0] = { ...col.celdas[0], n: 1, pct: 0.5 };
    col.n = 3;
    if (t.total) t.total.n = 999;
    const html = tabla(t, { cruces: [t.cruces[0]] });
    expect(fila(html, "1")[1]).toBe("50.00 .b");
    expect(dom(html).querySelector('.cruces-fila--n [data-columna="total"]')?.textContent).toBe("999");
    expect(dom(html).querySelector('.cruces-fila--n [data-columna="smp"]')?.textContent).toBe("3");
  });

  it("cada celda va con su fila por código, aunque lleguen en otro orden", () => {
    const t = tablaDe(respuestaSinPesos(), "D1_information");
    const antes = fila(tabla(t), "96");
    for (const c of t.cruces) for (const col of c.columnas) col.celdas.reverse();
    if (t.total) t.total.celdas.reverse();
    expect(fila(tabla(t), "96")).toEqual(antes);
  });

  it("una celda que falta no se rellena con la vecina", () => {
    const t = tablaDe(respuestaSinPesos(), "D1_information");
    t.cruces[0].columnas[0].celdas = t.cruces[0].columnas[0].celdas.filter((c) => c.fila !== "2");
    expect(fila(tabla(t), "2")[1]).toBe("Sin dato");
    expect(fila(tabla(t), "3")[1]).toBe(fila(tabla(tablaDe(respuestaSinPesos(), "D1_information")), "3")[1]);
  });

  it("sin pesos la fila de N es la base en su unidad y no hay otra fila de bases (es el mismo número)", () => {
    const html = tabla(tablaDe(respuestaSinPesos(), "D1_information"));
    expect(html).toContain('role="rowheader">Base (encuestados)</span>');
    expect(html).not.toContain(">Casos<");
    const hija = tablaDe(respuestaBaseHija(), "srv_satisfaccion");
    expect(tabla(hija)).toContain('role="rowheader">Base (registros)</span>');
    expect(tabla(tablaDe(respuestaBaseHija(), "conocimiento"))).toContain('role="rowheader">Base (encuestados)</span>');
    expect(html).not.toContain("N ponderado");
    expect(html).not.toContain("cruces-fila--base");
  });

  it("con pesos: N ponderado redondeado como el Excel y la base en encuestados sin ponderar", () => {
    const t = tablaDe(respuestaConPesos(), "D1_information");
    const html = tabla(t, { ponderado: true });
    expect(html).toContain('role="rowheader">N ponderado</span>');
    expect(html).not.toContain(">Casos<");
    // 540.79 de pesos se lee 541; 107.77 se lee 108; la base de esa columna son 120 encuestados.
    const d = dom(html);
    const de = (fila: string, columna: string) => d.querySelector(`.${fila} [data-columna="${columna}"]`)?.textContent;
    expect([de("cruces-fila--n", "total"), de("cruces-fila--n", "smp")]).toEqual(["541", "108"]);
    expect(d.querySelector(".cruces-fila--base [role=rowheader]")?.textContent).toBe("Base (encuestados)");
    expect([de("cruces-fila--base", "total"), de("cruces-fila--base", "smp")]).toEqual(["559", "120"]);
    // D4: con pesos la base va primero; D5: dice que el archivo no la trae.
    const pie = Array.from(d.querySelectorAll(".cruces-pie-cifras [role=row]")).map((r) => r.className);
    expect(pie[0]).toContain("cruces-fila--base");
    expect(pie[1]).toContain("cruces-fila--n");
    expect(d.querySelector(".cruces-fila--base [role=rowheader]")?.getAttribute("title")).toBe("La fila de base es de la vista previa; el archivo trae el N ponderado.");
  });

  it("la base de una tabla de una base hija dice registros", () => {
    const html = tabla(tablaDe(respuestaBaseHija(), "srv_satisfaccion"), { ponderado: true });
    expect(html).toContain("Respondió el 100.0 % de los 660 registros");
    expect(html).toContain("Base (registros)");
    // Ni el título ni la tabla llaman casos a los registros (las notas del motor van literales).
    const d = dom(html);
    expect(`${d.querySelector(".cruces-tabla-titulo")?.textContent} ${d.querySelector(".cruces-rejilla")?.textContent}`).not.toMatch(/\bcasos?\b/i);
  });

  it("frente al resto: sin letra de columna; con letras: la letra va bajo la categoría", () => {
    const t = tablaDe(respuestaBaseHija(), "conocimiento");
    const resto = tabla(t, { cruces: [t.cruces[1]] });
    expect(resto).not.toContain("cruces-letra\"");
    const conFlechas = { ...t, cruces: [{ ...t.cruces[1], columnas: t.cruces[1].columnas.map((c, i) => ({ ...c, celdas: c.celdas.map((x) => ({ ...x, letras: i === 1 ? "▲" : x.letras })) })) }] };
    expect(tabla(conFlechas)).toContain('<span class="cruces-letras" data-clase="flechas">▲</span>');
    expect(tabla(t, { cruces: [t.cruces[0]] })).toMatch(/Hasta 15 minutos<\/span><span class="cruces-letra">A<\/span>/);
  });

  it("R1: una columna excluida que la exclusión no vació lo dice; R3: un cruce descriptivo no muestra letra de columna", () => {
    const t = tablaDe(respuestaSinPesos(), "D1_information");
    const otro = t.cruces[1].columnas[2];
    t.cruces[1].columnas[2] = { ...otro, exclusion_aplicada: false };
    const d = dom(tabla(t));
    const marca = d.querySelector('.cruces-fila--categorias [data-columna="3"] .cruces-marca');
    expect(marca?.textContent).toBe("Excluida sin efecto");
    expect(marca?.getAttribute("title")).toBe("La base guarda otro valor que el excluido; la exclusión no quitó casos");
    expect(dom(tabla(tablaDe(respuestaSinPesos(), "D1_information"))).querySelector('[data-columna="3"] .cruces-marca')?.textContent).toBe("Excluida");
    const hija = tablaDe(respuestaBaseHija(), "srv_satisfaccion");
    const transporte = dom(tabla(hija, { cruces: [hija.cruces[1]] }));
    expect(transporte.querySelectorAll(".cruces-letra")).toHaveLength(0);
    const tiempo = dom(tabla(hija, { cruces: [hija.cruces[0]] }));
    expect(tiempo.querySelectorAll(".cruces-letra").length).toBeGreaterThan(0);
  });

  it("Q2: una tabla sin respuestas muestra su vacío y no una grilla de celdas vacías", () => {
    const base = tablaDe(respuestaSinPesos(), "E6_impact");
    const t = { ...base, sin_respuestas: true, base: { ...base.base, n: 0 } };
    const d = dom(tabla(t));
    expect(d.querySelector(".cruces-rejilla")).toBeNull();
    expect(d.querySelectorAll(".cruces-fila")).toHaveLength(0);
    expect(d.querySelector(".cruces-vacio-tabla")?.textContent).toBe("Nadie respondió esta pregunta: el archivo la escribe con ceros.");
    expect((d.textContent ?? "").split("Nadie respondió").length).toBe(2);
    expect(d.textContent).not.toContain("No se compara");
  });

  it("una fila no probada lo dice; una sin diferencia no lleva marca", () => {
    const d = dom(tabla(tablaDe(respuestaSinPesos(), "D1_information")));
    const otro = d.querySelector('[data-categoria="96"]');
    expect(otro?.getAttribute("data-probada")).toBe("no");
    expect(otro?.querySelector('[role="rowheader"]')?.textContent).toContain("No se compara");
    const radio = d.querySelector('[data-categoria="3"]');
    expect(radio?.textContent).not.toContain("No se compara");
    expect(radio?.hasAttribute("data-probada")).toBe(false);
  });

  it("la columna excluida se marca y no pierde su lugar", () => {
    const html = tabla(tablaDe(respuestaSinPesos(), "D1_information"));
    expect(html).toMatch(/data-columna="3" data-excluida=""[^>]*><span class="cruces-columna-etiqueta">Otro<\/span><span class="cruces-letra">C<\/span><span class="cruces-marca">Excluida<\/span>/);
  });

  it("es una tabla para quien la lee: cabecera de dos niveles, fila con su encabezado y celdas", () => {
    const t = tablaDe(respuestaSinPesos(), "D1_information");
    const html = tabla(t);
    expect(html).toContain(`role="table" aria-label="${t.etiqueta}"`);
    expect(html).toContain('role="columnheader" aria-colspan="6" style="grid-column:span 6" title="¿En qué distrito vive actualmente?"');
    const datos = dom(html).querySelector('[data-categoria="1"]');
    expect(datos?.querySelectorAll('[role="rowheader"]')).toHaveLength(1);
    expect(datos?.querySelectorAll('[role="cell"]')).toHaveLength(10);
    expect(dom(html).querySelectorAll('.cruces-cabecera [role="row"]')).toHaveLength(2);
    expect(html).not.toMatch(/<table[\s>]/);
  });
});

describe("la hoja", () => {
  const hoja = (cruce: string, ponderado = false) => renderToStaticMarkup(createElement(HojaDeCruces, {
    tablas: respuestaSinPesos().tablas, ponderado, cruce, elegida: null,
  }));

  it("mide la tabla más ancha con lo que se ve (el grupo C1 lo declara la vista que la contiene)", () => {
    expect(hoja("M5_district")).not.toContain("data-qa-geometry-group");
    expect(hoja("M5_district")).toContain("--cruces-max:7");
    expect(hoja("E2_sex")).toContain("--cruces-max:4");
    expect(hoja(TODAS_LAS_VARIABLES)).toContain("--cruces-max:10");
  });

  it("la leyenda de letras se dice una vez, al final, y no en cada tabla", () => {
    const d = dom(hoja("M5_district"));
    const nota = respuestaSinPesos().tablas[0].significancia?.nota ?? "";
    expect(nota.length).toBeGreaterThan(20);
    expect((d.textContent ?? "").split(nota)).toHaveLength(2);
    expect(d.querySelector(".cruces-leyenda")?.textContent).toContain(nota);
    expect(d.querySelector(".cruces-leyenda")?.textContent).toContain("Porcentajes por columna");
    expect(Array.from(d.querySelectorAll(".cruces-tabla")).some((t) => t.textContent?.includes(nota))).toBe(false);
    // Al final: arriba le quitaba la primera fila a una ventana de 768 de alto.
    expect(d.querySelector(".cruces-hoja")?.lastElementChild?.classList.contains("cruces-leyenda")).toBe(true);
  });
});
