/**
 * El desglose distingue un criterio que muerde de uno que no.
 *
 * Es la vara V3 del GOAL de reconstrucción. Las cifras del proyecto real de
 * 2025-2 son las de `REAL`, y ahí NINGÚN criterio es inerte: los cinco recortan,
 * entre 9.747 filas (`faculty`) y 35.364 (`level`). El caso inerte se prueba con
 * un criterio SINTÉTICO, porque es el que la pantalla no sabía distinguir y no
 * porque se haya observado en ese proyecto.
 */
import { describe, expect, it } from "vitest";
import { recorteCriteriosAlumno } from "../recorteCriteriosAlumnoModel";

/** Cifras del `criterios_alumno_report` que trae guardado el proyecto de 2025-2. */
const REAL = {
  activa: true,
  filas_total: null,
  criterios: [
    { id: "faculty", layer: "marco", filas_pasan: 126537, evaluable: true },
    { id: "condition", layer: "marco", filas_pasan: 124167, evaluable: true },
    { id: "formation", layer: "marco", filas_pasan: 125003, evaluable: true },
    { id: "age", layer: "marco", filas_pasan: 123360, evaluable: true },
    { id: "level", layer: "instrumento", filas_pasan: 100920, evaluable: true },
  ],
};

/** Un criterio que se midió y no dejó fuera a nadie. Sintético: ver cabecera. */
const INERTE = { id: "sintetico", layer: "marco", filas_pasan: 136284, evaluable: true };

describe("recorteCriteriosAlumno", () => {
  it("con el total declarado, cada criterio dice cuánto recorta", () => {
    const r = recorteCriteriosAlumno(REAL, 136284);
    const porId = Object.fromEntries((r?.criterios ?? []).map((c) => [c.id, c]));

    expect(porId.age.recorta).toBe(12924);
    expect(porId.condition.recorta).toBe(12117);
    expect(porId.formation.recorta).toBe(11281);
    expect(porId.faculty.recorta).toBe(9747);
    expect(porId.age.pctRecorte).toBeCloseTo(0.0948, 3);
  });

  it("en el proyecto real ningún criterio es inerte", () => {
    const r = recorteCriteriosAlumno(REAL, 136284);
    expect(r?.inertes).toBe(0);
    expect(r?.criterios.every((c) => !c.noRecorta)).toBe(true);
    // `level` es el que MÁS recorta, no el que menos.
    const porId = Object.fromEntries((r?.criterios ?? []).map((c) => [c.id, c]));
    expect(porId.level.recorta).toBe(35364);
    expect(porId.faculty.recorta).toBe(9747);
  });

  it("señala un criterio activo que no recorta nada", () => {
    // EL caso que la pantalla no sabía distinguir, con un criterio sintético.
    const r = recorteCriteriosAlumno({ ...REAL, criterios: [...REAL.criterios, INERTE] }, 136284);
    const porId = Object.fromEntries((r?.criterios ?? []).map((c) => [c.id, c]));
    expect(porId.sintetico.recorta).toBe(0);
    expect(porId.sintetico.noRecorta).toBe(true);
    expect(porId.age.noRecorta).toBe(false);
    expect(r?.inertes).toBe(1);
  });

  it("ordena de más a menos recorte para que el que muerde se lea primero", () => {
    const r = recorteCriteriosAlumno(REAL, 136284);
    expect(r?.criterios.map((c) => c.id)).toEqual([
      "level", "age", "condition", "formation", "faculty",
    ]);
  });

  it("sin total declarado no inventa porcentajes", () => {
    // El máximo observado es sólo una cota inferior del universo: calcular
    // recortes sobre él los inflaría. Antes que mentir, se calla.
    const r = recorteCriteriosAlumno(REAL);
    expect(r?.total).toBeNull();
    expect(r?.criterios.every((c) => c.recorta === null && c.pctRecorte === null)).toBe(true);
    // Pero el que pasa el máximo sí se puede señalar como inerte: es lo máximo
    // que se puede afirmar sin inventar un universo, aunque sobre el total real
    // ese criterio sí recorte.
    expect(r?.inertes).toBe(1);
  });

  it("toma el total que publica el motor sin que se lo pasen", () => {
    // El universo lo sabe el motor; obligar a la pantalla a pasarlo era pedirle
    // que lo dedujera de otra fuente y arriesgar que fueran dos cifras.
    const r = recorteCriteriosAlumno({ ...REAL, filas_total: 136284 });
    const porId = Object.fromEntries((r?.criterios ?? []).map((c) => [c.id, c]));
    expect(r?.total).toBe(136284);
    expect(porId.age.recorta).toBe(12924);
    expect(porId.level.recorta).toBe(35364);
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
