import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const aqui = path.dirname(fileURLToPath(import.meta.url));

/**
 * **La unidad del estudio se llama curso-horario, y el perfil todavía dice
 * «aula» en 15 frases.**
 *
 * No son sinónimos. El ADR 0060 fija el principio: «cada vez que el operativo
 * **visita un curso-horario** se produce un encuentro con cada estudiante
 * matriculado en él». Un aula física puede albergar varios cursos-horario, así
 * que contar aulas y contar cursos-horario da números distintos.
 *
 * La unificación ya se hizo en el motor (ADR 0057) y en las seis pestañas de
 * Avance (commits `b2f8febd` y `a0d18856`, 30 frases revisadas una a una). El
 * resto del perfil —Fuentes, Agenda, Validación, Consultas y las ramas que el
 * proyecto de referencia no activa— sigue con el vocabulario viejo.
 *
 * ## Por qué un tope y no un cero
 *
 * El propio ADR 0057 prohíbe el atajo:
 *
 * > «El mismo término puede ser correcto en una frase e incorrecto en la de al
 * > lado… Un find-replace la habría convertido en una frase falsa. Los barridos
 * > de vocabulario se revisan frase por frase.»
 *
 * Y hay al menos un caso legítimo vivo: «cinco aulas con el rendimiento medio»
 * describía unidades imaginarias de un cálculo, no cursos-horario del plan.
 *
 * Así que esto es un **ratchet**: la deuda puede bajar y **nunca subir**. Cuando
 * alguien cierre frases, baja `TOPE` al número nuevo — el propio test lo dice en
 * su mensaje de fallo.
 */

/**
 * **Es un PISO, no un censo.** El detector exige un determinante o una cifra
 * delante —«las aulas», «304 aulas»— para no cazar identificadores de código, y
 * eso deja fuera las frases donde la palabra abre el literal: `"aulas sin sus
 * dos umbrales"` no contaba, y corregirla no movió este número. Sirve para lo
 * que se creó —impedir que la deuda crezca— pero su cifra es una cota inferior.
 *
 * **Cuánto es «un piso», medido.** Se probaron dos detectores más amplios: uno
 * que cuenta la palabra siempre que no forme parte de un identificador da 314, y
 * otro que exige contexto de frase da 123 — pero los dos siguen cazando código
 * (`const aulas = banco.disponibles`, `filas, falta, aulas`), en torno al 14 %
 * de lo que devuelven. **Un ratchet con falsos positivos es peor que uno
 * incompleto**: bloquea trabajo legítimo, porque el número no se puede bajar
 * arreglando prosa.
 *
 * Así que se conserva el preciso, y la magnitud real queda escrita aquí: la
 * deuda ronda las **120 frases**, no las 63 que este contador ve.
 *
 * Medido el 2026-08-29, después de cerrar las seis pestañas de Avance.
 */
// 23 → 17 el 2026-08-30, cerradas seis frases de PROSA con cifra: «N aulas
// tienen hora acordada», «N aulas se salen del resto», «N aulas de referencia»,
// «N aulas en curso», «N de M aulas ya tienen hora» y «N encuestas en N aulas».
//
// Las que quedan no son del mismo tipo:
//
//   · 17 → 13: cerradas las cuatro CABECERAS del libro de control. El sujeto NO
//     se recortó —«Tasa del curso-horario» frente a «Tasa de la facultad», «Peso
//     del curso-horario» frente a «Peso del estudiante»: el sujeto es justo el
//     contraste que las distingue—, así que se alargan. **Su ancho sigue sin
//     medirse**: esa tabla no se pinta en el estudio de referencia, que tiene el
//     libro sin columnas llenas. Red de seguridad: `AulasControlDelLibro` da a
//     cada cabecera su `title` con el texto completo, así que una elipsis ahí es
//     recuperable y C4 la admite en etiqueta.
//   · dos son la locución «aula por aula», impracticable en curso-horario.
//   · el resto habla del aula como ESPACIO, que es correcto y no se toca.
const TOPE = 13;

