import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * **P3 — el punto medio no es un separador (Hojas de ruta).**
 *
 * Hojas de ruta cosía datos con « · » en 84 líneas de código. Gonzalo los vio en
 * pantalla («Todos · 50», «N 1,200 · ±2.8 %», «46 mil hab. · 1,930 manzanas») y
 * pidió no usarlos. Pasaron a coma o paréntesis el 3 nov 2026. Meta 0: una lista
 * se une con coma o con «y» (`lib/enumerar`); un conteo que acompaña, entre
 * paréntesis. Los comentarios no cuentan.
 */

const aqui = path.dirname(fileURLToPath(import.meta.url));

function archivos(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const completo = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "__tests__" ? [] : archivos(completo);
    return /\.tsx?$/.test(e.name) && !/\.test\./.test(e.name) ? [completo] : [];
  });
}

const rel = (f: string) => path.relative(aqui, f).split(path.sep).join("/");

/** Líneas de código con « · », sin comentarios de bloque ni de línea. */
function lineasConPunto(fuente: string): number {
  return fuente
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ""))
    .split("\n")
    .map((l) => l.replace(/^\s*\/\/.*$/, "").replace(/\s\/\/ .*$/, ""))
    .filter((l) => l.includes("·")).length;
}

/** Foto del 2 nov 2026, después de pasar los `join(" · ")` a coma. Sólo baja. */
const SNAPSHOT: Record<string, number> = {};

describe("punto medio en Hojas de ruta (P3)", () => {
  const conteo: Record<string, number> = {};
  for (const f of archivos(aqui)) {
    const n = lineasConPunto(readFileSync(f, "utf8"));
    if (n > 0) conteo[rel(f)] = n;
  }

  it("el barrido ve el feature", () => {
    expect(archivos(aqui).length).toBeGreaterThan(30);
  });

  it('ningún archivo suma " · " ni aparece uno nuevo', () => {
    const regresiones = Object.entries(conteo)
      .filter(([f, n]) => n > (SNAPSHOT[f] ?? 0))
      .map(([f, n]) => `${f}: ${SNAPSHOT[f] ?? 0} → ${n}`);
    expect(regresiones, 'Une con coma o con "y" (lib/enumerar); datos de otro tipo, en otra línea.').toEqual([]);
  });

  it("el snapshot no guarda conteos que ya bajaron", () => {
    expect(archivos(aqui).length).toBeGreaterThan(30);
    const viejos = Object.entries(SNAPSHOT)
      .filter(([f, n]) => (conteo[f] ?? 0) < n)
      .map(([f, n]) => `${f}: ${n} → ${conteo[f] ?? 0}`);
    expect(viejos).toEqual([]);
  });

  it("join con punto medio no vuelve", () => {
    const hallazgos = archivos(aqui).filter((f) => /join\(["'`] · ["'`]\)/.test(readFileSync(f, "utf8"))).map(rel);
    expect(hallazgos).toEqual([]);
  });
});
