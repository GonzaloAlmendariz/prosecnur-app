// Confirmación de «Vaciar el plan» (C14) en la barra de Láminas: aparece bajo el menú ⋯ que la pidió, toma el foco
// (patrón `ConfirmacionCompartir`), Escape o Cancelar la cierran y el foco vuelve al disparador ⋯. No es direccionable:
// una confirmación destructiva no se abre desde un enlace.

import type { KeyboardEvent, RefObject } from "react";
import { ConfirmacionCompartir } from "./ConfirmacionCompartir";
import type { ControlVaciar } from "./useVaciarPlan";

export function ConfirmacionVaciar({ control, retornoRef }: { control: ControlVaciar; retornoRef: RefObject<HTMLElement> }) {
  const volver = () => retornoRef.current?.focus();
  const cancelar = () => { control.cancelar(); volver(); };
  const alTeclear = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Escape") return;
    e.preventDefault();
    e.stopPropagation();
    cancelar();
  };
  return (
    <div
      className="pulso-f6-barra-vaciar"
      onKeyDown={alTeclear}
      data-qa-surface="graficos/f6-vaciar-plan"
      data-qa-geometry-group="graficos/f6-vaciar-plan"
      data-qa-geometry-contract="intrinsic"
    >
      <div data-qa-geometry-member>
        <ConfirmacionCompartir
          texto={control.texto}
          ocupado={false}
          onCancelar={cancelar}
          onConfirmar={() => { control.confirmar(); volver(); }}
        />
      </div>
    </div>
  );
}
