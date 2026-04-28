import { Maximize2, Minimize2 } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import "./fullscreen.css";

// Render-prop API: el padre decide DÓNDE va el botón de "Ampliar"
// (típicamente en el header de su card, no flotante). El wrapper solo
// provee el state, el overlay y los atajos de teclado.
//
// Uso:
//   <FullscreenWrapper title="Dimensiones">
//     {(ctx) => (
//       <>
//         <Header>
//           <h2>...</h2>
//           <FullscreenButton ctx={ctx} />
//         </Header>
//         <Body />
//       </>
//     )}
//   </FullscreenWrapper>

export type FullscreenCtx = {
  maxed: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
};

export function FullscreenWrapper({
  title,
  children,
  className,
  shortcut = "f",
}: {
  title?: string;
  children: (ctx: FullscreenCtx) => ReactNode;
  className?: string;
  /** Letra del atajo (con Alt). "f" por default. Pasa "" para deshabilitar. */
  shortcut?: string;
}) {
  const [maxed, setMaxed] = useState(false);
  const previousFocus = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const ctx: FullscreenCtx = {
    maxed,
    open: () => setMaxed(true),
    close: () => setMaxed(false),
    toggle: () => setMaxed((v) => !v),
  };

  // Esc cierra. Atajo Alt+F (configurable) toggle. No interferir con
  // inputs activos.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const inField = target instanceof HTMLInputElement
        || target instanceof HTMLTextAreaElement
        || target instanceof HTMLSelectElement
        || (target?.isContentEditable ?? false);

      if (e.key === "Escape" && maxed) {
        e.preventDefault();
        setMaxed(false);
        return;
      }
      if (
        shortcut &&
        e.altKey &&
        e.key.toLowerCase() === shortcut.toLowerCase() &&
        !inField
      ) {
        e.preventDefault();
        setMaxed((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [maxed, shortcut]);

  // Bloquea el scroll del body mientras está fullscreen.
  useEffect(() => {
    if (!maxed) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [maxed]);

  // Focus management: al abrir, guarda el foco previo y mueve foco al
  // panel. Al cerrar, restaura el foco previo. Mejora la navegación por
  // teclado y los lectores de pantalla.
  useEffect(() => {
    if (maxed) {
      previousFocus.current = (document.activeElement as HTMLElement) ?? null;
      // Foco al primer botón del panel (Minimize2) tras pintar.
      const t = window.setTimeout(() => {
        const firstBtn = panelRef.current?.querySelector<HTMLElement>(
          "button, [tabindex]:not([tabindex='-1'])",
        );
        firstBtn?.focus();
      }, 0);
      return () => window.clearTimeout(t);
    } else {
      previousFocus.current?.focus?.();
    }
  }, [maxed]);

  // Focus trap simple: si Tab sale del panel, lo regresa al primero/último.
  useEffect(() => {
    if (!maxed) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [maxed]);

  const content = children(ctx);

  return (
    <div className={`dash-fs-wrap ${className ?? ""} ${maxed ? "is-maxed" : ""}`}>
      {!maxed && content}
      {maxed && (
        <div
          className="dash-fs-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={title ?? "Vista expandida"}
        >
          <div className="dash-fs-panel" ref={panelRef}>
            <div className="dash-fs-head">
              {title ? <h2 className="dash-fs-title">{title}</h2> : <span />}
              <div className="dash-fs-actions">
                <span className="dash-fs-hint" aria-hidden="true">
                  Esc para salir
                </span>
                <button
                  type="button"
                  className="dash-icon-btn"
                  onClick={() => setMaxed(false)}
                  title="Salir de pantalla completa (Esc)"
                  aria-label="Salir de pantalla completa"
                >
                  <Minimize2 size={14} />
                </button>
              </div>
            </div>
            <div className="dash-fs-body">{content}</div>
          </div>
        </div>
      )}
    </div>
  );
}

// Botón de "Ampliar" reutilizable. Se renderiza dentro del header del
// componente que envuelve el wrapper, con posición predecible.
export function FullscreenButton({
  ctx,
  label = "Ampliar",
}: {
  ctx: FullscreenCtx;
  label?: string;
}) {
  return (
    <button
      type="button"
      className="dash-fs-trigger"
      onClick={ctx.open}
      title="Ampliar (Alt+F)"
      aria-label={`${label} a pantalla completa`}
    >
      <Maximize2 size={13} />
      <span className="dash-fs-trigger-label">{label}</span>
    </button>
  );
}
