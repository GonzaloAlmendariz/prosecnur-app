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
   * El guard cubre criterios, marco y aulas. Definición y Salidas conservan los
   * suyos y se atienden en su propio lote: declararlo aquí evita el falso verde
   * de un guard que parece cubrir el módulo entero.
   *
   * `aulas` tiene **una** excepción declarada por nombre. La regla prohíbe
   * esconder el trabajo o la evidencia con la que se decide; el mensaje literal
   * del motor en `ClassroomRiskList` no es ninguna de las dos —es una traza que
   * no cambia ninguna decisión del estudio—. Nombrarla es lo que separa un
   * permiso de un olvido: cualquier `<details>` nuevo en aulas falla.
   */
  const CUBIERTO: Record<string, string[]> = {
    criterios: [],
    marco: [],
    aulas: ["ClassroomRiskList.tsx"],
  };

  for (const [area, permitidos] of Object.entries(CUBIERTO)) {
    it(`${area} no pliega nada fuera de lo declarado`, () => {
      const dir = join(RAIZ, "universidad", area);
      const conDetails = archivos(dir, ".tsx")
        .filter((f) => !f.includes("__tests__"))
        // Sin comentarios: el primer intento marcó `CriterioFacultadRadiografia`,
        // donde el `<details>` aparece dentro de una nota que explica por qué ya
        // no hay ninguno. Un guard que no distingue marcado de prosa acusa
        // justamente al archivo que documenta la reparación.
        .filter((f) => /<details[\s>]/.test(sinComentarios(readFileSync(f, "utf8"))))
        .map((f) => f.slice(RAIZ.length + 1))
        .filter((f) => !permitidos.some((p) => f.endsWith(p)));
      expect(conDetails).toEqual([]);
    });
  }

  /**
   * F103 · El agujero del guard anterior.
   *
   * Buscaba `<details>` **literal** en cada archivo, así que un componente que
   * pliega por dentro pasaba invisible: `PanelAvanzado` renderiza un `<details>`
   * cerrado y estaba montado en Aulas —área supuestamente cubierta— escondiendo
   * la semilla y los pesos del objetivo. El guard daba verde.
   *
   * Ahora se resuelve la transitividad: se localizan los componentes locales que
   * renderizan un `<details>` y se exige que cada montaje suyo en área cubierta
   * declare `defaultOpen`.
   */
  it("un componente que pliega por dentro no se cuela por montaje", () => {
    const plegadores = archivos(join(RAIZ, "universidad"), ".tsx")
      .filter((f) => !f.includes("__tests__"))
      .filter((f) => /<details[\s>]/.test(sinComentarios(readFileSync(f, "utf8"))))
      .map((f) => f.split("/").pop()!.replace(/\.tsx$/, ""))
      // El del mensaje del motor no exporta un componente reutilizable.
      .filter((n) => n !== "ClassroomRiskList");

    const cerrados: string[] = [];
    for (const area of Object.keys(CUBIERTO)) {
      for (const f of archivos(join(RAIZ, "universidad", area), ".tsx")) {
        if (f.includes("__tests__")) continue;
        const src = sinComentarios(readFileSync(f, "utf8"));
        for (const comp of plegadores) {
          // Cada apertura del componente, con sus props hasta el `>` de cierre.
          for (const m of src.matchAll(new RegExp(`<${comp}\\b[^>]*>`, "g"))) {
            if (!/defaultOpen/.test(m[0])) cerrados.push(`${f.slice(RAIZ.length + 1)} → ${comp}`);
          }
        }
      }
    }
    expect(cerrados).toEqual([]);
  });

  it("la excepción de aulas sigue existiendo: el permiso no es letra muerta", () => {
    // Si `ClassroomRiskList` deja de tener su `<details>`, este permiso sobra y
    // hay que retirarlo. Un allowlist que ya no protege nada es la puerta por
    // la que vuelve a entrar lo que excluía.
    const f = join(RAIZ, "universidad", "aulas", "ClassroomRiskList.tsx");
    expect(/<details[\s>]/.test(sinComentarios(readFileSync(f, "utf8")))).toBe(true);
  });
});
