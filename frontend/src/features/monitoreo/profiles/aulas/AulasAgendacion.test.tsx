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
  fila({ faculty: "PSICOLOGÍA", contact_date: "2026-09-09", scheduled_date: "" }),
  fila({ faculty: "PSICOLOGÍA", scheduled_date: "" }),
  fila({ sample_role: "chain_reserve", faculty: "LETRAS", contact_date: "2026-09-09" }),
];

describe("el panel de agendación", () => {
  it("separa los tres trabajos: agendar, insistir y empezar", () => {
    // «Falta tomar en cuenta agendación que son reemplazos, agendaciones de
    // titulares, y cuántos en contacto se tiene que aún no recibimos respuesta».
    const html = renderToStaticMarkup(<AulasAgendacion agenda={agenda} />);
    expect(html).toContain("<strong>3</strong> de 5 titulares");
    expect(html).toContain("en contacto sin respuesta");
    expect(html).toContain("sin contactar aún");
    expect(html).toContain("PSICOLOGÍA");
  });

  it("cuenta aparte la reserva que ya está en juego", () => {
    const html = renderToStaticMarkup(<AulasAgendacion agenda={agenda} />);
    expect(html).toContain("Reemplazos en juego");
    expect(html).toContain("aulas-agd-clave es-reemplazo");
  });

  it("dibuja TODOS los días del rango, también los que no tuvieron agendación", () => {
    // Un eje que salta el sábado dibuja un ritmo que no existió. Del 01 al 09
    // son nueve columnas, y sólo tres traen cifra.
    const html = renderToStaticMarkup(<AulasAgendacion agenda={agenda} />);
    expect((html.match(/aulas-agd-dia"/g) ?? []).length).toBe(9);
    expect((html.match(/es-sin-agendar/g) ?? []).length).toBe(6);
  });

  it("el eje llega hasta el corte aunque hoy no se haya agendado nada", () => {
    const html = renderToStaticMarkup(<AulasAgendacion agenda={agenda} corte="2026-09-12" />);
    expect((html.match(/aulas-agd-dia"/g) ?? []).length).toBe(12);
  });

  it("escribe el mes al empezar y sólo cuando cambia", () => {
    const html = renderToStaticMarkup(<AulasAgendacion agenda={agenda} />);
    expect((html.match(/aulas-agd-mes/g) ?? []).length).toBe(1);
    expect(html).toContain("set");
  });

  it("dice hasta cuándo llega lo ya agendado", () => {
    expect(renderToStaticMarkup(<AulasAgendacion agenda={agenda} />)).toContain("15/09");
  });

  it("sin titulares declara la ausencia, no dibuja un panel vacío", () => {
    const html = renderToStaticMarkup(<AulasAgendacion agenda={[]} />);
    expect(html).toContain("todavía no trae cursos-horario titulares");
    expect(html).not.toContain("aulas-agd-dias");
  });
});
