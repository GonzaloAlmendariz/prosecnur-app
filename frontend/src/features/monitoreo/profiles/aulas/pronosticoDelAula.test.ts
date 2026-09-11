import { describe, expect, it } from "vitest";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { pronosticoDelAula } from "./pronosticoDelAula";

/**
 * Las tres varas de lo que un curso-horario puede dar.
 *
 * Gonzalo, 2026-09-11: «le falta los hombres y mujeres elegibles y los
 * esperados en base a lo planeado y en base a lo obtenido hasta ahora».
 */

const fila = (extra: Record<string, unknown> = {}): MonitoreoAulasPlanRow =>
  ({
    // `sex_top_1` es el sexo DOMINANTE, no «mujeres»: con "F" el primero son
    // mujeres. Se declara así para no invertir la tabla.
    sex_top_1: "F", sex_top_1_n: 20, sex_top_2_n: 10, eligible_n: 30,
    ...extra,
  }) as unknown as MonitoreoAulasPlanRow;

describe("las tres varas de un curso-horario", () => {
  it("los elegibles son el padrón, repartido por sexo", () => {
    const p = pronosticoDelAula(fila());
    expect(p.elegibles).toEqual({ mujeres: 20, hombres: 10, total: 30 });
  });

  it("el plan reparte su meta en la proporción del padrón, y el total es la suma", () => {
    // 15 sobre 20/10: 10 mujeres y 5 hombres. Nunca un tercer redondeo.
    const p = pronosticoDelAula(fila({ expected_valid: 15 }));
    expect(p.plan).toEqual({ mujeres: 10, hombres: 5, total: 15 });
  });

  it("sin meta declarada NO inventa un plan", () => {
    // Un plan a cero se leería como «el diseño no pide nada de esta celda», que
    // es una afirmación; la verdad es que no lo declara.
    expect(pronosticoDelAula(fila({ expected_valid: 0 })).plan).toBeNull();
    expect(pronosticoDelAula(fila()).desvio).toBeNull();
  });

  it("la tasa del aula manda sobre la de su facultad, y lo dice", () => {
    const suya = pronosticoDelAula(fila({ tasa_efectividad_aula: 0.4, tasa_facultad: 0.6 }));
    expect(suya.tasa).toBeCloseTo(0.4, 3);
    expect(suya.deDondeLaTasa).toBe("aula");

    // Un candidato que aún no ha salido no tiene tasa propia: la vara honesta
    // es la que su facultad está consiguiendo, y se declara como prestada.
    const prestada = pronosticoDelAula(fila({ tasa_facultad: 0.6 }));
    expect(prestada.tasa).toBeCloseTo(0.6, 3);
    expect(prestada.deDondeLaTasa).toBe("facultad");

    const ninguna = pronosticoDelAula(fila());
    expect(ninguna.deDondeLaTasa).toBe("perfil");
  });

  it("el desvío dice cuánto se aparta la proyección de lo que el plan pidió", () => {
    // Plan 21; al 0,4 sobre 30 elegibles la proyección da 8+4=12. Faltan 9.
    const corto = pronosticoDelAula(fila({ expected_valid: 21, tasa_efectividad_aula: 0.4 }));
    expect(corto.ritmo.total).toBe(12);
    expect(corto.desvio).toBe(-9);

    // Y al revés: un aula que rinde por encima de lo que el diseño le pedía.
    const sobra = pronosticoDelAula(fila({ expected_valid: 9, tasa_efectividad_aula: 0.6 }));
    expect(sobra.desvio).toBeGreaterThan(0);
  });

  it("cuando el plan salió de la misma tasa, el desvío es CERO y no null", () => {
    // Es el caso de un candidato que no ha salido, y son cosas distintas: cero
    // significa «coinciden» y null «no hay plan con el que comparar». La vista
    // las escribe distinto.
    const p = pronosticoDelAula(fila({ expected_valid: 15, tasa_efectividad_aula: 0.5 }));
    expect(p.desvio).toBe(0);
  });

  it("un aula sin padrón no produce cifras: no hay de dónde sacarlas", () => {
    const p = pronosticoDelAula(fila({ sex_top_1_n: 0, sex_top_2_n: 0, eligible_n: 0, expected_valid: 10 }));
    expect(p.elegibles.total).toBe(0);
    expect(p.ritmo.total).toBe(0);
    expect(p.plan?.total).toBe(0);
  });
});
