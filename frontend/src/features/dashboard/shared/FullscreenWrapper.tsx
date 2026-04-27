import { Maximize2, Minimize2, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import "./fullscreen.css";

// Envuelve un gráfico con un botón discreto para verlo a pantalla
// completa. Cuando el usuario activa fullscreen, el contenido se
// re-renderiza dentro de un overlay ocupando casi toda la viewport.
//
// Uso:
//   <FullscreenWrapper title="Heatmap">
//     {(maxed) => <HeatmapView maxed={maxed} />}
//   </FullscreenWrapper>
// El callback recibe un boolean `maxed` para que el contenido pueda
// adaptar su altura.
export function FullscreenWrapper({
  title,
  children,
  className,
}: {
  title?: string;
  children: ReactNode | ((maxed: boolean) => ReactNode);
  className?: string;
}) {
  const [maxed, setMaxed] = useState(false);

  // Cierre con Esc.
  useEffect(() => {
    if (!maxed) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMaxed(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [maxed]);

  // Bloquea el scroll del body mientras está fullscreen.
  useEffect(() => {
    if (!maxed) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [maxed]);

  const content = typeof children === "function" ? children(maxed) : children;

  return (
    <div className={`dash-fs-wrap ${className ?? ""}`}>
      <button
        type="button"
        className="dash-fs-btn"
        onClick={() => setMaxed(true)}
        title="Pantalla completa"
        aria-label="Ver a pantalla completa"
      >
        <Maximize2 size={13} />
      </button>
      {!maxed && content}
      {maxed && (
        <div
          className="dash-fs-overlay"
          role="dialog"
          aria-label={title ?? "Vista expandida"}
          onClick={(e) => e.target === e.currentTarget && setMaxed(false)}
        >
          <div className="dash-fs-panel">
            <div className="dash-fs-head">
              {title ? <h2 className="dash-fs-title">{title}</h2> : <span />}
              <div className="dash-fs-actions">
                <button
                  type="button"
                  className="dash-icon-btn"
                  onClick={() => setMaxed(false)}
                  title="Salir de pantalla completa (Esc)"
                  aria-label="Cerrar"
                >
                  <Minimize2 size={14} />
                </button>
                <button
                  type="button"
                  className="dash-icon-btn"
                  onClick={() => setMaxed(false)}
                  aria-label="Cerrar"
                >
                  <X size={14} />
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
