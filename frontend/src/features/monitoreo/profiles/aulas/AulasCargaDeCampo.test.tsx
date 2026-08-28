import { describe, expect, it } from "vitest";

import { renderToStaticMarkup } from "react-dom/server";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";
import { AulasCargaDeCampo } from "./AulasCargaDeCampo";

const aula = (over: Partial<MonitoreoAulasPlanRow>): MonitoreoAulasPlanRow =>
  ({
    selection_run_id: "r", wave: "M1", orden: 1, classroom_id: "x", label: "x", course_id: "c",
    course_name: "Curso", section: "", schedule: "", teacher: "", teacher_email: "", faculty: "F",
    program: "", level: "", stratum: "", eligible_n: 20, expected_valid: 10, link: "", qr: "",
    collector_id: "", responsible: "", sample_role: "titular",
    ...over,
  }) as MonitoreoAulasPlanRow;

/**
 * La vista abre con la lectura que corresponde al estado del estudio, y en el
 * calendario no deja que un techo se lea como un hecho.
 */
describe("AulasCargaDeCampo", () => {
  it("sin nada agendado abre en patron semanal", () => {
    const html = renderToStaticMarkup(
      <AulasCargaDeCampo
        filas={[
          aula({ classroom_id: "a", sesiones_dia_hora: "LUN 10:00-12:00", venue: "A501" }),
          aula({ classroom_id: "b", sesiones_dia_hora: "MAR 10:00-12:00", venue: "A502" }),
        ]}
      />,
    );
    expect(html).toContain(">lunes<");
    expect(html).toContain(">martes<");
    expect(html).not.toContain("Por agendar · todavía sin fecha");
    // El eje activo se declara en el control, no solo en la tabla.
    expect(html).toMatch(/aria-pressed="true"[^>]*>Patrón semanal/);
  });

  it("con el operativo confirmado abre en calendario y pone cada fecha en su fila", () => {
    const html = renderToStaticMarkup(
      <AulasCargaDeCampo
        filas={[
          aula({
            classroom_id: "a", sesiones_dia_hora: "LUN 10:00-12:00", venue: "A501",
            scheduled_time: "10:00", scheduled_date: "2026-09-14",
          }),
          aula({
            classroom_id: "b", sesiones_dia_hora: "LUN 10:00-12:00", venue: "A502",
            scheduled_time: "10:00", scheduled_date: "2026-09-21",
          }),
        ]}
      />,
    );
    expect(html).toContain("Lunes 14/09");
    expect(html).toContain("Lunes 21/09");
    expect(html).toMatch(/aria-pressed="true"[^>]*>Calendario/);
    expect(html).toContain(">Fecha<");
  });

  it("el carril de lo que falta agendar se rotula: no es una fecha mas", () => {
    const html = renderToStaticMarkup(
      <AulasCargaDeCampo
        filas={[
          aula({
            classroom_id: "a", sesiones_dia_hora: "LUN 10:00-12:00",
            scheduled_time: "10:00", scheduled_date: "2026-09-14",
          }),
          aula({ classroom_id: "b", sesiones_dia_hora: "MAR 10:00-12:00" }),
        ]}
      />,
    );
    expect(html).toContain("Por agendar · todavía sin fecha");
    expect(html).toContain("aulas-carga-carril");
  });

  it("declara las agendadas sin fecha en vez de descartarlas en silencio", () => {
    const html = renderToStaticMarkup(
      <AulasCargaDeCampo
        filas={[
          aula({
            classroom_id: "a", sesiones_dia_hora: "LUN 10:00-12:00",
            scheduled_time: "10:00", scheduled_date: "2026-09-14",
          }),
          // Hora acordada pero sin fecha: no cabe en el calendario.
          aula({ classroom_id: "b", sesiones_dia_hora: "LUN 10:00-12:00", scheduled_time: "11:00" }),
        ]}
      />,
    );
    // Una sola: el aviso concuerda en singular.
    expect(html).toContain("1 aula tiene hora acordada pero no fecha");
  });

  it("sin horario en el catalogo lo dice en vez de pintar una malla vacia", () => {
    const html = renderToStaticMarkup(
      <AulasCargaDeCampo filas={[aula({ classroom_id: "a", sesiones_dia_hora: "" })]} />,
    );
    expect(html).toContain("no trae el horario");
  });
});
