// Cámara de un lienzo espacial (ADR 0047).
//
// Destilado de `features/xlsformEditor/canvas-graph/LogicCanvas.tsx`, donde
// esta gramática existía pero sin ninguna costura: `zoom` y `pan` eran
// `useState` dentro de 2610 líneas, el manejador de rueda estaba tipado a
// `SVGSVGElement` y el clamp de zoom aparecía escrito TRES veces en el mismo
// archivo.
//
// Acá vive una vez, agnóstico de SVG y de dominio, y como funciones puras — lo
// único que vitest puede probar en este repo, porque corre en Node sin DOM.
//
// `LogicCanvas` todavía no consume esto: migrarlo es una unidad de trabajo con
// su propio riesgo y sin red de tests. Pero éste es el hogar canónico: código
// de lienzo nuevo se cuelga de acá.

export type Camara = { x: number; y: number; zoom: number };
export type Punto = { x: number; y: number };
export type Caja = { x: number; y: number; w: number; h: number };

/**
 * Límites de zoom.
 *
 * Por debajo del mínimo los nodos son ilegibles y por encima del máximo se
 * pierde el contexto espacial, que es lo único que el lienzo aporta sobre una
 * lista.
 */
export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 2.5;

export const CAMARA_INICIAL: Camara = { x: 0, y: 0, zoom: 1 };

export function acotarZoom(z: number): number {
  if (!Number.isFinite(z)) return 1;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
}

export type GestoRueda =
  | { tipo: "pan"; dx: number; dy: number }
  | { tipo: "zoom"; factor: number };

/** Lo que el manejador necesita de un evento de rueda, sin depender de React. */
export type EventoRueda = {
  deltaX: number;
  deltaY: number;
  deltaMode: number;
  ctrlKey: boolean;
  metaKey?: boolean;
};

/**
 * Traduce un evento de rueda a la intención del usuario.
 *
 * Convención de macOS y de Figma, Miro y Obsidian Canvas:
 *
 *   - Pinch en trackpad llega como `wheel` con `ctrlKey` SINTÉTICO → zoom.
 *   - Dos dedos arrastrando llegan sin `ctrlKey` y con `deltaMode === 0` → pan.
 *   - La rueda física de un mouse manda `deltaMode` 1 o 2 (líneas o páginas) →
 *     zoom, que es lo que espera quien usa mouse.
 *   - Cmd/Ctrl + rueda fuerza zoom siempre, como escotilla explícita.
 *
 * El caso ambiguo es una rueda física que reporta `deltaMode === 0`: se
 * resuelve como zoom cuando no hay componente horizontal, porque una rueda no
 * produce `deltaX` y un trackpad sí.
 */
export function resolverGestoRueda(evento: EventoRueda): GestoRueda {
  if (evento.ctrlKey || evento.metaKey) {
    return { tipo: "zoom", factor: 1 + -evento.deltaY * 0.005 };
  }
  if (evento.deltaMode === 0 && evento.deltaX !== 0) {
    return { tipo: "pan", dx: -evento.deltaX, dy: -evento.deltaY };
  }
  if (evento.deltaMode !== 0) {
    return { tipo: "zoom", factor: 1 + -evento.deltaY * 0.0015 };
  }
  // `deltaMode === 0` sin componente horizontal: trackpad desplazando en
  // vertical puro. Pan, no zoom — quien quiera zoom tiene pinch o Cmd.
  return { tipo: "pan", dx: 0, dy: -evento.deltaY };
}

/** Aplica un pan a la cámara. */
export function panear(camara: Camara, dx: number, dy: number): Camara {
  return { ...camara, x: camara.x + dx, y: camara.y + dy };
}

/**
 * Zoom centrado en un punto de PANTALLA.
 *
 * Sin el ajuste de `x`/`y`, hacer zoom movería el contenido bajo el cursor y la
 * sensación es la de un lienzo que se escapa. La cuenta mantiene fijo el punto
 * del mundo que está bajo el cursor.
 */
