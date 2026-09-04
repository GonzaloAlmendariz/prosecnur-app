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
    // A: titular caído → el R lo REEMPLAZA, en esa palabra.
    expect(html).toContain("R 90.1");
    expect(html).toContain("reemplaza a CH 90");
    // El caso también se ve en el FONDO del box y en el tono de la pill.
    expect(html).toContain("es-caso-a");
    expect(html).toContain("aulas-ruta-reserva es-reemplaza");
  });

  it("con el titular VIVO el R lo complementa — ambos suman (caso B)", () => {
    // Dictado 2026-09-03: «no es que un R reemplaza un CH, sino que un R
    // COMPLEMENTA un CH… no siempre reemplazan en ese sentido de la palabra».
    const html = renderToStaticMarkup(
      <AulasAgendaPorFacultad
        filas={[
          fila({ operational_code: "CH 14", faculty: "Derecho", sample_role: "titular",
                 sample_status: "agendada", scheduled_date: "2026-09-09" }),
          fila({ operational_code: "R 14.1", faculty: "Derecho", sample_role: "chain_reserve",
                 titular_operational_code: "CH 14", sample_status: "agendada",
                 scheduled_date: "2026-09-10" } as Partial<MonitoreoAulasPlanRow>),
        ]}
      />,
    );
    expect(html).toContain("complementa a CH 14");
    expect(html).not.toContain("reemplaza a CH 14");
    expect(html).toContain("es-caso-b");
  });

  it("una reserva sin titular es un «refuerzo» — nomenclatura propia (caso C)", () => {
    // Dictado 2026-09-03: «el caso C no tiene ninguna relación con el CH…
    // debería tener su propia nomenclatura, que es diferente».
    const html = renderToStaticMarkup(
      <AulasAgendaPorFacultad
        filas={[
          fila({ operational_code: "EXTRA 3", faculty: "Derecho", sample_role: "chain_reserve",
                 sample_status: "agendada", scheduled_date: "2026-09-11" } as Partial<MonitoreoAulasPlanRow>),
        ]}
      />,
    );
    expect(html).toContain("refuerzo");
    expect(html).not.toContain("reemplaza a");
    expect(html).not.toContain("complementa a");
    expect(html).toContain("es-caso-c");
  });
});
