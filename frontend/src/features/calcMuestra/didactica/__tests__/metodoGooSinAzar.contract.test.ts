/**
 * Determinismo de los mini-goo de Método (b) — análogo al gate 1 del relato
 * (`relatoSinAzar.contract.test.ts`): los esquemas usan un dataset ilustrativo
 * CONSTANTE; posiciones, tamaños y tiempos son fijos. Un loop «GIF» que se
 * sortea a sí mismo en cada render dejaría de ser un esquema y empezaría a
 * parecer una corrida — exactamente lo que la distinción congelada prohíbe.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const FUENTES = ["../MetodoGooEsquema.tsx", "../metodoGooEsquema.css"];

/** Fuente sin comentarios: la regla se vigila sobre lo que ejecuta/renderiza. */
function leerSinComentarios(rel: string): string {
  return readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("MetodoGooEsquema — cero azar, dataset constante (b)", () => {
  for (const patron of [/Math\.random\s*\(/, /getRandomValues/, /\bshuffle\b/i, /Date\.now\s*\(/]) {
    it(`ningún fuente del esquema matchea ${String(patron)}`, () => {
      for (const rel of FUENTES) {
        expect(leerSinComentarios(rel), rel).not.toMatch(patron);
      }
    });
  }

  it("las posiciones y tamaños viven en el dataset constante exportado", () => {
    const fuente = leerSinComentarios("../MetodoGooEsquema.tsx");
    expect(fuente).toContain("export const METODO_GOO_ESQUEMAS");
    expect(fuente).toContain("export const METODO_GOO_DECLARACION");
  });
});
