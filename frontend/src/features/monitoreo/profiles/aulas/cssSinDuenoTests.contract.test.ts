import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Ninguna regla del perfil debe estilar una clase que ya no existe.
 *
 * Cuando se retira un componente su CSS no se va con él, y nada falla: las
 * reglas simplemente dejan de aplicarse. Medido al escribir esto: de **285
 * clases** declaradas por el perfil, **cuatro** no las nombraba ningún `.tsx` —
 * `aulas-cuotas-chart` y `aulas-cuotas-cortes` son de `AulasCuotasChart`,
 * borrado en `fcf57647`, y `aulas-mon-tabs` de las pestañas que pasaron al rail
 * en `ecbb059e`. **78 líneas de CSS** que llevaban commits sin poder aplicarse.
 *
 * Lo peor no es el peso: es que quien lee la hoja cree que esas reglas hacen
 * algo, y las respeta al tocar lo de al lado.
 *
 * OJO CON LOS FALSOS POSITIVOS —éste me pilló—: las clases compuestas en
 * runtime no aparecen literales en el código. `aulas-kpi--warn` salía como
 * huérfana y se construye con `` `aulas-kpi--${kpi.tone}` ``.
 *
 * Pero admitir el prefijo a secas es DEMASIADO permisivo, y también me pilló:
 * con esa regla, `aulas-cuotas-cortes` pasaba porque existe
 * `aulas-cuotas-resumen`, o sea que el prefijo `aulas-cuotas-` blanqueaba a toda
 * su familia. Un mutante que reponía una regla muerta sobrevivió. Ahora se exige
 * que el prefijo vaya seguido de una INTERPOLACIÓN —`aulas-kpi--${`—, que es lo
 * único que prueba que se compone en runtime.
 */

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, "..", "..", "..", "..");

function fuentesDelFrontend(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    const ruta = join(dir, e.name);
    if (e.isDirectory()) fuentesDelFrontend(ruta, acc);
    else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) acc.push(ruta);
  }
  return acc;
}

describe("el CSS del perfil no estila clases que ya no existen", () => {
  it("cada clase propia que declara la hoja la usa algún componente", () => {
    const css = ["aulasMonitoreo.css", "registroDeCampo.css"]
      .map((f) => readFileSync(join(AQUI, f), "utf-8")).join("\n");
    const declaradas = new Set(
      [...css.matchAll(/\.((?:aulas|registro-campo)[a-z0-9-]*)/g)].map((m) => m[1]),
    );
    const codigo = fuentesDelFrontend(RAIZ).map((f) => readFileSync(f, "utf-8")).join("\n");

    const huerfanas = [...declaradas].filter((clase) => {
      if (codigo.includes(clase)) return false;
      // Compuesta en runtime: sólo cuenta si el prefijo va seguido de `${`.
      // Sin esa exigencia, `aulas-cuotas-resumen` blanquearía a toda la familia
      // `aulas-cuotas-*`, muertas incluidas.
      for (let i = clase.length; i > 0; i -= 1) {
        if (clase[i - 1] !== "-") continue;
        if (codigo.includes(`${clase.slice(0, i)}\${`)) return false;
      }
      return true;
    });
    expect(huerfanas.sort()).toEqual([]);
  });
});
