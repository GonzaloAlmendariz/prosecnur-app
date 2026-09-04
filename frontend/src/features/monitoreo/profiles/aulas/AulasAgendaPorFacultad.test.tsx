import { describe, expect, it } from "vitest";

import { renderToStaticMarkup } from "react-dom/server";

import { AulasAgendaPorFacultad } from "./AulasAgendaPorFacultad";
import type { MonitoreoAulasPlanRow } from "../../../../api/monitoreo";

const fila = (f: Partial<MonitoreoAulasPlanRow>) => f as MonitoreoAulasPlanRow;

/**
 * El caso A en la RUTA, de punta a punta (dictado 2026-09-03: «el otro sale y
 * yo entro en la tarjeta… el B que ambos estén y estén relacionados… el C que
 * el R entre como titular pero con una distinción particular»): el titular
 * rechazado se ve con su Rechazo, y la reserva despierta se ve como fila
 * plena CON su marca de relación.
 */
describe("AulasAgendaPorFacultad — los tres modelos de reemplazo", () => {
  it("titular con Rechazo y su relevo despierto con la marca «reemplaza a»", () => {
    const html = renderToStaticMarkup(
      <AulasAgendaPorFacultad
        filas={[
          fila({ operational_code: "CH 90", faculty: "Derecho", sample_role: "titular",
                 sample_status: "rechazo", operational_status: "planificada",
                 teacher: "Docente Que Rechazó" }),
          fila({ operational_code: "R 90.1", faculty: "Derecho", sample_role: "chain_reserve",
                 titular_operational_code: "CH 90", sample_status: "agendada",
                 scheduled_date: "2026-09-10", teacher: "Docente Relevo" } as Partial<MonitoreoAulasPlanRow>),
        ]}
      />,
    );
    // A: el titular no miente — dice Rechazo, no Planificado.
    expect(html).toContain("Rechazo");
    // B: ambos están y la relación se declara en la fila del R.
    expect(html).toContain("R 90.1");
    expect(html).toContain("reemplaza a CH 90");
  });

  it("una reserva sin titular declarado se marca «reserva» a secas (caso C)", () => {
    const html = renderToStaticMarkup(
      <AulasAgendaPorFacultad
        filas={[
          fila({ operational_code: "EXTRA 3", faculty: "Derecho", sample_role: "chain_reserve",
                 sample_status: "agendada", scheduled_date: "2026-09-11" } as Partial<MonitoreoAulasPlanRow>),
        ]}
      />,
    );
    expect(html).toContain("reserva");
    expect(html).not.toContain("reemplaza a");
  });
});
