import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Remates de Frecuencias y Cruces que el QA confirmó en la app (11 nov 2026,
 * QA_REMATES_FIDELIDAD parte B). Son reglas de hoja: happy-dom no maqueta, y
 * las medidas se tomaron en pantalla con el arnés (oleada19-A/sonda*.mjs).
 *
 *  - La cifra del Total de Cruces salía 11 px de su celda en las filas con
 *    barra, en los tres tamaños: el ancho de la barra era un porcentaje de la
 *    línea que también contiene la cifra.
 *  - 10 de 26 preguntas ocupaban 3 o 4 líneas en la lista a 1440.
 *  - A 1024, la columna de Archivo quedaba vacía mientras duraban los ajustes.
 */

const aqui = path.dirname(fileURLToPath(import.meta.url));
const leer = (rel: string) => readFileSync(path.join(aqui, rel), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

/** Las declaraciones de las reglas cuyo selector es exactamente ese, en cualquier nivel. */
function reglas(css: string, selector: string): string {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, sel]) => sel.split(",").map((s) => s.trim()).includes(selector))
    .map(([, , cuerpo]) => cuerpo)
    .join("\n");
}

const tablas = leer("tablas.css");
const cruces = leer("../cruces/cruces.css");

describe("remates de Frecuencias y Cruces", () => {
  it("la barra del Total se mide sobre una pista fija, no sobre la línea que lleva la cifra", () => {
    expect(reglas(cruces, ".cruces-linea:has(> .cruces-barra)")).toMatch(/grid-template-columns\s*:\s*\d+px\s+auto/);
    const barra = reglas(cruces, ".cruces-barra");
    expect(barra).toMatch(/inline-size\s*:\s*var\(--cruces-barra/);
    // El defecto: un porcentaje de la línea escalado, que crece con su propio contenido.
    expect(barra).not.toMatch(/calc\(var\(--cruces-barra[^)]*\)\s*\*/);
  });

  it("la pregunta de la lista ocupa dos líneas como máximo", () => {
    expect(reglas(tablas, ".tablas-pregunta-etiqueta")).toMatch(/-webkit-line-clamp\s*:\s*2/);
  });

  it("a lo angosto, ajustes y archivo van uno debajo del otro: sin columna vacía junto a los ajustes", () => {
    const lateral = reglas(tablas, ".tablas-lateral");
    expect(lateral).not.toMatch(/grid-template-columns/);
    expect(tablas).not.toMatch(/minmax\(0,\s*300px\)/);
  });
});
