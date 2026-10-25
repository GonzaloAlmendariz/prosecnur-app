import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Avance › Mapa (territorial.md §3.15): **nada se superpone al mapa.**
 *
 * El visor anterior anclaba controles y avisos en las esquinas del lienzo, y
 * `avisosDelMapaNoSeTapan.contract.test.ts` tuvo que vigilar que no se pisaran
 * entre ellos. El mapa nuevo lleva barra, leyenda y ficha en flujo, alrededor
 * del lienzo; este guard impide que vuelva un hijo absoluto o fijo.
 */

const dir = path.dirname(fileURLToPath(import.meta.url));
const css = readFileSync(path.join(dir, "mapa.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

function reglas(): Array<{ selector: string; cuerpo: string }> {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({ selector: match[1].trim(), cuerpo: match[2] }));
}

describe("Avance › Mapa no superpone nada al lienzo", () => {
  it("ninguna regla del mapa usa position absolute o fixed", () => {
    const superpuestas = reglas()
      .filter((regla) => /position\s*:\s*(absolute|fixed)/.test(regla.cuerpo))
      .map((regla) => regla.selector);
    expect(superpuestas).toEqual([]);
  });

  it("el guard lee reglas reales del mapa", () => {
    expect(reglas().some((regla) => regla.selector.includes(".mon-mapa-lienzo"))).toBe(true);
  });
});
