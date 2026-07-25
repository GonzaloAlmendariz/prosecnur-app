import fs from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

/**
 * Contrato: la dirección canónica se lee por el hook compartido, no a mano.
 *
 * `lib/navegacion/` resuelve la gramática completa del ADR 0044, pero durante
 * mucho tiempo no la expuso como hook, así que seis módulos escribieron su
 * propio lector importando la constante `PARAMS_DIRECCION` (o redefiniendo el
 * literal) y armando el `URLSearchParams` a mano. Cada uno resolvió a su manera
 * el default de sección y el descarte de la pestaña al cambiar de sección — y
 * varios no lo resolvieron.
 *
 * Este test no los migra: son seis refactors de navegación con su propio riesgo
 * y no entran en el trabajo de chrome. Lo que hace es congelar la lista, para
 * que el séptimo no aparezca. La whitelist SOLO puede encoger: `toEqual` falla
 * igual si aparece un lector nuevo que si se migra uno viejo sin actualizar la
 * lista, y en ese segundo caso el arreglo es borrar la línea.
 */

const AQUI = fileURLToPath(new URL(".", import.meta.url));
const SRC = join(AQUI, "..", "..");

/**
 * Los lectores ad hoc que existían cuando se escribió el hook compartido.
 * Orden alfabético. Al migrar uno, se borra su línea.
 */
const LECTORES_HEREDADOS = [
  "features/analitica/AnaliticaPage.tsx",
  "features/bitacora/BitacoraPage.tsx",
  "features/calcMuestra/CalcMuestraPage.tsx",
  "features/codificacion/CodificacionPage.tsx",
  "features/hojasRuta/hojasRutaNavigation.ts",
  "features/monitoreo/shell/MonitoreoModuleChrome.tsx",
  "features/monitoreo/useMonitoreoDireccion.ts",
] as const;

/** El dueño de la gramática puede hacer lo que quiera con ella. */
const DUENO = "lib/navegacion/";

/** Quita comentarios para no acusar a un archivo por lo que dice su prosa. */
function sinComentarios(codigo: string): string {
  return codigo
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/** Mismo recorrido que los demás contract tests: `fs`, sin dependencia extra. */
function archivosFuente(dir: string = SRC): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = join(dir, entrada.name);
    if (entrada.isDirectory()) {
      if (entrada.name === "node_modules" || entrada.name === "__tests__") return [];
      return archivosFuente(ruta);
    }
    if (!/\.tsx?$/.test(entrada.name)) return [];
    if (/\.(?:test|spec)\.tsx?$/.test(entrada.name)) return [];
    return [relative(SRC, ruta).split(sep).join("/")];
  });
}

describe("lectores de la dirección canónica", () => {
  test("nadie nuevo lee la dirección a mano", () => {
    const archivos = archivosFuente();
    const infractores: string[] = [];

    for (const rel of archivos) {
      if (rel.startsWith(DUENO)) continue;
      const codigo = sinComentarios(fs.readFileSync(join(SRC, rel), "utf8"));

      const leeConstante = /\bPARAMS_DIRECCION\b/.test(codigo);
      const leeSearchParams = /\buseSearchParams\b/.test(codigo);
      // Una ASIGNACIÓN del literal, no una comparación: `variant === "panel"`
      // es una pregunta legítima sobre una variante visual y no tiene nada que
      // ver con la gramática de direcciones.
      const redefineLiteral =
        /(?:const|let|var)\s+\w+\s*(?::[^=]+)?=\s*"(?:modo|seccion|pestana|panel|foco)"\s*;/
          .test(codigo);

      if (!leeConstante && !leeSearchParams && !redefineLiteral) continue;
      infractores.push(rel);
    }

    expect(
      infractores.sort(),
      "Un lector de dirección nuevo. Usa `useSeccion(modulo)` de " +
        "lib/navegacion/useDireccion.ts: resuelve el default del manifiesto y " +
        "descarta los niveles hijos al cambiar de nivel padre, que es lo que " +
        "cada lector a mano resolvió distinto. Si migraste uno de los " +
        "heredados, borra su línea de LECTORES_HEREDADOS.",
    ).toEqual([...LECTORES_HEREDADOS].sort());
  });

  test("el hook compartido no reimplementa el parseo de la gramática", () => {
    const hook = fs.readFileSync(join(AQUI, "useDireccion.ts"), "utf8");
    const cuerpo = sinComentarios(hook);
    // La tentación al escribir un hook así es rehacer el parseo "porque es
    // corto". `direccion.ts` ya resuelve los alias legacy POR MÓDULO (`tab`
    // significa sección en Monitoreo y pestaña en Hojas de ruta), y eso es
    // justo lo que un parseo nuevo pierde.
    expect(cuerpo).toContain("parsearDireccion");
    expect(
      /new URLSearchParams\(/.test(cuerpo),
      "el hook debe delegar en conNivel/parsearDireccion, no armar params",
    ).toBe(false);
  });

  test("la whitelist no tiene entradas muertas", () => {
    const archivos = new Set(archivosFuente());
    const inexistentes = LECTORES_HEREDADOS.filter((r) => !archivos.has(r));
    expect(
      inexistentes,
      "una entrada de LECTORES_HEREDADOS apunta a un archivo que ya no existe",
    ).toEqual([]);
  });
});
