/**
 * Cámara del lienzo de Hojas de ruta (ADR 0114 §1). El mundo está en metros con
 * origen común para Lima y Callao (`/api/hojas-ruta/geometria`); la cámara dice
 * qué punto del mundo va al centro del lienzo y cuántos píxeles mide un metro.
 * Todo es puro: el componente sólo aplica el resultado al Canvas.
 */

export type Camara = { x: number; y: number; s: number };
export type Caja = readonly [number, number, number, number];
export type Tamano = { w: number; h: number };

/** Límites del zoom: de toda Lima (≈ 50 km en pantalla) a una manzana. */
export const ESCALA_MIN = 0.004;
export const ESCALA_MAX = 6;
/** El encuadre automático nunca acerca más que esto (una manzana sola no llena la pantalla). */
export const ESCALA_ENCUADRE_MAX = 2.4;
/** Sensibilidad de la rueda y del pellizco del trackpad (`ctrlKey`), medidas en el prototipo. */
export const SENSIBILIDAD_RUEDA = 0.0065;
export const SENSIBILIDAD_PELLIZCO = 0.014;
export const DURACION_VUELO_MS = 620;

export const acotarEscala = (s: number) => Math.max(ESCALA_MIN, Math.min(ESCALA_MAX, s));

export function aPantalla(c: Camara, t: Tamano, x: number, y: number): [number, number] {
  return [(x - c.x) * c.s + t.w / 2, (y - c.y) * c.s + t.h / 2];
}

export function aMundo(c: Camara, t: Tamano, px: number, py: number): [number, number] {
  return [(px - t.w / 2) / c.s + c.x, (py - t.h / 2) / c.s + c.y];
}

/** Lo que se ve del mundo con esta cámara: [xmin, ymin, xmax, ymax]. */
export function cajaVisible(c: Camara, t: Tamano): Caja {
  const [x0, y0] = aMundo(c, t, 0, 0);
  const [x1, y1] = aMundo(c, t, t.w, t.h);
  return [x0, y0, x1, y1];
}

/**
 * Cámara que encuadra una caja con un margen relativo `pad` por lado.
 * `tapadoAbajo` (0–0,9) es la fracción del alto que cubre algo encima del
 * lienzo (el cajón de tablas): la caja se encuadra en lo que queda visible.
 */
export function encuadre(caja: Caja, t: Tamano, pad = 0.1, tapadoAbajo = 0): Camara {
  const f = Math.max(0, Math.min(0.9, tapadoAbajo));
  const visible = t.h * (1 - f);
  const w = Math.max(1, caja[2] - caja[0]);
  const h = Math.max(1, caja[3] - caja[1]);
  const s = acotarEscala(Math.min(t.w / (w * (1 + pad * 2)), visible / (h * (1 + pad * 2)), ESCALA_ENCUADRE_MAX));
  // El centro de la caja va al centro de la franja visible, no al del lienzo.
  return { x: (caja[0] + caja[2]) / 2, y: (caja[1] + caja[3]) / 2 + (t.h - visible) / 2 / s, s };
}

/**
 * Zoom con la rueda anclado al cursor: el punto del mundo bajo el cursor queda
 * bajo el cursor. `deltaMode` 1 (líneas) se lleva a píxeles; el salto por
 * evento se acota para que un ratón con muescas grandes no salte de escala.
 */
export function zoomRueda(c: Camara, t: Tamano, px: number, py: number, deltaY: number, deltaMode: number, pellizco: boolean): Camara {
  const [wx, wy] = aMundo(c, t, px, py);
  const dy = Math.max(-120, Math.min(120, deltaMode === 1 ? deltaY * 16 : deltaY));
  const s = acotarEscala(c.s * Math.exp(-dy * (pellizco ? SENSIBILIDAD_PELLIZCO : SENSIBILIDAD_RUEDA)));
  return { s, x: wx - (px - t.w / 2) / s, y: wy - (py - t.h / 2) / s };
}

/** Desplazamiento por arrastre: la cámara se mueve al revés que el puntero. */
export function arrastre(inicio: Camara, dx: number, dy: number): Camara {
  return { ...inicio, x: inicio.x - dx / inicio.s, y: inicio.y - dy / inicio.s };
}

/** Curva de vuelo: aceleración y frenado cúbicos. */
export const suavizar = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

/**
 * Cámara intermedia del vuelo en la fracción `k` (0–1). La escala se interpola
 * en logaritmo: así un vuelo de toda Lima a una manzana avanza parejo en vez
 * de quedarse lejos hasta el último instante.
 */
export function interpolar(desde: Camara, hasta: Camara, k: number): Camara {
  if (k <= 0) return { ...desde };
  if (k >= 1) return { ...hasta };
  const e = suavizar(k);
  return {
    x: desde.x + (hasta.x - desde.x) * e,
    y: desde.y + (hasta.y - desde.y) * e,
    s: Math.exp(Math.log(desde.s) + (Math.log(hasta.s) - Math.log(desde.s)) * e),
  };
}

/** Escala gráfica: el largo redondo (en metros) que ocupa al menos `minPx` píxeles. */
export function escalaGrafica(s: number, minPx = 70): { metros: number; px: number; rotulo: string } {
  const metros = [50, 100, 200, 500, 1000, 2000, 5000, 10000].find((m) => m * s >= minPx) ?? 10000;
  return { metros, px: metros * s, rotulo: metros >= 1000 ? `${metros / 1000} km` : `${metros} m` };
}

/**
 * Lon/lat → metros del mundo, con el mismo origen y los mismos factores que
 * `.hojas_ruta_geometria_proyectar()` en R, para que lo que llega en lon/lat
 * (contornos de distritos) encaje con la geometría compacta.
 */
export const ORIGEN_LONLAT = { lon: -76.99, lat: -12.03 } as const;
const KX = 111320 * Math.cos((ORIGEN_LONLAT.lat * Math.PI) / 180);
const KY = 110540;
export function proyectarLonLat(lon: number, lat: number): [number, number] {
  // «+ 0» convierte el −0 del origen en 0
  return [Math.round((lon - ORIGEN_LONLAT.lon) * KX) + 0, Math.round(-(lat - ORIGEN_LONLAT.lat) * KY) + 0];
}
