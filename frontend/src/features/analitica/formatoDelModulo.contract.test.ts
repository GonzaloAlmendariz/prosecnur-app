import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * **Pasada de formato de Analítica (4 nov 2026), con meta 0.** Las hojas ya iban por rol
 * (`app/letraPorRol`, 196 → 0 el 1 nov); faltaba lo demás (`docs/qa/formato-analitica-2026-11-04.md`):
 *
 * - P1: 170 `fontSize` numéricos en estilos en línea pasan a `var(--pulso-type-<rol>-size)`.
 * - P3: el « · » no se pinta como separador (33 líneas). Quedan dos que LEEN el formato del
 *   backend («… · E_CODIGO»): `CrucesReglaEstudio` y `comparativosModel` (`PaneKit` dejó de leerlo el
 *   2026-11-07: el pie «Generar» pasó al kit de entregables, que separa el código con `splitErrorDetail`).
 * - P4: ninguna cifra con `toLocaleString` suelto.
 * - P5: el vacío es `EstadoVacio`. Se declara la pantalla de preparación de la Ficha técnica
 *   (`analitica-ficha-loading*`): enseña los pasos y una silueta.
 * - P6: «ID común listo / Falta ID común» es `EstadoChip`; `analitica-panel-badge` no vuelve.
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

/** Líneas de código, sin comentarios de bloque ni de línea. */
function lineas(fuente: string): string[] {
  return fuente
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ""))
    .split("\n")
    .map((l) => l.replace(/^\s*\/\/.*$/, "").replace(/\s\/\/ .*$/, ""));
}

function hallazgos(ext: RegExp, cuenta: (l: string) => string[]): string[] {
  return archivos(aqui, ext).flatMap((f) =>
    lineas(readFileSync(f, "utf8")).flatMap((l, i) => cuenta(l).map((x) => `${rel(f)}:${i + 1} ${x}`)),
  );
}

const PX_EN_HOJA = /font-size\s*:\s*\d+(?:\.\d+)?px/g;
const PX_EN_LINEA = /fontSize\s*:\s*\d/g;
const PUNTO = /·/g;
const TO_LOCALE = /toLocaleString\(/g;
const RECETA = /(?<!-)\b(?:pulso-)?analitica(?:-[a-z0-9]+)*-(?:empty|vacio|loading|cargando)(?:(?:-|__)[a-z0-9]+)*\b/g;
// `analitica-vacio` es el valor de readiness de la página sin prerequisitos, no una clase.
const DECLARADAS = /^(?:analitica-ficha-loading(?=$|-)|analitica-vacio$)/;
const BADGE = /\banalitica-panel-badge\b/g;

/** Los que LEEN el punto medio de un dato del backend. Sólo baja. */
const PUNTO_QUE_LEE: Record<string, number> = { "panes/CrucesReglaEstudio.tsx": 1, "panes/comparativosModel.ts": 1 };

const todas = (re: RegExp) => (l: string) => [...l.matchAll(re)].map((m) => m[0]);

describe("formato de Analítica", () => {
  it("el barrido ve el feature (centinela)", () => {
    expect(archivos(aqui, /\.(tsx|ts|css)$/).length).toBeGreaterThan(80);
  });

    it("P1: ningún estilo en línea escribe fontSize con un número", () => {
    expect(hallazgos(/\.tsx$/, todas(PX_EN_LINEA)), 'Usa fontSize: "var(--pulso-type-<rol>-size)".').toEqual([]);
  });

  it("P3: el punto medio no se pinta como separador", () => {
    const porArchivo: Record<string, number> = {};
    for (const h of hallazgos(/\.tsx?$/, todas(PUNTO))) {
      const f = h.split(":")[0];
      porArchivo[f] = (porArchivo[f] ?? 0) + 1;
    }
    const suben = Object.entries(porArchivo)
      .filter(([f, n]) => n > (PUNTO_QUE_LEE[f] ?? 0))
      .map(([f, n]) => `${f}: ${PUNTO_QUE_LEE[f] ?? 0} → ${n}`);
    expect(suben, 'Une con coma o "y" (lib/enumerar).').toEqual([]);
    const bajan = Object.entries(PUNTO_QUE_LEE).filter(([f, n]) => (porArchivo[f] ?? 0) < n);
    expect(bajan, "Baja el conteo de la foto.").toEqual([]);
  });

  it("P4: ninguna cifra se formatea con toLocaleString suelto", () => {
    expect(hallazgos(/\.tsx?$/, todas(TO_LOCALE)), "Usa lib/formatoNumero.").toEqual([]);
  });

  it("P5: ningún vacío ni carga con receta propia", () => {
    const propias = hallazgos(/\.(tsx|ts|css)$/, (l) => todas(RECETA)(l).filter((c) => !DECLARADAS.test(c)));
    expect(propias, "Usa EstadoVacio, LoadingBlock o ErrorBlock del kit.").toEqual([]);
  });

  it("P6: un estado es EstadoChip, no una píldora propia", () => {
    expect(hallazgos(/\.(tsx|css)$/, todas(BADGE))).toEqual([]);
  });

  it("los detectores reconocen lo que prohíben (no son guards que no guardan)", () => {
    expect(todas(PX_EN_HOJA)("a { font-size: 11.5px; }")).toHaveLength(1);
    expect(todas(PX_EN_LINEA)("{ fontSize: 12, color }")).toHaveLength(1);
    expect(todas(PX_EN_LINEA)('{ fontSize: "var(--pulso-type-body-size)" }')).toHaveLength(0);
    expect(todas(RECETA)('<div className="analitica-orden-catalogo-empty">')).toEqual(["analitica-orden-catalogo-empty"]);
    expect(todas(RECETA)('color: "var(--pulso-status-empty)"')).toEqual([]);
    expect(DECLARADAS.test("analitica-ficha-loading-steps")).toBe(true);
    expect(todas(PUNTO)("{a} · {b}")).toHaveLength(1);
  });
});
