import { describe, expect, it } from "vitest";

import type { MonitoreoRow } from "../../../../api/monitoreo";
import { rendimientoPorFacultad } from "./rendimientoPorFacultad";

const parte = (f: Partial<MonitoreoRow>) => f as MonitoreoRow;

describe("rendimientoPorFacultad", () => {
  it("ordena por lo que deja cada visita, NO por porcentaje", () => {
    // El caso que Gonzalo describió: un aula de 100 elegibles al 40 % rinde más
    // que una de 20 al 70 %. Ordenar por porcentaje pondría primero a la que
    // menos aporta, que es exactamente el error que hay que no cometer.
    const salida = rendimientoPorFacultad(
      [
        parte({ operational_code: "G", faculty: "Grande", effective_surveys: 40, observed_students: 100 }),
        parte({ operational_code: "P", faculty: "Pequena", effective_surveys: 14, observed_students: 20 }),
      ],
    );
    expect(salida.map((f) => f.facultad)).toEqual(["Grande", "Pequena"]);
    expect(salida[0].porAula).toBe(40);
    // Y la tasa sobre asistentes dice lo contrario: por eso convive, no sustituye.
    expect(salida[0].deLosAsistentes).toBe(40);
    expect(salida[1].deLosAsistentes).toBe(70);
  });

  it("un parte vacío no hunde la tasa de su facultad", () => {
    // Sin efectivas NI asistentes no es un aula que rindió cero: es un parte que
    // nadie llenó todavía.
    const [f] = rendimientoPorFacultad([
      parte({ operational_code: "A", faculty: "X", effective_surveys: 20, observed_students: 25 }),
      parte({ operational_code: "B", faculty: "X" }),
    ]);
    expect(f.aulas).toBe(1);
    expect(f.porAula).toBe(20);
  });

  it("el potencial sale de los elegibles del plan", () => {
    const [f] = rendimientoPorFacultad(
      [parte({ operational_code: "A", faculty: "X", effective_surveys: 30, observed_students: 40 })],
      [parte({ operational_code: "A", eligible_n: 60 })],
    );
    expect(f.elegibles).toBe(60);
    expect(f.delPotencial).toBe(50);
  });

  it("sin elegibles conocidos el potencial es nulo, no cero", () => {
    // Un cero se leería como «no queda nada por exprimir», que es lo contrario
    // de «no se sabe».
    const [f] = rendimientoPorFacultad([
      parte({ operational_code: "A", faculty: "X", effective_surveys: 10, observed_students: 12 }),
    ]);
    expect(f.delPotencial).toBeNull();
    expect(f.deLosAsistentes).toBeCloseTo(83.3, 1);
  });
});
