import type { ReactNode } from "react";

/**
 * El código de un curso-horario, en una celda de tabla, llevando a su ficha.
 *
 * **Es el mismo arreglo que ya recibió la ruta por facultad, donde el código
 * era el único dato muerto de una fila que ya trataba el curso-horario como
 * unidad.** En la tabla de la agenda pesa más: son 70 columnas de las que caben
 * 14, con 365 px escondidos a la derecha —medido el 2026-09-12 en
 * `modelo>agenda`—, así que la fila NO puede contar todo lo que sabemos de ese
 * curso-horario y el sitio donde sí cabe es la ficha. El código es lo que lleva
 * hasta ella.
 *
 * Va como `href` de verdad y no como botón: se copia, se abre en pestaña nueva
 * y se lee con el teclado. El click con modificador no se intercepta —o se le
 * quita al usuario lo único que un enlace le da de más—. Y el `onClick` navega
 * por el router porque la SPA no puede recargar: el warm start del proyecto
 * tarda minutos.
 */

/** Las columnas cuyo valor ES un código de curso-horario. */
export const COLUMNAS_DE_CODIGO = new Set([
  "operational_code",
  // El titular al que una reserva reemplaza: desde una fila de cadena, el
  // salto natural es a la ficha del titular, no a la de la reserva.
  "titular_operational_code",
]);

export function CodigoEnCelda({ valor, hrefDeFicha, onVerFicha }: {
  valor: string;
  /** La dirección de la ficha de ese código. Sin ella se pinta texto plano. */
  hrefDeFicha?: (codigo: string) => string;
  /** Navegación por el router; sin ella el `href` hace su trabajo solo. */
  onVerFicha?: (codigo: string) => void;
}): ReactNode {
  const codigo = valor.trim();
  // Una celda vacía no inventa un enlace a ninguna parte: hay filas sin titular
  // —los titulares mismos— y la columna existe igual.
  if (!codigo || !hrefDeFicha) return valor;
  return (
    <a
      className="aulas-codigo-enlace"
      href={hrefDeFicha(codigo)}
      title={`Ver la ficha de ${codigo}`}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        if (!onVerFicha) return;
        e.preventDefault();
        onVerFicha(codigo);
      }}
    >
      {valor}
    </a>
  );
}
