// La ficha de la maqueta es un SVG medido en pulgadas: su texto lleva `fontSize` en pulgadas. Si una hoja de otro módulo
// define una clase que la ficha usa, su CSS pisa ese tamaño. Pasó con `.pulso-ficha-pregunta`, que también es el bloque
// de pregunta del kit (piezas-procesamiento.css, `font-size: 0.92em`): el título salía de unas 9 pulgadas encima de la
// lámina (RMS ACNUR, 2026-11-11). Este contrato pide que ninguna clase de la ficha se defina fuera de la maqueta.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const aqui = dirname(fileURLToPath(import.meta.url));
const src = resolve(aqui, "../../../..");

function hojas(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return n === "node_modules" ? [] : hojas(p);
    return n.endsWith(".css") ? [p] : [];
  });
}

const clasesDeLaFicha = () => {
  const tsx = readFileSync(resolve(aqui, "FichaRanura.tsx"), "utf8");
  return [...new Set([...tsx.matchAll(/pulso-ficha[a-z-]*/g)].map((m) => m[0]))];
};

const definidaFuera = (clase: string, css: Array<{ ruta: string; texto: string }>) =>
  css.filter((h) => !h.ruta.startsWith(aqui) && new RegExp(`\\.${clase}(?![\\w-])`).test(h.texto)).map((h) => h.ruta);

describe("clases de la ficha de la maqueta", () => {
  const css = hojas(src).map((ruta) => ({ ruta, texto: readFileSync(ruta, "utf8") }));

  it("ninguna se define en una hoja de otro módulo", () => {
    const choques = clasesDeLaFicha().flatMap((c) => definidaFuera(c, css).map((r) => `${c} en ${r.slice(src.length + 1)}`));
    expect(choques).toEqual([]);
  });

  it("el contrato detecta un choque real", () => {
    expect(definidaFuera("pulso-ficha-pregunta", css).length).toBeGreaterThan(0);
  });
});
