import { describe, expect, it } from "vitest";

import { efectividadPorDia, tendenciaDeEfectividad } from "./efectividadPorDia";
import type { MonitoreoRow } from "../../../../api/monitoreo";

/**
 * «A lo mejor la efectividad era baja al principio pero ahora se está
 * recuperando: patrones, tendencias» (Gonzalo, 2026-09-09). Medido sobre el
 * operativo, el patrón existe: 54,1 % → 58,6 % → 88,9 % en tres jornadas.
 */
const parte = (fecha: string, codigo: string, efectivas: number, asistentes = 30): MonitoreoRow => ({
  applied_at: `${fecha} 10:00`, operational_code: codigo,
  effective_surveys: efectivas, observed_students: asistentes,
} as unknown as MonitoreoRow);

const aula = (codigo: string, elegibles: number, esperadas: number): MonitoreoRow => ({
  operational_code: codigo, eligible_n: elegibles, expected_valid: esperadas,
} as unknown as MonitoreoRow);

describe("la efectividad, día a día", () => {
  const plan = [aula("CH 1", 40, 20), aula("CH 2", 60, 30), aula("CH 3", 20, 10)];

  it("agrupa por día y calcula la tasa sobre ELEGIBLES", () => {
    const dias = efectividadPorDia(
      [parte("2026-09-07", "CH 1", 20), parte("2026-09-07", "CH 2", 30), parte("2026-09-08", "CH 3", 18)],
      plan,
    );
    expect(dias.map((d) => d.fecha)).toEqual(["2026-09-07", "2026-09-08"]);
    // 50 de 100 elegibles el primer día; 18 de 20 el segundo.
    expect(dias[0].tau).toBe(50);
    expect(dias[1].tau).toBe(90);
  });

  it("sale en orden CRONOLÓGICO, no por tasa: una tendencia se lee en el tiempo", () => {
    const dias = efectividadPorDia(
      [parte("2026-09-09", "CH 3", 18), parte("2026-09-07", "CH 1", 5)],
      plan,
    );
    expect(dias.map((d) => d.fecha)).toEqual(["2026-09-07", "2026-09-09"]);
  });

  it("lleva el número de AULAS de cada día pegado", () => {
    // Sin él, un 88,9 % de siete visitas se lee como un hecho del operativo.
    const dias = efectividadPorDia(
      [parte("2026-09-07", "CH 1", 20), parte("2026-09-07", "CH 2", 30)], plan,
    );
    expect(dias[0].aulas).toBe(2);
  });

  it("compara también contra lo que el diseño esperaba de esas aulas", () => {
    const dias = efectividadPorDia([parte("2026-09-07", "CH 1", 30)], plan);
    expect(dias[0].esperadas).toBe(20);
    expect(dias[0].delEsperado).toBe(150);
  });

  it("un parte vacío no hunde su jornada", () => {
    // Misma regla que el ranking de rendimiento, y a propósito: dos criterios
    // de «este parte cuenta» darían dos verdades sobre el mismo día.
    const dias = efectividadPorDia(
      [parte("2026-09-07", "CH 1", 20), parte("2026-09-07", "CH 2", 0, 0)], plan,
    );
    expect(dias[0].aulas).toBe(1);
    expect(dias[0].tau).toBe(50);
  });

  it("una fecha ilegible no inventa un día", () => {
    const dias = efectividadPorDia(
      [{ applied_at: "el lunes", operational_code: "CH 1", effective_surveys: 9, observed_students: 9 } as unknown as MonitoreoRow],
      plan,
    );
    expect(dias).toHaveLength(0);
  });

  it("sin elegibles conocidos la tasa es null, no cero", () => {
    const dias = efectividadPorDia([parte("2026-09-07", "CH 99", 12)], plan);
    expect(dias[0].tau).toBeNull();
    expect(dias[0].efectivas).toBe(12);
  });
});

describe("hacia dónde va", () => {
  const plan = [aula("CH 1", 100, 50), aula("CH 2", 100, 50)];

  it("con dos jornadas separadas, dice el sentido y enseña las dos puntas", () => {
    const t = tendenciaDeEfectividad(efectividadPorDia(
      [parte("2026-09-07", "CH 1", 40), parte("2026-09-09", "CH 2", 80)], plan,
    ));
    expect(t?.sentido).toBe("sube");
    expect(t?.desde.tau).toBe(40);
    expect(t?.hasta.tau).toBe(80);
  });

  it("una diferencia de un punto es ESTABLE: no se le lee intención al ruido", () => {
    const t = tendenciaDeEfectividad(efectividadPorDia(
      [parte("2026-09-07", "CH 1", 40), parte("2026-09-09", "CH 2", 41)], plan,
    ));
    expect(t?.sentido).toBe("estable");
  });

  it("con un solo día no se afirma ninguna tendencia", () => {
    expect(tendenciaDeEfectividad(efectividadPorDia([parte("2026-09-07", "CH 1", 40)], plan))).toBeNull();
    expect(tendenciaDeEfectividad([])).toBeNull();
  });
});
