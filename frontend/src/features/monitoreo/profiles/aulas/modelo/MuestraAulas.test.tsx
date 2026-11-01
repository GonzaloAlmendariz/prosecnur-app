import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import type { MonitoreoAulasDashboard } from "../../../../../api/monitoreo";
import { franjaDeMuestra, MuestraAulas } from "./MuestraAulas";

// Ficha M2: la muestra que dejó el sorteo, con las piezas de Consultas ordenadas.

const tablero = {
  course_status_rol_y_estado: {
    titulares: { total: 174, aplicado: 152 },
    reemplazos: { total: 1173, utilizado: 29 },
    banco: { total: 45, utilizado: 7, disponible: 38 },
  },
  agenda: [],
} as unknown as MonitoreoAulasDashboard;

describe("MuestraAulas", () => {
  it("la franja dice titulares, reservas en cadena y banco con lo usado", () => {
    expect(franjaDeMuestra(tablero).map((c) => [c.valor, c.sub])).toEqual([
      ["174", "152 aplicados"],
      ["1,173", "29 usadas"],
      ["45", "7 usados · 38 disponibles"],
    ]);
  });

  it("publica su marca y sus tres piezas; false mientras carga", () => {
    const html = renderToStaticMarkup(<MuestraAulas dashboard={tablero} cargando={false} vacioSinTablero={null} />);
    expect(html).toContain('data-audit-ready="monitoreo-aulas-modelo-muestra"');
    for (const t of ["Dónde aguanta la reserva", "Cadenas de reemplazo", "¿Alcanza el banco?"]) expect(html).toContain(t);
    expect(renderToStaticMarkup(<MuestraAulas dashboard={null} cargando vacioSinTablero={null} />)).toContain('data-audit-ready="false"');
  });
});
