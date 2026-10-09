import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";

vi.mock("../../../../lib/PlotlyChart", () => ({ PlotlyChart: () => null }));
const { RegistroDeCampo } = await import("./RegistroDeCampo");

/**
 * **La ficha ESCANEADA del parte está en el registro** (B6c, fase 2).
 *
 * El equipo pega en la hoja «Aulas Aplicadas (Campo)» del libro el enlace del
 * escaneo de la ficha que volvió del aula —columna manual «ENLACE DE FICHA
 * ESCANEADA»—, y el backend ya lo publica en cada parte como
 * `scanned_sheet_link` (7e549c22). Son DOS enlaces distintos: `row.link` es la
 * ficha para aplicar (el del QR, B6a) y éste es el escaneo del resultado; el
 * segundo vive en el PARTE, no en la fila del plan, porque `.PARTE_APP_AL_PLAN`
 * no lo copia. La ficha del registro los enseña a los dos sin confundirlos.
 */

const aula = (codigo: string): MonitoreoAulasPlanRow =>
  ({ operational_code: codigo, classroom_id: codigo, sample_role: "titular",
     faculty: "Derecho", sample_status: "agendada", operational_status: "agendada",
     link: "https://ee.kobotoolbox.org/x/aX6corrida" }) as unknown as MonitoreoAulasPlanRow;

// La ficha se abre como en la app: el padre extrae el código de `?foco=aula:CH 1`
// y pasa la hoja de partes del libro tal como llega en `dashboard.partes_campo`.
const pinta = (partes: ReadonlyArray<Record<string, unknown>>) => renderToStaticMarkup(
  <MemoryRouter initialEntries={["/monitoreo?modo=aulas&seccion=calidad&pestana=registro&foco=aula%3ACH+1"]}>
    <RegistroDeCampo agenda={[aula("CH 1")]} partes={partes} onGuardado={() => {}} codigoEnFoco="CH 1" />
  </MemoryRouter>,
);

describe("la ficha escaneada del parte está en el registro", () => {
  it("con scanned_sheet_link en el parte, hay un enlace abrible y convive con el de la ficha", () => {
    const html = pinta([{ operational_code: "CH 1", scanned_sheet_link: "https://drive.google.com/file/d/abc" }]);
    expect(html).toContain("Ficha escaneada");
    expect(html).toContain('href="https://drive.google.com/file/d/abc"');
    // Los dos enlaces son dos cosas y se ven juntos sin pisarse: la ficha para
    // aplicar (B6a) sigue ahí con su propio href.
    expect(html).toContain("Enlace de la ficha");
    expect(html).toContain('href="https://ee.kobotoolbox.org/x/aX6corrida"');
  });

  it("con parte pero sin enlace escaneado, el hueco dice ese motivo", () => {
    const html = pinta([{ operational_code: "CH 1", scanned_sheet_link: "" }]);
    expect(html).toContain("Sin ficha escaneada: el parte no trae su enlace");
    // El otro motivo no aplica y no puede colarse: son dos hechos distintos.
    expect(html).not.toContain("aún sin parte en el libro");
  });

  it("sin parte del aula, el hueco dice que el parte todavía no está", () => {
    const html = pinta([{ operational_code: "CH 9", scanned_sheet_link: "https://drive.google.com/file/d/otro" }]);
    expect(html).toContain("Sin ficha escaneada: aún sin parte en el libro");
    expect(html).not.toContain('href="https://drive.google.com/file/d/otro"');
  });
});
