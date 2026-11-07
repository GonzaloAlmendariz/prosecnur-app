import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import type { MonitoreoAulasDashboard } from "../../../../../api/monitoreo";
import { franjaDePartes, PartesAulas } from "./PartesAulas";

// Ficha Ctl5: los partes leídos del libro, los que no cuadran primero.

const tablero = {
  partes_campo: [
    { operational_code: "CH 1", observed_students: 30, refusals: 2, already_answered: 3, effective_surveys: 25, cuadra: true },
    { operational_code: "CH 2", observed_students: 30, refusals: 0, already_answered: 0, effective_surveys: 20, cuadra: false, diferencia: -10 },
    { operational_code: "CH 3", observed_students: 30, effective_surveys: null },
  ],
  agenda: [],
} as unknown as MonitoreoAulasDashboard;

describe("PartesAulas", () => {
  it("la franja suma leídos = cuadran + no cuadran + sin datos", () => {
    const { celdas, cuadre } = franjaDePartes(tablero);
    const v = Object.fromEntries(celdas.map((c) => [c.clave, c.valor]));
    expect(v.leidos).toBe("3");
    expect(Number(v.cuadran) + cuadre.descuadrados + cuadre.sinComprobar).toBe(3);
  });

  it("publica su marca y dice que solo lee", () => {
    const html = renderToStaticMarkup(<PartesAulas dashboard={tablero} cargando={false} vacioSinTablero={null} />);
    expect(html).toContain('data-audit-ready="monitoreo-aulas-control-partes"');
    expect(html).toContain("Monitoreo solo lee");
    expect(html).toContain("Del aula a las efectivas");
  });
});
