// Contenedor de una zona de la mesa de tablas: el `Panel` del kit con la
// cabecera fija y un cuerpo que es el único dueño del scroll y del alto libre
// (C3 y C4). El pie, si lo hay, queda fijo bajo el cuerpo.

import type { ReactNode } from "react";

import { Panel } from "../../../components/Panel";
import { formatoConteo } from "../../../lib/formatoNumero";

export function PanelDeZona({ zona, titulo, icono, conteo, acciones, pie, ocupado = false, grupo, children }: {
  zona: "preguntas" | "tabla" | "ajustes";
  titulo: string;
  icono: ReactNode;
  /** Cuántos elementos lista el panel, junto al título. */
  conteo?: number;
  /** Controles de la cabecera. */
  acciones?: ReactNode;
  /** Línea fija bajo el cuerpo. */
  pie?: ReactNode;
  /** Lo que se ve es de una lectura anterior y se está releyendo. */
  ocupado?: boolean;
  /** Grupo de geometría de las secciones del cuerpo, cuando las tiene. */
  grupo?: string;
  children: ReactNode;
}) {
  return (
    <Panel
      noPadding
      data-entra="sube"
      className={`tablas-panel tablas-panel--${zona}`}
      title={(
        <>
          <span className="tablas-panel-tesela" aria-hidden="true">{icono}</span>
          <span>{titulo}</span>
          {conteo !== undefined ? <span className="tablas-conteo">{formatoConteo(conteo)}</span> : null}
        </>
      )}
      actions={acciones}
    >
      {/* El cuerpo se desplaza con el teclado: es una región con nombre y parada de tabulador. */}
      <div
        className="tablas-panel-cuerpo"
        role="region"
        aria-label={titulo}
        aria-busy={ocupado || undefined}
        tabIndex={0}
        data-qa-geometry-capacity="owned"
        {...(grupo ? { "data-qa-geometry-group": grupo, "data-qa-geometry-contract": "intrinsic" } : {})}
      >
        {children}
      </div>
      {pie ? <div className="tablas-panel-pie">{pie}</div> : null}
    </Panel>
  );
}
