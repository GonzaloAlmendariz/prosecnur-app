import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * **P8 de la pasada de formato — la monoespaciada es para código, no para metadatos.**
 *
 * Una huella, una semilla o el código de un curso-horario son metadatos: van en
 * la letra del sistema con cifras tabulares y el valor completo en `title`. La
 * monoespaciada se queda donde el texto ES código o un identificador que se
 * teclea tal cual: el nombre de una columna o variable de la base, una fórmula
 * o su sustitución, el símbolo de un parámetro. Ratchet de `<code>` por archivo:
 * sólo baja, y un archivo nuevo no lo estrena.
 */

const aqui = path.dirname(fileURLToPath(import.meta.url));

function archivos(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const completo = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "__tests__" ? [] : archivos(completo);
    return /\.tsx$/.test(e.name) && !/\.test\./.test(e.name) ? [completo] : [];
  });
}

const rel = (f: string) => path.relative(aqui, f).split(path.sep).join("/");
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** `<code>` por archivo al 2 nov 2026: columnas, variables, fórmulas y símbolos. Sólo baja. */
const SNAPSHOT: Record<string, number> = {
  "MultiApiladasBuilder.tsx": 2,
  "PlanCoverageBadge.tsx": 1,
  "SuggestedPlanButton.tsx": 1,
  "VariablePicker.tsx": 1,
  "VarsListPicker.tsx": 2,
  "multiapiladas/TemasPorPublico.tsx": 1,
};

/** Reglas CSS con font-family monoespaciada por hoja, al 2 nov 2026: nombres de variable, hex, atajos y el editor de composición. Sólo baja. */
const SNAPSHOT_CSS: Record<string, number> = {
  "v2/styles/editor-v2.css": 28,
};

function hojas(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const completo = path.join(dir, e.name);
    if (e.isDirectory()) return hojas(completo);
    return e.name.endsWith(".css") ? [completo] : [];
  });
}

describe("monoespaciada sólo para código · P8", () => {
  it("ninguna hoja suma reglas monoespaciadas", () => {
    const fuentes = hojas(aqui);
    expect(fuentes.length).toBeGreaterThan(40);
    const regresiones = fuentes
      .map((f) => [rel(f), readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").match(/font-family\s*:[^;}]*mono/g)?.length ?? 0] as const)
      .filter(([f, n]) => n > (SNAPSHOT_CSS[f] ?? 0))
      .map(([f, n]) => `${f}: ${SNAPSHOT_CSS[f] ?? 0} → ${n}`);
    expect(regresiones).toEqual([]);
  });

  const conteo: Record<string, number> = {};
  for (const f of archivos(aqui)) {
    const n = sinComentarios(readFileSync(f, "utf8")).match(/<code\b/g)?.length ?? 0;
    if (n > 0) conteo[rel(f)] = n;
  }

  it("ningún archivo suma <code> ni aparece uno nuevo", () => {
    // Centinela: el barrido ve los componentes del feature y sus <code> de hoy.
    expect(archivos(aqui).length).toBeGreaterThan(150);
    expect(Object.keys(conteo).length).toBeGreaterThan(3);
    const regresiones = Object.entries(conteo)
      .filter(([f, n]) => n > (SNAPSHOT[f] ?? 0))
      .map(([f, n]) => `${f}: ${SNAPSHOT[f] ?? 0} → ${n}`);
    expect(regresiones, "Un metadato va en la letra del sistema; el valor técnico, en title.").toEqual([]);
  });

  it("el snapshot no guarda conteos que ya bajaron", () => {
    expect(Object.keys(SNAPSHOT).length).toBeGreaterThan(3);
    const viejos = Object.entries(SNAPSHOT)
      .filter(([f, n]) => (conteo[f] ?? 0) < n)
      .map(([f, n]) => `${f}: ${n} → ${conteo[f] ?? 0}`);
    expect(viejos).toEqual([]);
  });
});
