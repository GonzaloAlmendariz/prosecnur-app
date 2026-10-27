/**
 * Avance › Cuotas del telefónico no comparte clases con otras hojas.
 *
 * Gonzalo, 2026-10-27, con el build: el chip «En curso» salía una letra por
 * línea y «RENDIMIENTO» partido. Acreditación declara `.mon-cuotas`,
 * `.mon-cuotas > *`, `.mon-cuotas-categoria`, `.mon-cuotas-indicador`… sin
 * acotar; en dev cada hoja llega sólo con su página y no se cruzaban, en el
 * bundle conviven. Telefónico usa `mon-tel-cuotas-` y ninguna otra hoja puede
 * declararlo; tampoco puede volver al prefijo compartido.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(AQUI, "../../../../..");
const PROPIA = path.join(AQUI, "cuotasFaltante.css");

function* hojas(dir: string): Generator<string> {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* hojas(p);
    else if (e.name.endsWith(".css")) yield p;
  }
}

describe("Avance › Cuotas del telefónico: clases propias", () => {
  it("ninguna otra hoja declara `.mon-tel-cuotas`", () => {
    const ajenas = [...hojas(SRC)].filter((p) => p !== PROPIA && /\.mon-tel-cuotas\b/.test(fs.readFileSync(p, "utf8")));
    expect(ajenas.map((p) => path.relative(SRC, p))).toEqual([]);
  });

  it("ninguna hoja fuera de Telefónico declara una clase con sus prefijos propios", () => {
    // El bundle junta las hojas de los cuatro modos: una clase de Telefónico
    // declarada en otra hoja le cambia la forma sólo en producción.
    const PROPIOS = /\.(mon-(?:tel|ctl|sup|dsc|respuestas|avisos|barrido|equipo|cadencia|insumos|metas|calendario)-[a-z0-9-]*)/g;
    const TELEFONICO = path.resolve(AQUI, "..");
    const sinComentarios = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");
    const ajenas = [...hojas(SRC)]
      .filter((p) => !p.startsWith(TELEFONICO + path.sep))
      .flatMap((p) => [...sinComentarios(fs.readFileSync(p, "utf8")).matchAll(PROPIOS)].map((m) => `${path.relative(SRC, p)}: .${m[1]}`));
    expect(ajenas).toEqual([]);
  });

  it("la tabla y su CSS no usan el prefijo compartido `mon-cuotas`", () => {
    for (const archivo of ["cuotasFaltante.css", "CuotasFaltante.tsx", "FaltanteDiario.tsx"]) {
      // Sin comentarios: la cabecera de la hoja nombra el prefijo ajeno para explicar el cambio.
      const codigo = fs.readFileSync(path.join(AQUI, archivo), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
      expect(codigo).not.toMatch(/(?<!tel-)\bmon-cuotas/);
    }
  });

  it("el chip de estado no se parte aunque el nombre de la cuota sea largo", () => {
    const css = fs.readFileSync(PROPIA, "utf8");
    const regla = /\.mon-tel-cuotas-estado\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(regla).toMatch(/white-space:\s*nowrap/);
  });

  it("sin «Cumplió» la plantilla pierde la pista: ocho columnas con ella, siete sin ella, en cada ancho", () => {
    const css = fs.readFileSync(PROPIA, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const plantillas = [...css.matchAll(/(\.mon-tel-cuotas(?:\.sin-cumplio)?)\s*\{[^}]*--mon-tel-cuotas-columnas:\s*([^;]+);/g)]
      .map((m) => ({ sin: m[1].includes("sin-cumplio"), pistas: m[2].replace(/minmax\([^)]*\)/g, "m").trim().split(/\s+/).length }));
    expect(plantillas.filter((p) => !p.sin).map((p) => p.pistas)).toEqual([8, 8, 8]);
    expect(plantillas.filter((p) => p.sin).map((p) => p.pistas)).toEqual([7, 7, 7]);
  });
});
