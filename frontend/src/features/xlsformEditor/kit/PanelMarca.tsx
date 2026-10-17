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
    // offsetHeight ignora el transform de entrada (escala .97), así que mide el alto final del panel.
    const alto = el.offsetHeight;
    let left = r.centro - ancho / 2;
    left = Math.max(MARGEN, Math.min(left, window.innerWidth - ancho - MARGEN));
    const abajo = r.bottom + alto + SEPARACION + 2 < window.innerHeight || r.top - alto - SEPARACION < MARGEN;

    // Si un ancestro crea su propio bloque contenedor (transform, filter), `fixed` no mide desde la ventana. El
    // origen se mide con un sondeo de ancho cero hermano del panel: el transform de entrada del propio panel no
    // lo desplaza, así que la corrección es exacta.
    const origen = origenFijo(el);
    el.style.left = `${left - origen.x}px`;
    // Abriendo hacia arriba se ancla por el borde inferior: el hueco no depende de redondear el alto del panel.
    if (abajo) {
      el.style.top = `${r.bottom + SEPARACION - origen.y}px`;
      el.style.bottom = "";
    } else {
      el.style.top = "auto";
      el.style.bottom = `${origen.abajo - (r.top - SEPARACION)}px`;
    }
    el.dataset.lado = abajo ? "abajo" : "arriba";
    el.style.setProperty("--xfk-flecha", `${r.centro - left}px`);
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
