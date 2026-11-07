import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import type { MonitoreoAulasDashboard } from "../../../../../api/monitoreo";
import { CalidadAulas, readinessDeCalidad } from "./CalidadAulas";

// Ficha Ctl6: lo que deriva la app y lo que declara el libro, separados.

describe("CalidadAulas", () => {
  it("publica su marca y sus cuatro paneles", () => {
    const html = renderToStaticMarkup(
      <CalidadAulas dashboard={{ validation: [], agenda: [] } as unknown as MonitoreoAulasDashboard} cargando={false} vacioSinTablero={null} />,
    );
    expect(html).toContain('data-audit-ready="monitoreo-aulas-control-calidad"');
    for (const t of ["Señales del corte", "Duración que se aparta del resto", "Base de control del libro", "Respuestas abiertas"]) expect(html).toContain(t);
    // Sin libro, el vacío dice que es por desconexión.
    expect(html).toContain('data-qa-geometry-empty="desconexion"');
  });

  it("false mientras carga", () => {
    expect(readinessDeCalidad(true, null)).toBe("false");
  });
});
