// Un control de la barra del visor con su globo: el nombre de la acción y su tecla en `<kbd>` (hallazgo 13 de la auditoría
// de Arte: ⌘1 y ⌘. existían sin que nada los mostrara). El globo sale al pasar o al llegar con el foco, en un portal; el
// control es el hijo, conserva su nombre accesible y declara su tecla en `aria-keyshortcuts`.

import { cloneElement, type ReactElement } from "react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { ariaDeAccion, ATAJOS_VISOR, teclaDeAccion, type AccionVisor } from "./atajosVisor";
import "./botonConTecla.css";

type Props = {
  accion: AccionVisor;
  /** Lo que dice el globo; por defecto, el nombre de la acción. */
  ayuda?: string;
  children: ReactElement<{ "aria-keyshortcuts"?: string }>;
};

export function BotonConTecla({ accion, ayuda, children }: Props) {
  return (
    <Tooltip.Provider delayDuration={350} skipDelayDuration={200}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{cloneElement(children, { "aria-keyshortcuts": ariaDeAccion(accion) })}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content className="pulso-f6-tecla-globo" side="bottom" align="center" sideOffset={6} collisionPadding={8}>
            <span>{ayuda ?? ATAJOS_VISOR[accion].nombre}</span>
            <kbd className="pulso-f6-tecla">{teclaDeAccion(accion)}</kbd>
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
