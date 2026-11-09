import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * **Pasada de formato de Codificación (4 nov 2026), con meta 0.**
 *
 * Misma receta que Monitoreo, Cálculo y Gráficos
 * (`docs/qa/formato-codificacion-2026-11-04.md`):
 *
 * - P1: la letra va por rol (`var(--pulso-type-<rol>-size)` de
 *   `app/tipografia.css`), en las hojas y en los estilos en línea del JSX. Había
 *   107 `font-size` en px y 118 `fontSize` numéricos.
 * - P3: una lista se une con coma o con «y» (`lib/enumerar`), una pareja
 *   código-etiqueta con punto («9. Trabajo»), un paso con dos puntos. El « · »
 *   que queda LEE el formato del backend (`… · E_TXT_*` en `diccionarioPalabras`).
 * - P4: las cifras visibles van por `lib/formatoNumero`; ningún `toLocaleString`.
 * - P5: el vacío es `EstadoVacio`, la carga `LoadingBlock` y el error
 *   `ErrorBlock`. Se declara la pantalla de preparación de Preparar
 *   (`pulso-codificacion-loading*`): enseña los pasos y una silueta, como la de
 *   los perfiles de Monitoreo.
 * - P6: un estado es `EstadoChip` (el chip de decisión y «Existente»/«Nuevo» de
 *   los grupos): `pulso-cv2-badge` no vuelve.
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
const RECETA = /\bpulso-(?:codificacion|codif|cv2|plf)(?:-[a-z0-9]+)*-(?:empty|vacio|loading|cargando)(?:(?:-|__)[a-z0-9]+)*\b/g;
const DECLARADAS = /^pulso-codificacion-loading(?=$|-)/;
const BADGE = /\bpulso-cv2-badge\b/g;

/** Los que LEEN el punto medio de un dato del backend. Sólo baja. */
const PUNTO_QUE_LEE: Record<string, number> = { "diccionarioPalabras.ts": 1 };

const todas = (re: RegExp) => (l: string) => [...l.matchAll(re)].map((m) => m[0]);

describe("formato de Codificación", () => {
  it("el barrido ve el feature (centinela)", () => {
    expect(archivos(aqui, /\.(tsx|ts|css)$/).length).toBeGreaterThan(50);
  });

  it("P1: ninguna hoja escribe font-size en px", () => {
    expect(hallazgos(/\.css$/, todas(PX_EN_HOJA))).toEqual([]);
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
    expect(todas(RECETA)('<div className="pulso-cv2-resp-empty">')).toEqual(["pulso-cv2-resp-empty"]);
    expect(todas(RECETA)('color: "var(--pulso-status-empty)"')).toEqual([]);
    expect(DECLARADAS.test("pulso-codificacion-loading-steps")).toBe(true);
    expect(todas(PUNTO)("{a} · {b}")).toHaveLength(1);
  });
});