/**
 * Con determinante o cifra delante: en prosa siempre lo lleva; en código, no.
 *
 * **La alternativa `${...}` va FUERA del `\b`, y ahí estuvo ciego el detector.**
 * Con `\b` delante del grupo entero, `\b\$` exige un carácter de palabra
 * inmediatamente antes del `$` — y en un template literal al `${` siempre lo
 * precede un espacio, un backtick o un paréntesis. La alternativa casaba sólo en
 * `x${n} aulas`, que no existe en el código real: veinte frases con la cifra
 * interpolada —«${fmt(f.vencidas)} aulas», las MÁS visibles en pantalla— se
 * contaban como cero.
 *
 * El `(?!-)` final descarta `${className} aulas-foco-boton`: el guion cuenta
 * como frontera de palabra, así que un nombre de clase CSS casaba como prosa.
 */
/**
 * **«en el aula» es el SALÓN, y no cuenta.** Al añadir «el» a los determinantes,
 * el detector destapó ocho frases: cuatro hablaban de la unidad —«cerrar el
 * aula», «el aula se cae», «identifica el aula», «registrar el aula»— y se
 * corrigieron; las otras cuatro son locativas —«personas estaban en el aula»,
 * «quien estuvo en el aula»— y ahí «aula» es el espacio físico donde ocurrió la
 * sesión, que es su significado correcto.
 *
 * La frontera resultó ser exactamente la preposición: con «en» delante es un
 * lugar, sin ella es la unidad. Por eso se descuenta el locativo en vez de
 * mantener una lista de frases, que caducaría a la primera reescritura.
 */
const EN_EL_AULA_LOCATIVO = /\ben\s+el\s+aulas?\b(?!-)/gi;

// El cierre de etiqueta cuenta como contexto: la cifra suele ir envuelta y
// entonces antes de «aulas» no hay determinante sino `</strong>`. Encontrado el
// 2026-08-30 MIRANDO una captura —«77 aulas extra en 3 facultades»—, con el
// título del mismo panel diciendo ya «Cursos-horario extra disponibles». Es la
// misma familia que el `}` de la interpolación.
/**
 * **La pluralización por ternario**, que ninguno de los otros patrones ve.
 *
 * `x === 1 ? "aula" : "aulas"` no lleva determinante ni interpolación delante:
 * es el término solo, entre comillas. Encontrado el 2026-08-30 al reparar cuatro
 * frases que el contador seguía sin ver —y por eso el número no bajaba—.
 *
 * Se busca el patrón completo y no el literal suelto: `"aula"` a secas también es
 * una CLAVE —`FocoDeCuota` la usa como tipo, y `"aulas"` nombra al perfil
 * entero—, y esas no se tocan. Medido: de 18 literales exactos en el perfil, 4
 * eran pluralización y 14 identificadores.
 */
const PLURAL_TERNARIO = /\?\s*"aula"\s*:\s*"aulas"/g;

const EN_PROSA =
  /(?:\b(?:el|la|las|los|una|unas|un|esa|esas|este|esta|estas|ese|cada|entre|ninguna|ningún|ningun|otra|otras|misma|sin|de|del|en|por|su|sus|primera|primer|segunda|segundo|alguna|algún|algun|aquella|dicha|toda|todas|cualquier|única|unica|nueva|propia|\d+)|\$\{[^}]{0,40}\}|<\/\w+>)\s+aulas?\b(?!-)/gi;

/**
 * **Dos formas más que el detector de arriba no puede ver.**
 *
 * `EN_PROSA` exige un determinante o una cifra DELANTE, y en prosa hay dos
 * sitios donde el sustantivo no lo lleva:
 *
 * 1. **Al empezar un literal de texto**: `<h3>Aulas extra disponibles</h3>`,
 *    `aria-label="Aulas por pedir"`. Ahí abre la frase.
 * 2. **Detrás de un verbo copulativo o de existencia**: «son aulas
 *    adicionales», «no quedan aulas por aplicar», «hay aulas gestionadas».
 *
 * Medido el 2026-08-30 al ampliarlo: **10 del primer tipo y 3 del segundo**, y
 * el ratchet marcaba 27. Entre ellas un título de panel —«Aulas extra
 * disponibles»— y varios `aria-label`, que es lo único que oye quien no ve la
 * pantalla.
 *
 * El `["`>]` del primero es lo que lo separa de un identificador de código:
 * `AulasSeccionModelo` no va precedido de comilla ni de `>`.
 */
