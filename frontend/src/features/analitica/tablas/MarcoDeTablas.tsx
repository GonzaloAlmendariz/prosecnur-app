// Marco de una pestaña de tablas de Analítica (Frecuencias y, después, Cruces):
// la tabla tal como sale en el archivo, los ajustes al lado y el archivo
// debajo. Arriba, la banda de cifras de la pestaña.
//
// Tres zonas con dueño propio:
//  - `tabla` y `ajustes` son dos contenedores que llegan al pie de la mesa;
//    cada uno desplaza su cuerpo y contiene su vacío (`PanelDeZona`);
//  - `archivo` queda siempre a la vista bajo la mesa (`PieDeArchivo`).
// El marco no sabe qué tabla ni qué ajustes lleva: eso lo pone la pestaña.

import type { ReactNode } from "react";

import "./tablas.css";

export function MarcoDeTablas({ pestana, banda, tabla, ajustes, archivo }: {
  /** La pestaña, para nombrar el grupo de geometría: "frecuencias", "cruces". */
  pestana: string;
  banda: ReactNode;
  tabla: ReactNode;
  ajustes: ReactNode;
  archivo: ReactNode;
}) {
  return (
    // Dos niveles: la superficie mide el ancho disponible (es el contenedor de
    // las consultas de tamaño) y el marco reparte el alto entre las zonas.
    <div className="tablas-superficie" data-tablas={pestana}>
      <div className="tablas-marco">
        <div className="tablas-banda">{banda}</div>
        {/* C1: dos contenedores de ancho distinto que comparten el alto de la mesa;
            cada uno es dueño de su scroll y de su vacío. */}
        <div
          className="tablas-mesa"
          data-qa-geometry-group={`analitica/${pestana}-mesa`}
          data-qa-geometry-contract="intrinsic"
        >
          {tabla}
          {ajustes}
        </div>
        {archivo}
      </div>
    </div>
  );
}
