import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * **Pasada de formato de Carga (4 nov 2026), con meta 0.** La letra ya iba por rol
 * (`app/letraPorRol`, 614 → 0 el 1 nov) y el « · » lo cuida `puntoMedio.contract`.
 * Aquí, lo demás de la receta de `docs/qa/formato-carga-2026-11-04.md`:
 *
 * - P4: las cifras visibles van por `lib/formatoNumero`; ningún `toLocaleString` suelto
 *   salvo el de las fechas (`dateStyle`, `{ day: … }`), que no es una cifra.
 * - P5: el vacío es `EstadoVacio`, la carga `LoadingBlock` y el error `ErrorBlock`. Había
 *   ~50 recetas propias (`pulso-armon-vacio` 22, `pulso-plf-estado` 14, `pulso-sm-empty` 9…).
 *   Se declara la marca de celda vacía de Secciones («—» en una celda de condición).
 * - P6: un estado con tono es `EstadoChip`. Los indicadores de presencia de las matrices
 *   (`pulso-mapa-presencia`, `pulso-emparejamiento-insignia`: icono y texto en una celda)
 *   son la gramática de tabla del Mapa de bases y se quedan.
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

/** Un `toLocaleString` sin opciones de fecha: una cifra formateada a mano. */
const CIFRA_A_MANO = /toLocaleString\((?:"es-PE")?\)/g;
const RECETA = /(?<!-)\bpulso-[a-z0-9]+(?:-[a-z0-9]+)*-(?:empty|vacio|loading|cargando)(?:(?:-|__)[a-z0-9]+)*\b|\bpulso-plf-estado\b/g;
const DECLARADAS = /^pulso-carga-section-condition-empty$/;
/** Píldoras de estado con tono que ya pasaron a `EstadoChip`. */
/** Una espera con objeto («Leyendo la lista…») escrita como texto. Se permiten el rótulo de
 * LoadingBlock (`label=`), el rótulo ocupado de un botón (`? "…"`), el mecanismo `setBusy` de
 * Carga y el detalle de un paso del recorrido de la serie (`detalle: "Leyendo…"`). */
const ESPERA_A_MANO = /(Leyendo|Cargando|Comparando|Calculando|Preparando|Generando) [^"'`<>{}]*…/;
const ESPERA_PERMITIDA = /\blabel=|\?\s*"(Leyendo|Cargando|Comparando|Calculando|Preparando|Generando)|setBusy\(|detalle: "/;
const PILDORA = /\bpulso-(?:cf-estado|origen-externo-estado|sm-case-badge)\b/g;

describe("formato de Carga", () => {
  it("el barrido ve el feature (centinela)", () => {
    expect(archivos(aqui, /\.(tsx|ts|css)$/).length).toBeGreaterThan(150);
  });

  it("P4: ninguna cifra se formatea con toLocaleString suelto", () => {
    expect(hallazgos(/\.tsx?$/, todas(CIFRA_A_MANO)), "Usa lib/formatoNumero.").toEqual([]);
  });

  it("P5: ningún vacío ni carga con receta propia", () => {
    const propias = hallazgos(/\.(tsx|ts|css)$/, (l) => todas(RECETA)(l).filter((c) => !DECLARADAS.test(c)));
    expect(propias, "Usa EstadoVacio, LoadingBlock o ErrorBlock del kit.").toEqual([]);
  });

  it("P5: una espera de superficie va por LoadingBlock, no como texto suelto", () => {
    const sueltas = archivos(aqui, /\.tsx$/).flatMap((f) =>
      lineas(readFileSync(f, "utf8"))
        .map((l, i) => (ESPERA_A_MANO.test(l) && !ESPERA_PERMITIDA.test(l) ? `${rel(f)}:${i + 1}: ${l.trim()}` : null))
        .filter((x): x is string => x !== null),
    );
    expect(sueltas).toEqual([]);
  });

  it("P6: un estado con tono es EstadoChip", () => {
    expect(hallazgos(/\.(tsx|css)$/, todas(PILDORA))).toEqual([]);
  });

  it("los detectores reconocen lo que prohíben (no son guards que no guardan)", () => {
    expect(todas(CIFRA_A_MANO)('n.toLocaleString("es-PE")')).toHaveLength(1);
    expect(todas(CIFRA_A_MANO)('d.toLocaleString("es-PE", { dateStyle: "medium" })')).toHaveLength(0);
    expect(todas(RECETA)('<p className="pulso-armon-vacio">')).toEqual(["pulso-armon-vacio"]);
    expect(todas(RECETA)('<div className="pulso-plf-estado is-error">')).toEqual(["pulso-plf-estado"]);
    expect(todas(RECETA)('color: var(--pulso-status-empty)')).toEqual([]);
    expect(todas(RECETA)('<li className="is-empty">')).toEqual([]);
    expect(ESPERA_A_MANO.test("<p>Leyendo las columnas de la base…</p>")).toBe(true);
    expect(ESPERA_PERMITIDA.test('<LoadingBlock label="Leyendo las columnas…" />')).toBe(true);
    expect(todas(PILDORA)('<span className="pulso-cf-estado is-distinta">')).toHaveLength(1);
  });
});
