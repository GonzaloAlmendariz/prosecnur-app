/**
 * El rendimiento simulado se muestra: media y percentil 5.
 *
 * El motor simula el sorteo para decidir cuántas aulas hacen falta, y de esa
 * simulación publica dos cifras por facultad: cuántos alumnos rinde un aula en
 * promedio y cuántos en el 5% peor de los sorteos. Las dos viajaban en el
 * contrato —`rendimiento_medio` y `rendimiento_p05`— y ninguna pantalla las
 * pintaba: el frontend sólo las tocaba en tests.
 *
 * El P05 es el que decide si la cuota aguanta un mal día. Una facultad puede
 * alcanzar su cuota en promedio y quedarse corta en el peor escenario, y esa
 * diferencia no se ve en ninguna otra columna del panel.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CertezaCoberturaPanel } from "../CertezaCoberturaPanel";
import type { CertezaVista } from "../certezaCoberturaModel";

function vista(medio: number | null, p05: number | null): CertezaVista {
  const fila = {
    key: "F1", label: "DERECHO", cuota: 100, disponibles: 40,
    aulas_formula: 5, probabilidad_formula: 0.9, aulas_certeza: 7,
    brecha: 2, estado: "corta", cotaSuperior: false,
    rendimiento_medio: medio, rendimiento_p05: p05,
  };
  return {
    certeza: { nivel: 0.95 } as CertezaVista["certeza"],
    filas: [fila], criticos: [], nivelPct: 0.95,
    aulasFormula: 5, aulasCerteza: 7, brecha: 2,
    hayCotaSuperior: false, vigente: true,
  } as unknown as CertezaVista;
}

function pintar(medio: number | null, p05: number | null): string {
  return renderToStaticMarkup(
    <CertezaCoberturaPanel
      filasResultado={[]}
      vista={vista(medio, p05)}
      busy={false}
      onMedir={() => {}}
    />,
  );
}

describe("la columna de rendimiento", () => {
  it("existe y publica las dos cifras", () => {
    const html = pintar(24.6, 18.2);
    expect(html).toContain("Alumnos por aula");
    expect(html).toContain("24.6");
    expect(html).toContain("18.2");
    expect(html).toContain("P05");
  });

  it("la media y el P05 no se confunden entre sí", () => {
    // Sin este contraste, una celda que pintara dos veces la misma cifra —o que
    // leyera el campo equivocado— pasaría el caso de arriba.
    const html = pintar(30, 12);
    const iMedia = html.indexOf("30.0");
    const iP05 = html.indexOf("12.0");
    expect(iMedia).toBeGreaterThan(-1);
    expect(iP05).toBeGreaterThan(-1);
    // La media va primero: es la que se lee de corrido.
    expect(iMedia).toBeLessThan(iP05);
  });

  it("sin cifras no inventa un cero", () => {
    // Un estrato sin simulación utilizable llega con las dos en null. Pintar 0
    // diría que un aula no rinde a nadie, que es una afirmación distinta de
    // «no se midió».
    const html = pintar(null, null);
    expect(html).toContain("Alumnos por aula");
    expect(html).not.toContain(">0.0<");
  });
});
