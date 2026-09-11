import { describe, expect, it } from "vitest";

import type { MonitoreoRow } from "../../../../api/monitoreo";
import { embudoDelAula } from "./embudoDelAula";

const parte = (a: number, r: number, d: number, e: number) => ({
  observed_students: a, refusals: r, duplicates: d, effective_surveys: e,
} as unknown as MonitoreoRow);

describe("embudoDelAula", () => {
  it("angosta paso a paso y dice cuánto se pierde en cada uno", () => {
    const e = embudoDelAula([parte(100, 10, 20, 70)]);
    expect(e.asistentes).toBe(100);
    expect(e.pasos.map((p) => p.quedan)).toEqual([100, 90, 70]);
    expect(e.pasos.map((p) => p.pierde)).toEqual([0, 10, 20]);
    // Sin redondear: el modelo publica el cociente exacto y la vista decide el
    // formato. Antes salian enteros y la frase decia «92%» junto a una columna
    // que decia «89.3 %».
    expect(e.pasos.map((p) => Math.round(p.pct))).toEqual([100, 90, 70]);
  });

  it("el descuadre es lo declarado menos lo que la cadena implica", () => {
    // La cadena implica 70 y el equipo escribió 68: faltan 2, y NO se corrige
    // ninguno de los dos.
    const e = embudoDelAula([parte(100, 10, 20, 68)]);
    expect(e.declaradas).toBe(68);
    expect(e.descuadre).toBe(-2);
  });

  it("suma los partes, que es donde se ve qué pesa más", () => {
    const e = embudoDelAula([parte(50, 1, 9, 40), parte(50, 9, 1, 40)]);
    expect(e.asistentes).toBe(100);
    // 10 rechazos y 10 duplicados: el conjunto los iguala aunque cada aula los
    // tenga al revés.
    expect(e.pasos[1].pierde).toBe(10);
    expect(e.pasos[2].pierde).toBe(10);
  });

  it("sin asistentes devuelve vacío en vez de dividir entre cero", () => {
    expect(embudoDelAula([parte(0, 0, 0, 0)]).pasos).toEqual([]);
  });
});

describe("el escalón del padrón, encima de la asistencia", () => {
  /**
   * Es el escalón que la tasa del aula lleva dentro sin enseñarlo, y el más
   * caro del operativo: de cuántos había convocados, cuántos aparecieron.
   * Medido en HSVG26ULT2 el 2026-09-11: CH 2 con 29 elegibles y 22 en el aula.
   *
   * Se dio por bloqueado por falta de dato hasta que se miró el payload:
   * `observed_students` está en 54 partes y `eligible_n` en el plan.
   */
  const parte = (codigo: string, vistos: number, extra: Record<string, unknown> = {}) =>
    ({ operational_code: codigo, classroom_id: codigo, observed_students: vistos,
       effective_surveys: vistos, ...extra }) as unknown as MonitoreoRow;
  const aula = (codigo: string, elegibles: number) =>
    ({ operational_code: codigo, classroom_id: codigo, eligible_n: elegibles }) as unknown as MonitoreoRow;

  it("pone los convocados delante y la asistencia deja de ser el 100 %", () => {
    const e = embudoDelAula([parte("CH 2", 22)], [aula("CH 2", 29)]);
    expect(e.padron).toBe(29);
    expect(e.pasos[0].clave).toBe("padron");
    expect(e.pasos[0].quedan).toBe(29);
    const asistencia = e.pasos.find((p) => p.clave === "asistentes")!;
    expect(asistencia.quedan).toBe(22);
    expect(asistencia.pierde).toBe(7);
    expect(asistencia.pct).toBeCloseTo((100 * 22) / 29, 3);
  });

  it("un aula con DOS partes cuenta su padrón una sola vez", () => {
    // Las hay, con dos sesiones. Duplicar el denominador hundiría la asistencia
    // por debajo de la mitad sin que nada hubiera pasado en campo.
    const e = embudoDelAula([parte("CH 5", 10), parte("CH 5", 8)], [aula("CH 5", 30)]);
    expect(e.padron).toBe(30);
    expect(e.asistentes).toBe(18);
  });

  it("con un parte que no cruza con el plan NO se dibuja el escalón", () => {
    // La asistencia sería un cociente entre dos conjuntos distintos: los que
    // estaban en tres aulas contra los convocados de dos.
    const e = embudoDelAula([parte("CH 2", 22), parte("CH 9", 10)], [aula("CH 2", 29)]);
    expect(e.padron).toBeNull();
    expect(e.sinCruzar).toBe(1);
    expect(e.pasos[0].clave).toBe("asistentes");
    expect(e.pasos[0].pct).toBe(100);
  });

  it("sin plan se comporta como antes: el embudo empieza en el aula", () => {
    const e = embudoDelAula([parte("CH 2", 22)]);
    expect(e.padron).toBeNull();
    expect(e.pasos[0].clave).toBe("asistentes");
  });

  it("el padrón nunca hace que se pierda un negativo", () => {
    // Un aula donde aparecieron MÁS de los convocados —el padrón envejece— no
    // puede publicar «−3 perdidos»: eso es un aviso, no una pérdida.
    const e = embudoDelAula([parte("CH 7", 35)], [aula("CH 7", 30)]);
    expect(e.pasos.find((p) => p.clave === "asistentes")!.pierde).toBe(0);
  });
});
