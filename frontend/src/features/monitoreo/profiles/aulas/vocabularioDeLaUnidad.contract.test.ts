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
// 2026-09-03 (loop mejora-ui E25): se cerraron SEIS frases más («N aulas no
// alcanzaron su meta», «N aulas» del eje del gasto, los dos pies de la malla
// («ya tienen hora», «no declaran horario»), «aulas gestionadas traen» y
// «necesitan aulas nuevas») y el contador NO se movió: todas caen fuera del
// detector preciso — las cuatro primeras porque la cifra va en llaves de JSX
// ({fmt(n)}), no en ${} de template, y las otras dos son del tipo tras-verbo
// no listado. Confirmación medida de que la cifra es cota inferior; el TOPE
// se queda donde el detector ve.
// 2026-09-07 (loop estética-aulas-sheets, A3): 13 → 12. Entró UNA frase legítima
// —el título de columna del libro «ALUMNOS EN AULA», que es el salón— y se
// cerraron dos de la unidad: «la agenda son aulas con fecha» (kpisDeAulas) y
// «la tasa del aula» (AulasSerieDeRendimiento) pasan a curso-horario.
const TOPE = 12;

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

/**
 * **Lo que queda cuando la palabra ya se cambió: la CONCORDANCIA.**
 *
 * El ratchet de arriba cuenta la palabra «aula», así que deja de ver una frase
 * en cuanto alguien escribe «curso-horario» y no toca el resto. Y el resto
 * seguía en femenino. Medido el 2026-08-31 leyendo las 774 frases visibles de
 * Avance, cuatro llegaron así hasta la pantalla:
 *
 *   «los 14 cursos-horario ... se cayeron TODAS ... no hay por donde LLAMARLAS»
 *   «N cursos-horario del plan la traen; LAS QUE no, quedarán sin juzgar»
 *   «este criterio no podría juzgar NINGUNA»
 *   «Ningún curso-horario evaluado se quedó corto: LAS QUE el libro evalúa...»
 *
 * El tope es CERO porque están cerradas. Un tope de cero exige el control de
 * fixture de más abajo con más razón que uno alto: sin él, un regex roto
 * pasaría siempre y en silencio.
 *
 * **Dos femeninos que NO entran, y por qué el detector tuvo que afinarse.**
 *
 * `la traen` / `la trae`: ahí el femenino es la meta (`efectivas_esperadas`),
 * no el curso-horario.
 *
 * Y `ninguna` sólo cuenta cuando NO va delante de un sustantivo. La primera
 * versión marcaba dos frases correctas: «llegan sin identificar su
 * curso-horario, así que ninguna cuenta para la meta» —ninguna RESPUESTA— y «no
 * cruzan con ninguna facultad del plan». Un determinante femenino delante de un
 * sustantivo femenino es correcto por definición; lo sospechoso es el
 * `ninguna` que cierra la frase, como en «no podría juzgar ninguna:».
 */
const FEMENINO_TRAS_UNIDAD = new RegExp(
  String.raw`cursos?-horario(?:[^"\n]{0,70}?)\b(?:` +
    String.raw`todas|estas|esas|aquellas|las que|aplicadas|agendadas|caídas|dormidas` +
    String.raw`|visitadas|evaluadas|juzgadas|llamarlas|contarlas|activarlas` +
    // `ninguna` sólo si cierra: seguida de puntuación o de fin de literal.
    String.raw`|ninguna(?=\s*(?:[:.,;»]|$))` +
    String.raw`)\b`,
  "gi",
);

function concordanciasEnFemenino() {
  const fuentes = fs
    .readdirSync(aqui)
    .filter((f) => (f.endsWith(".ts") || f.endsWith(".tsx")) && !f.includes(".test."));
  const porArchivo: Array<[string, string[]]> = [];
  for (const archivo of fuentes) {
    const fuente = fs
      .readFileSync(path.join(aqui, archivo), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    const hits = fuente.match(FEMENINO_TRAS_UNIDAD) ?? [];
    if (hits.length) porArchivo.push([archivo, hits]);
  }
  return porArchivo;
}

describe("la unidad concuerda en masculino", () => {
  it("ninguna frase habla de cursos-horario en femenino", () => {
    const porArchivo = concordanciasEnFemenino();
    const detalle = porArchivo
      .map(([f, hits]) => `${f}: «${hits[0].replace(/\s+/g, " ").slice(0, 80)}»`)
      .join(" · ");
    expect(
      porArchivo.length,
      "El cambio de «aula» a «curso-horario» dejó la concordancia en femenino. " +
        `El ratchet de la palabra no lo ve, porque la palabra ya no está: ${detalle}`,
    ).toBe(0);
  });

  it("y el detector mide algo: con tope cero, un regex roto pasaría siempre", () => {
    // El control de fixture, que aquí es obligatorio. Las cuatro frases reales
    // que se cerraron el 2026-08-31, para que un regex que deje de casarlas
    // falle en vez de dar verde.
    const cerradas = [
      "En 2025 los 14 cursos-horario sin medio de contacto anotado se cayeron todas.",
      "12 cursos-horario del plan la traen; las que no, quedarán sin juzgar.",
      "Ningún curso-horario del plan la trae, así que no podría juzgar ninguna: el plan...",
      "Ningún curso-horario evaluado se quedó corto: las que el libro evalúa alcanzaron.",
    ];
    for (const frase of cerradas) {
      expect(new RegExp(FEMENINO_TRAS_UNIDAD.source, "gi").test(frase), frase).toBe(true);
    }
    // Y no casa lo que es correcto. Las dos últimas son frases reales que la
    // primera versión del detector marcó por error: el sustantivo femenino que
    // va detrás de `ninguna` es quien manda.
    for (const frase of [
      "12 cursos-horario del plan la traen; los que no, quedarán sin juzgar.",
      "La prueba está en las reservas dormidas de ese curso-horario.",
      "llegan sin identificar su curso-horario, así que ninguna cuenta para la meta.",
      "3 de estos cursos-horario no cruzan con ninguna facultad del plan por su código.",
    ]) {
      expect(new RegExp(FEMENINO_TRAS_UNIDAD.source, "gi").test(frase), frase).toBe(false);
    }
  });
});

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
