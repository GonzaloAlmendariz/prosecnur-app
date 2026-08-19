import { describe, expect, it } from "vitest";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { colaDeContacto } from "./colaDeContacto";

const fila = (f: Partial<MonitoreoAulasPlanRow>) => f as MonitoreoAulasPlanRow;

describe("colaDeContacto", () => {
  it("el que más intentos lleva encabeza la cola", () => {
    // Es el que se va a caer: decidir si se insiste o se activa su reserva es
    // la decisión del día.
    const { pendientes } = colaDeContacto([
      fila({ operational_code: "CH 1", sample_status: "", contact_attempts: 2 }),
      fila({ operational_code: "CH 2", sample_status: "", contact_attempts: 6 }),
    ]);
    expect(pendientes.map((p) => p.codigo)).toEqual(["CH 2", "CH 1"]);
  });

  it("una reserva dormida NO se persigue", () => {
    // No se llama hasta que su titular cae; meterla en la cola mandaría al
    // equipo a perseguir aulas que nadie necesita todavía.
    const { pendientes } = colaDeContacto([
      fila({ operational_code: "R 1.1", sample_role: "chain_reserve", sample_status: "en reserva 1" }),
    ]);
    expect(pendientes).toHaveLength(0);
  });

  it("lo que ya cayó tampoco entra en la cola", () => {
    const { pendientes } = colaDeContacto([
      fila({ operational_code: "CH 1", sample_status: "reemplazada", contact_attempts: 9 }),
    ]);
    expect(pendientes).toHaveLength(0);
  });

  it("el esfuerzo sale de las que SÍ consiguieron cita", () => {
    const { esfuerzo } = colaDeContacto([
      fila({ operational_code: "A", faculty: "Derecho", sample_status: "agendada", contact_attempts: 4 }),
      fila({ operational_code: "B", faculty: "Derecho", sample_status: "agendada", contact_attempts: 2 }),
      fila({ operational_code: "C", faculty: "Letras", sample_status: "reagendada", contact_attempts: 1 }),
    ]);
    expect(esfuerzo[0]).toMatchObject({ facultad: "Derecho", aulas: 2, intentos: 3 });
    expect(esfuerzo[1]).toMatchObject({ facultad: "Letras", aulas: 1, intentos: 1 });
  });

  it("el banco no se contacta", () => {
    const { pendientes, esfuerzo } = colaDeContacto([
      fila({ operational_code: "EXTRA 1", sample_role: "extra_reserve_pool", sample_status: "" }),
    ]);
    expect(pendientes).toHaveLength(0);
    expect(esfuerzo).toHaveLength(0);
  });
});
