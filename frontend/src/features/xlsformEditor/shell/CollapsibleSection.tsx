// =============================================================================
// shell/CollapsibleSection.tsx — sección plegable con animación de altura
// =============================================================================
// Helper para envolver paneles secundarios (índice del instrumento, futuras
// secciones de "vista técnica") como bloques colapsables que no compiten con
// el constructor por ancho ni por foco visual.
//
// Patrón: trigger arriba (chevron + título + chip de count opcional), contenido
// abajo. La animación de altura usa el truco moderno `grid-template-rows: 0fr →
// 1fr` para evitar tener que medir alturas con JS.
// =============================================================================

import type { ReactNode } from "react";
import { useState } from "react";
import { ChevronDown } from "lucide-react";

export type CollapsibleSectionProps = {
  title: string;
  hint?: string;
  /** Cantidad de items relevantes para mostrar como chip al lado del título. */
  count?: number;
  /** Estado inicial. Default: collapsed. */
  defaultOpen?: boolean;
  children: ReactNode;
  /** Icono opcional a la izquierda del título. */
  icon?: ReactNode;
};

export function CollapsibleSection({
  title,
  hint,
  count,
  defaultOpen = false,
  children,
  icon,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`pulso-collapsible${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="pulso-collapsible-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span
          className="pulso-collapsible-chevron"
          style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}
          aria-hidden="true"
        >
          <ChevronDown size={14} />
        </span>
        {icon && (
          <span className="pulso-collapsible-icon" aria-hidden="true">
            {icon}
          </span>
        )}
        <span className="pulso-collapsible-title">{title}</span>
        {typeof count === "number" && count > 0 && (
          <span className="pulso-collapsible-count">{count}</span>
        )}
        {hint && <span className="pulso-collapsible-hint">{hint}</span>}
      </button>
      <div
        className="pulso-collapsible-body"
        // grid trick: 0fr cuando cerrado, 1fr cuando abierto.
        // El contenido vive en un div interior con overflow:hidden.
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="pulso-collapsible-body-inner">
          {open && children}
        </div>
      </div>
    </section>
  );
}
