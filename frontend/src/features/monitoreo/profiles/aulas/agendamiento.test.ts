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
 * **Aplicada sin fecha agendada: un descuadre, no un estado del operativo.**
 *
 * Regla del operativo (Gonzalo, 2026-08-24): «si no se agenda un aula, no se
 * aplica; esa situación no puede suceder». La primera versión de este test
 * llamaba al caso «aplicadas sin cita previa» y lo daba por bueno, porque mi
 * simulación de campo aplicaba sin agendar antes — fabriqué un imposible y
 * después escribí UI que lo normalizaba.
 *
 * Se cuenta y no se bloquea: la combinación puede llegar del Excel por un error
 * de transcripción —falta la fecha en la agenda, o el parte se anotó en la fila
 * equivocada— y rechazar la importación perdería un parte real. Descartarlo en
 * silencio lo escondería.
 */
describe("agendamiento · una aplicada sin agenda es un descuadre", () => {
  const fila = (over: Record<string, unknown>) =>
    ({ sample_role: "titular", sample_status: "agendada", ...over }) as never;

  it("no cuenta como por agendar: no hay cita que cerrar, hay algo que revisar", () => {
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

  it("las tres cifras siguen particionando el total en juego", () => {
    const r = agendamiento([
      fila({ operational_status: "aplicada" }),
      fila({ scheduled_date: "2026-09-02" }),
      fila({}),
      fila({}),
    ]);
    expect(r.agendadas + r.aplicadasSinAgenda + r.porAgendar).toBe(r.enJuego);
  });
});
