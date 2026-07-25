/**
 * El último peldaño de «overflow con dignidad» (ADR 0042 §4).
 *
 * Cuando el ancho no alcanza, la command bar compacta labels y, si aún no
 * alcanza, recoge acá lo que sobra. Lo importante es lo que NO hace: no deja
 * caer nada. Una acción recogida sigue estando a un click, y un chip de estado
 * recogido conserva su detalle — que es la regla explícita del ADR: los chips
 * nunca desaparecen sin alternativa.
 *
 * Reusa el `Popover` de la casa (portal, clamping al viewport, cierre por ESC y
 * click-fuera). No hay razón para un segundo mecanismo de flotante.
 */

import { Popover } from "./Popover";
import { PulsoButton } from "./PulsoButton";
import { MoreHorizontal } from "../vendor/lucide-react";
import type { ChromeAction, ChromeStatusChip } from "./ModuleCommandBar";

export function ChromeOverflowMenu({
  acciones,
  estado,
}: {
  acciones: readonly ChromeAction[];
  estado: readonly ChromeStatusChip[];
}) {
  const total = acciones.length + estado.length;
  if (total === 0) return null;

  return (
    <Popover
      side="bottom"
      align="end"
      maxWidth={260}
      ariaLabel="Más acciones"
      trigger={
        <PulsoButton
          variant="icon"
          size="sm"
          aria-label={`Más acciones (${total})`}
          title={`Más acciones (${total})`}
        >
          <MoreHorizontal size={16} aria-hidden />
        </PulsoButton>
      }
    >
      <div className="pulso-chrome-overflow">
        {estado.length > 0 && (
          <div className="pulso-chrome-overflow-group" role="group" aria-label="Estado">
            {estado.map((chip) => (
              <div
                key={chip.id}
                className="pulso-chrome-overflow-status"
                data-tone={chip.tone}
              >
                <span className="pulso-chrome-overflow-status-label">{chip.label}</span>
                {chip.detail && (
                  <span className="pulso-chrome-overflow-status-detail">{chip.detail}</span>
                )}
              </div>
            ))}
          </div>
        )}

        {acciones.length > 0 && (
          <div className="pulso-chrome-overflow-group">
            {acciones.map((accion) => {
              const Icono = accion.icon;
              return (
                <button
                  key={accion.id}
                  type="button"
                  className="pulso-chrome-overflow-item"
                  onClick={accion.onSelect}
                  disabled={accion.disabled || accion.busy}
                  data-kind={accion.kind ?? "secondary"}
                >
                  {Icono && <Icono size={15} aria-hidden />}
                  <span>{accion.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </Popover>
  );
}
