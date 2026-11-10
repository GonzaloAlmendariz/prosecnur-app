// Forma anclada del censo de descargas (barra de comandos): el disparador queda
// en su barra y el contenedor del kit flota bajo él sin mover la página.

import type { ReactNode } from "react";

import { ContenedorEntregable } from "../../../components/entregables/ContenedorEntregable";
import type { AlineacionAnclada } from "../../../components/entregables/tipos";
import type { EntregaMonitoreo } from "./useEntrega";
import "./entregas.css";

export function EntregaAnclada({ entrega, alinear = "fin", children }: {
  entrega: EntregaMonitoreo;
  alinear?: AlineacionAnclada;
  /** El disparador, deshabilitado por quien lo pinta mientras `entrega.enCurso`. */
  children: ReactNode;
}) {
  return (
    <span className="mon-entrega-anclaje">
      {children}
      <ContenedorEntregable estado={entrega.estado} forma="anclada" alinear={alinear} onCerrar={entrega.cerrar} />
    </span>
  );
}
