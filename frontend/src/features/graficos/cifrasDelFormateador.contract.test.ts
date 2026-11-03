import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * **P4 de la pasada de formato — un conteo de Gráficos lleva separador de millares.**
 *
 * Un `{x.length}` pegado en el JSX escribe «1234 disponibles» al lado de un
 * «1,234» formateado. Los que cuentan variables o preguntas (los únicos que
 * pasan de 999 en un estudio real) van por `formatoConteo` de `lib/formatoNumero`
 * desde el 2 nov 2026; el resto cuenta láminas, avisos o capítulos y este
 * ratchet sólo los deja bajar. `toLocaleString` suelto no vuelve.
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
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const LENGTH_CRUDO = /(?<![=\w])\{[\w.!?]+\.length\}|\$\{[\w.!?]+\.length\}/g;

/** Meta 0 desde el 3 nov 2026: todo conteo visible pasa por formatoConteo. */
const SNAPSHOT_LENGTH_CRUDO: Record<string, number> = {};

describe("cifras de Gráficos por el formateador compartido · P4", () => {
  const conteo: Record<string, number> = {};
  for (const f of archivos(aqui)) {
    const n = sinComentarios(readFileSync(f, "utf8")).match(LENGTH_CRUDO)?.length ?? 0;
    if (n > 0) conteo[rel(f)] = n;
  }

  it("ningún archivo suma conteos crudos ni aparece uno nuevo", () => {
    expect(archivos(aqui).length).toBeGreaterThan(300);
    const regresiones = Object.entries(conteo)
      .filter(([f, n]) => n > (SNAPSHOT_LENGTH_CRUDO[f] ?? 0))
      .map(([f, n]) => `${f}: ${SNAPSHOT_LENGTH_CRUDO[f] ?? 0} → ${n}`);
    expect(regresiones, "Usa formatoConteo(x.length) de lib/formatoNumero.").toEqual([]);
  });

  it("el snapshot no guarda conteos que ya bajaron", () => {
    expect(archivos(aqui).length).toBeGreaterThan(300);
    const viejos = Object.entries(SNAPSHOT_LENGTH_CRUDO)
      .filter(([f, n]) => (conteo[f] ?? 0) < n)
      .map(([f, n]) => `${f}: ${n} → ${conteo[f] ?? 0}`);
    expect(viejos).toEqual([]);
  });

  it("nadie formatea por su cuenta con toLocaleString", () => {
    const hallazgos = archivos(aqui)
      .filter((f) => /\.toLocaleString\(\s*["'`]es/.test(sinComentarios(readFileSync(f, "utf8"))))
      .map(rel);
    expect(hallazgos).toEqual([]);
  });

  // es-PE escribe punto decimal («0.72», «12.5 %»). Había 23 `toFixed(n).replace(".", ",")`
  // que escribían coma decimal al lado de cifras con coma de millares («1,234»): la
  // misma coma con dos sentidos en una pantalla. Meta 0.
  it("ninguna cifra cambia el punto decimal por coma", () => {
    const fuentes = archivos(aqui);
    expect(fuentes.length).toBeGreaterThan(300);
    const hallazgos = fuentes
      .filter((f) => /\.replace\(\s*["'`]\.["'`]\s*,\s*["'`],["'`]\s*\)/.test(sinComentarios(readFileSync(f, "utf8"))))
      .map(rel);
    expect(hallazgos).toEqual([]);
    expect(/\.replace\(\s*["'`]\.["'`]\s*,\s*["'`],["'`]\s*\)/.test('x.toFixed(1).replace(".", ",")')).toBe(true);
  });
});
