/**
 * Popover genérico de la app: portal a document.body, posicionamiento fixed
 * con clamping al viewport, cierre por ESC/click-fuera, apertura por click o
 * hover (con los delays de hovercard del tema). Sin dependencias externas —
 * patrón de posicionamiento tomado de features/graficos/ArgField.
 */
import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import "./popover.css";

type PopoverSide = "top" | "bottom";
type PopoverAlign = "start" | "center" | "end";

const VIEWPORT_MARGIN = 10;
const GAP = 8;

export function Popover({
  trigger,
  children,
  openOn = "click",
  side = "bottom",
  align = "center",
  maxWidth = 320,
  className,
  ariaLabel,
}: {
  /** Elemento que dispara el popover. Si es un elemento válido se clona con los handlers. */
  trigger: ReactElement;
  children: ReactNode;
  openOn?: "click" | "hover";
  side?: PopoverSide;
  align?: PopoverAlign;
  maxWidth?: number;
  className?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<CSSProperties>({});
  const triggerRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const hoverTimer = useRef<number | null>(null);

  const clearHoverTimer = () => {
    if (hoverTimer.current != null) {
      window.clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
  };

  const reposition = useCallback(() => {
    const anchor = triggerRef.current;
    const panel = panelRef.current;
    if (!anchor || !panel) return;
    const a = anchor.getBoundingClientRect();
    const p = panel.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let top = side === "bottom" ? a.bottom + GAP : a.top - p.height - GAP;
    // Si no cabe en el lado pedido, voltea.
    if (side === "bottom" && top + p.height > vh - VIEWPORT_MARGIN && a.top - p.height - GAP >= VIEWPORT_MARGIN) {
      top = a.top - p.height - GAP;
    } else if (side === "top" && top < VIEWPORT_MARGIN && a.bottom + GAP + p.height <= vh - VIEWPORT_MARGIN) {
      top = a.bottom + GAP;
    }
    top = Math.min(Math.max(top, VIEWPORT_MARGIN), Math.max(vh - p.height - VIEWPORT_MARGIN, VIEWPORT_MARGIN));

    let left = align === "start" ? a.left : align === "end" ? a.right - p.width : a.left + a.width / 2 - p.width / 2;
    left = Math.min(Math.max(left, VIEWPORT_MARGIN), Math.max(vw - p.width - VIEWPORT_MARGIN, VIEWPORT_MARGIN));

    // Origin-aware: el popover escala desde el lado donde vive su trigger.
    const abreAbajo = top >= a.bottom;
    const originY = abreAbajo ? "top" : "bottom";
    const originX = align === "start" ? "left" : align === "end" ? "right" : "center";

    setStyle({
      position: "fixed",
      top: Math.round(top),
      left: Math.round(left),
      maxWidth,
      transformOrigin: `${originY} ${originX}`,
    });
  }, [align, maxWidth, side]);

  useLayoutEffect(() => {
    if (!open) return;
    reposition();
  }, [open, reposition, children]);

  useEffect(() => {
    if (!open) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setOpen(false);
    };
    const onPointerDown = (ev: PointerEvent) => {
      const target = ev.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onScrollOrResize = () => reposition();
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [open, reposition]);

  useEffect(() => clearHoverTimer, []);

  if (!isValidElement(trigger)) return trigger;

  const triggerProps: Record<string, unknown> = {
    ref: (node: HTMLElement | null) => {
      triggerRef.current = node;
      const original = (trigger as { ref?: unknown }).ref;
      if (typeof original === "function") original(node);
    },
    "aria-expanded": open,
    "aria-haspopup": "dialog",
  };
  if (openOn === "click") {
    triggerProps.onClick = (ev: MouseEvent) => {
      (trigger.props as { onClick?: (ev: MouseEvent) => void }).onClick?.(ev);
      setOpen((prev) => !prev);
    };
  } else {
    triggerProps.onMouseEnter = () => {
      clearHoverTimer();
      hoverTimer.current = window.setTimeout(() => setOpen(true), 120);
    };
    triggerProps.onMouseLeave = () => {
      clearHoverTimer();
      hoverTimer.current = window.setTimeout(() => setOpen(false), 160);
    };
    triggerProps.onFocus = () => setOpen(true);
    triggerProps.onBlur = () => setOpen(false);
  }

  // El portal aterriza dentro del frame del módulo cuando existe, para que
  // los tokens scoped (ej. --cmv2-*) resuelvan dentro del popover; cae a body
  // si no hay frame. position: fixed sigue anclado al viewport en ambos casos.
  const portalTarget =
    (triggerRef.current?.closest(".pulso-page-frame") as HTMLElement | null) ?? document.body;

  return (
    <>
      {cloneElement(trigger, triggerProps)}
      {open &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label={ariaLabel}
            className={`pulso-popover${className ? ` ${className}` : ""}`}
            style={style}
            onMouseEnter={openOn === "hover" ? clearHoverTimer : undefined}
            onMouseLeave={
              openOn === "hover"
                ? () => {
                    clearHoverTimer();
                    hoverTimer.current = window.setTimeout(() => setOpen(false), 160);
                  }
                : undefined
            }
          >
            {children}
          </div>,
          portalTarget,
        )}
    </>
  );
}
