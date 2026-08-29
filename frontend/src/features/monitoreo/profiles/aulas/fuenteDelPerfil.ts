import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * La fuente del perfil de aulas, entera, para los tests que comprueban que una
 * PISTA existe —un rótulo, una unidad declarada, un aviso— sin importar en qué
 * archivo viva.
 *
 * **Por qué existe.** Varios tests leían `AulasMonitoreoPage.tsx` con
 * `readFileSync` y afirmaban que contiene tal frase. Eso ató contratos de
 * vocabulario a un archivo concreto, y el GOAL de 2026-08-28 pide justo lo
 * contrario: partir ese archivo, que iba por 2.949 líneas, en una pestaña por
 * fichero. Cada extracción rompía tests que no protegían nada roto — la frase
 * seguía ahí, en otro sitio.
 *
 * Un test que quiera comprobar algo del page-file EN PARTICULAR —un contrato de
 * layout, un import— sigue leyéndolo directo. Éste es para lo otro: «esta
 * pantalla dice de dónde sale su cifra».
 */
const aqui = path.dirname(fileURLToPath(import.meta.url));

export function fuenteDelPerfilDeAulas(): string {
  return fs.readdirSync(aqui)
    .filter((f) => (f.endsWith(".tsx") || f.endsWith(".ts"))
      && !f.endsWith(".test.ts") && !f.endsWith(".test.tsx"))
    .sort()
    .map((f) => fs.readFileSync(path.join(aqui, f), "utf8"))
    .join("\n");
}

/**
 * El page-file MÁS los trozos en que se está partiendo: `AulasPestana*.tsx` y
 * `AulasSeccion*.tsx`.
 *
 * Es la misma superficie que antes era un solo archivo, y sirve para los
 * contratos que hablan de ESA pantalla —qué títulos tiene, cómo se distinguen—
 * y no del perfil entero. Usar `fuenteDelPerfilDeAulas()` para esto arrastra
 * los componentes hoja, que tienen sus propios encabezados y nunca estuvieron
 * bajo ese contrato: al probarlo aparecieron cinco «choques» que sólo eran eso.
 */
export function fuenteDelPageDeAulas(): string {
  return fs.readdirSync(aqui)
    .filter((f) => f === "AulasMonitoreoPage.tsx"
      || ((f.startsWith("AulasPestana") || f.startsWith("AulasSeccion")) && f.endsWith(".tsx")))
    .filter((f) => !f.endsWith(".test.tsx"))
    .sort()
    .map((f) => fs.readFileSync(path.join(aqui, f), "utf8"))
    .join("\n");
}

/**
 * TODAS las hojas de estilo del perfil, concatenadas.
 *
 * `aulasMonitoreo.css` se está partiendo (N1 del GOAL 2026-08-28) y los
 * contratos que enumeraban las hojas POR NOMBRE dejan de ver lo que se muda:
 * `cssSinDuenoTests` listaba cuatro ficheros y el primer corte —la cadena de
 * reemplazos— habría quedado fuera de su vigilancia sin que nada fallara. Es la
 * misma lista cerrada que ya mordió en el lado TS y que allí resolvió
 * `fuenteDelPerfilDeAulas()`.
 *
 * Un test que compruebe una regla de UNA hoja concreta sigue leyéndola directo.
 * Ésta es para los contratos que hablan del perfil entero.
 */
export function cssDelPerfilDeAulas(): string {
  return fs.readdirSync(aqui)
    .filter((f) => f.endsWith(".css"))
    .sort()
    .map((f) => fs.readFileSync(path.join(aqui, f), "utf8"))
    .join("\n");
}
