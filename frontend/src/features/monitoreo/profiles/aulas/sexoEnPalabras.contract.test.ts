import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { etiquetaDeSexo } from "./etiquetaDeSexo";

/**
 * El sexo llega como letra y a pantalla va en palabras.
 *
 * El payload trae `"M"` / `"F"` —medido el 2026-08-30: los tres bloques que lo
 * publican (`quotas_sex_faculty`, `avance_sexo_facultad`, `reserva_dirigida`)
 * usan la letra— y la instrucción es explícita: «lo que me interesa es cuántos
 * hombres y cuántas mujeres».
 *
 * **De las tres copias que había de esta traducción en el perfil, una no
 * traducía**: `alertaDeAnticipacion` hacía `.sexo.toLowerCase()` y publicaba
 * «faltan 48 · 38 m», que se lee como 38 metros. Este guard vigila la FORMA que
 * produjo ese defecto, porque el test de comportamiento no lo vio: su fixture
 * usaba «Hombre»/«Mujer», valores que el backend no produce, y con ellos el
 * `.toLowerCase()` daba algo legible.
 */

const RAIZ = new URL(".", import.meta.url).pathname;

function fuentes(dir: string, acc: string[] = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) fuentes(p, acc);
    else if (/\.tsx?$/.test(e) && !/\.test\.|\.contract\./.test(e)) acc.push(p);
  }
  return acc;
}

const sinComentarios = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

describe("el sexo no se publica como la letra que llega del payload", () => {
  // **Centinela de no-mudez.** El barrido recorre el árbol del perfil y luego
  // se afirma que no hay culpables. Si dejara de encontrar fuentes —un
  // renombre, una carpeta que se mueve— la lista saldría vacía y el guard
  // pasaría en verde sin haber leído un solo archivo.
  it("el barrido encuentra las fuentes del perfil, o no está guardando nada", () => {
    expect(fuentes(RAIZ).length).toBeGreaterThan(40);
  });

  it("nadie pasa `.sex`/`.sexo` por `toLowerCase()` para pintarlo", () => {
    // Ésta es exactamente la línea que publicaba «38 m». Bajar el caso de una
    // letra no la convierte en palabra.
    const culpables: string[] = [];
    for (const f of fuentes(RAIZ)) {
      const src = sinComentarios(readFileSync(f, "utf8"));
      if (/\.sexo?\s*\.\s*toLowerCase\s*\(/.test(src)) culpables.push(f.split("/").pop()!);
    }
    expect(culpables, `pintan la letra en minúscula: ${culpables.join(", ")}`).toEqual([]);
  });

  it("la traducción vive en un solo sitio del perfil", () => {
    // Tres copias había, y una estaba rota. La de series de gráfico
    // (`sexSeriesLabel`) es de calcMuestra y tiene otra semántica —da también
    // el color de la serie—, así que no cuenta como copia de ésta.
    const propias: string[] = [];
    for (const f of fuentes(RAIZ)) {
      const nombre = f.split("/").pop()!;
      if (nombre === "etiquetaDeSexo.ts") continue;
      const src = sinComentarios(readFileSync(f, "utf8"));
      // Un ternario que mapea la letra a la palabra, en cualquier orden.
      if (/===\s*"[FM]"\s*\?\s*"(mujeres|hombres|Mujeres|Hombres)"/.test(src)) propias.push(nombre);
    }
    expect(propias, `traducen el sexo por su cuenta: ${propias.join(", ")}`).toEqual([]);
  });

  it("el helper devuelve palabras para las dos letras reales", () => {
    // El control del guard: si `etiquetaDeSexo` dejara de traducir, los dos
    // asertos de arriba seguirían verdes sobre un perfil roto.
    expect(etiquetaDeSexo("M")).toBe("hombres");
    expect(etiquetaDeSexo("F")).toBe("mujeres");
    expect(etiquetaDeSexo("m")).toBe("hombres");
    expect(etiquetaDeSexo("M", { mayuscula: true })).toBe("Hombres");
  });

  it("y no inventa un sexo para lo que no reconoce", () => {
    expect(etiquetaDeSexo("X")).toBe("x");
    expect(etiquetaDeSexo("")).toBe("");
    expect(etiquetaDeSexo(null)).toBe("");
  });
});
