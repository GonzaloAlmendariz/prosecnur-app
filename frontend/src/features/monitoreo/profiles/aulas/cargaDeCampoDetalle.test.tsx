// cargaDeCampoDetalle.test.tsx — la malla de carga se explora: celdas con
// dueño, pico marcado en la malla, totales por fila y pager por semana.
//
// Dictado en vivo (2026-09-02): «más claro, más amplio, menos vacío… puede ser
// scrolleable por semana, y además cada 30 mins con hover». Los pins son
// estáticos —renderToStaticMarkup, patrón eslabonDeLaAgenda—: la mecánica del
// detalle la sostienen los helpers (quienesEnLaCelda, semanasDeCarga) y el
// estado inicial declara aquí sus superficies.
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

describe("las celdas ocupadas se pueden explorar; las vacías no estorban el teclado", () => {
  const html = renderToStaticMarkup(
    <AulasCargaDeCampo
      filas={[
        aula({ classroom_id: "a", operational_code: "CH 1", teacher: "RUTH", venue: "A501", sesiones_dia_hora: "LUN 10:00-12:00", scheduled_time: "10:00" }),
        aula({ classroom_id: "b", operational_code: "CH 2", teacher: "MARTA", venue: "A502", sesiones_dia_hora: "LUN 10:00-12:00" }),
      ]}
    />,
  );

  it("la celda con gente es un botón con nombre accesible que dice sus dos capas", () => {
    expect(html).toMatch(/<button[^>]*class="aulas-carga-celda[^"]*"[^>]*aria-label="lunes 10:00: 1 confirmado, hasta 1 por agendar/);
  });

  it("la celda vacía no es un botón: cien tab-stops muertos no son acceso", () => {
    // Las vacías se pintan como span; el recorrido de teclado sólo pisa datos.
    expect(html).toMatch(/<span class="aulas-carga-celda"/);
  });

  it("el panel de detalle existe desde el primer render y explica cómo se usa", () => {
    expect(html).toContain("aulas-carga-detalle");
    expect(html).toContain("qué cursos-horario caen");
  });

  it("B37: la fecha es un control con nombre accesible — click y el día entero al detalle", () => {
    // Dictado (2026-09-02): «el calendario se ve mejor». El parte del día sin
    // recorrer diez celdas con el puntero; la mecánica del resumen la
    // sostiene citasDeLaFila (quienesEnLaCelda.test.ts).
    expect(html).toContain("aulas-carga-dia");
    expect(html).toMatch(/aria-label="lunes: ver todas sus citas en el detalle"/);
    expect(html).toContain("Click en una fecha deja su");
  });

  it("la duración nace confirmada: el slider sólo existe tras el lápiz", () => {
    // Dictado (2026-09-02): «muy accesible para editar… una vez confirmas
    // que dura por ejemplo 30 se queda allí hasta que lo edites».
    expect(html).toContain("aulas-carga-duracion-boton");
    expect(html).toContain("Editar");
    expect(html).not.toContain('type="range"');
  });

  it("B39: la celda verde dice SOLO el confirmado; el techo vive en el nombre accesible", () => {
    // Dos rondas del mismo dictado. Primera: la suma pintaba «2» donde el
    // cruce real era 1. Segunda (veredicto en vivo sobre el «+N»: «no se
    // ve… francamente mal… estás combinando más cosas a la vez»): el techo
    // tampoco va DENTRO del número — la celda confirmada es solo verde y
    // solo su cifra; lo que falta se lee en hover/aria/detalle.
    expect(html).not.toContain("aulas-carga-techo");
    // El fixture tiene 1 confirmado + 1 plausible a las 10:00: la capa que
    // no se pinta en el número sigue declarada donde corresponde.
    expect(html).toMatch(/aria-label="lunes 10:00: 1 confirmado, hasta 1 por agendar/);
  });

  it("el pico del operativo está marcado EN la malla, no solo en el KPI", () => {
    expect(html).toContain("es-pico");
  });

  it("cada fila cierra con su total de cursos-horario", () => {
    expect(html).toContain(">CH<");
    expect(html).toContain("aulas-carga-total");
  });
});

describe("el calendario se recorre por semana", () => {
  const dosSemanas = [
    aula({ classroom_id: "a", operational_code: "CH 1", sesiones_dia_hora: "LUN 10:00-12:00", scheduled_time: "10:00", scheduled_date: "2026-09-14" }),
    aula({ classroom_id: "b", operational_code: "CH 2", sesiones_dia_hora: "LUN 10:00-12:00", scheduled_time: "10:00", scheduled_date: "2026-09-21" }),
  ];

  it("con más de una semana aparece el pager ‹ › con «Hoy», y abre mostrando todo", () => {
    const html = renderToStaticMarkup(<AulasCargaDeCampo filas={dosSemanas} />);
    expect(html).toMatch(/aria-label="Semana visible"/);
    expect(html).toContain("Semana anterior");
    expect(html).toContain("Semana siguiente");
    expect(html).toContain(">Hoy<");
    // Abre en «todas»: paginar es un gesto del usuario, no un recorte de
    // apertura — las dos fechas están en pantalla.
    expect(html).toContain("Lunes 14/09");
    expect(html).toContain("Lunes 21/09");
  });

  it("con una sola semana no hay nada que paginar y el pager no se pinta", () => {
    const html = renderToStaticMarkup(
      <AulasCargaDeCampo
        filas={[aula({ classroom_id: "a", sesiones_dia_hora: "LUN 10:00-12:00", scheduled_time: "10:00", scheduled_date: "2026-09-14" })]}
      />,
    );
    expect(html).not.toContain("Semana anterior");
  });
});
