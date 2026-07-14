import { describe, expect, it } from "vitest";
import {
  alumnosPorCursoHorario,
  construirCursosHorarioModelo,
  cursosHorarioFinalMap,
  cursosHorarioNecesarios,
  type CursosHorarioEntradaFacultad,
} from "../cursosHorarioModel";

describe("alumnosPorCursoHorario", () => {
  it("toma el mínimo entre media y mediana", () => {
    expect(alumnosPorCursoHorario(32, 28.5)).toBe(28.5);
    expect(alumnosPorCursoHorario(20, 26)).toBe(20);
  });

  it("cae a la única medida disponible o null", () => {
    expect(alumnosPorCursoHorario(30, null)).toBe(30);
    expect(alumnosPorCursoHorario(null, 25)).toBe(25);
    expect(alumnosPorCursoHorario(null, null)).toBeNull();
    expect(alumnosPorCursoHorario(0, -3)).toBeNull();
  });
});

describe("cursosHorarioNecesarios", () => {
  it("es ceil(cuota / alumnos-por-CH)", () => {
    expect(cursosHorarioNecesarios(100, 30)).toBe(4);
    expect(cursosHorarioNecesarios(90, 30)).toBe(3);
  });

  it("null sin divisor y 0 sin cuota", () => {
    expect(cursosHorarioNecesarios(100, null)).toBeNull();
    expect(cursosHorarioNecesarios(0, 30)).toBe(0);
  });
});

describe("construirCursosHorarioModelo", () => {
  const entradas: CursosHorarioEntradaFacultad[] = [
    { facultad: "Ingeniería", cuota: 120, estAulaMediana: 30, estAulaMedia: 28, chMarcoElegible: 40, chTotal: 55, extra: 1 },
    { facultad: "Derecho", cuota: 60, estAulaMediana: 20, estAulaMedia: 24, chMarcoElegible: 12, chTotal: 18, extra: 0 },
    { facultad: "Sin medida", cuota: 40, estAulaMediana: null, estAulaMedia: null, chMarcoElegible: 5, chTotal: 9, extra: 2 },
  ];

  it("resuelve CH necesarios y finales por facultad con el mínimo media/mediana", () => {
    const modelo = construirCursosHorarioModelo(entradas, "elegible");
    const ing = modelo.filas[0];
    expect(ing.alumnosPorCH).toBe(28);
    expect(ing.chNecesarios).toBe(Math.ceil(120 / 28)); // 5
    expect(ing.chFinal).toBe(Math.ceil(120 / 28) + 1); // 6
    expect(ing.chBase).toBe(40); // base elegible
    const der = modelo.filas[1];
    expect(der.alumnosPorCH).toBe(20);
    expect(der.chNecesarios).toBe(3);
    expect(der.chFinal).toBe(3);
  });

  it("marca incompleto cuando alguna facultad con cuota no tiene divisor", () => {
    const modelo = construirCursosHorarioModelo(entradas, "elegible");
    expect(modelo.filas[2].alumnosPorCH).toBeNull();
    expect(modelo.filas[2].chNecesarios).toBeNull();
    expect(modelo.filas[2].chFinal).toBeNull();
    expect(modelo.completo).toBe(false);
  });

  it("la base seleccionable cambia el inventario de referencia", () => {
    const total = construirCursosHorarioModelo(entradas, "total");
    expect(total.filas[0].chBase).toBe(55);
    expect(total.base).toBe("total");
  });

  it("totaliza cuota, necesarios, extra y final", () => {
    const modelo = construirCursosHorarioModelo(entradas, "elegible");
    expect(modelo.totalCuota).toBe(220);
    expect(modelo.totalExtra).toBe(3);
    expect(modelo.totalNecesarios).toBe((modelo.filas[0].chNecesarios ?? 0) + 3);
    expect(modelo.totalFinal).toBe((modelo.filas[0].chFinal ?? 0) + (modelo.filas[1].chFinal ?? 0));
  });

  it("cursosHorarioFinalMap omite facultades sin plan", () => {
    const modelo = construirCursosHorarioModelo(entradas, "elegible");
    const mapa = cursosHorarioFinalMap(modelo);
    expect(mapa["Ingeniería"]).toBe(6);
    expect(mapa["Derecho"]).toBe(3);
    expect(mapa["Sin medida"]).toBeUndefined();
  });
});
