// calendarioEnLaAgenda.test.tsx — la cuadrícula de calendario en la Agenda
// (dictado de Gonzalo 2026-09-01: «que… el calendario de CHs a agendar se vea
// mejor»).
//
// Wiring pineado ligero, patrón eslabonDeLaAgenda: la colocación en semanas la
// verifica calendarioDeAgenda.test.ts; aquí se fija lo que la superficie DICE
// — celdas con su cuenta, HOY marcado, las repisas de lo que no cabe en un
// calendario y que la franja vieja de chips ya no es el markup.
import { describe, expect, it } from "vitest";

import { renderToStaticMarkup } from "react-dom/server";

import { agendaPorDia } from "./agendaPorDia";
import { AulasAgendaPorDia } from "./AulasAgendaPorDia";
import { AulasCalendarioDeAgenda } from "./AulasCalendarioDeAgenda";
import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";

const fila = (fecha: string, estado = "agendada"): MonitoreoAulasPlanRow => ({
  operational_code: `CH ${fecha || "sf"}-${estado}-${Math.random()}`,
  scheduled_date: fecha,
  application_state: estado,
} as unknown as MonitoreoAulasPlanRow);

const dias = (...filas: MonitoreoAulasPlanRow[]) => agendaPorDia(filas).dias;

describe("AulasCalendarioDeAgenda", () => {
  const html = renderToStaticMarkup(
    <AulasCalendarioDeAgenda
      dias={dias(
        fila("2026-09-08", "lista"),
        fila("2026-09-08", "lista"),
        fila("2026-09-08", "agendada"),
        fila("2026-09-21"),
      )}
      hoy="2026-09-15"
    />,
  );

  it("es un calendario de verdad: semanas encabezadas de lunes a domingo", () => {
    // Tabla con columnas nombradas, no una lista de chips: los días de la
    // semana se leen de la cabecera y cada fecha de su posición.
    for (const col of ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"]) {
      expect(html).toContain(`>${col}</th>`);
    }
    expect(html).toContain("septiembre 2026");
  });

  it("cada celda agendada dice su día del mes y su cuenta", () => {
    // El mismo formato de lectura que la franja vieja: total y sin empezar,
    // pronunciados como dos cifras separadas por palabras.
    expect(html).toContain('aria-label="3 cursos-horario, 2 sin empezar"');
  });

  it("HOY se marca con semántica, no solo con color", () => {
    expect(html).toContain('aria-current="date"');
  });

  it("el relleno de semana queda contenido, no protagónico", () => {
    expect(html).toContain("es-relleno");
  });

  it("la repisa «sin fecha agendada» es aparte, no una celda", () => {
    const conSinFecha = renderToStaticMarkup(
      <AulasCalendarioDeAgenda
        dias={dias(fila("2026-09-08"), fila(""), fila(""))}
        hoy="2026-09-08"
      />,
    );
    expect(conSinFecha).toContain("sin fecha agendada");
    expect(conSinFecha).toContain("aulas-calendario-repisa");
    // Y sin casos no se pinta un aviso vacío.
    expect(html).not.toContain("aulas-calendario-repisa");
  });

  it("una fecha imposible del libro se declara tal como está escrita", () => {
    const roto = renderToStaticMarkup(
      <AulasCalendarioDeAgenda
        dias={dias(fila("2026-09-08"), fila("2026-09-31"))}
        hoy="2026-09-08"
      />,
    );
    expect(roto).toContain("2026-09-31");
    expect(roto).toContain("no existe");
  });

  it("un año tecleado mal no fabrica medio siglo de celdas: se recorta declarando", () => {
    const lejano = renderToStaticMarkup(
      <AulasCalendarioDeAgenda
        dias={dias(fila("2026-09-08"), fila("2062-01-01"))}
        hoy="2026-09-08"
      />,
    );
    expect(lejano).toContain("2062-01-01");
    expect(lejano).toContain("fuera del calendario");
  });
});

describe("la Agenda por día monta el calendario en el sitio de la franja", () => {
  const html = renderToStaticMarkup(
    <AulasAgendaPorDia
      filas={[fila("2026-09-08", "lista"), fila("2026-09-10"), fila("")]}
      totalDelPlan={3}
    />,
  );

  it("la cuadrícula reemplaza a la lista de chips", () => {
    expect(html).toContain("aulas-calendario");
    expect(html).not.toContain("aulas-agenda-lista");
  });

  it("el resumen plegable sigue diciendo lo que resume", () => {
    const plano = html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ");
    expect(plano).toMatch(/\d+ días de campo/);
    expect(plano).toContain("1 sin fecha");
  });

  it("la cuadrícula declara su capacidad para el gate (C1)", () => {
    expect(html).toContain('data-qa-geometry-capacity="owned"');
  });
});
