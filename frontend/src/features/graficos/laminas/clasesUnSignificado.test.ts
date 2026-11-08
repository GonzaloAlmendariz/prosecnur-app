import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Una clase, un significado (R7-8). `.pulso-f6-ayuda` vivía en dos hojas con dos sentidos: texto de ayuda en bloque
 * (inspectorLamina.css) y globo "?" en línea (datosGrafico.css). Al concatenar el bundle ganaba la última hoja y los
 * "?" saltaban a su propia línea en todo el inspector. El contrato: una clase declarada como regla raíz (`.clase {`)
 * en dos hojas distintas del módulo no puede fijar `display` distinto en cada una.
 */

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function* hojas(dir: string): Generator<string> {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* hojas(p);
    else if (e.name.endsWith(".css")) yield p;
  }
}

const sinComentarios = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");

/** clase → hoja → display declarado en su regla raíz. */
export function displaysPorClase(archivos: Array<{ ruta: string; css: string }>): Map<string, Map<string, string>> {
  const mapa = new Map<string, Map<string, string>>();
  const regla = /(^|\})\s*\.([a-z0-9-]+)\s*\{([^}]*)\}/g;
  for (const { ruta, css } of archivos) {
    const limpio = sinComentarios(css);
    for (const m of limpio.matchAll(regla)) {
      const display = /(?:^|;)\s*display\s*:\s*([^;]+)/.exec(m[3])?.[1]?.trim();
      if (!display) continue;
      const porHoja = mapa.get(m[2]) ?? new Map<string, string>();
      porHoja.set(ruta, display);
      mapa.set(m[2], porHoja);
    }
  }
  return mapa;
}

export function colisiones(mapa: Map<string, Map<string, string>>): string[] {
  const fuera: string[] = [];
  for (const [clase, porHoja] of mapa) {
    if (porHoja.size < 2 || new Set(porHoja.values()).size < 2) continue;
    fuera.push(`.${clase}: ${[...porHoja].map(([h, d]) => `${h} → ${d}`).join(" | ")}`);
  }
  return fuera;
}

describe("una clase, un significado", () => {
  it("detecta la colisión que rompía el inspector", () => {
    const mapa = displaysPorClase([
      { ruta: "a.css", css: ".pulso-f6-ayuda {\n  display: block;\n}" },
      { ruta: "b.css", css: "/* globo */\n.pulso-f6-ayuda {\n  position: relative;\n  display: inline-grid;\n}" },
    ]);
    expect(colisiones(mapa)).toHaveLength(1);
  });

  it("ninguna clase raíz del módulo Gráficos fija dos display distintos en dos hojas", () => {
    const archivos = [...hojas(RAIZ)].map((ruta) => ({ ruta: path.relative(RAIZ, ruta), css: fs.readFileSync(ruta, "utf8") }));
    expect(colisiones(displaysPorClase(archivos))).toEqual([]);
  });
});
