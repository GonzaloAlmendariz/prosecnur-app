import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";

vi.mock("../../../../lib/PlotlyChart", () => ({ PlotlyChart: () => null }));
const { RegistroDeCampo } = await import("./RegistroDeCampo");

/**
 * Sistema Pabellón en el registro (B33/P5): quien va a registrar un
 * curso-horario necesita su cita a la vista — dónde, a qué hora, qué día — y
 * eso va como la fila de chips del sistema bajo el código del formulario. La
 * lista de la izquierda no se chipifica: 196 filas en 240 px mandan sobriedad.
 */

const aula = (extra: Record<string, unknown>): MonitoreoAulasPlanRow =>
  ({
    operational_code: "CH 1", classroom_id: "CH 1", sample_role: "titular",
    faculty: "Derecho", sample_status: "agendada", operational_status: "agendada",
    venue: "A206", scheduled_time: "16:00", scheduled_date: "2026-09-03",
    ...extra,
  }) as unknown as MonitoreoAulasPlanRow;

const pintaConFoco = (filas: MonitoreoAulasPlanRow[]) => renderToStaticMarkup(
  <MemoryRouter initialEntries={["/monitoreo?modo=aulas&seccion=calidad&pestana=registro&foco=aula%3ACH+1"]}>
    <RegistroDeCampo agenda={filas} partes={[]} onGuardado={() => {}} codigoEnFoco="CH 1" />
  </MemoryRouter>,
);

describe("el registro enseña la cita del aula en foco como chips", () => {
  it("lugar como chip de pabellón, hora como chip y fecha como badge", () => {
    const html = pintaConFoco([aula({})]);
    expect(html).toContain("aulas-chips-fila");
    expect(html).toContain("aulas-chip-lugar");
    expect(html).toContain("aulas-chip-hora");
    expect(html).toContain("A206");
    expect(html).toContain("2026-09-03");
  });

  it("el lugar acordado (B30) gana al salón del catálogo", () => {
    const html = pintaConFoco([aula({ scheduled_venue: "V110" })]);
    expect(html).toContain("V110");
    // El salón del catálogo no se pinta al lado: dos lugares serían una
    // contradicción, y el acordado es el que manda.
    expect(html).not.toContain(">A206<");
  });

  it("sin cita declarada no hay fila de chips, no chips vacíos", () => {
    const html = pintaConFoco([
      aula({ venue: "", scheduled_time: "", scheduled_date: "" }),
    ]);
    expect(html).not.toContain("aulas-chips-fila");
  });
});
