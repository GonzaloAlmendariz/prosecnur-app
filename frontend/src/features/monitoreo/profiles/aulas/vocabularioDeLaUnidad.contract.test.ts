import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const aqui = path.dirname(fileURLToPath(import.meta.url));

/**
 * **La unidad del estudio se llama curso-horario, y el perfil todavía dice
 * «aula» en 68 frases.**
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

/** Medido el 2026-08-29, después de cerrar las seis pestañas de Avance. */
const TOPE = 68;

/** Con determinante o cifra delante: en prosa siempre lo lleva; en código, no. */
const EN_PROSA =
  /\b(?:la|las|los|una|unas|un|esa|esas|este|esta|estas|ese|cada|ninguna|ningún|ningun|otra|otras|misma|sin|de|del|en|por|su|sus|\d+|\$\{[^}]{0,40}\})\s+aulas?\b/gi;

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
    const n = (fuente.match(EN_PROSA) ?? []).length;
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
});
