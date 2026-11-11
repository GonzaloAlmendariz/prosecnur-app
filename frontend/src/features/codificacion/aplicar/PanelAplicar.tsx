// Un panel de Aplicar: el mismo marco con contenido, mientras carga y si falla la
// lectura (C2). Los dos de la pantalla (preguntas y detalle) llegan al borde inferior
// y el vacío queda dentro.

import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { Panel } from "../../../components/Panel";
import "./aplicar.css";

type Props = {
  /** Cuál de los dos paneles es: decide su clase y, con ella, su columna. */
  variante: "preguntas" | "detalle";
  titulo: string;
  /** Ícono de la tesela de la cabecera. */
  icono: ReactNode;
  /** Acciones de la cabecera. */
  acciones?: ReactNode;
  /** El cuerpo es un solo estado (carga, error): va centrado en el alto libre. */
  soloEstado?: boolean;
  children: ReactNode;
} & Omit<ComponentPropsWithoutRef<"section">, "title" | "className" | "children">;

export function PanelAplicar({ variante, titulo, icono, acciones, soloEstado = false, children, ...resto }: Props) {
  return (
    <Panel
      {...resto}
      noPadding
      className={`pulso-aplicar-panel pulso-aplicar-panel--${variante}`}
      data-solo-estado={soloEstado ? "" : undefined}
      title={
        <>
          <span className="pulso-aplicar-tesela" aria-hidden="true">
            {icono}
          </span>
          {titulo}
        </>
      }
      actions={acciones}
    >
      {children}
    </Panel>
  );
}
