/**
 * El desglose distingue un criterio que muerde de uno que no.
 *
 * Es la vara V3 del GOAL de reconstrucción: medido en el proyecto real de
 * 2025-2, `level` estaba activo y dejaba pasar las 136.284 filas, y sólo se
 * detectó calculándolo a mano porque la pantalla mostraba el agregado y no el
 * desglose.
 */
import { describe, expect, it } from "vitest";
import { recorteCriteriosAlumno } from "../recorteCriteriosAlumnoModel";

const REAL = {
  activa: true,
  filas_total: null,
  criterios: [
    { id: "faculty", layer: "marco", filas_pasan: 128018, evaluable: true },
    { id: "condition", layer: "marco", filas_pasan: 124167, evaluable: true },
    { id: "formation", layer: "marco", filas_pasan: 125003, evaluable: true },
    { id: "age", layer: "marco", filas_pasan: 123360, evaluable: true },
    { id: "level", layer: "marco", filas_pasan: 136284, evaluable: true },
  ],
};

describe("recorteCriteriosAlumno", () => {
  it("con el total declarado, cada criterio dice cuánto recorta", () => {
    const r = recorteCriteriosAlumno(REAL, 136284);
    const porId = Object.fromEntries((r?.criterios ?? []).map((c) => [c.id, c]));

    expect(porId.age.recorta).toBe(12924);
    expect(porId.condition.recorta).toBe(12117);
    expect(porId.formation.recorta).toBe(11281);
    expect(porId.faculty.recorta).toBe(8266);
    expect(porId.age.pctRecorte).toBeCloseTo(0.0948, 3);
  });

  it("señala el criterio activo que no recorta nada", () => {
    // EL caso. `level` deja pasar todo: está declarado y no filtra.
    const r = recorteCriteriosAlumno(REAL, 136284);
    const porId = Object.fromEntries((r?.criterios ?? []).map((c) => [c.id, c]));

    expect(porId.level.recorta).toBe(0);
    expect(porId.level.noRecorta).toBe(true);
    expect(porId.age.noRecorta).toBe(false);
    expect(r?.inertes).toBe(1);
  });

  it("ordena de más a menos recorte para que el que muerde se lea primero", () => {
    const r = recorteCriteriosAlumno(REAL, 136284);
    expect(r?.criterios.map((c) => c.id)).toEqual([
      "age", "condition", "formation", "faculty", "level",
    ]);
  });

  it("sin total declarado no inventa porcentajes", () => {
    // El máximo observado es sólo una cota inferior del universo: calcular
    // recortes sobre él los inflaría. Antes que mentir, se calla.
    const r = recorteCriteriosAlumno(REAL);
    expect(r?.total).toBeNull();
    expect(r?.criterios.every((c) => c.recorta === null && c.pctRecorte === null)).toBe(true);
    // Pero el que pasa el máximo sí se puede señalar como inerte.
    expect(r?.inertes).toBe(1);
  });

  it("toma el total que publica el motor sin que se lo pasen", () => {
    // El universo lo sabe el motor; obligar a la pantalla a pasarlo era pedirle
    // que lo dedujera de otra fuente y arriesgar que fueran dos cifras.
    const r = recorteCriteriosAlumno({ ...REAL, filas_total: 136284 });
    const porId = Object.fromEntries((r?.criterios ?? []).map((c) => [c.id, c]));
    expect(r?.total).toBe(136284);
    expect(porId.age.recorta).toBe(12924);
    expect(porId.level.noRecorta).toBe(true);
  });

  it("sin reporte no hay desglose", () => {
    expect(recorteCriteriosAlumno(null)).toBeNull();
    expect(recorteCriteriosAlumno({ activa: true, filas_total: 10, criterios: [] })).toBeNull();
  });
});

describe("criterios que no se pudieron medir", () => {
  it("no cuentan como inertes, se cuentan aparte", () => {
    // `level` se midió y no recortó: eso es inerte. `formation` no se pudo
    // medir: deja pasar a todos por falta de datos, no por no morder.
    const r = recorteCriteriosAlumno({
      activa: true, filas_total: 136284,
      criterios: [
        { id: "level", layer: "marco", filas_pasan: 136284, evaluable: true },
        { id: "formation", layer: "marco", filas_pasan: 136284, evaluable: false },
      ],
    }, 136284);
    expect(r?.inertes).toBe(1);
    expect(r?.noMedibles).toBe(1);
    const porId = Object.fromEntries((r?.criterios ?? []).map((c) => [c.id, c]));
    expect(porId.level.noRecorta).toBe(true);
    expect(porId.formation.noRecorta).toBe(false);
  });
});
