import { describe, expect, it } from "vitest";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { medioDeContacto } from "./medioDeContacto";

const fila = (f: Partial<MonitoreoAulasPlanRow>) => f as MonitoreoAulasPlanRow;

describe("medioDeContacto", () => {
  it("una fecha de Excel colada NO entra en la mediana, y se cuenta", () => {
    // El caso real: la columna de intentos del libro trae 45909 y 23252, y con
    // ellos la MEDIA del correo sale 19,65 en vez de 3. Creerse ese número
    // llevaría a prohibir el correo.
    const [m] = medioDeContacto([
      fila({ contact_medium: "Correo", contact_attempts: 3, sample_status: "agendada" }),
      fila({ contact_medium: "Correo", contact_attempts: 3, sample_status: "agendada" }),
      fila({ contact_medium: "Correo", contact_attempts: 45909, sample_status: "agendada" }),
    ]);
    expect(m.intentos).toBe(3);
    expect(m.intentosDescartados).toBe(1);
    // La fila SÍ cuenta como aula: lo que se descarta es su número de intentos.
    expect(m.aulas).toBe(3);
  });

  it("ordena por lo que más agenda", () => {
    const salida = medioDeContacto([
      ...Array.from({ length: 8 }, () =>
        fila({ contact_medium: "Llamada", contact_attempts: 2, sample_status: "agendada" })),
      ...Array.from({ length: 2 }, () =>
        fila({ contact_medium: "Llamada", contact_attempts: 2, sample_status: "reemplazada" })),
      ...Array.from({ length: 6 }, () =>
        fila({ contact_medium: "Correo", contact_attempts: 3, sample_status: "agendada" })),
      ...Array.from({ length: 4 }, () =>
        fila({ contact_medium: "Correo", contact_attempts: 3, sample_status: "reemplazada" })),
    ]);
    expect(salida.map((m) => m.medio)).toEqual(["Llamada", "Correo"]);
    expect(salida[0].tasa).toBe(80);
    expect(salida[1].tasa).toBe(60);
  });

  it("«reagendada» también cuenta como conseguida", () => {
    // El medio consiguió la cita; que luego se moviera es otra historia.
    const [m] = medioDeContacto([
      fila({ contact_medium: "Llamada", sample_status: "reagendada" }),
    ]);
    expect(m.agendadas).toBe(1);
  });

  it("el banco no se contacta", () => {
    const salida = medioDeContacto([
      fila({ contact_medium: "Llamada", sample_role: "extra_reserve_pool", sample_status: "en_reserva" }),
    ]);
    expect(salida).toHaveLength(0);
  });

  it("sin intentos declarados la mediana es nula, no cero", () => {
    const [m] = medioDeContacto([fila({ contact_medium: "Llamada", sample_status: "agendada" })]);
    expect(m.intentos).toBeNull();
  });
});
