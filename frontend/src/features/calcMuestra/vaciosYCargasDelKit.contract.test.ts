import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * **P5 de la pasada de formato — el vacío y la carga de Cálculo son los del kit.**
 *
 * Mismo patrón que Material (`recopiladores/vaciosYCargasDelKit.contract.test.ts`):
 * convivían el `EmptyState` del kit (29 usos) con 27 vacíos de bloque pintados a
 * mano, cada uno con su clase (`cmv2-classroom-empty`, `cmv2-crit-empty`,
 * `cmv2-descriptive-empty-state`, `cmv2-i18b-*-empty`…), su ícono suelto y su
 * `<strong>` de 12 a 14 px. Ahora el vacío de un bloque es `EstadoVacio`
 * (`components/EstadoVacio.tsx`) y la espera de un bloque, `LoadingBlock`.
 *
 * Meta 0: las clases viejas ya no existen. Quedan fuera, a propósito, los
 * marcadores en línea que no son el vacío de un bloque sino el valor ausente de
 * una celda o de una ranura («—», «sin referencia», «sin distribución», «1 lugar
 * sin cubrir», «Ningún curso-horario coincide con…») y la nota dentro de una
 * tarjeta que ya tiene su marco (`cmv2-crc-inline-empty`, el «Total del marco»
 * sin calcular en la serie de facultades): eso es dato, no superficie.
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

/** Líneas de código, sin los comentarios de línea ni de bloque. */
function lineasDeCodigo(fuente: string): string[] {
  return fuente
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ""))
    .split("\n")
    .map((l) => l.replace(/^\s*\/\/.*$/, ""));
}

const CLASES_VIEJAS = new RegExp(
  "\\b(" +
    [
      "cmv2-classroom-empty",
      "cmv2-descriptive-empty-state",
      "cmv2-descriptive-empty-tags",
      "cmv2-crit-empty",
      "cmv2-partic-empty",
      "cmv2-ref-asist-empty",
      "cmv2-ref-tau-empty",
      "cmv2-result-empty",
      "cmv2-i18b-anchor-empty",
      "cmv2-i18b-cascade-empty",
      "cmv2-i18b-boxplot-empty",
      "cmv2-crc-empty",
      "cmv2-tsr-empty",
      "cmv2-explorador-card-vacio",
      "cmv2-certeza-vacio",
      "cmv2-facultades-excluidas-vacio",
      "cmv2-coincidencia-vacio",
      "cmg-vacio-tabla",
    ].join("|") +
    ")(?![\\w-])",
);
// Una espera con objeto («Leyendo el escenario…») escrita como texto. Dentro de
// `label=` es el rótulo de LoadingBlock; el rótulo ocupado de un botón
// («Calculando…» en un ternario) tampoco es una carga de superficie.
const ESPERA_A_MANO = /(Leyendo|Cargando|Comparando) [^"'`<>{}]*…/;

describe("vacíos y cargas de Cálculo de muestra", () => {
  it("ninguna hoja ni componente usa las clases propias de vacío de bloque", () => {
    const fuentes = archivos(aqui, /\.(tsx|ts|css)$/);
    // Centinela: el barrido mira de verdad el feature (≈460 fuentes al 2 nov 2026).
    expect(fuentes.length).toBeGreaterThan(350);
    const hallazgos = fuentes.flatMap((f) =>
      lineasDeCodigo(readFileSync(f, "utf8"))
        .map((l, i) => (CLASES_VIEJAS.test(l) ? `${rel(f)}:${i + 1}` : null))
        .filter((x): x is string => x !== null),
    );
    expect(hallazgos).toEqual([]);
  });

  it("una espera de bloque va por LoadingBlock, no como texto suelto", () => {
    const componentes = archivos(aqui, /\.tsx$/);
    const usos = componentes.reduce((n, f) => n + (readFileSync(f, "utf8").match(/<EstadoVacio\b/g)?.length ?? 0), 0);
    // Centinela: el barrido ve los vacíos migrados (27 sitios al 2 nov 2026).
    expect(usos).toBeGreaterThan(20);
    const hallazgos = componentes.flatMap((f) =>
      lineasDeCodigo(readFileSync(f, "utf8"))
        .map((l, i) =>
          ESPERA_A_MANO.test(l) && !/\blabel=/.test(l) && !/\?\s*"(Leyendo|Cargando)/.test(l)
            ? `${rel(f)}:${i + 1}: ${l.trim()}`
            : null,
        )
        .filter((x): x is string => x !== null),
    );
    expect(hallazgos).toEqual([]);
  });

  it("el detector reconoce lo que prohíbe (no es un guard que no guarda)", () => {
    expect(ESPERA_A_MANO.test('<p className="cmv2-sal-nota">Leyendo el escenario…</p>')).toBe(true);
    expect(ESPERA_A_MANO.test('{ocupado ? "Leyendo…" : "Leer"}')).toBe(false);
    expect(CLASES_VIEJAS.test('<div className="cmv2-classroom-empty is-compact">')).toBe(true);
    expect(CLASES_VIEJAS.test('<p className="cmv2-crit-empty-note">')).toBe(false);
  });
});
