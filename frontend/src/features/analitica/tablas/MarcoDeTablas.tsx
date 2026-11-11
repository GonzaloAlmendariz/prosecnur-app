// Marco de una pestaña de tablas de Analítica (Frecuencias y Cruces), como en
// el prototipo del rediseño de Procesamiento: la cabecera de la pestaña y,
// debajo, una mesa de tres columnas que llegan al pie.
//
//  - "Preguntas": la lista de las preguntas del archivo, con su buscador;
//  - "Así sale en el archivo": la tabla de la pregunta elegida;
//  - a la derecha, "Ajustes del archivo" y "Archivo", apilados.
//
// Cada contenedor desplaza su cuerpo y contiene su vacío (C3 y C4). El marco
// no sabe qué tabla ni qué ajustes lleva: eso lo pone la pestaña.

import type { ReactNode } from "react";

// La secuencia de datos (`--pulso-data-seq-*`) no es global: se importa donde se usa. Sin ella las barras
// de Frecuencias y del Total de Cruces se pintaban sin color, invisibles.
import "../../../app/tokens-datos.css";
import "./tablas.css";

export function MarcoDeTablas({ pestana, cabecera, preguntas, tabla, ajustes, archivo }: {
  /** La pestaña, para nombrar los grupos de geometría: "frecuencias", "cruces". */
  pestana: "frecuencias" | "cruces";
  cabecera: ReactNode;
  preguntas: ReactNode;
  tabla: ReactNode;
  ajustes: ReactNode;
  archivo: ReactNode;
}) {
  return (
    // Dos niveles: la superficie mide el ancho disponible (es el contenedor de
    // las consultas de tamaño) y el marco reparte el alto entre las zonas.
    <div className="tablas-superficie" data-tablas={pestana}>
      <div className="tablas-marco">
        {cabecera}
        {/* C1: tres columnas independientes que comparten el alto de la mesa. */}
        <div
          className="tablas-mesa"
          data-qa-geometry-group={`analitica/${pestana}-mesa`}
          data-qa-geometry-contract="intrinsic"
        >
          {preguntas}
          {tabla}
          {/* La columna derecha: los ajustes miden lo suyo y el archivo se queda con el resto del alto. */}
          <div
            className="tablas-lateral"
            data-qa-geometry-group={`analitica/${pestana}-lateral`}
            data-qa-geometry-contract="intrinsic"
          >
            {ajustes}
            {archivo}
          </div>
        </div>
      </div>
    </div>
  );
}
