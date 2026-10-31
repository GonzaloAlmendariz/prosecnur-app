import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { MonitoreoAulasDashboard } from "../../../../../api/monitoreo";
import { AgendaAulas } from "./AgendaAulas";

const dash = {
  agenda: [
    { operational_code: "CH 154", scheduled_date: "2026-10-01", scheduled_time: "11:45 am", scheduled_venue: "MU24", sample_role: "titular" },
    { operational_code: "CH 155", scheduled_date: "2026-10-01", scheduled_time: "11:45 am", scheduled_venue: "MU25", sample_role: "titular" },
  ],
  partes_campo: [],
  course_status_rol_y_estado: { acciones: { sin_agendar: [], agendado_vencido: [] } },
} as unknown as MonitoreoAulasDashboard;

describe("AgendaAulas", () => {
  it("declara su marca y superficies, y apila dos citas a la misma hora", () => {
    const html = renderToStaticMarkup(<AgendaAulas dashboard={dash} cargando={false} vacioSinTablero={<p>x</p>} hoy="2026-10-01" />);
    expect(html).toContain('data-audit-ready="monitoreo-aulas-control-agenda"');
    expect(html).toContain('data-qa-geometry-group="aulas-agenda"');
    expect(html).toContain("Sin cita");
    expect(html).toContain("Todos los titulares tienen cita.");
    const tops = [...html.matchAll(/class="aulas-ag-cita"[^>]*style="top:(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1]));
    expect(tops).toHaveLength(2);
    expect(tops[1] - tops[0]).toBeGreaterThanOrEqual(68);
  });
});
