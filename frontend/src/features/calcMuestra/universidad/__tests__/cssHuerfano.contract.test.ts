import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * F101 · La deuda que ningún compilador cobra.
 *
 * El typecheck protege el TSX y no mira el CSS. Cuando un componente cambia de
 * elemento —`<details>` a `<section>`— o una pieza se retira, sus reglas siguen
 * ahí, válidas y muertas. Medido al escribir esto: 95 clases `cmv2-*` declaradas
 * sin un solo uso en el marcado, incluidas tres reglas de `> summary` para
 * elementos que llevan iteraciones sin ser `<details>`.
 *
 * Este contrato NO exige cero: exige que no suba. La deuda vieja se paga en el
 * lote de su pestaña; lo que este guard impide es traer deuda nueva.
 */

const RAIZ = join(__dirname, "..", "..");

function archivos(dir: string, ext: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) archivos(p, ext, acc);
    else if (e.endsWith(ext)) acc.push(p);
  }
  return acc;
}

/** Quita comentarios de bloque y de línea: son prosa, no marcado. */
function sinComentarios(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

/** Clases `cmv2-*` declaradas en una hoja, sin comentarios. */
function clasesDeclaradas(css: string): string[] {
  const sinComentarios = css.replace(/\/\*[\s\S]*?\*\//g, "");
  return [...new Set(sinComentarios.match(/\.cmv2-[a-z0-9-]+/g) ?? [])].map((c) => c.slice(1));
}

const marcado = archivos(RAIZ, ".tsx")
  .concat(archivos(RAIZ, ".ts"))
  .map((f) => readFileSync(f, "utf8"))
  .join("\n");

function huerfanasDe(area: string): string[] {
  const dir = join(RAIZ, "universidad");
  return archivos(dir, ".css")
    .filter((f) => f.slice(dir.length + 1).startsWith(area))
    .flatMap((f) => clasesDeclaradas(readFileSync(f, "utf8")))
    .filter((c) => !marcado.includes(c));
}

/**
 * Línea base por pestaña, medida el 2026-08-02. Un número sólo puede BAJAR: si
 * un lote paga su deuda, se baja aquí y queda cerrado. Subirlo es una decisión
 * deliberada que se argumenta, no un efecto colateral de un cambio de marcado.
 */
const BASELINE: Record<string, number> = {
  aulas: 17,
  calculo: 29,
  criterios: 5,
  definicion: 23,
  marco: 11,
  salidas: 1,
  "universidad-base.css": 9,
};

describe("CSS huérfano por pestaña — la deuda no sube (F101)", () => {
  for (const [area, tope] of Object.entries(BASELINE)) {
    it(`${area}: como mucho ${tope} clases sin uso en el marcado`, () => {
      const sin = huerfanasDe(area);
      // El mensaje trae los nombres: un número a secas obliga a repetir el
      // barrido a mano para saber cuál se coló.
      expect(sin.length, `sin uso en ${area}: ${sin.join(", ")}`).toBeLessThanOrEqual(tope);
    });
  }
});

describe("Nada oculto en la superficie de criterios (ADR 0057)", () => {
  /**
   * «Si algo está oculto es un error de diseño». Un `<details>` cerrado esconde
   * lo que la pestaña existe para mostrar; en Particularidades escondía además
   * las filas donde se decide, bajo una cabecera que contaba «K sin decidir».
   *
   * El guard cubre criterios y marco. Aulas, Definición y Salidas conservan los
   * suyos y se atienden en su propio lote: declararlo aquí evita el falso verde
   * de un guard que parece cubrir el módulo entero.
   */
  const CUBIERTO = ["criterios", "marco"];

  for (const area of CUBIERTO) {
    it(`${area} no usa <details> para plegar contenido`, () => {
      const dir = join(RAIZ, "universidad", area);
      const conDetails = archivos(dir, ".tsx")
        .filter((f) => !f.includes("__tests__"))
        // Sin comentarios: el primer intento marcó `CriterioFacultadRadiografia`,
        // donde el `<details>` aparece dentro de una nota que explica por qué ya
        // no hay ninguno. Un guard que no distingue marcado de prosa acusa
        // justamente al archivo que documenta la reparación.
        .filter((f) => /<details[\s>]/.test(sinComentarios(readFileSync(f, "utf8"))))
        .map((f) => f.slice(RAIZ.length + 1));
      expect(conDetails).toEqual([]);
    });
  }
});
