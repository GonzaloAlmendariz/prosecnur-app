import { describe, expect, it } from "vitest";

import { estadosPorDiaDeLaCuota } from "./estadosPorCuota";

const FILAS = [
  { Actor: "Homologación de Títulos", Estado: "Efectivo", "2026-08-04": 11, "2026-08-05": 9, Total: 20 },
  { Actor: "Homologación de Títulos", Estado: "No contesta", "2026-08-04": 4, "2026-08-05": 2, Total: 6 },
  { Actor: "Vinculación Laboral", Estado: "Efectivo", "2026-08-04": 3, "2026-08-05": 1, Total: 4 },
];

describe("estadosPorDiaDeLaCuota", () => {
  it("devuelve solo las filas de la cuota pedida", () => {
    const filas = estadosPorDiaDeLaCuota(FILAS, "Vinculación Laboral");
    expect(filas).toHaveLength(1);
    expect(filas[0].Estado).toBe("Efectivo");
    expect(filas[0].Total).toBe(4);
  });

  it("retira la columna de actor", () => {
    // La construcción de series toma la primera columna de texto como etiqueta:
    // dejar `Actor` convertiría el nombre de la cuota en una serie de estado.
    const filas = estadosPorDiaDeLaCuota(FILAS, "Homologación de Títulos");
    expect(filas.every((fila) => !("Actor" in fila))).toBe(true);
    expect(Object.keys(filas[0])).toEqual(["Estado", "2026-08-04", "2026-08-05", "Total"]);
  });

  it("ignora tildes y mayúsculas al comparar", () => {
    expect(estadosPorDiaDeLaCuota(FILAS, "vinculacion laboral")).toHaveLength(1);
  });

  it("acepta otros nombres de la columna de agrupación", () => {
    const filas = estadosPorDiaDeLaCuota(
      [{ Sede: "Norte", Estado: "Efectivo", "2026-08-04": 2, Total: 2 }],
      "Norte",
    );
    expect(filas).toHaveLength(1);
    expect(filas[0]).not.toHaveProperty("Sede");
  });

  it("con un actor desconocido devuelve vacío, no todas las filas", () => {
    // Caer al conjunto completo pintaría el barrido del estudio bajo el rótulo
    // de una cuota, que es exactamente el defecto que este bloque corrige.
    expect(estadosPorDiaDeLaCuota(FILAS, "Otro")).toEqual([]);
  });

  it("sin filas, sin actor o sin columna de agrupación devuelve vacío", () => {
    expect(estadosPorDiaDeLaCuota([], "Homologación de Títulos")).toEqual([]);
    expect(estadosPorDiaDeLaCuota(FILAS, "")).toEqual([]);
    expect(estadosPorDiaDeLaCuota([{ Estado: "Efectivo", Total: 1 }], "Homologación de Títulos")).toEqual([]);
  });
});
