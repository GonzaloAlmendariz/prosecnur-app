import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * **Carga deja de pintar «·» (P3 de la pasada de formato).** Gonzalo, 3 nov 2026: «No
 * entiendo esa necesidad de seguir agregando puntos … cuando ya te dije que no los uses».
 * Los datos se unen con coma o con `enumerar` (lib/enumerar.ts). Ratchet por archivo: el
 * conteo sólo BAJA y un archivo nuevo con «·» falla; al limpiar uno, se baja su número aquí.
 *
 * Foto del 3 nov 2026: 194 en 54 archivos (218 en 56 antes de limpiar CargaPage y BasesPanel).
 * 4 nov 2026: meta 0 (`docs/qa/formato-carga-2026-11-04.md`). Ninguno LEÍA el punto medio de
 * un dato: eran todos separadores pintados. Los mensajes de error simulados en los tests
 * conservan su « · E_CODIGO» porque ese es el formato del backend.
 */

const aqui = path.dirname(fileURLToPath(import.meta.url));

const SNAPSHOT: Record<string, number> = {};

function fuentes(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const completo = path.join(dir, e.name);
    if (e.isDirectory()) return fuentes(completo);
    return /\.tsx?$/.test(e.name) && !/\.test\./.test(e.name) ? [completo] : [];
  });
}

const puntos = (f: string) =>
  (f.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => l.replace(/^\s*\/\/.*$/, "")).join("\n").match(/·/g) ?? []).length;

describe("Carga no suma «·»", () => {
  const conteo = fuentes(aqui).map((f) => [path.relative(aqui, f).split(path.sep).join("/"), puntos(readFileSync(f, "utf8"))] as const);

  it("el barrido ve Carga (centinela)", () => {
    expect(conteo.length).toBeGreaterThan(100);
  });

  it("ningún archivo suma «·» ni aparece uno nuevo con «·»", () => {
    const regresiones = conteo
      .filter(([archivo, n]) => n > (SNAPSHOT[archivo] ?? 0))
      .map(([archivo, n]) => `${archivo}: ${SNAPSHOT[archivo] ?? 0} → ${n}`);
    expect(regresiones).toEqual([]);
  });
});
