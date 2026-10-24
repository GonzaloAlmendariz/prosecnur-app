import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import "./superficieFlotante.css";

/**
 * Sideover o diálogo de Monitoreo sobre un velo, en un portal. Escape y el
 * velo cierran; el foco entra al botón de cerrar y vuelve a quien lo abrió.
 * Solo usa tokens globales `--pulso-*`: en el portal no llegan las variables
 * de un perfil.
 */
export function SuperficieFlotante({
  tipo,
  antetitulo,
  titulo,
  onCerrar,
  children,
  pie,
  ancho,
  panelId,
}: {
  tipo: "sideover" | "dialogo";
  antetitulo?: string;
  titulo: string;
  onCerrar: () => void;
  children: ReactNode;
  pie?: ReactNode;
  /** Ancho máximo en px; por defecto 720 el sideover y 520 el diálogo. */
  ancho?: number;
  /** El `id` del panel direccionable, para el QA. */
  panelId?: string;
}) {
  const id = useId();
  const cerrarRef = useRef<HTMLButtonElement | null>(null);
  const onCerrarRef = useRef(onCerrar);
  onCerrarRef.current = onCerrar;
  useEffect(() => {
    const previo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cerrarRef.current?.focus();
    const alPulsar = (evento: KeyboardEvent) => { if (evento.key === "Escape") onCerrarRef.current(); };
    window.addEventListener("keydown", alPulsar);
    return () => {
      window.removeEventListener("keydown", alPulsar);
      previo?.focus();
    };
  }, []);
  const contenido = (
    <div
      className={`mon-flotante-velo is-${tipo}`}
      data-pulso-panel={panelId}
      onMouseDown={(evento) => { if (evento.target === evento.currentTarget) onCerrar(); }}
    >
      <section
        className={`mon-flotante is-${tipo}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-titulo`}
        style={{ inlineSize: `min(${ancho ?? (tipo === "sideover" ? 720 : 520)}px, 100%)` }}
      >
        <header className="mon-flotante-cabeza">
          <div>
            {antetitulo ? <span className="mon-flotante-antetitulo">{antetitulo}</span> : null}
            <h2 id={`${id}-titulo`}>{titulo}</h2>
          </div>
          <button ref={cerrarRef} type="button" className="mon-flotante-cerrar" onClick={onCerrar} aria-label="Cerrar">
            <X size={16} aria-hidden="true" />
          </button>
        </header>
        <div className="mon-flotante-cuerpo" data-qa-scroll-owner={panelId ? `${panelId}-panel` : "flotante"}>{children}</div>
        {pie ? <footer className="mon-flotante-pie">{pie}</footer> : null}
      </section>
    </div>
  );
  // Sin documento (render estático de los tests) se pinta en su sitio.
  return typeof document === "undefined" ? contenido : createPortal(contenido, document.body);
}
