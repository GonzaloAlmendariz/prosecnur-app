// Menú «⋯» de una campaña: en su tarjeta y en la cabecera de la campaña abierta.
// Una acción que no se puede hacer ahora se ve deshabilitada con su motivo; no
// desaparece (ADR 0111 §7).

import * as Popover from "@radix-ui/react-popover";
import { useState } from "react";

import type { CampanaMaterial } from "../../../api/materialCampanas";
import { PulsoButton } from "../../../components/PulsoButton";
import { MoreHorizontal } from "../../../vendor/lucide-react";
import type { AccionDeCampana, IdDeAccion } from "./accionesDeCampana";

type Props = {
  campana: CampanaMaterial;
  acciones: readonly AccionDeCampana[];
  onAccion: (accion: IdDeAccion, campana: CampanaMaterial) => void;
  className?: string;
};

export function MenuDeCampana({ campana, acciones, onAccion, className }: Props) {
  const [abierto, setAbierto] = useState(false);
  if (!acciones.length) return null;
  return (
    <Popover.Root open={abierto} onOpenChange={setAbierto}>
      <Popover.Trigger asChild>
        <PulsoButton
          variant="icon"
          size="sm"
          className={["rec-campana-menu-boton", className].filter(Boolean).join(" ")}
          aria-label={`Acciones de ${campana.name}`}
          title="Acciones de la campaña"
        >
          <MoreHorizontal size={16} aria-hidden />
        </PulsoButton>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="rec-campana-menu" align="end" sideOffset={6} collisionPadding={12} aria-label={`Acciones de ${campana.name}`}>
          {acciones.map((accion) => (
            <button
              key={accion.id}
              type="button"
              className={`rec-campana-menu-item${accion.peligrosa ? " is-peligrosa" : ""}`}
              disabled={accion.motivo !== null}
              title={accion.motivo ?? undefined}
              onClick={() => {
                setAbierto(false);
                onAccion(accion.id, campana);
              }}
            >
              {accion.label}
              {accion.motivo ? <small>{accion.motivo}</small> : null}
            </button>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
