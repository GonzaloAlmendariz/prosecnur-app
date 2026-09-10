import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AulasAgendacion } from "./AulasAgendacion";
import type { MonitoreoRow } from "../../../../api/monitoreo";

/**
 * **«Cómo va la agendación»** (ítem 28). Gonzalo: «es muy importante tener en
 * Resumen cómo va la agendación de aulas, porque es lo que nos permite decir a
 * estas aulas vamos a ir a aplicar, y eso está en el Sheets».
 */
const fila = (f: Partial<MonitoreoRow>) => ({ sample_role: "titular", ...f } as MonitoreoRow);

const agenda = [
  fila({ faculty: "DERECHO", contact_date: "2026-09-01", scheduled_date: "2026-09-08" }),
  fila({ faculty: "DERECHO", contact_date: "2026-09-03", scheduled_date: "2026-09-09" }),
  fila({ faculty: "DERECHO", contact_date: "2026-09-09", scheduled_date: "2026-09-15" }),
  fila({ faculty: "PSICOLOGÍA", scheduled_date: "" }),
  fila({ faculty: "PSICOLOGÍA", scheduled_date: "" }),
];

describe("el panel de agendación", () => {
  it("dice lo que queda por agendar y a quién le falta", () => {
    const html = renderToStaticMarkup(<AulasAgendacion agenda={agenda} />);
    expect(html).toContain("Quedan <strong>2</strong>");
    expect(html).toContain("PSICOLOGÍA");
  });

  it("dibuja un día por cada jornada CON agendación", () => {
    const html = renderToStaticMarkup(<AulasAgendacion agenda={agenda} />);
    // Tres días con actividad: 01, 03 y 09. La comilla final importa: sin ella
    // el contador también cuenta el `<ul class="aulas-agd-dias">` que los envuelve.
    expect((html.match(/aulas-agd-dia"/g) ?? []).length).toBe(3);
  });

  it("dice hasta cuándo llega lo ya agendado", () => {
    expect(renderToStaticMarkup(<AulasAgendacion agenda={agenda} />)).toContain("15/09");
  });

  it("con todo agendado lo dice, en vez de enseñar un cero", () => {
    const todo = agenda.filter((f) => f.scheduled_date);
    const html = renderToStaticMarkup(<AulasAgendacion agenda={todo} />);
    expect(html).toContain("Todos los cursos-horario titulares tienen fecha");
  });

  it("sin titulares declara la ausencia, no dibuja un panel vacío", () => {
    const html = renderToStaticMarkup(<AulasAgendacion agenda={[]} />);
    expect(html).toContain("todavía no trae cursos-horario titulares");
    expect(html).not.toContain("aulas-agd-dias");
  });
});
