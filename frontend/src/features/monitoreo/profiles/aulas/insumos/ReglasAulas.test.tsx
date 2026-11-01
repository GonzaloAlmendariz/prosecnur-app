import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import type { MonitoreoAulasDashboard } from "../../../../../api/monitoreo";
import type { ContextoDeInsumos } from "./contextoDeInsumos";
import { construirReglas, readinessDeReglas } from "./reglasModelo";
import { ReglasAulas } from "./ReglasAulas";

// Ficha I2 (Insumos › Reglas): toda regla que cambia una cifra antes de contarla.

function tablero(): MonitoreoAulasDashboard {
  return {
    respuestas_desglose: {
      total: { observadas: 3610, efectivas: 3327, fuera_del_operativo: 37, no_pasan_criterio: 250, sin_aula: 39 },
      facultades: [
        { facultad: "Letras", observadas: 300, efectivas: 290, fuera_del_operativo: 2, no_pasan_criterio: 8 },
        { facultad: "Derecho", observadas: 900, efectivas: 820, fuera_del_operativo: 10, no_pasan_criterio: 70 },
      ],
    },
  } as unknown as MonitoreoAulasDashboard;
}

const contexto: ContextoDeInsumos = {
  config: null, fuentes: [], ocupado: false, importarPlan: () => {}, operaciones: null,
  comoMide: <div>EJE</div>, criterioDeEfectiva: <div>CRITERIO</div>, criterioDeAula: <div>AULA</div>,
  onDeclararUmbralDeDuracion: () => {},
};

describe("construirReglas", () => {
  it("lo que no cuenta va por grupo, con lo que más se pierde arriba y el total al pie", () => {
    const m = construirReglas(tablero());
    expect(m.noCuenta?.titulo).toBe("Lo que no cuenta, por facultad");
    expect(m.noCuenta?.filas.map((f) => f.grupo)).toEqual(["Derecho", "Letras"]);
    expect(m.noCuenta?.total).toMatchObject({ leidas: 3610, efectivas: 3327, noPasan: 250, fuera: 37 });
  });

  it("sin duraciones en el tablero lo dice en vez de inventar un umbral", () => {
    const m = construirReglas(tablero());
    expect(m.duracion.declarado).toBe(false);
    expect(m.duracion.resumen.length).toBeGreaterThan(0);
  });
});

describe("ReglasAulas", () => {
  it("ordena los paneles de la página en tres columnas y publica su marca", () => {
    const html = renderToStaticMarkup(<ReglasAulas dashboard={tablero()} cargando={false} vacioSinTablero={null} contexto={contexto} />);
    expect(html).toContain('data-audit-ready="monitoreo-aulas-insumos-reglas"');
    expect(html).toContain('data-qa-geometry-group="aulas-insumos-reglas"');
    for (const pieza of ["EJE", "CRITERIO", "AULA", "Qué cuenta como encuesta efectiva", "Duración sospechosa", "Lo que no cuenta, por facultad"]) {
      expect(html).toContain(pieza);
    }
  });

  it("false mientras carga y su vacío sin tablero", () => {
    expect(readinessDeReglas(true, null)).toBe("false");
    expect(readinessDeReglas(false, null)).toBe("vacio:sin-tablero");
  });
});
