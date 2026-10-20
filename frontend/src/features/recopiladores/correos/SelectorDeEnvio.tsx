// Selector del envío en la barra del correo (addendum E1k §5):
// «Envío: Invitación · 02/09 ▾», junto al de la campaña.
//
// El envío elegido es estado de la vista —como escritorio o teléfono—, no una
// dimensión de navegación: no escribe la dirección. Se recuerda por campaña en
// sessionStorage (modeloEnvios). Cambiar de envío no descarta nada: los envíos
// se guardan juntos con la plantilla.

import * as Popover from "@radix-ui/react-popover";
import { useState } from "react";

import type { MailSend } from "../../../api/materialMail";
import { Check, ChevronDown, Plus, Send } from "../../../vendor/lucide-react";
import { ROTULO_DE_AUDIENCIA, puedeAgregar, rotuloDeEnvio } from "./modeloEnvios";
import "./correosEnvios.css";

type Props = {
  envios: readonly MailSend[];
  activo: MailSend;
  onElegir: (sendId: string) => void;
  onAgregar: () => void;
  onGestionar: () => void;
};

export function SelectorDeEnvio({ envios, activo, onElegir, onAgregar, onGestionar }: Props) {
  const [abierto, setAbierto] = useState(false);
  return (
    <Popover.Root open={abierto} onOpenChange={setAbierto}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="rec-env-selector"
          aria-label={`Envío: ${rotuloDeEnvio(activo)}. Cambiar de envío`}
        >
          <span className="rec-env-selector-rotulo">Envío:</span>
          <b className="rec-env-selector-nombre">{rotuloDeEnvio(activo)}</b>
          <ChevronDown size={14} aria-hidden className="rec-env-selector-flecha" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="rec-env-menu" align="start" sideOffset={6} collisionPadding={12} aria-label="Envíos de la campaña">
          <ul className="rec-env-menu-lista">
            {envios.map((e) => {
              const actual = e.send_id === activo.send_id;
              return (
                <li key={e.send_id}>
                  <button
                    type="button"
                    className={`rec-env-menu-item${actual ? " is-active" : ""}`}
                    aria-current={actual ? "true" : undefined}
                    onClick={() => { setAbierto(false); onElegir(e.send_id); }}
                  >
                    <span className="rec-env-menu-marca" aria-hidden>{actual ? <Check size={14} /> : null}</span>
                    <span className="rec-env-menu-textos">
                      <b>{rotuloDeEnvio(e)}</b>
                      <span>{e.kind === "invitacion" ? "A todos" : `A: ${ROTULO_DE_AUDIENCIA[e.audience].toLocaleLowerCase("es-PE")}`}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="rec-env-menu-pie">
            <button
              type="button"
              className="rec-env-menu-accion"
              disabled={!puedeAgregar(envios)}
              title={puedeAgregar(envios) ? undefined : "Una campaña tiene hasta 6 envíos"}
              onClick={() => { setAbierto(false); onAgregar(); }}
            >
              <Plus size={14} aria-hidden /> Recordatorio
            </button>
            <button type="button" className="rec-env-menu-accion" onClick={() => { setAbierto(false); onGestionar(); }}>
              <Send size={14} aria-hidden /> Envíos de la campaña…
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
