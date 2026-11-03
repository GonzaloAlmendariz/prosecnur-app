import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * **P5 de la pasada de formato — el vacío y la carga de Gráficos son los del kit.**
 *
 * Mismo patrón que Material y Cálculo de muestra. Gráficos tenía 13 esperas
 * escritas a mano («Cargando variables…» en un `<span>`, «Leyendo las escalas…»
 * en un `<p>` con `fontSize: 12` en línea, spinners sueltos con su propia clase)
 * y 15 vacíos de bloque con clase propia (`pulso-f6-vacio-col`,
 * `pulso-f6-selector-vacio`, `pulso-f6-vacio-informe`, `pulso-gv2-inline-empty`…).
 * Ahora la espera es `LoadingBlock` y el vacío de un bloque, `EstadoVacio`.
 *
 * Meta 0. Quedan fuera, a propósito: el resultado de una búsqueda dentro de un
 * desplegable («No hay variables que coincidan»), el marcador de una ranura de
 * la maqueta (`is-vacio`, que dibuja la lámina) y los vacíos de las bibliotecas
 * de láminas y graficadores, que llevan `aria-labelledby` hacia su título y se
 * migran con su propia prueba de accesibilidad.
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

function lineasDeCodigo(fuente: string): string[] {
  return fuente
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ""))
    .split("\n")
    .map((l) => l.replace(/^\s*\/\/.*$/, ""));
}

const CLASES_VIEJAS = new RegExp(
  "\\b(" +
    [
      "pulso-f6-vacio-informe",
      "pulso-f6-selector-vacio",
      "pulso-f6-vacio-col",
      "pulso-f6-indice-vacio",
      "pulso-f6-especial-vacio",
      "pulso-gv2-base-labels-empty",
      "pulso-gv2-inline-empty",
      "pulso-gv2-filters-empty",
    ].join("|") +
    ")(?![\\w-])",
);
// Una espera con objeto escrita como texto. Dentro de `label=` es el rótulo de
// LoadingBlock; el rótulo ocupado de un botón (un ternario) no es una carga.
const ESPERA_A_MANO = /(Leyendo|Cargando|Comparando) [^"'`<>{}]*…/;

describe("vacíos y cargas de Gráficos", () => {
  it("ninguna hoja ni componente usa las clases propias de vacío de bloque", () => {
    const fuentes = archivos(aqui, /\.(tsx|ts|css)$/);
    // Centinela: el barrido mira de verdad el feature (≈420 fuentes al 2 nov 2026).
    expect(fuentes.length).toBeGreaterThan(300);
    const hallazgos = fuentes.flatMap((f) =>
      lineasDeCodigo(readFileSync(f, "utf8"))
        .map((l, i) => (CLASES_VIEJAS.test(l) ? `${rel(f)}:${i + 1}` : null))
        .filter((x): x is string => x !== null),
    );
    expect(hallazgos).toEqual([]);
  });

  it("una espera va por LoadingBlock, no como texto suelto", () => {
    const componentes = archivos(aqui, /\.tsx$/);
    const usos = componentes.reduce((n, f) => n + (readFileSync(f, "utf8").match(/<LoadingBlock\b/g)?.length ?? 0), 0);
    // Centinela: el barrido ve las cargas migradas (19 al 2 nov 2026).
    expect(usos).toBeGreaterThan(15);
    const hallazgos = componentes.flatMap((f) =>
      lineasDeCodigo(readFileSync(f, "utf8"))
        .map((l, i) =>
          ESPERA_A_MANO.test(l) && !/\blabel=/.test(l) && !/\?\s*"(Leyendo|Cargando)[^"]*"\s*:/.test(l)
            ? `${rel(f)}:${i + 1}: ${l.trim()}`
            : null,
        )
        .filter((x): x is string => x !== null),
    );
    expect(hallazgos).toEqual([]);
  });

  it("el detector reconoce lo que prohíbe (no es un guard que no guarda)", () => {
    expect(ESPERA_A_MANO.test('<span className="x">Cargando variables…</span>')).toBe(true);
    expect(ESPERA_A_MANO.test('{preparando ? "Leyendo…" : "Importar"}')).toBe(false);
    expect(CLASES_VIEJAS.test('<p className="pulso-f6-vacio-col">')).toBe(true);
    expect(CLASES_VIEJAS.test('<div className="pulso-f6-vacio-acciones">')).toBe(false);
  });
});
