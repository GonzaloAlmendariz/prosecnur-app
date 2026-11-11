import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * La mesa de tablas a lo angosto (C4 del Contrato de Superficie, regla No
 * Scroll Jail). Bajo 960 px de superficie (1024 de ventana) la lista
 * "Preguntas" medía 207 px con su propio scroll dentro de la pestaña, y para
 * bajar a los ajustes con la rueda sobre ella había que agotar 2,526 px de
 * lista (QA de fidelidad, 11 nov 2026). Ahora la lista se recoge en un selector
 * en la cabecera de la tabla y la tabla mide su contenido: la pestaña es el
 * único dueño del scroll vertical. Cruces conserva el scroll a lo ancho.
 *
 * Es una prueba sobre la hoja porque happy-dom no maqueta; las medidas se
 * tomaron en pantalla a 1024x600.
 */

const aqui = path.dirname(fileURLToPath(import.meta.url));
const leer = (rel: string) => readFileSync(path.join(aqui, rel), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

/** El cuerpo del primer bloque `@container` que empieza con esa cabecera. */
function bloque(css: string, cabecera: string): string {
  const inicio = css.indexOf(cabecera);
  if (inicio < 0) return "";
  const abre = css.indexOf("{", inicio);
  let nivel = 0;
  for (let i = abre; i < css.length; i += 1) {
    if (css[i] === "{") nivel += 1;
    if (css[i] === "}") nivel -= 1;
    if (nivel === 0) return css.slice(abre + 1, i);
  }
  return "";
}

/** Las declaraciones de las reglas cuyo selector es exactamente ese. */
function reglas(css: string, selector: string): string {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, sel]) => sel.split(",").map((s) => s.trim()).includes(selector))
    .map(([, , cuerpo]) => cuerpo)
    .join("\n");
}

const ANGOSTA = "@container tablas-superficie (max-width: 959px)";
const tablas = bloque(leer("tablas.css"), ANGOSTA);
// Cruces ya no tiene reglas angostas propias: se revisa la hoja entera.
const cruces = leer("../cruces/cruces.css");

describe("mesa de tablas a lo angosto", () => {
  it("el régimen angosto existe y las reglas de Cruces se leen (centinelas)", () => {
    expect(tablas).toContain(".tablas-mesa");
    expect(reglas(cruces, ".cruces-cabecera")).toMatch(/position\s*:\s*sticky/);
  });

  it("la lista se recoge en el selector: el panel de preguntas no se ve y el selector sí", () => {
    // Con la especificidad de `.tablas-superficie .pulso-panel.tablas-panel` (display: flex): con menos, no se oculta.
    expect(reglas(tablas, ".tablas-superficie .pulso-panel.tablas-panel--preguntas")).toMatch(/display\s*:\s*none/);
    expect(reglas(tablas, ".tablas-ir-a")).toMatch(/display\s*:\s*block/);
    // A lo ancho el selector no se ve: manda la lista.
    const ancha = leer("tablas.css").replace(`${ANGOSTA} {${tablas}}`, "");
    expect(ancha).not.toContain(ANGOSTA);
    expect(reglas(ancha, ".tablas-ir-a")).toMatch(/display\s*:\s*none/);
    expect(reglas(ancha, ".tablas-ir-a")).not.toMatch(/display\s*:\s*block/);
  });

  it("la tabla mide su contenido y no abre un scroll vertical propio: la pestaña es el único dueño", () => {
    expect(reglas(tablas, ".tablas-panel--tabla")).toMatch(/(^|[\s;])block-size\s*:\s*auto/);
    expect(reglas(tablas, ".tablas-panel--tabla .tablas-panel-cuerpo")).toMatch(/overflow-y\s*:\s*visible/);
    expect(reglas(tablas, ".tablas-panel--tabla .tablas-panel-cuerpo")).not.toMatch(/overscroll-behavior\s*:\s*contain/);
    // Ningún panel de la mesa queda con un alto acotado que encadene scrolls.
    expect(tablas).not.toMatch(/block-size\s*:\s*clamp\(/);
  });

  it("Cruces conserva el scroll a lo ancho en su cuerpo; la vista no abre un segundo", () => {
    expect(reglas(tablas, '.tablas-superficie[data-tablas="cruces"] .tablas-panel--tabla .tablas-panel-cuerpo')).toMatch(/overflow-x\s*:\s*auto/);
    expect(reglas(cruces, '.tablas-superficie[data-tablas="cruces"] .cruces-vista')).not.toMatch(/overflow/);
    expect(reglas(cruces, ".cruces-vista")).not.toMatch(/overflow/);
  });
});
