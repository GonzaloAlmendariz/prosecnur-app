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
