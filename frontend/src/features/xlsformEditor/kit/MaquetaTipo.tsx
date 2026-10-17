import { Sello } from "./Sello";
import "./sello.css";

// Fachada de los sitios que explican un tipo a tamaño grande (menú de alta, Resumen, ficha). Desde «Señales»
// (2026-10-17) la maqueta deja de ser el código de identidad: es el mismo sello, grande y centrado en el lienzo de
// siempre (ancho × 2/3 del ancho), para no mover la geometría de quien la usa.

export function MaquetaTipo({ baseType, ancho = 48 }: { baseType: string; ancho?: number }) {
  const alto = Math.round((ancho * 32) / 48);
  const lado = Math.round(alto * 0.86);
  return (
    <svg className="xfk-maqueta" width={ancho} height={alto} viewBox={`0 0 ${ancho} ${alto}`} aria-hidden="true" focusable="false">
      <Sello baseType={baseType} size={lado} x={(ancho - lado) / 2} y={(alto - lado) / 2} />
    </svg>
  );
}
