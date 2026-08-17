import { describe, expect, test } from "vitest";

import type { MonitoreoRow } from "../../../../api/monitoreo";
import { cuotasSexoFacultad } from "./cuotasSexoFacultad";
import { COLOR_RESULTADO } from "../../coloresDeResultado";

function celda(
  faculty: string, sex: string, target: number, observed: number, status: string,
): MonitoreoRow {
  return { faculty, sex, target, observed, status, missing: Math.max(0, target - observed) };
}

describe("cuotasSexoFacultad", () => {
  test("ordena por cumplimiento, no por lo que falta en absoluto", () => {
    // 40 de 50 y 4 de 5 van igual de bien: el mismo problema resuelto en la
    // misma proporcion. Ordenar por `missing` pondria la grande primero y diria
    // que va peor, cuando la celda al 20 % es la que se va a incumplir.
    const res = cuotasSexoFacultad([
      celda("Derecho", "Mujer", 50, 40, "en_riesgo"),
      celda("Letras", "Hombre", 5, 1, "en_riesgo"),
      celda("Arte", "Mujer", 5, 4, "en_riesgo"),
    ]);
    expect(res.celdas.map((c) => c.etiqueta)).toEqual([
      "Letras · Hombre", "Derecho · Mujer", "Arte · Mujer",
    ]);
    expect(res.celdas[0].avance).toBe(20);
  });

  test("una celda sin meta se cuenta aparte, no se fuerza a 0 % ni a 100 %", () => {
    const res = cuotasSexoFacultad([
      celda("Derecho", "Mujer", 0, 0, "sin_meta"),
      celda("Derecho", "Hombre", 10, 5, "en_riesgo"),
    ]);
    expect(res.sinMeta).toBe(1);
    expect(res.total).toBe(1);
  });

  test("el color sale del veredicto del motor, no de recalcularlo", () => {
    // L52: el estado se lee del campo que el engine ya emite. Si esta vista
    // decidiera por su cuenta cuando algo esta «cumplido», dos superficies del
    // mismo tablero podrian contradecirse.
    const res = cuotasSexoFacultad([
      celda("A", "Mujer", 10, 10, "cumplida"),
      celda("B", "Mujer", 10, 5, "en_riesgo"),
      celda("C", "Mujer", 10, 0, "pendiente"),
    ]);
    const porEtiqueta = Object.fromEntries(res.celdas.map((c) => [c.etiqueta, c.color]));
    expect(porEtiqueta["A · Mujer"]).toBe(COLOR_RESULTADO.efectiva);
    expect(porEtiqueta["B · Mujer"]).toBe(COLOR_RESULTADO.parcial);
    expect(porEtiqueta["C · Mujer"]).toBe(COLOR_RESULTADO.pendiente);
    expect(res.cumplidas).toBe(1);
  });

  test("pasarse de la meta no recorta la barra ni cambia el estado", () => {
    const res = cuotasSexoFacultad([celda("A", "Hombre", 10, 15, "cumplida")]);
    expect(res.celdas[0].avance).toBe(150);
    expect(res.celdas[0].faltan).toBe(0);
  });

  test("no recorta en silencio", () => {
    const muchas = Array.from({ length: 18 }, (_, i) =>
      celda(`F${i}`, "Mujer", 100, i, "en_riesgo"));
    const res = cuotasSexoFacultad(muchas, 14);
    expect(res.celdas).toHaveLength(14);
    expect(res.omitidas).toBe(4);
  });

  test("una celda con meta pero sin `missing` calcula lo que falta", () => {
    // El motor puede no emitir la columna; dejar la barra sin numero esconderia
    // justo el dato que se necesita para actuar.
    const res = cuotasSexoFacultad([
      { faculty: "Derecho", sex: "Mujer", target: 20, observed: 8, status: "en_riesgo" },
    ]);
    expect(res.celdas[0].faltan).toBe(12);
    expect(res.faltanTotal).toBe(12);
  });
});
