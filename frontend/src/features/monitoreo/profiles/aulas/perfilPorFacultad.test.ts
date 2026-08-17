import { describe, expect, it } from "vitest";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { avanceEnRespuestas } from "./avanceEnRespuestas";
import { perfilPorFacultad } from "./perfilPorFacultad";

/**
 * Entre el total y el aula no había nada.
 *
 * Avance decía cuánto se lleva en total y cuánto lleva cada curso-horario; para
 * saber que a una facultad le faltan doscientas respuestas había que sumar a
 * mano treinta filas de la tabla. Y es la pregunta con la que se decide a dónde
 * va el equipo mañana.
 */

function aula(facultad: string, meta: number, validas: number): MonitoreoAulasPlanRow {
  return {
    faculty: facultad,
    expected_valid: meta,
    respuestas_validas: validas,
  } as unknown as MonitoreoAulasPlanRow;
}

const plan = [
  aula("Derecho", 30, 10),
  aula("Derecho", 30, 30),
  aula("Gestión", 40, 5),
  aula("Letras", 20, 20),
];

describe("el perfil por facultad", () => {
  it("ordena por lo que falta, no por la tasa", () => {
    // El caso que distingue las dos ordenaciones: una facultad diminuta con
    // pésima tasa (25 %) contra una grande a medias (50 %). Por tasa iría
    // primero la de tres respuestas; por lo que falta, la de doscientas, que es
    // donde de verdad hay que mandar al equipo.
    //
    // Con un plan donde las dos ordenaciones coinciden, este aserto pasaría
    // igual ordenando por tasa y no verificaría nada. Comprobado: al invertir
    // el criterio en el módulo, es este caso el que se pone rojo.
    const { facultades } = perfilPorFacultad([
      aula("Micro", 4, 1),
      aula("Grande", 400, 200),
    ]);
    expect(facultades.map((f) => f.facultad)).toEqual(["Grande", "Micro"]);
    expect(facultades[0].falta).toBe(200);
    expect(facultades[0].avance).toBe(50);
    expect(facultades[1].avance).toBe(25);
  });

  it("agrupa cada aula en su facultad", () => {
    const { facultades } = perfilPorFacultad(plan);
    expect(facultades.map((f) => f.facultad).sort()).toEqual(["Derecho", "Gestión", "Letras"]);
    expect(facultades.find((f) => f.facultad === "Derecho")?.aulas).toBe(2);
  });

  it("las partes suman exactamente el total", () => {
    // El aserto que fija la propiedad: cada facultad se calcula con la MISMA
    // función que da el total, así que no pueden discrepar.
    const { facultades } = perfilPorFacultad(plan);
    const total = avanceEnRespuestas(plan);
    expect(facultades.reduce((s, f) => s + f.falta, 0)).toBe(total.falta);
    expect(facultades.reduce((s, f) => s + f.cubierto, 0)).toBe(total.cubierto);
    expect(facultades.reduce((s, f) => s + f.meta, 0)).toBe(total.meta);
  });

  it("el excedente de una facultad no cubre la falta de otra", () => {
    // Misma regla que en el total, ahora entre facultades: 20 de más en Letras
    // no tapan las 35 que faltan en Gestión.
    const { facultades } = perfilPorFacultad([
      aula("Letras", 20, 40),
      aula("Gestión", 40, 5),
    ]);
    const letras = facultades.find((f) => f.facultad === "Letras");
    expect(letras?.excedente).toBe(20);
    expect(letras?.falta).toBe(0);
    expect(facultades.find((f) => f.facultad === "Gestión")?.falta).toBe(35);
  });

  it("un aula sin facultad se cuenta aparte, no se reparte", () => {
    // Repartirla a ojo entre las demás falsearía la facultad que la reciba; se
    // dice, que es lo que deja arreglarlo en el plan.
    const res = perfilPorFacultad([aula("Derecho", 30, 10), aula("", 30, 10)]);
    expect(res.facultades).toHaveLength(1);
    expect(res.sinFacultad).toBe(1);
  });

  it("cuenta las facultades que ya cumplieron", () => {
    const res = perfilPorFacultad(plan);
    expect(res.cumplidas).toBe(1);
    expect(res.tope).toBe(60);
  });
});
