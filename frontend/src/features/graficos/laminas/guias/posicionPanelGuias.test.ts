// Dónde abre el panel de guías (QA A3, defecto 2): por enlace (`panel=guias`) con la Estructura abierta abría sin ancla en
// top: 56, encima del encabezado. Mide el anclaje al botón, el respaldo dentro del visor y el confinamiento a la ventana.
import { describe, expect, it } from "vitest";
import { ALTO_BARRA_VISOR, ANCHO_PANEL_GUIAS, MARGEN_PANEL_GUIAS, posicionPanelGuias, type CajaPantalla } from "./posicionPanelGuias";

const caja = (left: number, top: number, width: number, height: number): CajaPantalla => ({
  left, top, width, height, right: left + width, bottom: top + height,
});

const VENTANA_1024 = { ancho: 1024, alto: 600 };
/** Visor a 1024 con la Estructura abierta: 701 px desde x = 323, barra desde y = 193. */
const VISOR = caja(323, 193, 701, 407);

describe("posición del panel de guías", () => {
  it("con el botón visible, abre debajo de él y alineado a su borde derecho", () => {
    const p = posicionPanelGuias(caja(766, 201, 60, 28), VISOR, VENTANA_1024);
    expect(p).toMatchObject({ anclado: "boton", top: 237, left: 826 - ANCHO_PANEL_GUIAS, width: ANCHO_PANEL_GUIAS });
  });

  // Mutante que mata: volver a la coordenada fija de la ventana (top: 56) cuando el botón no tiene caja.
  it("sin botón visible (0 × 0), abre bajo la barra del visor y contra su borde derecho, nunca encima del encabezado", () => {
    const p = posicionPanelGuias(caja(0, 0, 0, 0), VISOR, VENTANA_1024);
    expect(p.anclado).toBe("visor");
    expect(p.top).toBe(VISOR.top + ALTO_BARRA_VISOR + 8);
    expect(p.top).toBeGreaterThan(VISOR.top + ALTO_BARRA_VISOR);
    expect(p.left + p.width).toBeLessThanOrEqual(VISOR.right);
    expect(p.left).toBeGreaterThanOrEqual(VISOR.left);
  });

  it("queda dentro de la ventana: ni a la izquierda del margen ni más allá del borde derecho, y con alto propio", () => {
    const p = posicionPanelGuias(caja(30, 100, 40, 28), null, VENTANA_1024);
    expect(p.left).toBe(MARGEN_PANEL_GUIAS);
    const q = posicionPanelGuias(caja(1010, 100, 40, 28), null, VENTANA_1024);
    expect(q.left + q.width).toBeLessThanOrEqual(VENTANA_1024.ancho - MARGEN_PANEL_GUIAS);
    expect(q.maxHeight).toBe(VENTANA_1024.alto - q.top - MARGEN_PANEL_GUIAS);
  });

  it("con poco alto debajo sube lo justo para conservar el mínimo dentro de la ventana", () => {
    const p = posicionPanelGuias(caja(700, 520, 60, 28), null, VENTANA_1024);
    expect(p.top + p.maxHeight).toBeLessThanOrEqual(VENTANA_1024.alto - MARGEN_PANEL_GUIAS);
    expect(p.maxHeight).toBeGreaterThanOrEqual(160);
  });

  it("sin botón ni visor, abre arriba a la derecha dentro de la ventana", () => {
    expect(posicionPanelGuias(null, null, VENTANA_1024)).toMatchObject({ anclado: "ventana", top: MARGEN_PANEL_GUIAS });
  });
});
