import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * La mesa de tablas a lo angosto (C4 del Contrato de Superficie). Bajo 960 px
 * de superficie la mesa pasa a una columna. Antes, la vista previa soltaba su
 * scroll y medía lo que todas sus tablas: a 1024x600 "Ajustes del archivo"
 * quedaba a 8,400 px en Frecuencias y a 8,800 en Cruces, detrás de la hoja
 * entera. Ahora la vista previa conserva su alto acotado y su scroll (en los
 * dos ejes, con la cabecera de columnas pegada arriba, igual que a lo ancho) y
 * los ajustes quedan justo debajo, en el desplazamiento de la pestaña.
 *
 * Es una prueba sobre la hoja porque happy-dom no maqueta; la posición de los
 * ajustes se midió en pantalla a 1024x600.
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

  it("la vista previa tiene un alto acotado y su cuerpo conserva el scroll", () => {
    // `block-size` propio, no `min-block-size` ni `max-block-size`.
    expect(reglas(tablas, ".tablas-panel--tabla")).toMatch(/(^|[\s;])block-size\s*:\s*clamp\(/);
    // Ninguna regla angosta suelta el scroll del cuerpo de la vista previa.
    expect(reglas(tablas, ".tablas-panel-cuerpo")).not.toMatch(/overflow\s*:\s*visible/);
    expect(reglas(tablas, ".tablas-panel--tabla .tablas-panel-cuerpo")).not.toMatch(/overflow\s*:\s*visible/);
  });

  it("la cabecera de columnas sigue pegada arriba dentro de la vista previa", () => {
    expect(reglas(tablas, ".tablas-hoja-cabecera")).not.toMatch(/position\s*:\s*static/);
    expect(reglas(cruces, ".cruces-cabecera")).not.toMatch(/position\s*:\s*static/);
  });

  it("un solo dueño del scroll de Cruces: la vista no abre un segundo a lo ancho", () => {
    expect(reglas(cruces, '.tablas-superficie[data-tablas="cruces"] .cruces-vista')).not.toMatch(/overflow/);
    expect(reglas(cruces, ".cruces-vista")).not.toMatch(/overflow/);
  });
});
