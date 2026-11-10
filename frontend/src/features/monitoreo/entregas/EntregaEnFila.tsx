// Forma "en la fila" del censo de descargas: el disparador se queda en su
// celda de acción y el contenedor del kit va debajo de la fila entera, en su
// propia línea, con su línea de avance, el archivo y Abrir / Mostrar en la
// carpeta, o la causa del fallo con Reintentar. No comparte celda con el botón:
// en la celda de acción (columna `auto`) competía por ancho con el texto de la
// fila y lo dejaba en 0 px (Monitoreo › Salidas, "Generar libro").

import { ContenedorEntregable } from "../../../components/entregables/ContenedorEntregable";
import type { EntregaMonitoreo } from "./useEntrega";
import "./entregas.css";

/** Sin generación no pinta nada: la fila no gana un renglón vacío. */
export function EntregaEnFila({ entrega, className }: { entrega: EntregaMonitoreo; className?: string }) {
  if (entrega.estado.fase === "inactiva") return null;
  return (
    <div className={className ? `mon-entrega-fila ${className}` : "mon-entrega-fila"}>
      <ContenedorEntregable estado={entrega.estado} forma="fila" onCerrar={entrega.cerrar} />
    </div>
  );
}
