import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";

vi.mock("../../../../lib/PlotlyChart", () => ({ PlotlyChart: () => null }));
const { RegistroDeCampo } = await import("./RegistroDeCampo");

/**
 * **El enlace de la ficha está a la mano en el registro.**
 *
 * Mandato textual de Gonzalo (2026-08-31): «el registro de campo debe tener a
 * la mano el enlace». El dato ya vivía en el plan —`row.link`, escrito por la
 * entrega de Recopiladores; medido 1 512/1 512 en la corrida A6— y esta
 * superficie no lo enseñaba: cero anchors en toda la vista con la ficha
 * abierta. El que registra es el que reparte el enlace cuando el QR impreso
 * no alcanza.
 */

const aula = (codigo: string, link: string): MonitoreoAulasPlanRow =>
  ({ operational_code: codigo, classroom_id: codigo, sample_role: "titular",
     faculty: "Derecho", sample_status: "agendada", operational_status: "agendada",
     link }) as unknown as MonitoreoAulasPlanRow;

// La ficha se abre como en la app: el padre extrae el código de
// `?foco=aula:CH 1` y lo pasa como `codigoEnFoco`. El render estático no corre
// efectos, así que esto pinnea además que la dirección manda desde el PRIMER
// render (initializer), no desde un useEffect.
const pintaConFoco = (filas: MonitoreoAulasPlanRow[]) => renderToStaticMarkup(
  <MemoryRouter initialEntries={["/monitoreo?modo=aulas&seccion=calidad&pestana=registro&foco=aula%3ACH+1"]}>
    <RegistroDeCampo agenda={filas} partes={[]} onGuardado={() => {}} codigoEnFoco="CH 1" />
  </MemoryRouter>,
);

describe("el enlace de la ficha está a la mano en el registro", () => {
  it("con row.link, la ficha en foco muestra un enlace abrible", () => {
    const html = pintaConFoco([aula("CH 1", "https://ee.kobotoolbox.org/x/aX6corrida")]);
    expect(html).toContain("Enlace de la ficha");
    expect(html).toContain('href="https://ee.kobotoolbox.org/x/aX6corrida"');
  });

  it("sin row.link, el hueco dice su motivo en vez de callar", () => {
    const html = pintaConFoco([aula("CH 1", "")]);
    expect(html).not.toContain("Enlace de la ficha");
    expect(html).toContain("Sin enlace de ficha");
  });
});
