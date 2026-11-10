// Forma bloque del censo de descargas (tarjeta, cabecera o pie de panel): el
// contenedor del kit en el flujo, bajo la fila que tiene el disparador y al
// ancho de su panel. Sin generación no ocupa nada.

import type { ReactNode } from "react";

import { ContenedorEntregable } from "../../../components/entregables/ContenedorEntregable";
import type { EntregaMonitoreo } from "./useEntrega";
import "./entregas.css";

export function EntregaEnBloque({ entrega, pie, inset = false }: {
  entrega: EntregaMonitoreo;
  pie?: ReactNode;
  /** El panel no tiene relleno propio (sus filas lo ponen): el contenedor se separa de sus bordes como la cabecera. */
  inset?: boolean;
}) {
  if (entrega.estado.fase === "inactiva") return null;
  return (
    <div className={inset ? "mon-entrega-bloque mon-entrega-bloque--inset" : "mon-entrega-bloque"}>
      <ContenedorEntregable estado={entrega.estado} forma="bloque" onCerrar={entrega.cerrar} pie={pie} />
    </div>
  );
}