const AL_ABRIR_FRASE = /(?:["`>]\s*)Aulas?\b(?!-)/g;
const TRAS_VERBO =
  /\b(?:son|es|hay|quedan|había|habia|serán|seran|fueron)\s+aulas?\b(?!-)/gi;

function frasesConAula() {
  const fuentes = fs
    .readdirSync(aqui)
    .filter((f) => (f.endsWith(".ts") || f.endsWith(".tsx")) && !f.includes(".test."));
  const porArchivo: Array<[string, number]> = [];
  for (const archivo of fuentes) {
    const fuente = fs
      .readFileSync(path.join(aqui, archivo), "utf8")
      // Los comentarios explican por qué se retiró y citan el término.
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    const n = (fuente.match(EN_PROSA) ?? []).length
      + (fuente.match(AL_ABRIR_FRASE) ?? []).length
      + (fuente.match(TRAS_VERBO) ?? []).length
      // El locativo lo cuenta `EN_PROSA` por su «el», y hay que descontarlo: ahí
      // «aula» es el salón, no la unidad.
      - (fuente.match(EN_EL_AULA_LOCATIVO) ?? []).length
      + (fuente.match(PLURAL_TERNARIO) ?? []).length;
    if (n) porArchivo.push([archivo, n]);
  }
  return porArchivo;
}

describe("el vocabulario de la unidad sólo puede mejorar", () => {
  it(`no supera las ${TOPE} frases con «aula» medidas al cerrar Avance`, () => {
    const porArchivo = frasesConAula();
    const total = porArchivo.reduce((n, [, c]) => n + c, 0);
    const detalle = porArchivo
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([f, n]) => `${n} en ${f}`)
      .join(" · ");
    expect(
      total,
      `El perfil pasó de ${TOPE} a ${total} frases con «aula» en prosa. ` +
        `La unidad es el curso-horario (ADR 0060). Las que más acumulan: ${detalle}. ` +
        "Si vienes de CERRAR frases, baja TOPE a este número.",
    ).toBeLessThanOrEqual(TOPE);
  });

  it("y el contador mide algo: si diera cero, el ratchet no protegería nada", () => {
    // El control de fixture. Un regex roto devolvería 0 y el tope pasaría
    // siempre, que es el verde por ausencia que este repo ya se ha comido.
    const total = frasesConAula().reduce((n, [, c]) => n + c, 0);
    expect(total).toBeGreaterThan(0);
  });

  /**
   * **Un total distinto de cero no prueba que el regex esté entero.**
   *
   * El control de arriba pasaba con la alternativa `${...}` muerta: el detector
   * seguía devolviendo 15 por las otras alternativas, así que «no da cero» no
   * podía ver el agujero. En un regex compuesto, cada alternativa necesita su
   * propio caso o queda sin proteger.
   */
  it.each([
    ["cifra interpolada", "`${fmt(f.vencidas)} aulas vencidas con parte`", true],
    ["interpolada tras preposición", "`de ${fmt(p.universo)} aulas; cierre`", true],
    ["cifra literal", "30 aulas de la facultad", true],
    ["determinante", "ninguna aula tiene parte", true],
    ["nombre de clase CSS", "className={`${c} aulas-foco-boton`}", false],
    ["identificador de código", "const aulasPorFacultad = 1", false],
  ])("la alternativa «%s» %s", (_nombre, muestra, deberiaCasar) => {
    expect(new RegExp(EN_PROSA.source, "gi").test(muestra)).toBe(deberiaCasar);
  });
});
