import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * **El kit, lib/ y app/ no pintan «·» (meta 0).**
 *
 * Gonzalo, 3 nov 2026, al ver «Selección · pestaña 3 de 10»: «No entiendo esa
 * necesidad de seguir agregando puntos … cuando ya te dije que no los uses». Lo que
 * vive aquí lo heredan todos los módulos, así que un «·» del kit aparece en todas
 * partes. Los datos se unen con coma o con `enumerar` (lib/enumerar.ts); un separador
 * visual es una línea fina, no un punto. Cuentan también `title` y tooltips.
 *
 * Excepciones declaradas: código que LEE un «·» que llega de afuera y no lo pinta.
 */

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CARPETAS = ["components", "lib", "app"];

const LEEN_NO_PINTAN: Record<string, string> = {
  "components/errorPresentation.ts": "separa el código «· E_…» que agrega ApiError al mensaje",
  "lib/rotuloDeMatriz.ts": "parte rótulos de matriz que llegan con «·» desde el instrumento",
};

function fuentes(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const completo = path.join(dir, e.name);
    if (e.isDirectory()) return fuentes(completo);
    return /\.tsx?$/.test(e.name) && !/\.test\./.test(e.name) ? [completo] : [];
  });
}

export function puntosQueSePintan(fuente: string): number {
  const codigo = fuente
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((l) => l.replace(/^\s*\/\/.*$/, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, ""))
    .join("\n");
  return (codigo.match(/·/g) ?? []).length;
}

describe("el kit, lib/ y app/ no pintan «·»", () => {
  const archivos = CARPETAS.flatMap((c) => fuentes(path.join(SRC, c)));

  it("el barrido ve las tres carpetas (centinela)", () => {
    expect(archivos.length).toBeGreaterThan(100);
  });

  it("ningún archivo pinta «·», salvo los que sólo lo leen", () => {
    const conPunto = archivos
      .map((f) => [path.relative(SRC, f).split(path.sep).join("/"), puntosQueSePintan(readFileSync(f, "utf8"))] as const)
      .filter(([rel, n]) => n > 0 && !(rel in LEEN_NO_PINTAN))
      .map(([rel, n]) => `${rel}: ${n}`);
    expect(conPunto).toEqual([]);
  });

  it("las excepciones siguen existiendo: si una se mueve, el ratchet lo dice", () => {
    for (const rel of Object.keys(LEEN_NO_PINTAN)) {
      expect(puntosQueSePintan(readFileSync(path.join(SRC, rel), "utf8"))).toBeGreaterThan(0);
    }
  });

  it("el detector cuenta lo que se pinta y no los comentarios", () => {
    expect(puntosQueSePintan("const t = `${a} · ${b}`;")).toBe(1);
    expect(puntosQueSePintan("// «a · b»\nconst c = 1;")).toBe(0);
    expect(puntosQueSePintan("/* a · b */ const d = 1;")).toBe(0);
  });
});
