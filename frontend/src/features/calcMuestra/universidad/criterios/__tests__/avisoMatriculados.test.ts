/**
 * El umbral invisible: mínimo de MATRICULADOS por curso-horario.
 *
 * Gonzalo, textual: «me comentas de que aquí hay un umbral de matriculados ≥ 15,
 * pero el que yo recuerde eso no se debió aplicar en ningún curso-horario porque
 * ya teníamos el criterio de elegibles. No estoy entendiendo eso muy bien».
 *
 * Tenía razón, y la razón es geométrica: los elegibles nunca superan a los
 * matriculados, así que exigir 15 elegibles ya implica 15 matriculados. Medido
 * en HSVG2026 con ambos en 15: NINGUNA de las 5.263 aulas cayó sólo por
 * matriculados.
 *
 * El problema aparece al relajar. Con Artes Escénicas en 10 y matriculados en
 * 15, la facultad subió de 44 a 57 aulas en vez de a las 103 que el mínimo
 * relajado prometía: el umbral que no se ve se comió el efecto del que sí.
 */
import { describe, expect, it } from "vitest";
import { avisoMatriculados } from "../minElegiblesModel";

const FACS = [
  { key: "artes_escenicas", label: "ARTES ESCÉNICAS" },
  { key: "derecho", label: "DERECHO" },
  { key: "psicologia", label: "PSICOLOGÍA" },
];

const sel = (min: Record<string, number>, matric: number | null) => ({
  minEligible: { threshold: 15, byFaculty: min },
  ...(matric == null ? {} : { byVariable: { enrolled_total: { threshold: { op: ">=", min: matric } } } }),
}) as never;

describe("aviso del umbral de matriculados", () => {
  it("avisa SÓLO de las facultades que piden menos que él", () => {
    const a = avisoMatriculados(sel({ artes_escenicas: 10, derecho: 20 }, 15), FACS, 15);
    expect(a?.umbral).toBe(15);
    expect(a?.tapadas.map((f) => f.label)).toEqual(["ARTES ESCÉNICAS"]);
    expect(a?.tapadas[0].minimo).toBe(10);
  });

  it("CALLA cuando ninguna baja de él: ahí no recorta nada", () => {
    // Es el caso normal y el que Gonzalo recordaba: con todo en 15 el umbral de
    // matriculados es redundante. Avisar siempre lo volvería ruido.
    expect(avisoMatriculados(sel({ derecho: 20 }, 15), FACS, 15)).toBeNull();
    expect(avisoMatriculados(sel({}, 15), FACS, 15)).toBeNull();
  });

  it("cuenta el umbral GENERAL para las facultades sin mínimo propio", () => {
    // Si el general baja de 15, todas las que lo heredan quedan tapadas.
    const a = avisoMatriculados(sel({ derecho: 20 }, 15), FACS, 12);
    expect(a?.tapadas.map((f) => f.label)).toEqual(["ARTES ESCÉNICAS", "PSICOLOGÍA"]);
  });

  it("sin umbral de matriculados declarado no hay nada que avisar", () => {
    expect(avisoMatriculados(sel({ artes_escenicas: 10 }, null), FACS, 15)).toBeNull();
    expect(avisoMatriculados(null, FACS, 15)).toBeNull();
  });

  it("las tapadas salen de la MÁS agresiva a la menos", () => {
    const a = avisoMatriculados(sel({ artes_escenicas: 12, psicologia: 8 }, 15), FACS, 15);
    expect(a?.tapadas.map((f) => f.minimo)).toEqual([8, 12]);
  });
});
