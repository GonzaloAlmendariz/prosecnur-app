// La mesa de una pestaña de Procesamiento (ADR 0142, plan de fidelidad de
// Validación, V0; `pp-mesa pp-m3` y `pp-m2` del prototipo, plan 8.2): la
// cabecera de la pestaña arriba y, debajo, las columnas, que llegan al pie.
//
//  - Tres columnas: laterales iguales de 320 y centro libre; 360 desde 1600 de
//    ventana y 264 hasta 1400.
//  - Dos columnas: centro libre e inspector de 400; 440 desde 1600 y 330 hasta 1400.
//  - Hasta 1100 de ventana la de tres pasa a dos (la tercera baja a todo el
//    ancho), la de dos a una, y la pestaña se desplaza: cada contenedor tiene
//    un alto que cabe en la ventana y su propio scroll.
//
// Los cortes van por el ancho de la mesa (container query), no por el de la
// ventana: la misma pieza vive junto a un riel o sin él. La mesa no sabe qué
// lleva cada columna: eso lo pone la pestaña, con `PanelDeMesa` o una pila de
// ellos.

import type { ReactNode } from "react";

import "./mesa-procesamiento.css";

export function MesaDePestana({ grupo, columnas, cabecera, avisos, franja, children }: {
  /** Nombre de los grupos de geometría: "validacion/hallazgos" da "validacion/hallazgos-mesa". */
  grupo: string;
  columnas: 2 | 3;
  /** La cabecera de la pestaña (`CabeceraDePestana`). */
  cabecera: ReactNode;
  /** Avisos de la pestaña, entre la cabecera y la mesa. */
  avisos?: ReactNode;
  /** La franja de recorrido o de trabajo en curso, a todo el ancho sobre las columnas. */
  franja?: ReactNode;
  /** Las columnas, en orden: dos o tres. */
  children: ReactNode;
}) {
  return (
    <div className="pulso-mesa-pestana-superficie" data-columnas={columnas}>
      <div className="pulso-mesa-pestana-marco">
        {cabecera}
        {avisos}
        {franja}
        {/* C1: columnas independientes que comparten el alto de la mesa. */}
        <div
          className="pulso-mesa-pestana"
          data-columnas={columnas}
          data-qa-geometry-group={`${grupo}-mesa`}
          data-qa-geometry-contract="intrinsic"
        >
          {children}
        </div>
      </div>
    </div>
  );
}

/** Una columna de la mesa con varios contenedores apilados: el último se queda con el alto libre. */
export function PilaDeMesa({ grupo, children }: { grupo: string; children: ReactNode }) {
  return (
    <div
      className="pulso-mesa-pestana-pila"
      data-qa-geometry-group={`${grupo}-pila`}
      data-qa-geometry-contract="intrinsic"
    >
      {children}
    </div>
  );
}
