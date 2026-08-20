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
