import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const aqui = path.dirname(fileURLToPath(import.meta.url));

/**
 * **Una fila que es su propio grid no puede medir una columna por su contenido.**
 *
 * Estas listas no son tablas: cada fila es un `<button>` con su propio
 * `display: grid`. Una pista `max-content` o `auto` la mide entonces CADA fila
 * por separado, y el resto de columnas se desplaza con ella.
 *
 * Medido en pantalla el 2026-09-11, en «Cómo va cada facultad»: la pastilla del
 * veredicto iba a `max-content` y valía 92 px en Psicología, 105 en Ciencias
 * Sociales y 114 en Derecho. Con ella se movían la deuda (490/495/506), las
 * barras (587/592/603) y la tasa (944/954/976). Gonzalo: «no está alineado y se
 * ve mal», y tenía toda la razón: ninguna columna estaba en columna.
 *
 * El guard mira las hojas del perfil y exige que la ÚLTIMA pista de una fila-
 * rejilla sea de ancho determinado. Las intermedias pueden ser `fr` o `minmax`:
 * ésas reparten igual en todas las filas porque el contenedor mide lo mismo.
 */
describe("las filas-rejilla no miden columnas por su contenido", () => {
  const hojas = fs.readdirSync(aqui).filter((f) => f.endsWith(".css"));
  // Centinela de no-mudez: sin hojas, la lista de culpables sale vacía y el
  // guard pasa sin haber mirado nada.
  expect(hojas.length).toBeGreaterThan(20);

  it.each(hojas)("%s", (hoja) => {
    const fuente = fs.readFileSync(path.join(aqui, hoja), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    const culpables: string[] = [];
    for (const m of fuente.matchAll(/([^{}]+)\{([^{}]*grid-template-columns:[^;]+;[^{}]*)\}/g)) {
      const selector = m[1].trim().replace(/\s+/g, " ");
      // Sólo las filas de una lista: un grid de página puede medir por contenido
      // sin que nada se desalinee, porque hay uno solo.
      // `-cadena-pasos` es el CONTENEDOR de las filas, no una fila: su `auto`
      // lo miden todos sus hijos a la vez y por eso sí alinea.
      if (!/-fila(?![\w-])|-cadena(?![\w-])|-riesgo-lista li|-peor-lista li/.test(selector)) continue;
      // Un `li` con `subgrid` hereda las pistas del contenedor: ahí el `auto`
      // del fallback no decide nada.
      if (/grid-template-columns:\s*subgrid/.test(m[2])) continue;
      const pistas = /grid-template-columns:\s*([^;]+);/.exec(m[2])?.[1] ?? "";
      if (/\b(max-content|min-content|auto)\b/.test(pistas)) {
        culpables.push(`${hoja} · ${selector.slice(0, 60)} → ${pistas.trim()}`);
      }
    }
    expect(culpables, culpables.join("\n")).toEqual([]);
  });
});
