import { describe, expect, it } from "vitest";

import { agendamiento } from "./agendamiento";

const aula = (o: Record<string, unknown>) => ({ sample_role: "titular", ...o });

describe("agendamiento", () => {
  it("no cuenta lo que nadie va a agendar", () => {
    // El banco no cuelga de ningún titular y una reemplazada ya no se visita:
    // meterlas en el denominador diría que falta trabajo que no existe.
    const r = agendamiento([
      aula({ scheduled_date: "2026-09-01" }),
      aula({ sample_role: "extra_reserve_pool" }),
      aula({ sample_status: "reemplazada", scheduled_date: "2026-09-02" }),
    ]);
    expect(r.enJuego).toBe(1);
    expect(r.agendadas).toBe(1);
    expect(r.porAgendar).toBe(0);
  });

  it("agendada es la que tiene FECHA, no la que lo dice el estado", () => {
    // Cuando el estado y el hecho discrepan manda el hecho: una fila «agendada»
    // sin fecha no se puede visitar.
    const r = agendamiento([
      aula({ sample_status: "agendada" }),
      aula({ sample_status: "sin_contactar", scheduled_date: "2026-09-01" }),
    ]);
    expect(r.agendadas).toBe(1);
    expect(r.porAgendar).toBe(1);
  });

  it("la insistencia son los que pasaron de una gestión", () => {
    const r = agendamiento([
      aula({ contact_attempts: 1 }), aula({ contact_attempts: 3 }),
      aula({ contact_attempts: 5 }), aula({ contact_attempts: 0 }),
    ]);
    expect(r.conInsistencia).toBe(2);
    // Mediana de 1, 3, 5 —el cero no registra gestión y no entra—.
    expect(r.intentosMedianos).toBe(3);
  });

  it("sin ninguna gestión registrada no inventa una mediana", () => {
    // «0 intentos de media» diría que nadie llamó; `null` dice que no consta.
    expect(agendamiento([aula({})]).intentosMedianos).toBeNull();
  });

  it("los medios van de más a menos, y el vacío no es un medio", () => {
    const r = agendamiento([
      aula({ contact_medium: "Correo" }), aula({ contact_medium: "Llamada" }),
      aula({ contact_medium: "Llamada" }), aula({ contact_medium: "  " }),
    ]);
    expect(r.medios).toEqual([{ medio: "Llamada", aulas: 2 }, { medio: "Correo", aulas: 1 }]);
  });
});

/**
 * **Una ya aplicada no está «por agendar».**
 *
 * `seVaAAgendar` saca el banco, las reemplazadas y las reservas dormidas —«no la
 * va a agendar nadie»— y se dejaba fuera este caso. Medido en pantalla el
 * 2026-08-24, con diez aulas aplicadas entre el 1 y el 5 de septiembre: el KPI
 * decía «Por agendar 193» sobre un plan de 193 en el que diez ya estaban hechas.
 *
 * No suman a `agendadas` porque no lo estuvieron: se aplicaron sin cita previa.
 * Cuentan aparte para que la pista pueda explicar la resta.
 */
describe("agendamiento · las aplicadas salen del pendiente", () => {
  const fila = (over: Record<string, unknown>) =>
    ({ sample_role: "titular", sample_status: "agendada", ...over }) as never;

  it("una aplicada sin fecha no cuenta como por agendar", () => {
    const r = agendamiento([
      fila({ operational_status: "aplicada" }),
      fila({ operational_status: "planificada" }),
    ]);
    expect(r.enJuego).toBe(2);
    expect(r.agendadas).toBe(0);
    expect(r.aplicadasSinAgenda).toBe(1);
    expect(r.porAgendar).toBe(1);
  });

  it("una aplicada CON fecha sigue contando como agendada", () => {
    // Se agendó y además se aplicó: el hecho de la fecha manda, como ya decía
    // el comentario del bucle.
    const r = agendamiento([
      fila({ operational_status: "aplicada", scheduled_date: "2026-09-01" }),
    ]);
    expect(r.agendadas).toBe(1);
    expect(r.aplicadasSinAgenda).toBe(0);
    expect(r.porAgendar).toBe(0);
  });

  it("las tres cifras siguen sumando el total en juego", () => {
    const r = agendamiento([
      fila({ operational_status: "aplicada" }),
      fila({ scheduled_date: "2026-09-02" }),
      fila({}),
      fila({}),
    ]);
    expect(r.agendadas + r.aplicadasSinAgenda + r.porAgendar).toBe(r.enJuego);
  });
});
