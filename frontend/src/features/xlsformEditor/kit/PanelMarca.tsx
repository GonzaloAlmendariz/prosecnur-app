import { useEffect, useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import "./riel.css";

// Panel anclado a una casilla del riel (identidad «Señales», 2026-10-17). Se abre con opacidad, escala .97 → 1 y
// 6 px de desplazamiento en 170–200 ms (sin movimiento si el sistema lo pide). Cierra con Esc, clic afuera o ×, y
// devuelve el foco a la casilla. Va en un portal DENTRO del marco del editor (los tokens del perfil siguen llegando)
// para que la lista con scroll no lo recorte; si el marco no existe, al cuerpo del documento.

export type PanelMarcaProps = {
  ancla: HTMLElement;
  tono: string;
  etiquetaId: string;
  /** false mientras sale: el panel se desvanece antes de desmontarse. */
  visible: boolean;
  onCerrar: (devolverFoco: boolean) => void;
  children: ReactNode;
};

const MARGEN = 16;
const SEPARACION = 10;

export type PosicionPanel = {
  lado: "abajo" | "arriba";
  left: number;
  /** Borde superior en la ventana (abriendo hacia abajo). */
  top: number;
  /** Borde inferior en la ventana (abriendo hacia arriba). */
  fondo: number;
  /** Alto máximo cuando el panel no cabe entero en ningún lado: se desplaza por dentro. */
  maxAlto: number | null;
};

/**
 * Dónde abre el panel (S9, 2026-10-17). Abajo si cabe; si no, arriba si cabe; si no cabe en ningún lado, del lado con
 * más espacio y con el alto limitado a ese espacio (scroll propio). Siempre a 10 px de la casilla y a 16 px de los
 * bordes de la ventana, con la flecha apuntando al centro de la casilla.
 */
export function posicionPanel({
  ancla,
  alto,
  ancho,
  vw,
  vh,
}: {
  ancla: { top: number; bottom: number; centro: number };
  alto: number;
  ancho: number;
  vw: number;
  vh: number;
}): PosicionPanel {
  const left = Math.max(MARGEN, Math.min(ancla.centro - ancho / 2, vw - ancho - MARGEN));
  const top = ancla.bottom + SEPARACION;
  const fondo = ancla.top - SEPARACION;
  const espacioAbajo = vh - MARGEN - top;
  const espacioArriba = fondo - MARGEN;
  if (alto <= espacioAbajo) return { lado: "abajo", left, top, fondo, maxAlto: null };
  if (alto <= espacioArriba) return { lado: "arriba", left, top, fondo, maxAlto: null };
  const lado = espacioAbajo >= espacioArriba ? "abajo" : "arriba";
  return { lado, left, top, fondo, maxAlto: Math.max(0, Math.floor(lado === "abajo" ? espacioAbajo : espacioArriba)) };
}

/**
 * Dónde caen, en la ventana, los bordes izquierdo, superior e inferior del bloque contenedor de `position: fixed`
 * para los hermanos de `el` (la ventana, salvo que un ancestro con transform o filter cree uno propio).
 */
function origenFijo(el: HTMLElement): { x: number; y: number; abajo: number } {
  const padre = el.parentElement;
  if (!padre) return { x: 0, y: 0, abajo: window.innerHeight };
  const sondeo = document.createElement("div");
  sondeo.setAttribute("aria-hidden", "true");
  sondeo.style.cssText = "position:fixed;left:0;top:0;bottom:0;width:0;margin:0;padding:0;border:0;visibility:hidden;pointer-events:none";
  padre.insertBefore(sondeo, el);
  const r = sondeo.getBoundingClientRect();
  sondeo.remove();
  return { x: r.left, y: r.top, abajo: r.bottom };
}

export function PanelMarca({ ancla, tono, etiquetaId, visible, onCerrar, children }: PanelMarcaProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const cerrar = useRef(onCerrar);
  cerrar.current = onCerrar;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // La casilla puede estar escalada (hover) o en plena transición: el escalado es sobre su centro, así que el
    // centro se toma del rectángulo pintado y el alto del layout (offsetHeight no lleva transform).
    const pintado = ancla.getBoundingClientRect();
    const cx = pintado.left + pintado.width / 2;
    const cy = pintado.top + pintado.height / 2;
    const medio = (ancla.offsetHeight || pintado.height) / 2;
    const r = { top: cy - medio, bottom: cy + medio, centro: cx };
    const ancho = Math.min(360, window.innerWidth - MARGEN * 2);
    el.style.width = `${ancho}px`;
    // Sin tope previo: se mide el alto natural del panel. offsetHeight ignora el transform de entrada (escala .97).
    el.style.removeProperty("--xfk-pop-max");
    const pos = posicionPanel({ ancla: r, alto: el.offsetHeight, ancho, vw: window.innerWidth, vh: window.innerHeight });
    if (pos.maxAlto != null) el.style.setProperty("--xfk-pop-max", `${pos.maxAlto}px`);

    // Si un ancestro crea su propio bloque contenedor (transform, filter), `fixed` no mide desde la ventana. El
    // origen se mide con un sondeo de ancho cero hermano del panel: el transform de entrada del propio panel no
    // lo desplaza, así que la corrección es exacta.
    const origen = origenFijo(el);
    el.style.left = `${pos.left - origen.x}px`;
    // Abriendo hacia arriba se ancla por el borde inferior: el hueco no depende de redondear el alto del panel.
    if (pos.lado === "abajo") {
      el.style.top = `${pos.top - origen.y}px`;
      el.style.bottom = "";
    } else {
      el.style.top = "auto";
      el.style.bottom = `${origen.abajo - pos.fondo}px`;
    }
    el.dataset.lado = pos.lado;
    el.style.setProperty("--xfk-flecha", `${r.centro - pos.left}px`);
  }, [ancla]);

  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>(".xfk-pop__x")?.focus({ preventScroll: true });
    const dentro = (t: EventTarget | null) => t instanceof Node && (ref.current?.contains(t) || ancla.contains(t));
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      cerrar.current(true);
    };
    const onPointer = (e: PointerEvent) => {
      if (!dentro(e.target)) cerrar.current(false);
    };
    const onScroll = (e: Event) => {
      if (!(e.target instanceof Node && ref.current?.contains(e.target))) cerrar.current(false);
    };
    const onResize = () => cerrar.current(false);
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [ancla]);

  const destino = (ancla.closest(".pulso-xlsform-frame") as HTMLElement | null) ?? document.body;
  return createPortal(
    <div
      ref={ref}
      className={visible ? "xfk-pop is-vis" : "xfk-pop"}
      role="dialog"
      aria-labelledby={etiquetaId}
      style={{ "--xfk-c": tono } as CSSProperties}
      onClick={(e) => e.stopPropagation()}
      onBlur={(e) => {
        if (e.relatedTarget instanceof Node && !ref.current?.contains(e.relatedTarget) && !ancla.contains(e.relatedTarget)) cerrar.current(false);
      }}
    >
      <div className="xfk-pop__scroll">{children}</div>
    </div>,
    destino,
  );
}
