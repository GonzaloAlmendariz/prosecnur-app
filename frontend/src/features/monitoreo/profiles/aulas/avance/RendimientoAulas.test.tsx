import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import type { MonitoreoAulasDashboard } from "../../../../../api/monitoreo";
import { PestanaPropiaDeAulas } from "../navegacion/PestanaPropiaDeAulas";
import { RendimientoAulas } from "./RendimientoAulas";

const hsvg = {
  ritmo_diario: {
    dias: [
      { fecha: "2026-09-09", validas: 466, acumulado: 466 },
      { fecha: "2026-09-12", validas: 134, acumulado: 600 },
    ],
    dias_con_campo: 2, media_diaria: 300, meta: 2500,
    por_hora: [{ hora: 11, validas: 600 }],
  },
  efectividad_seguimiento: {
    facultades: [{ facultad: "DERECHO", faculty_key: "derecho", tau_previsto: 0.57, tau_observado: 0.44, senal: "bajo" }],
  },
  partes_campo: [{ operational_code: "CH 1", applied_by: "Aplicador 08", effective_surveys: 30, observed_students: 40 }],
  agenda: [{ operational_code: "CH 1", eligible_n: 50, faculty: "DERECHO" }],
} as unknown as MonitoreoAulasDashboard;

function pintar(dashboard: MonitoreoAulasDashboard | null, cargando = false) {
  return renderToStaticMarkup(
    <MemoryRouter>
      <RendimientoAulas dashboard={dashboard} cargando={cargando} vacioSinTablero={<p>Sin tablero</p>} />
    </MemoryRouter>,
  );
}

describe("RendimientoAulas", () => {
  it("publica su marca, declara sus superficies (C1) y pinta las cinco piezas", () => {
    const html = pintar(hsvg);
    expect(html).toContain('data-audit-ready="monitoreo-aulas-avance-rendimiento"');
    expect(html).toContain('data-qa-geometry-group="aulas-rendimiento"');
    expect(html).toContain('data-qa-geometry-member="tiempo"');
    expect(html).toContain('data-qa-geometry-member="tasa"');
    expect(html).toContain('data-qa-geometry-member="esfuerzo"');
    expect(html).toContain('data-qa-geometry-capacity="owned"');
    for (const titulo of ["Efectivas por día", "Hora en que se responde", "Tasa del campo contra la del diseño", "Día de la semana", "Por aplicador"]) {
      expect(html).toContain(titulo);
    }
    expect(html).toContain("pico a las 11:00");
    expect(html).toContain("Aplicador 08");
    expect(html).toContain('<th scope="col">Aplicador</th>');
  });

  it("mientras carga muestra la silueta con readiness false; sin tablero, el vacío del perfil", () => {
    expect(pintar(null, true)).toContain('data-audit-ready="false"');
    const vacio = pintar(null);
    expect(vacio).toContain('data-audit-ready="vacio:sin-tablero"');
    expect(vacio).toContain("Sin tablero");
  });

  it("la pestaña propia monta A4 en la principal y deja la sub-vista a la vista heredada", () => {
    const props = { dashboard: hsvg, cargando: false, vacioSinTablero: <p>x</p> };
    const principal = renderToStaticMarkup(
      <MemoryRouter><PestanaPropiaDeAulas direccion={{ seccion: "avance", pestana: "rendimiento", panel: null }} {...props} /></MemoryRouter>,
    );
    expect(principal).toContain("monitoreo-aulas-avance-rendimiento");
    const diario = renderToStaticMarkup(
      <MemoryRouter><PestanaPropiaDeAulas direccion={{ seccion: "avance", pestana: "rendimiento", panel: "diario" }} {...props} /></MemoryRouter>,
    );
    expect(diario).toBe("");
  });
});
