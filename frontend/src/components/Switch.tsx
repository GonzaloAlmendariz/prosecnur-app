import { PulsoSwitch } from "./PulsoSwitch";

/**
 * **El interruptor de la casa**, en un componente.
 *
 * El ESTILO ya existía: `.pulso-switch` y `.pulso-switch-thumb` viven en
 * `app/theme.css` con sus tokens (`--pulso-switch-track`, `--pulso-switch-border`,
 * `--pulso-switch-knob-shadow`) y su estado encendido en `--pulso-primary`. Lo
 * que faltaba era el componente: `analitica/panes/MultibaseTablasPane` escribía
 * el `<button role="switch">` a mano y `calcMuestra/universidad/criterios`
 * mantiene una tercera geometría propia. Esta es la pieza a la que las dos
 * deberían converger.
 *
 * Existe como interruptor y no como casilla porque un criterio que QUEDA
 * PUESTO no es una casilla: la casilla dice «marqué esto en un formulario que
 * voy a enviar» y el interruptor dice «esto está encendido ahora mismo»
 * (dictado 2026-09-04, sobre el criterio de concentración del reparto: «no
 * debe ser un check, debe ser un switch»).
 *
 * Presentacional y accesible: no guarda estado, y la etiqueta visible va AL
 * LADO, nunca dentro.
 *
 * Desde L26 es un adaptador fino de `PulsoSwitch` (el switch del kit, con
 * variantes chica y chip, etiqueta y `PulsoField`). Se conserva para sus
 * importadores; el código nuevo usa `PulsoSwitch` directamente.
 */
export function Switch({
  checked,
  onToggle,
  ariaLabel,
  disabled = false,
  id,
}: {
  checked: boolean;
  onToggle: () => void;
  /** El nombre accesible; el interruptor no lleva texto dentro. */
  ariaLabel: string;
  disabled?: boolean;
  /** Para `aria-labelledby` cuando el rótulo vive al lado. */
  id?: string;
}) {
  return (
    <PulsoSwitch
      checked={checked}
      onCheckedChange={() => onToggle()}
      ariaLabel={ariaLabel}
      disabled={disabled}
      id={id}
    />
  );
}
