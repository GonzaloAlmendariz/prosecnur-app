import { describe, expect, it } from "vitest";
import { agendacionDeAulas } from "./agendacionDeAulas";
import type { MonitoreoRow } from "../../../../api/monitoreo";

const fila = (f: Partial<MonitoreoRow>) => ({ sample_role: "titular", ...f } as MonitoreoRow);

/** Los nombres son los reales de la agenda: `contact_date` y `scheduled_date`. */
const agenda = [
  fila({ faculty: "DERECHO", contact_date: "2026-09-01", scheduled_date: "2026-09-08" }),
  fila({ faculty: "DERECHO", contact_date: "2026-09-01", scheduled_date: "2026-09-09" }),
  fila({ faculty: "DERECHO", contact_date: "2026-09-09", scheduled_date: "2026-09-15" }),
  fila({ faculty: "PSICOLOGÍA", contact_date: "2026-09-09", scheduled_date: "" }),
  fila({ faculty: "PSICOLOGÍA", scheduled_date: "" }),
  fila({ faculty: "DERECHO", scheduled_date: "", sample_status: "rechazo" }),
  // Una reserva NO se agenda hasta que hace falta: fuera de todas las cuentas.
  fila({ sample_role: "chain_reserve", faculty: "DERECHO", scheduled_date: "" }),
];

describe("agendacionDeAulas", () => {
  it("cuenta sólo titulares: las reservas no se agendan", () => {
    expect(agendacionDeAulas(agenda).titulares).toBe(6);
  });

  it("separa lo que ya tiene fecha de visita de lo que falta", () => {
    const a = agendacionDeAulas(agenda);
    expect(a.conFecha).toBe(3);
    // Dos sin fecha; el rechazo NO cuenta como pendiente.
    expect(a.sinFecha).toBe(2);
  });

  it("un rechazo no es trabajo pendiente de agendar", () => {
    // Su desenlace ya ocurrió: contarlo pediría un trabajo que nadie va a hacer.
    const a = agendacionDeAulas(agenda);
    expect(a.faltanPorFacultad.find((f) => f.facultad === "DERECHO")).toBeUndefined();
  });

  it("el ritmo sale de CUÁNDO SE AGENDÓ, no de cuándo se visita", () => {
    // `contact_date` es hablar con el docente; `scheduled_date`, ir al aula.
    // Mezclarlas daría el calendario de visitas disfrazado de ritmo.
    const a = agendacionDeAulas(agenda);
    // Dos el 01 y dos el 09: la quinta y la sexta fila no traen `contact_date`
    // y la séptima es reserva. (Conté tres al escribirlo; el fixture manda.)
    expect(a.porDia).toEqual([
      { fecha: "2026-09-01", aulas: 2 },
      { fecha: "2026-09-09", aulas: 2 },
    ]);
  });

  it("los últimos días son los que TUVIERON actividad", () => {
    // Un fin de semana sin agendar hundiría el ritmo con ceros que nadie trabajó.
    const a = agendacionDeAulas(agenda, { ultimos: 1 });
    expect(a.ultimosDias).toBe(1);
    expect(a.ultimosAulas).toBe(2);
  });

  it("dice hasta qué día llega lo agendado", () => {
    expect(agendacionDeAulas(agenda).hasta).toBe("2026-09-15");
  });

  it("las que faltan se ordenan por cuántas, y nombran su facultad", () => {
    expect(agendacionDeAulas(agenda).faltanPorFacultad).toEqual([
      { facultad: "PSICOLOGÍA", aulas: 2 },
    ]);
  });

  it("sin agenda no inventa un estado", () => {
    expect(agendacionDeAulas([]).titulares).toBe(0);
    expect(agendacionDeAulas(null).porDia).toEqual([]);
  });
});
