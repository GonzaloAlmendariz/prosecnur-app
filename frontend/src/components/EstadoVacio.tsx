import type { ReactNode } from "react";

import "./EstadoVacio.css";

// Estado vacío compartido (P-M4 de la ronda de pulido).
//
// Antes cada superficie pintaba su vacío a su manera: banda punteada centrada
// con tile de ícono (Frecuencias, Cruces), caja alta con título en negrita
// (Agrupar categorías), banda tintada alineada a la izquierda (Variables
// excluidas) o un párrafo suelto (Comparativos). Este componente es la única
// receta: ícono, título, UNA línea y una acción opcional, en dos tamaños.
//
// - `compacto`: fila dentro de una sección o de una lista (ícono a la
//   izquierda, acción a la derecha). Es el que corresponde a un bloque que
//   comparte pantalla con otros.
// - `normal`: columna centrada para un vacío que ocupa la superficie entera.
//
// C3: el vacío vive dentro de su propia caja con borde visible; quien lo
// coloca no le reserva alto extra. No lleva `min-height`: su alto es
// intrínseco, para no fabricar capacidad que el gate tendría que indultar.
//
// La descripción es una línea: dice qué falta y cómo se llena. Si hace falta
// un párrafo, el problema no es el vacío.

export type EstadoVacioTamano = "compacto" | "normal";

export interface EstadoVacioProps {
  icono: ReactNode;
  titulo: ReactNode;
  descripcion?: ReactNode;
  accion?: ReactNode;
  tamano?: EstadoVacioTamano;
  className?: string;
  id?: string;
}

export function EstadoVacio({
  icono,
  titulo,
  descripcion,
  accion,
  tamano = "compacto",
  className,
  id,
}: EstadoVacioProps) {
  return (
    <div
      id={id}
      className={["pulso-estado-vacio", `pulso-estado-vacio--${tamano}`, className]
        .filter(Boolean)
        .join(" ")}
      data-estado-vacio={tamano}
    >
      <span className="pulso-estado-vacio-icono" aria-hidden="true">
        {icono}
      </span>
      <div className="pulso-estado-vacio-texto">
        <p className="pulso-estado-vacio-titulo">{titulo}</p>
        {descripcion ? <p className="pulso-estado-vacio-descripcion">{descripcion}</p> : null}
      </div>
      {accion ? <div className="pulso-estado-vacio-accion">{accion}</div> : null}
    </div>
  );
}
