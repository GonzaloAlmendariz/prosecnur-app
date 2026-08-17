import { describe, expect, test } from "vitest";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { historiaDeCadena } from "./historiaDeCadena";

function titular(codigo: string, validas: number, meta: number, facultad = "Derecho"): MonitoreoAulasPlanRow {
  return {
    operational_code: codigo, sample_role: "titular", faculty: facultad,
    respuestas_validas: validas, expected_valid: meta, sample_status: "agendada",
  } as unknown as MonitoreoAulasPlanRow;
}

function reserva(codigo: string, de: string, orden: number, validas: number, meta: number): MonitoreoAulasPlanRow {
  return {
    operational_code: codigo, sample_role: "chain_reserve", replacement_for: de,
    replacement_order: orden, respuestas_validas: validas, expected_valid: meta,
    sample_status: "agendada",
  } as unknown as MonitoreoAulasPlanRow;
}

describe("historiaDeCadena", () => {
  test("dice cuál eslabón cerró la meta", () => {
    const res = historiaDeCadena([
      titular("CH 4", 5, 30),
      reserva("R 4.1", "CH 4", 1, 31, 30),
    ]);
    expect(res.historias).toHaveLength(1);
    expect(res.historias[0].cerro).toBe("R 4.1");
    expect(res.historias[0].desenlace).toBe("reemplazo");
    expect(res.cerraronEnReemplazo).toBe(1);
  });

  test("el cierre NO se acumula entre eslabones", () => {
    // 20 + 20 son 40 y la meta es 30, pero ningún aula llegó a la suya: cada
    // eslabon lleva su propio aforo elegible. Sumarlos diria que la cadena
    // cerro cuando en realidad ninguna aula alcanzo su meta.
    const res = historiaDeCadena([
      titular("CH 9", 20, 30),
      reserva("R 9.1", "CH 9", 1, 20, 30),
    ]);
    expect(res.historias[0].cerro).toBe("");
    expect(res.historias[0].desenlace).toBe("abierta");
    expect(res.historias[0].validas).toBe(40);
  });

  test("una cadena que cerró en el titular se distingue", () => {
    const res = historiaDeCadena([
      titular("CH 1", 31, 30),
      reserva("R 1.1", "CH 1", 1, 0, 30),
    ]);
    expect(res.historias[0].desenlace).toBe("titular");
    expect(res.cerraronEnTitular).toBe(1);
  });

  test("ordena los eslabones por su posición en la cadena", () => {
    const res = historiaDeCadena([
      reserva("R 2.2", "CH 2", 2, 0, 30),
      titular("CH 2", 4, 30),
      reserva("R 2.1", "CH 2", 1, 8, 30),
    ]);
    expect(res.historias[0].eslabones.map((e) => e.codigo)).toEqual(["CH 2", "R 2.1", "R 2.2"]);
    expect(res.historias[0].eslabones[0].orden).toBe(0);
  });

  test("los titulares sin reserva no llenan la vista", () => {
    // 170 filas de una sola línea no cuentan ninguna historia: se cuentan aparte.
    const res = historiaDeCadena([
      titular("CH 5", 30, 30),
      titular("CH 6", 10, 30),
      titular("CH 7", 4, 30),
      reserva("R 7.1", "CH 7", 1, 31, 30),
    ]);
    expect(res.historias).toHaveLength(1);
    expect(res.sinMovimiento).toBe(2);
  });

  test("las abiertas van primero: son las que piden decisión", () => {
    const res = historiaDeCadena([
      titular("CH 1", 31, 30), reserva("R 1.1", "CH 1", 1, 0, 30),
      titular("CH 2", 2, 30), reserva("R 2.1", "CH 2", 1, 3, 30),
    ]);
    expect(res.historias[0].titular).toBe("CH 2");
    expect(res.historias[0].desenlace).toBe("abierta");
    expect(res.abiertas).toBe(1);
  });
});
