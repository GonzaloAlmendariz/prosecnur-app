import { describe, expect, it } from "vitest";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { ritmoDeAgendacion } from "./ritmoDeAgendacion";

const fila = (f: Partial<MonitoreoAulasPlanRow>) => f as MonitoreoAulasPlanRow;

describe("ritmoDeAgendacion", () => {
  it("agrupa las agendadas por la jornada de su última gestión", () => {
    const r = ritmoDeAgendacion([
      fila({ operational_code: "A", sample_status: "agendada", contact_date: "2026-09-01" }),
      fila({ operational_code: "B", sample_status: "agendada", contact_date: "2026-09-01" }),
      fila({ operational_code: "C", sample_status: "reagendada 2", contact_date: "2026-09-03" }),
      // Sin cita: no cuenta aunque tenga gestión fechada.
      fila({ operational_code: "D", contact_date: "2026-09-01" }),
    ]);
    expect(r.jornadas).toEqual([
      { fecha: "2026-09-01", nuevas: 2 },
      { fecha: "2026-09-03", nuevas: 1 },
    ]);
    expect(r.conFecha).toBe(3);
    expect(r.pico).toEqual({ fecha: "2026-09-01", nuevas: 2 });
    expect(r.porJornada).toBe(1.5);
  });

  it("la agendada sin fecha de gestión se declara, no se inventa ni se calla", () => {
    const r = ritmoDeAgendacion([
      fila({ operational_code: "A", sample_status: "agendada" }),
      fila({ operational_code: "B", sample_status: "agendada", contact_date: "3/09" }),
    ]);
    // Ni vacío ni ISO estricto entran como jornada: van al bucket declarado.
    expect(r.jornadas).toEqual([]);
    expect(r.sinFechaDeGestion).toBe(2);
    expect(r.porJornada).toBeNull();
  });

  it("sin agendadas no hay ritmo que leer", () => {
    const r = ritmoDeAgendacion([fila({ operational_code: "A" })]);
    expect(r.jornadas).toEqual([]);
    expect(r.conFecha).toBe(0);
    expect(r.pico).toBeNull();
  });
});
