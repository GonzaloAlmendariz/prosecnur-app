// El cajón de plantillas y bloques (F3): en compacto la columna izquierda deja
// el ancho al lienzo y se abre desde la barra.
//
// Es un panel efímero (popover), no una dimensión de navegación: no escribe la
// dirección, como el menú «Más» de la barra. Se cierra con Esc, al pulsar
// fuera o al elegir un bloque (el inspector pasa a mostrarlo).
//
// Contrato de Superficie: la columna que lleva adentro declara sus grupos
// (plantillas, bloques); el cajón tiene alto tope de la ventana y un único
// dueño de scroll, su cuerpo (C4).

import * as Popover from "@radix-ui/react-popover";
import type { ReactNode } from "react";

import { LayoutPanelLeft } from "../../../vendor/lucide-react";
import "./correosCompacto.css";

type Props = {
  abierto: boolean;
  onAbierto: (abierto: boolean) => void;
  /** Cuántos bloques tienen algo por corregir: se ve sin abrir el cajón. */
  conProblemas: number;
  children: ReactNode;
};

export function CajonDeBloques({ abierto, onAbierto, conProblemas, children }: Props) {
  return (
    <Popover.Root open={abierto} onOpenChange={onAbierto}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={`rec-barra-cajon${abierto ? " is-on" : ""}`}
          aria-label={conProblemas ? `Plantillas y bloques (${conProblemas} con algo por corregir)` : "Plantillas y bloques"}
          title="Plantillas y bloques del correo"
        >
          <LayoutPanelLeft size={16} aria-hidden />
          <span className="rec-barra-cajon-rotulo">Bloques</span>
          {conProblemas ? <span className="rec-barra-cajon-cuenta" aria-hidden>{conProblemas}</span> : null}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="rec-cajon"
          side="bottom"
          align="start"
          sideOffset={8}
          collisionPadding={12}
          aria-label="Plantillas y bloques del correo"
        >
          {children}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
