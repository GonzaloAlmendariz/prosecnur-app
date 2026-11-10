// Forma «en la fila» del censo de descargas: el disparador queda en su celda y
// el contenedor del kit, debajo y en la misma celda, con su línea, el archivo y
// Abrir / Mostrar en la carpeta, o la causa del fallo con Reintentar.

import type { ReactNode } from "react";

import { ContenedorEntregable } from "../../../components/entregables/ContenedorEntregable";
import type { EntregaMonitoreo } from "./useEntrega";
import "./entregas.css";

export function EntregaEnFila({ entrega, children }: { entrega: EntregaMonitoreo; children: ReactNode }) {
  return (
    <div className="mon-entrega-celda">
      {children}
      <ContenedorEntregable estado={entrega.estado} forma="fila" onCerrar={entrega.cerrar} />
    </div>
  );
}
