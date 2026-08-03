import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * F37 · Los pisos de una fila no pueden sumar más que la columna que la aloja.
 *
 * Medido: `.cmv2-profile-bars > div` declaraba `minmax(180px, …) minmax(180px, …)`
 * con 10 de gap, 20 de padding y 2 de borde — 392 px mínimos dentro de la
 * columna lateral de Sustento, que mide 387. El desborde eran 5 px exactos y
 * arrastraba a los tres ancestros: cuatro desbordes medidos, un solo defecto.
 *
 * Sólo aparecía con comparación acreditada, porque sin datos el gráfico no se
 * dibuja. Por eso las pasadas anteriores daban la superficie por limpia, y por
 * eso este guard mira la regla y no la pantalla: la regla está rota aunque nadie
 * la esté mirando.
 */
const CSS = readFileSync(
  fileURLToPath(new URL("../universidad-base.css", import.meta.url)),
  "utf8",
);

/** Ancho real de la columna lateral donde vive el gráfico (medido en la app). */
const COLUMNA_LATERAL = 387;

describe("geometría de .cmv2-profile-bars", () => {
  it("la fila cabe en la columna lateral que la aloja", () => {
    const bloque = CSS.slice(CSS.indexOf(".cmv2-profile-bars > div"));
    const regla = bloque.slice(0, bloque.indexOf("}"));

    const columnas = /grid-template-columns:([^;]+);/.exec(regla)?.[1] ?? "";
    const pisos = [...columnas.matchAll(/minmax\(\s*(\d+)px/g)].map((m) => Number(m[1]));
    const gap = Number(/gap:\s*(\d+)px/.exec(regla)?.[1] ?? 0);
    const padding = Number(/padding:\s*\d+px\s+(\d+)px/.exec(regla)?.[1] ?? 0);
    const borde = Number(/border:\s*(\d+)px/.exec(regla)?.[1] ?? 0);

    const minimo =
      pisos.reduce((a, b) => a + b, 0) +
      gap * Math.max(0, pisos.length - 1) +
      padding * 2 +
      borde * 2;

    expect(minimo).toBeLessThanOrEqual(COLUMNA_LATERAL);
  });
});
