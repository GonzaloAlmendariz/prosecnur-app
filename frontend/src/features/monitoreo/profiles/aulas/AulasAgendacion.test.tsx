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
  fila({
    sample_role: "chain_reserve", faculty: "LETRAS", contact_date: "2026-09-09",
    equivalence_level: "misma_celda", titular_operational_code: "CH 7",
  }),
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
    expect(html).toContain("Reservas activadas");
    expect(html).toContain("aulas-agd-clave es-reemplazo");
  });

  it("dice cuántos reemplazos se aplicaron, de qué tipo y a quién cubren", () => {
    // «Tampoco me estás diciendo cuántos reemplazos ya se aplicaron y qué tipo
    // de reemplazos» (ítem 5). Aplicado es haber ido, no tener fecha.
    const html = renderToStaticMarkup(<AulasAgendacion agenda={agenda} />);
    expect(html).toContain("ninguno aplicado todavía");
    expect(html).toContain("del mismo perfil que el titular");
    expect(html).toContain("cubren CH 7");
    expect(html).toContain("sin motivo declarado en el libro");
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

  it("escribe el mes al empezar y sólo cuando cambia, pero reserva su renglón", () => {
    // **La celda del mes existe en las nueve columnas, vacía en ocho.** Iba
    // sólo donde había texto y entonces esa columna medía un renglón más que
    // sus vecinas: el día se le subía y la fila quedaba en diente de sierra.
    // «Este debe estar alineado» (Gonzalo, 2026-09-10).
    const html = renderToStaticMarkup(<AulasAgendacion agenda={agenda} />);
    expect((html.match(/aulas-agd-mes/g) ?? []).length).toBe(9);
    expect((html.match(/aulas-agd-mes">set/g) ?? []).length).toBe(1);
  });

  it("la cifra se ancla al alto de SU barra, no a una fila fija", () => {
    // Suelta arriba del todo, «29» quedaba a media pantalla de la barra que
    // cuenta y había que emparejarlas a ojo.
    const html = renderToStaticMarkup(<AulasAgendacion agenda={agenda} />);
    expect(html).toMatch(/aulas-agd-n[^>]*style="bottom:\s*100%/);
    // Y sólo la escriben los días con agendación: tres de nueve.
    expect((html.match(/aulas-agd-n/g) ?? []).length).toBe(3);
  });

  it("con un rango largo deja de escribir lo que ya no cabe", () => {
    const largo = [
      fila({ faculty: "DERECHO", contact_date: "2026-08-01", scheduled_date: "2026-09-08" }),
      fila({ faculty: "DERECHO", contact_date: "2026-09-09", scheduled_date: "2026-09-15" }),
    ];
    expect(renderToStaticMarkup(<AulasAgendacion agenda={largo} />)).toContain("es-apretado");
    expect(renderToStaticMarkup(<AulasAgendacion agenda={agenda} />)).not.toContain("es-apretado");
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
