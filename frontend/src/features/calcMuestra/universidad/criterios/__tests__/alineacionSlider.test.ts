import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * G34 · El deslizador arranca donde arranca el eje.
 *
 * Medido en la app antes de esto: pista en x=131, gráfico en x=149 — 18 px de
 * desfase a cada lado, que son el relleno y el borde de la tarjeta que envuelve
 * al gráfico. La manija señalaba un punto de la escala desplazado, y una guía
 * desviada es peor que ninguna porque se lee con la misma confianza.
 *
 * El sangrado se publica como variable en la tarjeta y el control lo compensa.
 * Este caso impide el número mágico: si alguien cambia el relleno sin mover la
 * variable, la compensación deja de seguirlo.
 */
const leer = (rel: string) =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

describe("alineación del deslizador con el eje", () => {
  it("la tarjeta del gráfico PUBLICA su sangrado", () => {
    const css = leer("../../marco/criterioFacultadRadiografia.css");
    expect(css).toMatch(/\.cmv2-crc-compact-segment\s*\{[^}]*--cmv2-seg-sangrado:/);
  });

  it("el control alineado lo compensa en vez de inventar un número", () => {
    const css = leer("../controlUmbral.css");
    const bloque = /\.cmv2-umbral-control\[data-alineado\] \.cmv2-umbral-fila\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(bloque).toContain("--cmv2-seg-sangrado");
    // Un `padding-inline` con sólo píxeles sería el número mágico que esto evita.
    expect(bloque).toMatch(/padding-inline:\s*calc\(/);
  });

  it("el control alineado no impone un ancho propio", () => {
    // Si lo hiciera, dejaría de seguir al gráfico cuando la fila cambie.
    const css = leer("../controlUmbral.css");
    const bloque = /\.cmv2-umbral-control\[data-alineado\] \.cmv2-umbral-fila\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(bloque).toMatch(/width:\s*100%/);
    expect(bloque).not.toMatch(/width:\s*\d+px/);
  });
});
