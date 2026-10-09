import { describe, expect, it } from "vitest";

import { renderToStaticMarkup } from "react-dom/server";

import { AulasAgendaPorFacultad } from "./AulasAgendaPorFacultad";
import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";

const fila = (f: Partial<MonitoreoAulasPlanRow>) => f as MonitoreoAulasPlanRow;

/**
 * **El código de cada entrada lleva a su ficha.**
 *
 * «A dónde ir cada día» ya trata el curso-horario como una unidad —día, hora,
 * chip de lugar, docente, estado y la nota de gestión, uno por entrada— y el
 * código era el único dato muerto de la fila: para ver todo lo que sabemos de
 * ese curso-horario había que cambiar de sección y teclearlo a mano.
 *
 * Va como `href` de verdad y no como botón, para que se copie y se abra en
 * pestaña nueva; el `onClick` del padre navega por el router porque la SPA no
 * puede recargar (el warm start del proyecto tarda minutos).
 */

const FILAS = [
  fila({
    operational_code: "CH 7", faculty: "CIENCIAS E INGENIERIA", sample_role: "titular",
    sample_status: "agendada", scheduled_date: "2026-09-07", scheduled_time: "11:30",
    // `donde` sale de `scheduled_venue` —el lugar de aplicacion
    // confirmado— y cae a `label` si no lo hay (agendaPorFacultad.ts:109);
    // `venue` a secas NO lo alimenta.
    scheduled_venue: "A703", teacher: "HERMOZA PAZ, LUIS RICARDO",
  }),
];

describe("la ruta por facultad lleva a la ficha del curso-horario", () => {
  it("el codigo es un enlace a su ficha, con el foco ya puesto", () => {
    const html = renderToStaticMarkup(
      <AulasAgendaPorFacultad
        filas={FILAS}
        hrefDeFicha={(codigo) =>
          `/monitoreo?seccion=consultas&pestana=ficha&foco=${encodeURIComponent(`aula:${codigo}`)}`}
      />,
    );
    expect(html).toContain("seccion=consultas");
    expect(html).toContain("pestana=ficha");
    // El foco viaja con su prefijo y codificado: `aula:CH 7`.
    expect(html).toContain("foco=aula%3ACH%207");
  });

  it("sin la prop se pinta como siempre: texto plano y ningun enlace", () => {
    // Es lo que mantiene el componente renderizable SIN Router: varios
    // contratos lo pintan con `renderToStaticMarkup`, y un enlace que exigiera
    // contexto de router los tumbaria a todos.
    const html = renderToStaticMarkup(<AulasAgendaPorFacultad filas={FILAS} />);
    expect(html).toContain("CH 7");
    expect(html).not.toContain("<a ");
  });

  it("el enlace no se traga la identidad de la entrada: sigue estando el resto", () => {
    const html = renderToStaticMarkup(
      <AulasAgendaPorFacultad filas={FILAS} hrefDeFicha={(c) => `/x?foco=${c}`} />,
    );
    expect(html).toContain("A703");
    expect(html).toContain("HERMOZA PAZ, LUIS RICARDO");
  });
});
