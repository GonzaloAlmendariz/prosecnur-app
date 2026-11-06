import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import type { MonitoreoAulasDashboard } from "../../../../../api/monitoreo";
import { BrechasAulas, brechasConPlan } from "./BrechasAulas";

// Ficha Ctl7: los tres caminos, las brechas con su relevo y los refuerzos pedidos.

const tablero = {
  agenda: [{ operational_code: "CH 1", faculty: "DERECHO", eligible_n: 40 }],
  brechas: [{ operational_code: "CH 1", brecha: 5, respuestas_validas: 10 }],
} as unknown as MonitoreoAulasDashboard;

describe("BrechasAulas", () => {
  it("la fila de brechas manda sobre la del plan y conserva el resto", () => {
    const [b] = brechasConPlan(tablero) as unknown as Array<Record<string, unknown>>;
    expect(b).toMatchObject({ operational_code: "CH 1", faculty: "DERECHO", brecha: 5, respuestas_validas: 10 });
  });

  it("publica su marca y sus tres paneles", () => {
    const html = renderToStaticMarkup(<BrechasAulas dashboard={tablero} cargando={false} vacioSinTablero={null} />);
    expect(html).toContain('data-audit-ready="monitoreo-aulas-control-brechas"');
    for (const t of ["Los tres caminos", "Cursos-horario con brecha", "Refuerzos pedidos"]) expect(html).toContain(t);
  });
});
