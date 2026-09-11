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
  // «Activada el» vivía en FIELD_LABELS y esta lista no la veía. El campo se
  // escribe en `plan[[pos]]$activated_at`, o sea sobre un curso-horario.
  "activad",
];

/** Femeninos legítimos: su sujeto no es la unidad. */
const OTRO_SUJETO = new Map<string, string>([
  // «descartadas por el filtro» salió del perfil el 2026-09-07: metía en la
  // misma bolsa las respuestas que no son del estudio y las que no pasan el
  // criterio. Los rótulos que la sustituyen no llevan femenino colgado, así que
  // esta lista no necesita entrada — y una excepción que ya no aplica no
  // protege nada, que es justo lo que este test vigila.
  ["tienen parte y no tienen fecha agendada", "la FECHA, que es femenina y está bien así"],
  // El title del KPI «Días de campo»: la que está agendada es la CITA (el
  // acuerdo con el docente — el sentido en que «cita» sigue siendo la
  // palabra tras el barrido citas→aplicaciones), no el curso-horario.
  ["Fechas distintas con al menos una cita agendada", "la CITA pactada con el docente, femenina"],
  // El verbo con el que termina cada fila de «Cada cadena, eslabón a eslabón»:
  // lo que se cierra ahí es la CADENA —la unidad de esa superficie, y femenina
  // en todo el perfil desde que existe «Cadena de reemplazos»—, no el
  // curso-horario. Su vecina «cerrada por {código}» no la ve este detector
  // porque va interpolada, y es el mismo sujeto.
  ["cerrada por su titular", "la CADENA de reemplazos, que es la unidad de esa vista"],
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
    const cuerpo = `(?:${RAICES.join("|")}|${mayus})a(?:s)?\\b`;
    // Dos formas de escribir un rótulo, y la segunda faltaba: «Reemplazadas»
    // era una cabecera de columna en JSX plano —`<span …>Reemplazadas</span>`—
    // sin comillas alrededor, así que el barrido de literales no la alcanzaba.
    // **Tercer brazo: la prosa larga.** Los dos de arriba miran el principio del
    // literal, y una pista de KPI decía «…y el operativo, que ya está agendada»
    // con setenta caracteres por delante. Se restringe a literales de 30+ y a
    // participio precedido de espacio: medido sobre el perfil entero, ese brazo
    // devuelve DOS resultados y uno solo es ruido —«fecha agendada», declarado
    // arriba—. Sin el mínimo de longitud caza clases CSS (`es-citada`) y trozos
    // de código partidos, que fue por lo que se descartó dos veces antes.
    // **Cuarto caso: el participio DESPUÉS de una interpolación.** Lo encontré a
    // ojo en una captura, no con este guard: `<em> · {reemplazadas} reemplazadas
    // no se registran</em>`. El brazo de JSX pide que el texto empiece justo
    // tras `>`, y aquí entre medias hay un `{…}`, así que ninguno de los tres
    // brazos lo veía. Basta con mirar también lo que sigue a una llave que
    // cierra.
    const patron = new RegExp(
      `"(${cuerpo}[^"]{0,40})"`
      + `|>\\s*(${cuerpo}[^<{]{0,40})<`
      + `|"([^"]{30,200}?\\s${cuerpo}[^"]{0,60})"`
      + `|\\}\\s*(${cuerpo}[^<{"]{0,40})`,
      "g",
    );
    const hallados: string[] = [];

    for (const archivo of fuentes(AQUI)) {
      const limpio = sinComentarios(readFileSync(archivo, "utf8"));
      for (const m of limpio.matchAll(patron)) {
        const literal = (m[1] ?? m[2] ?? m[3] ?? m[4]).trim();
        // El brazo de prosa larga puede cruzar la frontera entre dos literales y
        // traerse código por el medio. Una frase de pantalla no lleva salto de
        // línea ni llaves ni ángulos: eso es lo que separa la prosa del ruido.
        if (/[\n{}<>`]/.test(literal)) continue;
        if (!esRotulo(literal) || OTRO_SUJETO.has(literal)) continue;
        hallados.push(`${archivo.split("/aulas/")[1]}: "${literal}"`);
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
