import { describe, expect, it } from "vitest";

import type { MonitoreoAulasDashboard } from "../../../../../api/monitoreo";
import { construirAgenda, minutoDeHora, readinessDeAgenda } from "./agendaModelo";

// Semana del lun 28 set al vie 2 oct de 2026; hoy, jue 1 oct.
const dash = {
  agenda: [
    { operational_code: "CH 57", scheduled_date: "2026-09-29", scheduled_time: "9:45 am", scheduled_venue: "P303", sample_role: "titular", application_status: "pendiente", respuestas_validas: 21, faculty: "ESTUDIOS GENERALES CIENCIAS", eligible_n: "48" },
    { operational_code: "R 140.2", scheduled_date: "2026-09-28", scheduled_time: "10:00 am", scheduled_venue: "H302", sample_role: "chain_reserve", respuestas_validas: 9 },
    { operational_code: "CH 144", scheduled_date: "2026-09-30", scheduled_time: "7:00 pm", scheduled_venue: "Z402", sample_role: "titular", respuestas_validas: 0 },
    { operational_code: "CH 154", scheduled_date: "2026-10-01", scheduled_time: "11:45 am", scheduled_venue: "MU24", sample_role: "titular", respuestas_validas: 0 },
    { operational_code: "CH 155", scheduled_date: "2026-10-01", scheduled_time: "11:45 am", scheduled_venue: "MU25", sample_role: "titular", respuestas_validas: 0 },
    { operational_code: "CH 9", scheduled_date: "2026-09-15", scheduled_time: "8:00", sample_role: "titular", respuestas_validas: 0 },
    { operational_code: "CH 3", faculty: "CIENCIAS E INGENIERIA", eligible_n: "29", call_status: "Número no existe", contact_attempts: "1", venue: "M301" },
  ],
  // P8: manda el parte. CH 57 está «pendiente» en la agenda, pero su parte existe.
  partes_campo: [{ operational_code: "CH 57" }, { operational_code: "R 140.2" }],
  course_status_rol_y_estado: { acciones: { sin_agendar: ["CH 3"], agendado_vencido: ["CH 9"] } },
} as unknown as MonitoreoAulasDashboard;

describe("construirAgenda (Ctl1)", () => {
  it("lee horas con y sin am/pm", () => {
    expect(minutoDeHora("2:10 pm")).toBe(14 * 60 + 10);
    expect(minutoDeHora("12:05 am")).toBe(5);
    expect(minutoDeHora("14:10")).toBe(14 * 60 + 10);
    expect(minutoDeHora("a la salida")).toBeNull();
  });

  it("arma la semana de hoy con el parte mandando sobre la agenda", () => {
    const m = construirAgenda(dash, "2026-10-01");
    if (m.estado !== "listo" || "vacio" in m.semana) throw new Error("sin semana");
    expect(m.semana.titulo).toBe("Semana del 28 de setiembre al 2 de octubre");
    expect(m.semana.dias.map((d) => d.rotulo)).toEqual(["lun 28", "mar 29", "mié 30", "jue 1", "vie 2"]);
    expect(m.semana.dias[3].esHoy).toBe(true);
    const ch57 = m.semana.dias[1].citas[0];
    expect([ch57.estado, ch57.texto]).toEqual(["aplicada", "Aplicada, 21 efectivas"]);
    expect(m.semana.dias[2].citas[0]).toMatchObject({ codigo: "CH 144", estado: "vencida" });
    expect(m.semana.dias[3].citas.map((c) => c.estado)).toEqual(["por-aplicar", "por-aplicar"]);
    expect(m.semana.anterior).toBe("2026-09-14");
  });

  it("la franja cuenta la semana y las listas salen de las acciones del motor", () => {
    const m = construirAgenda(dash, "2026-10-01");
    if (m.estado !== "listo") throw new Error("sin modelo");
    const f = Object.fromEntries(m.franja.map((c) => [c.clave, c.valor]));
    expect(f).toMatchObject({ semana: "5", aplicadas: "2", hoy: "2", vencidas: "1", "sin-cita": "1" });
    expect(m.sinCita[0]).toMatchObject({ codigo: "CH 3", lugar: "M301", detalle: "Número no existe, 1 gestión" });
    expect(m.vencidas[0]).toMatchObject({ codigo: "CH 9", detalle: "Citada el 15 set" });
  });

  it("otra semana se pide por su lunes; sin tablero, el estado lo dice", () => {
    const m = construirAgenda(dash, "2026-10-01", "2026-09-14");
    if (m.estado !== "listo" || "vacio" in m.semana) throw new Error("sin semana");
    expect(m.semana.titulo).toBe("Semana del 14 de setiembre al 18 de setiembre");
    expect(readinessDeAgenda(construirAgenda(null, "2026-10-01"), false)).toBe("vacio:sin-tablero");
    expect(readinessDeAgenda(m, false)).toBe("monitoreo-aulas-control-agenda");
  });
});
