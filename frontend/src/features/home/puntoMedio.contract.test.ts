import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * **Home no pinta «·» (meta 0).** Es lo primero que se ve al abrir un proyecto.
 * Gonzalo, 3 nov 2026: «No entiendo esa necesidad de seguir agregando puntos … cuando
 * ya te dije que no los uses». Los datos se unen con coma o con `enumerar`; las rutas de
 * las Novedades usan «›», como el resto de la app; un separador visual es una línea fina.
 */

const aqui = path.dirname(fileURLToPath(import.meta.url));

function fuentes(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const completo = path.join(dir, e.name);
    if (e.isDirectory()) return fuentes(completo);
    return /\.tsx?$/.test(e.name) && !/\.test\./.test(e.name) ? [completo] : [];
  });
}

const sinComentarios = (f: string) => f.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => l.replace(/^\s*\/\/.*$/, "")).join("\n");

describe('Home no pinta "·"', () => {
  const archivos = fuentes(aqui);

  it("el barrido ve Home (centinela)", () => {
    expect(archivos.length).toBeGreaterThan(20);
  });

  it('ningún archivo pinta "·"', () => {
    const conPunto = archivos
      .filter((f) => sinComentarios(readFileSync(f, "utf8")).includes("·"))
      .map((f) => path.relative(aqui, f));
    expect(conPunto).toEqual([]);
  });
});
