/**
 * Explicación plegable que va DESPUÉS del resultado (patrón «veredicto
 * primero», AD7-E15).
 *
 * «¿Alcanza?» y «¿Este sorteo o otro?» abrían con dos tarjetas de prosa en
 * ~60 % del ancho y el resultado quedaba bajo el pliegue. La explicación sigue
 * a un clic, pero ya no se interpone entre quien entra y lo que vino a ver; y
 * al abrirse reparte sus bloques en columnas en vez de dejar el ancho vacío.
 */
import type { ReactNode } from "react";
import { BookOpenText, ChevronDown } from "../../../../vendor/lucide-react";
import "./explicacionPlegable.css";

export function ExplicacionPlegable({
  titulo,
  resumen,
  children,
  defaultOpen = false,
}: {
  titulo: string;
  resumen?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details className="cmv2-uni-explica" open={defaultOpen || undefined} data-qa-geometry-member>
      <summary>
        <BookOpenText size={14} aria-hidden="true" />
        <span className="cmv2-uni-explica-titulo">{titulo}</span>
        {resumen && <span className="cmv2-uni-explica-resumen">{resumen}</span>}
        <ChevronDown size={14} className="cmv2-uni-explica-chevron" aria-hidden="true" />
      </summary>
      <div className="cmv2-uni-explica-cuerpo">{children}</div>
    </details>
  );
}

export function ExplicacionBloque({
  titulo,
  subtitulo,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  children: ReactNode;
}) {
  return (
    <section className="cmv2-uni-explica-bloque">
      <header>
        <strong>{titulo}</strong>
        {subtitulo && <small>{subtitulo}</small>}
      </header>
      {children}
    </section>
  );
}
