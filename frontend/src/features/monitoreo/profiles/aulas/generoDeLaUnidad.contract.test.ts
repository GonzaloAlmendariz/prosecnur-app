import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * La unidad es el CURSO-HORARIO, y es masculina.
 *
 * El vocabulario ya tiene guard: `vocabularioDeLaUnidad.contract.test.ts` caza
 * la palabra «aula» usada como unidad. Pero al quitar la palabra queda el
 * género, y ése no lo veía nadie: «Aplicada», «Agendada», «Reemplazada»
 * concordaban con un sustantivo que ya no está en la frase.
 *
 * Medido el 2026-08-30: **veinte literales** en seis archivos que ninguna
 * prueba cubría, y tres de ellos —`STATUS_LABELS`, `ESTADOS_OPERATIVOS` y
 * `queTocaConCadaAula`— publicaban el MISMO estado por su cuenta. Al corregir
 * dos, el tercero quedó atrás; lo delató su propio test, que era el único que
 * existía. Este contrato es para que no haga falta esa suerte.
 *
 * **No es una regla de ortografía, es de sujeto.** Tres literales femeninos del
 * perfil son correctos porque su sujeto NO es la unidad, y están abajo con su
 * motivo. Añadir uno exige decir de qué habla; si la respuesta es «del
 * curso-horario», entonces es el defecto que este test busca, no una excepción.
 */
const RAICES = [
  "aplicad", "agendad", "reagendad", "reemplazad",
  "contactad", "citad", "cerrad", "descartad", "planificad", "cancelad",
];

/** Femeninos legítimos: su sujeto no es la unidad. */
const OTRO_SUJETO = new Map<string, string>([
  ["descartadas por el filtro", "las ENCUESTAS que el filtro de validez rechaza, no cursos-horario"],
]);

/**
 * **Una clave no es un rótulo.** `ESTADOS_OPERATIVOS` lo dice en su propio
 * comentario: «la clave viaja; la etiqueta se queda en la pantalla». Las claves
 * llegan del motor en minúscula y de una sola palabra (`"aplicada"`,
 * `"reemplazada"`) y cambiarlas rompería la comparación con el payload; lo que
 * el lector ve son los rótulos. De ahí la frontera: mayúscula inicial, o
 * minúscula con más de una palabra —«agendados, todavía sin salir a campo»— es
 * texto de pantalla; una palabra suelta en minúscula es clave y se respeta.
 */
function esRotulo(literal: string): boolean {
  return /^[A-ZÁÉÍÓÚÑ]/.test(literal) || /\s/.test(literal);
}

const AQUI = new URL(".", import.meta.url).pathname;

function fuentes(dir: string): string[] {
  const salida: string[] = [];
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) salida.push(...fuentes(ruta));
    else if (/\.tsx?$/.test(entrada) && !/\.test\./.test(entrada)) salida.push(ruta);
  }
  return salida;
}

/** Sin comentarios: la prosa explicativa puede citar el texto viejo. */
function sinComentarios(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("el género de las etiquetas concuerda con la unidad", () => {
  it("ningún rótulo del perfil habla del curso-horario en femenino", () => {
    const mayus = RAICES.map((r) => r[0].toUpperCase() + r.slice(1)).join("|");
    const patron = new RegExp(`"((?:${RAICES.join("|")}|${mayus})a(?:s)?\\b[^"]{0,40})"`, "g");
    const hallados: string[] = [];

    for (const archivo of fuentes(AQUI)) {
      const limpio = sinComentarios(readFileSync(archivo, "utf8"));
      for (const m of limpio.matchAll(patron)) {
        if (!esRotulo(m[1]) || OTRO_SUJETO.has(m[1])) continue;
        hallados.push(`${archivo.split("/aulas/")[1]}: "${m[1]}"`);
      }
    }

    expect(hallados, hallados.length
      ? `Participios en femenino sobre la unidad, que es masculina:\n  ${hallados.join("\n  ")}\n`
        + "Si el sujeto NO es el curso-horario, decláralo en OTRO_SUJETO con su motivo."
      : "").toEqual([]);
  });

  it("las excepciones siguen existiendo: una lista que ya no aplica no protege nada", () => {
    const todo = fuentes(AQUI).map((f) => readFileSync(f, "utf8")).join("\n");
    for (const [literal, motivo] of OTRO_SUJETO) {
      expect(todo.includes(`"${literal}"`), `«${literal}» ya no está en el perfil (${motivo}); quítala de OTRO_SUJETO`).toBe(true);
    }
  });
});
