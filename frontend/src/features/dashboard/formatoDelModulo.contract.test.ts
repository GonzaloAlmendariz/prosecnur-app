import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * **Pasada de formato de Dashboard (4 nov 2026), con meta 0.**
 *
 * La letra del tablero queda fuera de P1 por decisión de Gonzalo (1 nov 2026): su
 * tema es el del tablero publicado que ve el cliente (`app/letraPorRol`). Por el
 * mismo motivo, el vacío y la espera del tablero son su propio `shared/EmptyState`
 * (tokens `--dash-*`), no el `EstadoVacio` del kit de la app. Lo demás de la
 * receta (`docs/qa/formato-dashboard-2026-11-04.md`):
 *
 * - P3: el punto medio no se pinta como separador (había 16 líneas y un `·` suelto
 *   entre los dos cortes del FODA).
 * - P4: las cifras visibles van por `lib/formatoNumero`; el único `toLocaleString`
 *   que queda es la fecha completa del `title` de la última actualización.
 * - P5: ningún vacío ni carga con receta propia salvo los declarados: la celda sin
 *   datos de una tarjeta KPI, la fila vacía de la tabla de datos, la capa «Cargando
 *   subcriterios…» sobre un gráfico que ya se ve y la ranura de logo sin imagen.
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

const todas = (re: RegExp) => (l: string) => [...l.matchAll(re)].map((m) => m[0]);

const PUNTO = /·/g;
/** Un `toLocaleString` sin opciones: una cifra (o una fecha) formateada a mano. */
const A_MANO = /toLocaleString\((?:"es-PE")?\)/g;
const FECHA_DECLARADA = /new Date\(iso\)\.toLocaleString\("es-PE"\)/;
const RECETA = /(?<!-)\bdash-[a-z0-9]+(?:-[a-z0-9]+)*-(?:empty|vacio|loading|cargando)(?:(?:-|__)[a-z0-9]+)*\b/g;
// `dash-palette-list-empty` ya no la usa nadie, pero su regla lleva un `font-size` en px
// que cuenta `app/letraPorRol` (fuera de esta pasada): se poda junto con su foto.
const DECLARADAS = /^(?:dash-kpi-empty(?:--roomy)?|dash-dt-empty|dash-construccion-loading|dash-customize-logo-empty|dash-empty-state(?:-[a-z]+)?|dash-palette-list-empty)$/;

describe("formato de Dashboard", () => {
  it("el barrido ve el feature (centinela)", () => {
    expect(archivos(aqui, /\.(tsx|ts|css)$/).length).toBeGreaterThan(30);
  });

  it("P3: el punto medio no se pinta como separador", () => {
    expect(hallazgos(/\.(tsx?|css)$/, todas(PUNTO)), "Une con coma, dos puntos o paréntesis.").toEqual([]);
  });

  it("P4: ninguna cifra se formatea con toLocaleString suelto", () => {
    const sueltos = hallazgos(/\.tsx?$/, (l) => (FECHA_DECLARADA.test(l) ? [] : todas(A_MANO)(l)));
    expect(sueltos, "Usa lib/formatoNumero.").toEqual([]);
  });

  it("P5: ningún vacío ni carga con receta propia fuera de los declarados", () => {
    const propias = hallazgos(/\.(tsx|ts|css)$/, (l) => todas(RECETA)(l).filter((c) => !DECLARADAS.test(c)));
    expect(propias, "Usa shared/EmptyState, el vacío del tablero.").toEqual([]);
  });

  it("los detectores reconocen lo que prohíben (no son guards que no guardan)", () => {
    expect(todas(PUNTO)("{a} · {b}")).toHaveLength(1);
    expect(todas(A_MANO)('n.toLocaleString("es-PE")')).toHaveLength(1);
    expect(FECHA_DECLARADA.test('title={new Date(iso).toLocaleString("es-PE")}')).toBe(true);
    expect(todas(RECETA)('<div className="dash-lista-empty">')).toEqual(["dash-lista-empty"]);
    expect(DECLARADAS.test("dash-kpi-empty--roomy")).toBe(true);
    expect(todas(RECETA)("color: var(--dash-texto-empty)")).toEqual([]);
  });
});
