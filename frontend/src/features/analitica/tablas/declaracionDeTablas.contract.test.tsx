// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { respuestaSinPesos as crucesSinPesos } from "../cruces/ejemploDeCruces.test-util";
import { HojaDeCruces } from "../cruces/HojaDeCruces";
import { respuestaReal } from "./ejemploDeVistaPrevia.test-util";
import { HojaDeFrecuencias } from "./HojaDeFrecuencias";
import { PieDeLaHoja } from "./PieDeLaHoja";

/**
 * C1 del kit de tablas de Analítica (Frecuencias y Cruces). El QA de Cruces
 * contó 537 colecciones sin declarar: filas, celdas y cabeceras de las
 * rejillas con roles de tabla, la hoja de Cruces con sus secciones, los chips
 * de categorías y la lista de avisos.
 *
 * La gramática excluye las tablas de la inferencia de colecciones, pero el
 * runner reconoce `<table>` y no `role="table"`. La declaración va en el
 * contenedor, una vez por tabla y nunca por fila o celda: la rejilla se
 * declara como grupo (su marco sí se mide) y como tabla exenta de la inferencia
 * (`data-qa-geometry-exento`, el mecanismo que el runner ya tiene). Lo que no
 * es tabla (la hoja de Cruces, los avisos, las categorías) declara su grupo.
 */

const aqui = path.dirname(fileURLToPath(import.meta.url));

/** Las etiquetas de apertura que llevan ese atributo y valor. */
const etiquetas = (html: string, atributo: string) => html.match(new RegExp(`<[a-z]+[^>]*\\b${atributo}="[^"]*"[^>]*>`, "g")) ?? [];
const conRol = (html: string, rol: string) => (html.match(/<[a-z]+[^>]*>/g) ?? []).filter((t) => t.includes(`role="${rol}"`));

/** Una tabla con roles bien declarada: grupo, contrato y exención en la misma etiqueta. */
const tablaDeclarada = (etiqueta: string) =>
  /data-qa-geometry-group="analitica\/[^"]+"/.test(etiqueta)
  && /data-qa-geometry-contract="intrinsic"/.test(etiqueta)
  && /data-qa-geometry-exento="[^"]+"/.test(etiqueta);

describe("C1 de las tablas de Analítica", () => {
  const frecuencias = respuestaReal().tablas
    .map((tabla) => renderToStaticMarkup(createElement(HojaDeFrecuencias, { tabla, ponderado: true })))
    .join("");
  const cruces = crucesSinPesos().tablas
    .map((tabla) => renderToStaticMarkup(createElement(HojaDeCruces, { tabla, ponderado: false })))
    .join("");

  it("cada rejilla con roles de tabla declara grupo y exención en su contenedor", () => {
    const tablas = [...conRol(frecuencias, "table"), ...conRol(cruces, "table")];
    expect(tablas.length).toBeGreaterThanOrEqual(3);
    expect(tablas.filter((t) => !tablaDeclarada(t))).toEqual([]);
  });

  it("ninguna fila ni celda lleva su propia declaración", () => {
    for (const html of [frecuencias, cruces]) {
      for (const rol of ["row", "rowgroup", "cell", "columnheader", "rowheader"]) {
        expect(conRol(html, rol).filter((t) => t.includes("data-qa-geometry"))).toEqual([]);
      }
    }
  });

  it("la hoja de Cruces declara su tabla y su leyenda como grupo", () => {
    const hoja = etiquetas(cruces, "data-qa-geometry-group").find((t) => t.includes('class="cruces-hoja"'));
    expect(hoja).toMatch(/data-qa-geometry-group="analitica\/cruces-hoja" data-qa-geometry-contract="intrinsic"/);
  });

  it("la lista de avisos del pie declara su grupo", () => {
    const pie = renderToStaticMarkup(createElement(PieDeLaHoja, { recorte: null, lineas: [{ clave: "a", alerta: true, texto: "Uno" }, { clave: "b", alerta: false, texto: "Dos" }] }));
    expect(pie).toMatch(/<ul class="tablas-avisos"[^>]*data-qa-geometry-group="analitica\/tablas-avisos" data-qa-geometry-contract="intrinsic"/);
  });

  it("el resumen de la numérica declara sus celdas como pares", () => {
    expect(frecuencias).toMatch(/<dl class="tablas-resumen-rejilla" data-qa-geometry-group="analitica\/frecuencias-resumen" data-qa-geometry-contract="equal">/);
  });

  it("las categorías de una variable de cruce declaran su grupo", () => {
    const fuente = readFileSync(path.join(aqui, "..", "cruces", "CategoriasDeCruce.tsx"), "utf8");
    expect(fuente).toMatch(/className="cruces-categorias"[^>]*data-qa-geometry-group="analitica\/cruces-categorias"[^>]*data-qa-geometry-contract="intrinsic"/);
  });

  it("el detector distingue una tabla declarada de una que no", () => {
    expect(tablaDeclarada('<div role="table" data-qa-geometry-group="analitica/x" data-qa-geometry-contract="intrinsic" data-qa-geometry-exento="tabla">')).toBe(true);
    expect(tablaDeclarada('<div role="table" data-qa-geometry-group="analitica/x" data-qa-geometry-contract="intrinsic">')).toBe(false);
    expect(tablaDeclarada('<div role="table">')).toBe(false);
  });
});
