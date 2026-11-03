import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * **P4 de la pasada de formato — una cifra de Cálculo pasa por el formateador.**
 *
 * Había tres copias locales de `fmtInt` (sharedCore, la memoria de cálculo y la
 * distribución de categorías), un `enumerar` propio y veinte `toLocaleString`
 * sueltos. Todos escribían es-PE («1,234.5»), pero cada copia es un sitio donde
 * la convención puede derivar. Ahora `fmtInt` delega en `lib/formatoNumero`
 * (`formatoConteo`) y los decimales usan `formatoDecimal`.
 *
 * Y un conteo pegado crudo en el JSX (`{filas.length}`) no lleva separador de
 * millares: «1234 filas» al lado de «1,234» en la tarjeta vecina. Los que pueden
 * pasar de 999 (filas, columnas, cursos-horario, excluidos) fueron primero; el
 * 3 nov 2026 pasaron también los que cuentan facultades o métodos, para que no
 * haya dos maneras de escribir un conteo. Meta 0, salvo dos que no se muestran.
 */

const aqui = path.dirname(fileURLToPath(import.meta.url));

function archivos(dir: string, ext: RegExp): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const completo = path.join(dir, e.name);
    if (e.isDirectory()) return archivos(completo, ext);
    return ext.test(e.name) && !/\.test\./.test(e.name) ? [completo] : [];
  });
}

const rel = (f: string) => path.relative(aqui, f).split(path.sep).join("/");
const sinComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** `toLocaleString` vive sólo en el formateador del módulo y en la cifra con decimales fijos. */
const TO_LOCALE_PERMITIDO = new Set(["sharedCore.ts", "universidad/criterios/criteriosGeneralesModel.ts"]);

/** `{x.length}` o `${x.length}` sin formatear. Meta 0 desde el 3 nov 2026, salvo los dos que no se muestran. */
const SNAPSHOT_LENGTH_CRUDO: Record<string, number> = {
  // No son texto: la clave de una fila virtual y el número de columnas de un grid CSS.
  "universidad/aulas/classroomSelectionMapModel.ts": 1,
  "universidad/marco/marcoCharts.tsx": 1,
};

// Un conteo crudo en el texto: `{x.length}` entre etiquetas o `${x.length}` en
// una plantilla. No cuenta `prop={x.length}` (atributo) ni `x.length > 0`.
const LENGTH_CRUDO = /(?<![=\w])\{[\w.!?]+\.length\}|\$\{[\w.!?]+\.length\}/g;

function conteoLength(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const f of archivos(aqui, /\.tsx?$/)) {
    const n = sinComentarios(readFileSync(f, "utf8")).match(LENGTH_CRUDO)?.length ?? 0;
    if (n > 0) out[rel(f)] = n;
  }
  return out;
}

describe("cifras de Cálculo de muestra por el formateador compartido", () => {
  it("nadie formatea por su cuenta con toLocaleString ni redefine fmtInt", () => {
    const fuentes = archivos(aqui, /\.tsx?$/);
    expect(fuentes.length).toBeGreaterThan(300);
    const hallazgos = fuentes
      .filter((f) => !TO_LOCALE_PERMITIDO.has(rel(f)))
      .flatMap((f) => {
        const codigo = sinComentarios(readFileSync(f, "utf8"));
        const malos: string[] = [];
        if (/\.toLocaleString\(/.test(codigo)) malos.push(`${rel(f)}: toLocaleString`);
        if (rel(f) !== "sharedCore.ts" && /(const|function)\s+fmtInt\b/.test(codigo)) malos.push(`${rel(f)}: fmtInt propio`);
        if (/function\s+enumerar\b/.test(codigo)) malos.push(`${rel(f)}: enumerar propio (usa lib/enumerar)`);
        return malos;
      });
    expect(hallazgos).toEqual([]);
  });

  it("fmtInt es el formateador compartido: es-PE con coma de millares", async () => {
    const { fmtInt } = await import("./sharedCore");
    expect(fmtInt(17124)).toBe("17,124");
    expect(fmtInt(null)).toBe("—");
  });

  it("ningún archivo suma conteos crudos ni aparece uno nuevo", () => {
    const conteo = conteoLength();
    const regresiones = Object.entries(conteo)
      .filter(([f, n]) => n > (SNAPSHOT_LENGTH_CRUDO[f] ?? 0))
      .map(([f, n]) => `${f}: ${SNAPSHOT_LENGTH_CRUDO[f] ?? 0} → ${n}`);
    expect(regresiones, "Usa fmtInt(x.length).").toEqual([]);
    const viejos = Object.entries(SNAPSHOT_LENGTH_CRUDO)
      .filter(([f, n]) => (conteo[f] ?? 0) < n)
      .map(([f, n]) => `${f}: ${n} → ${conteo[f] ?? 0}`);
    expect(viejos).toEqual([]);
  });

  it("el detector reconoce lo que prohíbe", () => {
    expect("<b>{filas.length}</b>".match(LENGTH_CRUDO)).toHaveLength(1);
    expect("`${rows.length} filas`".match(LENGTH_CRUDO)).toHaveLength(1);
    expect("rowSpan={faculty.cells.length}".match(LENGTH_CRUDO)).toBeNull();
  });

  // es-PE escribe punto decimal («0.72», «12.5 %»). Había 23 `toFixed(n).replace(".", ",")`
  // que escribían coma decimal al lado de cifras con coma de millares («1,234»): la
  // misma coma con dos sentidos en una pantalla. Meta 0.
  it("ninguna cifra cambia el punto decimal por coma", () => {
    const fuentes = archivos(aqui, /\.tsx?$/);
    expect(fuentes.length).toBeGreaterThan(300);
    const hallazgos = fuentes
      .filter((f) => /\.replace\(\s*["'`]\.["'`]\s*,\s*["'`],["'`]\s*\)/.test(sinComentarios(readFileSync(f, "utf8"))))
      .map(rel);
    expect(hallazgos).toEqual([]);
    expect(/\.replace\(\s*["'`]\.["'`]\s*,\s*["'`],["'`]\s*\)/.test('x.toFixed(1).replace(".", ",")')).toBe(true);
  });
});
