import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";

/**
 * Zoom y desplazamiento de los mapas territoriales (Avance › Mapa y Control ›
 * Recorrido): rueda o pellizco acercan donde está el puntero, arrastrar mueve
 * el mapa y los botones acercan al centro. Todo ocurre en el `viewBox`: la
 * proyección no cambia, así que puntos, áreas y tooltips siguen en su lugar.
 *
 * Un arrastre de más de 4 px no cuenta como clic: soltar sobre un punto
 * después de mover el mapa no abre su ficha.
 */

export type VistaDelMapa = { x: number; y: number; ancho: number; alto: number };

export const ACERCAMIENTO_MAXIMO = 40;
const UMBRAL_DE_ARRASTRE = 4;

/** Acerca (factor > 1) o aleja alrededor de un punto, sin salir del lienzo base. */
export function zoomAlrededor(vista: VistaDelMapa, base: VistaDelMapa, factor: number, cx: number, cy: number): VistaDelMapa {
  const ancho = Math.min(base.ancho, Math.max(base.ancho / ACERCAMIENTO_MAXIMO, vista.ancho / factor));
  const alto = ancho * (base.alto / base.ancho);
  const rx = (cx - vista.x) / vista.ancho;
  const ry = (cy - vista.y) / vista.alto;
  return acotar({ x: cx - rx * ancho, y: cy - ry * alto, ancho, alto }, base);
}

/** Mantiene la vista dentro del lienzo base (no se puede «perder» el mapa). */
export function acotar(vista: VistaDelMapa, base: VistaDelMapa): VistaDelMapa {
  const x = Math.min(base.x + base.ancho - vista.ancho, Math.max(base.x, vista.x));
  const y = Math.min(base.y + base.alto - vista.alto, Math.max(base.y, vista.y));
  return { ...vista, x, y };
}

function puntoEnElSvg(svg: SVGSVGElement, clientX: number, clientY: number): { x: number; y: number } | null {
  const matriz = svg.getScreenCTM();
  if (!matriz) return null;
  const punto = svg.createSVGPoint();
  punto.x = clientX;
  punto.y = clientY;
  const enSvg = punto.matrixTransform(matriz.inverse());
  return { x: enSvg.x, y: enSvg.y };
}

export function useZoomDelMapa(base: VistaDelMapa, svgRef: RefObject<SVGSVGElement | null>, claveDeReinicio: string) {
  const [vista, setVista] = useState<VistaDelMapa>(base);
  const baseRef = useRef(base);
  baseRef.current = base;
  const arrastre = useRef<{ id: number; x: number; y: number; vista: VistaDelMapa; movido: boolean } | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  // Se lee en el clic que sigue al arrastre, para anularlo.
  const huboArrastre = useRef(false);

  // Cambiar de distrito, UMP o jornada vuelve al encuadre completo.
  const claveBase = `${claveDeReinicio}|${base.x}|${base.y}|${base.ancho}|${base.alto}`;
  useEffect(() => {
    setVista(baseRef.current);
  }, [claveBase]);

  // La rueda se escucha a mano: React registra `wheel` como pasivo y no deja
  // cancelar el desplazamiento de la página.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return undefined;
    const alGirar = (evento: WheelEvent) => {
      evento.preventDefault();
      const punto = puntoEnElSvg(svg, evento.clientX, evento.clientY);
      if (!punto) return;
      const factor = Math.exp(-evento.deltaY * (evento.ctrlKey ? 0.01 : 0.0022));
      setVista((actual) => zoomAlrededor(actual, baseRef.current, factor, punto.x, punto.y));
    };
    svg.addEventListener("wheel", alGirar, { passive: false });
    return () => svg.removeEventListener("wheel", alGirar);
  });

  const acercar = useCallback((factor = 1.6) => {
    setVista((actual) => zoomAlrededor(actual, baseRef.current, factor, actual.x + actual.ancho / 2, actual.y + actual.alto / 2));
  }, []);
  const alejar = useCallback(() => acercar(1 / 1.6), [acercar]);
  const encuadrar = useCallback(() => setVista(baseRef.current), []);

  const alPresionar = useCallback((evento: ReactPointerEvent<SVGSVGElement>) => {
    if (evento.button !== 0) return;
    huboArrastre.current = false;
    arrastre.current = { id: evento.pointerId, x: evento.clientX, y: evento.clientY, vista, movido: false };
  }, [vista]);

  const alMover = useCallback((evento: ReactPointerEvent<SVGSVGElement>) => {
    const actual = arrastre.current;
    const svg = svgRef.current;
    if (!actual || actual.id !== evento.pointerId || !svg) return;
    const dx = evento.clientX - actual.x;
    const dy = evento.clientY - actual.y;
    if (!actual.movido) {
      if (Math.hypot(dx, dy) < UMBRAL_DE_ARRASTRE) return;
      actual.movido = true;
      setArrastrando(true);
      svg.setPointerCapture(evento.pointerId);
    }
    const escala = svg.getScreenCTM()?.a ?? 1;
    setVista(acotar({ ...actual.vista, x: actual.vista.x - dx / escala, y: actual.vista.y - dy / escala }, baseRef.current));
  }, [svgRef]);

  const alSoltar = useCallback((evento: ReactPointerEvent<SVGSVGElement>) => {
    const actual = arrastre.current;
    if (!actual || actual.id !== evento.pointerId) return;
    huboArrastre.current = actual.movido;
    arrastre.current = null;
    setArrastrando(false);
    if (svgRef.current?.hasPointerCapture(evento.pointerId)) svgRef.current.releasePointerCapture(evento.pointerId);
  }, [svgRef]);

  /** En `onClickCapture` del SVG: un clic que cierra un arrastre no llega a los puntos. */
  const anularClicTrasArrastre = useCallback((evento: { stopPropagation: () => void; preventDefault: () => void }) => {
    if (!huboArrastre.current) return;
    huboArrastre.current = false;
    evento.stopPropagation();
    evento.preventDefault();
  }, []);

  const acercamiento = base.ancho / vista.ancho;
  return {
    vista,
    viewBox: `${vista.x.toFixed(1)} ${vista.y.toFixed(1)} ${vista.ancho.toFixed(1)} ${vista.alto.toFixed(1)}`,
    acercamiento,
    puedeAcercar: acercamiento < ACERCAMIENTO_MAXIMO - 0.01,
    puedeAlejar: acercamiento > 1.01,
    arrastrando,
    acercar,
    alejar,
    encuadrar,
    manejadores: {
      onPointerDown: alPresionar,
      onPointerMove: alMover,
      onPointerUp: alSoltar,
      onPointerCancel: alSoltar,
      onClickCapture: anularClicTrasArrastre,
    },
  };
}
