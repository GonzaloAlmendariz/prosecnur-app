// Un botón de «Revisar emparejado» con su globo: el nombre de la acción y, si la tiene, su tecla en `<kbd>` (X6). El
// globo sale al pasar o al llegar con el foco, en un portal sobre el diálogo (la celda de la tabla recorta su contenido).
// El botón es el hijo: conserva su nombre accesible y declara su tecla en `aria-keyshortcuts`.

import type { ReactElement } from "react";
import * as Tooltip from "@radix-ui/react-tooltip";

type Props = {
  ayuda: string;
  atajo?: string;
  children: ReactElement;
};

export function BotonConAtajo({ ayuda, atajo, children }: Props) {
  return (
    <Tooltip.Provider delayDuration={350} skipDelayDuration={200}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content className="pulso-f6-emp-globo" side="top" align="end" sideOffset={6} collisionPadding={8}>
            <span>{ayuda}</span>
            {atajo ? <kbd className="pulso-dialog__kbd">{atajo}</kbd> : null}
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
