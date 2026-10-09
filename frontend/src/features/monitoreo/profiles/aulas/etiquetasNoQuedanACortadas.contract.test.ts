import { describe, expect, it } from "vitest";
import { FIELD_LABELS } from "./aulasPresentation";

/**
 * Una cabecera de columna es una frase corta, y una frase corta que termina en
 * relativo o preposición está **pidiendo un complemento que nadie escribió**.
 *
 * Medido el 2026-08-30: `esperado` decía «Efectivas que implican» y se cortaba
 * ahí. El sujeto existía y estaba a mano —el motor lo escribe en su propio
 * comentario, «la cuenta que implican los otros tres números»—, pero el lector de
 * la tabla veía un verbo sin objeto y tenía que adivinar de dónde salía la cifra.
 *
 * No mide estilo: mide que la frase esté terminada. Una etiqueta puede ser tan
 * escueta como quiera —«Motivo», «Diferencia», «Corrida»— mientras cierre.
 */
/**
 * **Una preposición final no es un corte: la completa la celda.** El primer
 * intento marcaba «Aplicado por» y «Reemplaza a», y las dos están bien —en una
 * tabla la cabecera y su valor forman la frase: «Aplicado por · Juan»—. Lo que
 * no se completa con ningún valor es un relativo o una conjunción al final:
 * «Efectivas que · 38» no se lee de ninguna manera.
 */
const COLGADAS = /\s(?:que|y|o|pero|aunque)$/i;

/** Verbos que dejan la frase abierta aunque no acabe en preposición. */
const VERBO_SUELTO = /\s(?:implican|implica|declaran|declara|suman|suma|cuentan|cuenta|reciben|recibe)$/i;

describe("ninguna etiqueta de columna se corta a media frase", () => {
  it("no terminan en relativo ni preposición", () => {
    const malas = Object.entries(FIELD_LABELS)
      .filter(([, texto]) => COLGADAS.test(texto))
      .map(([campo, texto]) => `${campo}: "${texto}"`);
    expect(malas, malas.length ? `Etiquetas que piden un complemento y no lo traen:\n  ${malas.join("\n  ")}` : "").toEqual([]);
  });

  it("no terminan en un verbo transitivo sin objeto", () => {
    const malas = Object.entries(FIELD_LABELS)
      .filter(([, texto]) => VERBO_SUELTO.test(texto))
      .map(([campo, texto]) => `${campo}: "${texto}"`);
    expect(malas, malas.length ? `Etiquetas con el verbo colgando:\n  ${malas.join("\n  ")}` : "").toEqual([]);
  });

  it("el detector distingue una frase corta de una frase cortada", () => {
    // Escuetas y terminadas: válidas.
    for (const buena of ["Motivo", "Diferencia", "Corrida de selección", "Fecha agendada",
      // Se completan con la celda, que es como funciona una cabecera de tabla.
      "Aplicado por", "Reemplaza a"]) {
      expect(COLGADAS.test(buena) || VERBO_SUELTO.test(buena)).toBe(false);
    }
    // Cortadas: el caso real y sus parientes.
    for (const mala of ["Efectivas que implican", "Respuestas que", "Asistentes y"]) {
      expect(COLGADAS.test(mala) || VERBO_SUELTO.test(mala)).toBe(true);
    }
  });
});
