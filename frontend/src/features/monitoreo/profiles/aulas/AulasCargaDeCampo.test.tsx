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

  it("el calendario no lista el carril: lo pendiente vive en el patrón semanal", () => {
    // Dictado en vivo (2026-09-02): «el por agendar ya está en patrón semanal,
    // no lo necesitas en calendario» — el carril apilaba semanas y desbordaba
    // la vista. El KPI sigue declarando dónde vive lo pendiente.
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
    expect(html).toMatch(/aria-pressed="true"[^>]*>Calendario/);
    expect(html).not.toContain("Por agendar · todavía sin fecha");
    expect(html).not.toContain("aulas-carga-carril");
    expect(html).toContain("Por agendar, en el pico del patrón");
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
    expect(html).toContain("1 curso-horario tiene hora acordada pero no fecha");
  });

  it("solo rotula las horas en punto; la media hora queda para lectores de pantalla", () => {
    const html = renderToStaticMarkup(
      <AulasCargaDeCampo filas={[aula({ classroom_id: "a", sesiones_dia_hora: "LUN 10:00-12:00" })]} />,
    );
    // 25 etiquetas de 30 en 30 son el mismo dato repetido; la regla vertical
    // de `es-hora` es la que dice en que hora cae cada celda.
    expect(html).toContain('class="es-hora"');
    expect(html).toContain('class="es-media"');
    expect(html).toMatch(/es-media[^>]*><span class="pulso-sr-only">10:30<\/span>/);
  });

  it("las que faltan agendar no se cuelan en las filas por fecha del calendario", () => {
    // El carril salió del calendario (dictado 2026-09-02); las bandas de lo
    // pendiente tampoco pueden reaparecer dentro de una fecha: la fila del
    // 14/09 muestra SU cita, no el patrón del martes.
    const html = renderToStaticMarkup(
      <AulasCargaDeCampo
        filas={[
          aula({ classroom_id: "f", sesiones_dia_hora: "LUN 08:00-09:00", scheduled_time: "08:00", scheduled_date: "2026-09-14" }),
          aula({ classroom_id: "g", sesiones_dia_hora: "LUN 08:00-09:00", scheduled_time: "08:00", scheduled_date: "2026-09-21" }),
          aula({ classroom_id: "a", sesiones_dia_hora: "MAR 10:00-12:00" }),
          aula({ classroom_id: "b", sesiones_dia_hora: "MAR 10:00-12:00" }),
        ]}
      />,
    );
    expect(html).not.toContain("es-por-agendar");
    // Las franjas del martes pendiente (10:00-12:00) no viven en ninguna fila:
    // el «2» de su banda no aparece como celda.
    expect(html).not.toMatch(/>2<\/button>/);
    // Y las fechas sí están, cada una con su cita.
    expect(html).toContain("Lunes 14/09");
    expect(html).toContain("Lunes 21/09");
  });

  it("separa las semanas del calendario en vez de dar una lista plana", () => {
    const html = renderToStaticMarkup(
      <AulasCargaDeCampo
        filas={[
          aula({ classroom_id: "a", sesiones_dia_hora: "LUN 10:00-12:00", scheduled_time: "10:00", scheduled_date: "2026-09-14" }),
          aula({ classroom_id: "b", sesiones_dia_hora: "MAR 10:00-12:00", scheduled_time: "10:00", scheduled_date: "2026-09-15" }),
          // Lunes de la semana siguiente: aqui empieza semana.
          aula({ classroom_id: "c", sesiones_dia_hora: "LUN 10:00-12:00", scheduled_time: "10:00", scheduled_date: "2026-09-21" }),
        ]}
      />,
    );
    expect((html.match(/abre-semana/g) ?? []).length).toBe(1);
  });

  it("sin horario en el catalogo lo dice en vez de pintar una malla vacia", () => {
    const html = renderToStaticMarkup(
      <AulasCargaDeCampo filas={[aula({ classroom_id: "a", sesiones_dia_hora: "" })]} />,
    );
    expect(html).toContain("no trae el horario");
  });
});
