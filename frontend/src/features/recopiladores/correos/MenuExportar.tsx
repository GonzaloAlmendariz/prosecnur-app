// «Exportar ▾» en la barra del correo (revisión de usabilidad, F7).
//
// Antes la salida era un pie fijo del inspector de ≈360 px que crecía al
// aparecer el ZIP: el alto del marco lo decidía el contenido (C2) y le quitaba
// alto a la pestaña abierta. Ahora vive en la barra, como las demás acciones
// del correo: la principal según la plataforma, una línea de para qué sirve
// cada salida, dónde se pega y el ZIP listo para descargar.
//
// Es un panel efímero (popover): no escribe la dirección. Se queda abierto
// mientras se arma el paquete, para que el resultado aparezca donde se pidió.

import * as Popover from "@radix-ui/react-popover";
import type { ReactNode } from "react";

import type { MailPlatform } from "../../../api/materialMail";
import { ChevronDown, Upload } from "../../../vendor/lucide-react";
import { NOMBRE_DE_PLATAFORMA } from "./dialectos";
import "./correosExportar.css";

type Props = {
  plataforma: MailPlatform;
  abierto: boolean;
  onAbierto: (abierto: boolean) => void;
  /** Hay un paquete armado en esta vista: el botón lo dice sin abrir el menú. */
  listo: boolean;
  children: ReactNode;
};

export function MenuExportar({ plataforma, abierto, onAbierto, listo, children }: Props) {
  return (
    <Popover.Root open={abierto} onOpenChange={onAbierto}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={`rec-barra-exportar${abierto ? " is-on" : ""}`}
          aria-label={`Exportar para ${NOMBRE_DE_PLATAFORMA[plataforma]}${listo ? " (paquete listo)" : ""}`}
          title={`Lo que se lleva a ${NOMBRE_DE_PLATAFORMA[plataforma]}`}
        >
          <Upload size={14} aria-hidden />
          <span className="rec-barra-exportar-rotulo">Exportar</span>
          {listo ? <span className="rec-barra-exportar-listo" aria-hidden /> : null}
          <ChevronDown size={14} aria-hidden />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="rec-exp"
          align="end"
          sideOffset={6}
          collisionPadding={12}
          aria-label={`Exportar para ${NOMBRE_DE_PLATAFORMA[plataforma]}`}
        >
          {children}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