export function zoomEn(camara: Camara, factor: number, foco: Punto): Camara {
  const siguiente = acotarZoom(camara.zoom * factor);
  if (siguiente === camara.zoom) return camara;
  const escala = siguiente / camara.zoom;
  return {
    zoom: siguiente,
    x: foco.x - (foco.x - camara.x) * escala,
    y: foco.y - (foco.y - camara.y) * escala,
  };
}

/** Coordenada de MUNDO de un punto de pantalla relativo al viewport. */
export function pantallaAMundo(punto: Punto, camara: Camara): Punto {
  return {
    x: (punto.x - camara.x) / camara.zoom,
    y: (punto.y - camara.y) / camara.zoom,
  };
}

/** Coordenada de PANTALLA de un punto del mundo. */
export function mundoAPantalla(punto: Punto, camara: Camara): Punto {
  return {
    x: punto.x * camara.zoom + camara.x,
    y: punto.y * camara.zoom + camara.y,
  };
}

/** Caja que contiene a todas las dadas. `null` si no hay ninguna. */
export function cajaContenedora(cajas: readonly Caja[]): Caja | null {
  if (cajas.length === 0) return null;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const c of cajas) {
    x0 = Math.min(x0, c.x);
    y0 = Math.min(y0, c.y);
    x1 = Math.max(x1, c.x + c.w);
    y1 = Math.max(y1, c.y + c.h);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/**
 * Cámara que encuadra una caja dentro del viewport.
 *
 * Es la salida del usuario perdido: en un lienzo infinito siempre se puede
 * terminar mirando vacío, y sin una forma de volver al contenido la única
 * salida sería recargar.
 */
export function ajustarAContenido(
  contenido: Caja | null,
  viewport: { w: number; h: number },
  margen = 48,
): Camara {
  if (!contenido || contenido.w <= 0 || contenido.h <= 0 || viewport.w <= 0 || viewport.h <= 0) {
    return CAMARA_INICIAL;
  }
  const zoom = acotarZoom(
    Math.min(
      (viewport.w - margen * 2) / contenido.w,
      (viewport.h - margen * 2) / contenido.h,
      // No se amplía más allá del 100%: encuadrar un solo nodo chico no debería
      // dejarlo gigante.
      1,
    ),
  );
  const centro = { x: contenido.x + contenido.w / 2, y: contenido.y + contenido.h / 2 };
  return {
    zoom,
    x: viewport.w / 2 - centro.x * zoom,
    y: viewport.h / 2 - centro.y * zoom,
  };
}

/**
 * Cámara mínima para que una caja quede visible, moviendo lo menos posible.
 *
 * Se usa al navegar por teclado: saltar al nodo siguiente no debe recentrar
 * todo el lienzo si ese nodo ya estaba a la vista.
 */
export function asegurarVisible(
  camara: Camara,
  caja: Caja,
  viewport: { w: number; h: number },
  margen = 32,
): Camara {
  const p0 = mundoAPantalla({ x: caja.x, y: caja.y }, camara);
  const p1 = mundoAPantalla({ x: caja.x + caja.w, y: caja.y + caja.h }, camara);

  let dx = 0;
  let dy = 0;
  if (p0.x < margen) dx = margen - p0.x;
  else if (p1.x > viewport.w - margen) dx = viewport.w - margen - p1.x;
  if (p0.y < margen) dy = margen - p0.y;
  else if (p1.y > viewport.h - margen) dy = viewport.h - margen - p1.y;

  if (dx === 0 && dy === 0) return camara;
  return panear(camara, dx, dy);
}

/** `transform` CSS de la capa de mundo. Se escribe en el DOM, no en estado. */
export function transformDeCamara(camara: Camara): string {
  return `translate(${camara.x}px, ${camara.y}px) scale(${camara.zoom})`;
}
