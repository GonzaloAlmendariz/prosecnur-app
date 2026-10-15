// Tarjeta de detalle de la pestaña «Impreso»: título, una línea de ayuda y los controles. Las tarjetas de una parte
// son secciones independientes (alto intrínseco); el grupo se declara en el contenedor del detalle.

import type { ReactNode } from "react";

export function TarjetaImpreso({ titulo, ayuda, id, children }: {
  titulo: string;
  ayuda?: ReactNode;
  id?: string;
  children?: ReactNode;
}) {
  return (
    <section className="pulso-xf-imp-tarjeta" aria-labelledby={id ? `${id}-titulo` : undefined} data-qa-geometry-member="">
      <header className="pulso-xf-imp-tarjeta-cabeza">
        <h3 id={id ? `${id}-titulo` : undefined} className="pulso-xf-imp-tarjeta-titulo">{titulo}</h3>
        {ayuda ? <p className="pulso-xf-imp-tarjeta-ayuda">{ayuda}</p> : null}
      </header>
      {children ? <div className="pulso-xf-imp-tarjeta-cuerpo">{children}</div> : null}
    </section>
  );
}

/** Interruptor de fila (mismo material que tenía el diálogo). */
export function InterruptorImpreso({ activo, titulo, detalle, onCambiar }: {
  activo: boolean;
  titulo: string;
  detalle: string;
  onCambiar: (siguiente: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      className={`pulso-xf-pdf-switch-row${activo ? " is-on" : ""}`}
      onClick={() => onCambiar(!activo)}
    >
      <span className="pulso-xf-pdf-switch-text">
        <strong>{titulo}</strong>
        <em>{detalle}</em>
      </span>
      <span className={`pulso-xf-pdf-switch${activo ? " is-on" : ""}`} aria-hidden="true">
        <span className="pulso-xf-pdf-switch-thumb" />
      </span>
    </button>
  );
}
