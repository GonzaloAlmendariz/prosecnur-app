import { describe, expect, it } from "vitest";
import type { CriteriosSeleccionMarco } from "../../../../../api/client";
import { ELEGIBLES_POR_AULA_ID } from "../../../dominio";
import { copiarVariableCriterio } from "../borradorCriterios";
import {
  minimoFacultad,
  minimoSugerido,
  presentesEsperados,
  setMinimoFacultad,
  setTasaAsistencia,
  tasaAsistencia,
} from "../minElegiblesModel";

const vacia: CriteriosSeleccionMarco = { byVariable: {} };

describe("sugerencia de mínimos por inasistencia (criterio 7)", () => {
  it("sugiere ceil(mínimo/tasa): con asistencia del 70%, un mínimo de 8 pide 12", () => {
    // 8 matriculados × 0.7 ≈ 6 presentes; para encontrar 8 se exigen 12.
    expect(minimoSugerido(8, 0.7)).toBe(12);
    expect(presentesEsperados(8, 0.7)).toBe(6);
  });

  it("cubre el default general de 15 y tasas límite", () => {
    expect(minimoSugerido(15, 0.7)).toBe(22); // 21.43 → 22
    expect(minimoSugerido(15, 1)).toBe(15); // asistencia perfecta: sin ajuste
    expect(minimoSugerido(20, 0.8)).toBe(25);
  });

  it("sin tasa utilizable no hay sugerencia (nunca se inventa)", () => {
    expect(minimoSugerido(15, null)).toBeNull();
    expect(minimoSugerido(15, 0)).toBeNull();
    expect(minimoSugerido(15, -0.5)).toBeNull();
    expect(minimoSugerido(15, 1.2)).toBeNull(); // proporción, no porcentaje
    expect(minimoSugerido(15, Number.NaN)).toBeNull();
    expect(minimoSugerido(0, 0.7)).toBeNull();
    expect(presentesEsperados(15, null)).toBeNull();
  });
});

describe("mínimos por facultad y tasa de asistencia en la selección", () => {
  it("fija un mínimo propio (creando minEligible con el umbral global) y lo limpia", () => {
    const conPropio = setMinimoFacultad(vacia, "derecho", 25, 15);
    expect(conPropio.minEligible).toEqual({ threshold: 15, byFaculty: { derecho: 25 } });
    // vacía original intacta (inmutable)
    expect(vacia.minEligible).toBeUndefined();

    const sinPropio = setMinimoFacultad(conPropio, "derecho", null, 15);
    expect(sinPropio.minEligible).toEqual({ threshold: 15 });
    expect(sinPropio.minEligible?.byFaculty).toBeUndefined();
  });

  it("redondea y acota el override; no arrastra otras facultades al limpiar una", () => {
    let sel = setMinimoFacultad(vacia, "arte_y_diseno", 8.6, 15);
    sel = setMinimoFacultad(sel, "ciencias_e_ingenieria", 22, 15);
    expect(sel.minEligible?.byFaculty).toEqual({ arte_y_diseno: 9, ciencias_e_ingenieria: 22 });

    const limpia = setMinimoFacultad(sel, "arte_y_diseno", null, 15);
    expect(limpia.minEligible?.byFaculty).toEqual({ ciencias_e_ingenieria: 22 });
  });

  it("la tasa se guarda como proporción 0–1, se acota y se puede retirar", () => {
    const conTasa = setTasaAsistencia(vacia, 0.7, 15);
    expect(conTasa.minEligible).toEqual({ threshold: 15, attendance_rate: 0.7 });
    expect(tasaAsistencia(conTasa)).toBe(0.7);

    expect(setTasaAsistencia(vacia, 1.4, 15).minEligible?.attendance_rate).toBe(1);

    const sinTasa = setTasaAsistencia(conTasa, null, 15);
    expect(sinTasa.minEligible).toEqual({ threshold: 15 });
    expect(tasaAsistencia(sinTasa)).toBeNull();
  });

  it("la tasa NO altera el umbral efectivo ni los mínimos por facultad", () => {
    let sel = setMinimoFacultad(vacia, "derecho", 25, 15);
    sel = setTasaAsistencia(sel, 0.7, 15);
    expect(sel.minEligible?.threshold).toBe(15);
    expect(sel.minEligible?.byFaculty).toEqual({ derecho: 25 });
    expect(minimoFacultad(sel, "derecho")).toBe(25);
    expect(minimoFacultad(sel, "psicologia")).toBeNull(); // hereda el general
  });

  it("getters defensivos ante valores corruptos", () => {
    const rota: CriteriosSeleccionMarco = {
      byVariable: {},
      minEligible: { threshold: 15, byFaculty: { derecho: Number.NaN }, attendance_rate: -1 },
    };
    expect(minimoFacultad(rota, "derecho")).toBeNull();
    expect(tasaAsistencia(rota)).toBeNull();
  });
});

describe("integración con el borrador confirmable", () => {
  it("confirmar el fragmento minEligible arrastra byFaculty y attendance_rate", () => {
    const confirmado: CriteriosSeleccionMarco = { byVariable: {}, minEligible: { threshold: 15 } };
    let borrador = setMinimoFacultad(confirmado, "derecho", 25, 15);
    borrador = setTasaAsistencia(borrador, 0.7, 15);

    const next = copiarVariableCriterio(confirmado, borrador, ELEGIBLES_POR_AULA_ID, "minEligible");
    expect(next.minEligible).toEqual({ threshold: 15, byFaculty: { derecho: 25 }, attendance_rate: 0.7 });
    // y el descarte (copia inversa) restaura el confirmado sin residuos
    const descartado = copiarVariableCriterio(borrador, confirmado, ELEGIBLES_POR_AULA_ID, "minEligible");
    expect(descartado.minEligible).toEqual({ threshold: 15 });
  });
});
