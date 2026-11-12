import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * La banda de cifras de las pestañas de Analítica (`CifrasPestana`) se lee en
 * castellano normal: "Tablas en el archivo 27", no "TABLAS EN EL ARCHIVO 27".
 * La hoja no transforma el rótulo ni lo espacia como versalitas, y ninguna de
 * las ocho pestañas que la usan escribe el rótulo en mayúsculas en el código.
 */

const aqui = path.dirname(fileURLToPath(import.meta.url));
const leer = (rel: string) => readFileSync(path.join(aqui, rel), "utf8");

/** Las declaraciones de la regla con ese selector exacto, sin comentarios. */
function regla(css: string, selector: string): string {
  const limpio = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const bloques = [...limpio.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
  return bloques
    .filter(([, sel]) => sel.split(",").map((s) => s.trim()).includes(selector))
    .map(([, , cuerpo]) => cuerpo)
    .join("\n");
}

/** Pone el rótulo en versalitas: mayúsculas por transformación o espaciado de letras. */
const enVersalitas = (declaraciones: string) =>
  /text-transform\s*:\s*uppercase/.test(declaraciones)
  || [...declaraciones.matchAll(/letter-spacing\s*:\s*([^;]+)/g)]
    .some(([, valor]) => !/^(0(\.0+)?(em|px)?|normal)$/.test(valor.trim()));

/** Un rótulo literal escrito entero en mayúsculas (siglas de hasta cuatro letras aparte). */
const rotulosEnMayusculas = (fuente: string) =>
  [...fuente.matchAll(/etiqueta:\s*"([^"]+)"/g)]
    .map(([, rotulo]) => rotulo)
    .filter((rotulo) => /\p{L}{5,}/u.test(rotulo) && rotulo === rotulo.toLocaleUpperCase("es"));

const USOS = [
  "panes/DimensionesPane.tsx",
  "panes/DataReviewPane.tsx",
  "panes/CrucesPane.tsx",
  "panes/ComparativosPane.tsx",
];

describe("banda de cifras en castellano normal", () => {
  it("la etiqueta de la cifra no va en versalitas", () => {
    const declaraciones = regla(leer("cifrasPestana.css"), ".analitica-cifra-etiqueta");
    expect(declaraciones).not.toBe("");
    expect(enVersalitas(declaraciones)).toBe(false);
  });

  it("ninguna pestaña escribe el rótulo de una cifra en mayúsculas", () => {
    const hallados = USOS.flatMap((rel) => rotulosEnMayusculas(leer(rel)).map((r) => `${rel}: ${r}`));
    expect(hallados).toEqual([]);
  });

  it("los detectores reconocen lo que prohíben", () => {
    expect(enVersalitas("font-size: 1px; text-transform: uppercase;")).toBe(true);
    expect(enVersalitas("letter-spacing: 0.04em;")).toBe(true);
    expect(enVersalitas("letter-spacing: 0;")).toBe(false);
    expect(rotulosEnMayusculas('{ etiqueta: "TABLAS EN EL ARCHIVO" }')).toEqual(["TABLAS EN EL ARCHIVO"]);
    expect(rotulosEnMayusculas('{ etiqueta: "Formatos", valor: "SAV" }')).toEqual([]);
  });
});
