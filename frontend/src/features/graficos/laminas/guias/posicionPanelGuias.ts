// Dónde abre el panel de guías (QA A3, defecto 2). Lógica pura: bajo el botón «Guías», alineado a su borde derecho; si
// el botón no tiene caja visible (p. ej. el panel llega por enlace mientras la barra se recompone), bajo la barra del
// visor y contra su borde derecho. Nunca en una coordenada fija de la ventana: eso lo dejaba encima del encabezado.

export type CajaPantalla = { top: number; right: number; bottom: number; left: number; width: number; height: number };

export type Ventana = { ancho: number; alto: number };

export type PosicionPanel = { top: number; left: number; width: number; maxHeight: number; anclado: "boton" | "visor" | "ventana" };

export const ANCHO_PANEL_GUIAS = 320;
export const MARGEN_PANEL_GUIAS = 10;
const SEPARACION = 8;
/** Alto de la barra del visor (visorLamina.css): sin botón, el panel abre debajo de ella. */
export const ALTO_BARRA_VISOR = 44;
const ALTO_MINIMO = 160;

const visible = (c: CajaPantalla | null | undefined): c is CajaPantalla => !!c && c.width > 0 && c.height > 0;

export function posicionPanelGuias(boton: CajaPantalla | null, visor: CajaPantalla | null, ventana: Ventana): PosicionPanel {
  const { ancho: vw, alto: vh } = ventana;
  const ancho = Math.min(ANCHO_PANEL_GUIAS, Math.max(vw - 2 * MARGEN_PANEL_GUIAS, 0));
  let top: number;
  let derecha: number;
  let anclado: PosicionPanel["anclado"];
  if (visible(boton)) {
    top = boton.bottom + SEPARACION;
    derecha = boton.right;
    anclado = "boton";
  } else if (visible(visor)) {
    top = visor.top + ALTO_BARRA_VISOR + SEPARACION;
    derecha = visor.right - MARGEN_PANEL_GUIAS;
    anclado = "visor";
  } else {
    top = MARGEN_PANEL_GUIAS;
    derecha = vw - MARGEN_PANEL_GUIAS;
    anclado = "ventana";
  }
  const maxLeft = Math.max(vw - ancho - MARGEN_PANEL_GUIAS, MARGEN_PANEL_GUIAS);
  const left = Math.min(Math.max(derecha - ancho, MARGEN_PANEL_GUIAS), maxLeft);
  // Si queda poco alto debajo, el panel sube lo justo para conservar el mínimo dentro de la ventana.
  const topFinal = Math.max(MARGEN_PANEL_GUIAS, Math.min(top, vh - MARGEN_PANEL_GUIAS - ALTO_MINIMO));
  return {
    top: Math.round(topFinal),
    left: Math.round(left),
    width: ancho,
    maxHeight: Math.max(ALTO_MINIMO, Math.round(vh - topFinal - MARGEN_PANEL_GUIAS)),
    anclado,
  };
}
