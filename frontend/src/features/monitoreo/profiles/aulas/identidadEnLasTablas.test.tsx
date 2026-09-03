import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DataTable } from "./AulasMonitoreoPage";

/**
 * Sistema Pabellón en las tablas del perfil (B33): las columnas de IDENTIDAD
 * —lugar, hora, «Sesiones y aula»— se pintan como chips, y sólo ésas. La
 * intercepción vive en la celda del `DataTable` compartido, igual que la de
 * estado (`EstadoEnCelda`), así que Agenda, Consultas, Avance y la Base de
 * control la heredan sin que cada tabla se lo pida.
 */

const FILA = {
  operational_code: "CH 1",
  faculty: "DERECHO",
  label: "LUN 16:00 A206",
  venue: "A206",
  scheduled_time: "16:00",
  scheduled_date: "2026-09-01",
  sample_status: "agendada",
};

// Dos filas: con una sola, columnas como `venue` caerían por «constante
// inerte» antes de llegar a la celda.
const FILAS = [FILA, {
  ...FILA,
  operational_code: "CH 2",
  label: "MAR 10:00 V110",
  venue: "V110",
  scheduled_time: "10:00",
  scheduled_date: "2026-09-02",
  sample_status: "planificada",
}];

const pinta = (columns: string[]) =>
  renderToStaticMarkup(
    <DataTable rows={FILAS} empty="vacía" preferredColumns={columns} maxColumns={columns.length} />,
  );

describe("las tablas del perfil pintan la identidad como chips", () => {
  it("el lugar sale como chip de pabellón y la hora como chip de hora", () => {
    const html = pinta(["operational_code", "venue", "scheduled_time"]);
    expect(html).toContain("aulas-chip-lugar");
    expect(html).toContain("aulas-chip-hora");
    // El valor sigue legible dentro del chip.
    expect(html).toContain("A206");
    expect(html).toContain("16:00");
  });

  it("«Sesiones y aula» descriptivo se parte en sesión + pabellón", () => {
    const html = pinta(["operational_code", "label"]);
    expect(html).toContain("aulas-chip-sesion");
    expect(html).toContain("aulas-chip-lugar");
  });

  it("la fecha queda en texto: el chip va en la identidad, no en todas", () => {
    const html = pinta(["operational_code", "scheduled_date"]);
    expect(html).toContain("2026-09-01");
    expect(html).not.toContain("aulas-chip");
  });

  it("el estado conserva su propio chip de color, que es otro sistema", () => {
    const html = pinta(["operational_code", "sample_status"]);
    expect(html).toContain("aulas-estado-chip");
  });
});
