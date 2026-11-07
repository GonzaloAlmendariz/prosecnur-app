import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import type { MonitoreoAulasDashboard } from "../../../../../api/monitoreo";
import { ContactoAulas, readinessDeContacto } from "./ContactoAulas";

// Ficha Ctl2: la cola de contacto con su medio y su ritmo; Monitoreo solo lee.

describe("ContactoAulas", () => {
  it("publica su marca y sus tres piezas, y dice que solo lee", () => {
    const html = renderToStaticMarkup(
      <ContactoAulas dashboard={{ agenda: [] } as unknown as MonitoreoAulasDashboard} cargando={false} vacioSinTablero={null} agenda={[]} />,
    );
    expect(html).toContain('data-audit-ready="monitoreo-aulas-control-contacto"');
    for (const t of ["Cola de contacto", "Con qué medio", "Ritmo de agendación", "Monitoreo solo lee"]) expect(html).toContain(t);
  });

  it("false mientras carga; su vacío sin tablero", () => {
    expect(readinessDeContacto(true, null)).toBe("false");
    expect(readinessDeContacto(false, null)).toBe("vacio:sin-tablero");
  });
});
