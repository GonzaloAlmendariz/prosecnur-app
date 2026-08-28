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

  it("el carril rotula solo donde cambia: es una banda, no veinticinco cuentas", () => {
    // Dos aulas sin agendar cubriendo 10:00-12:00 dan «2» en cuatro franjas
    // seguidas. Se escribe una vez.
    const html = renderToStaticMarkup(
      <AulasCargaDeCampo
        filas={[
          // Dos con fecha y dos sin ella: asi la vista abre en calendario, que
          // es el unico eje con carril.
          aula({ classroom_id: "f", sesiones_dia_hora: "LUN 08:00-09:00", scheduled_time: "08:00", scheduled_date: "2026-09-14" }),
          aula({ classroom_id: "g", sesiones_dia_hora: "LUN 08:00-09:00", scheduled_time: "08:00", scheduled_date: "2026-09-21" }),
          aula({ classroom_id: "a", sesiones_dia_hora: "MAR 10:00-12:00" }),
          aula({ classroom_id: "b", sesiones_dia_hora: "MAR 10:00-12:00" }),
        ]}
      />,
    );
    const i = html.indexOf("es-por-agendar");
    expect(i).toBeGreaterThan(-1);
    const carril = html.slice(i);
    // «2» aparece en cuatro franjas de 30 min, pero rotulado una sola vez.
    expect((carril.match(/>2<\/span>/g) ?? []).length).toBe(1);
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
