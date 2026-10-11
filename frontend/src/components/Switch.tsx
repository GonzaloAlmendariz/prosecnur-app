/**
 * **El interruptor de la casa**, en un componente.
 *
 * El ESTILO ya existía: `.pulso-switch` y `.pulso-switch-thumb` viven en
 * `app/theme.css` con sus tokens (`--pulso-switch-track`, `--pulso-switch-border`,
 * `--pulso-switch-knob-shadow`) y su estado encendido en `--pulso-switch-accent`.
 * Lo que faltaba era el componente: `analitica/panes/MultibaseTablasPane` escribía
 * el `<button role="switch">` a mano y `calcMuestra/universidad/criterios`
 * mantenía una tercera geometría propia. Ambas convergieron aquí (2026-09-04).
 *
 * Existe como interruptor y no como casilla porque un criterio que QUEDA
 * PUESTO no es una casilla: la casilla dice «marqué esto en un formulario que
 * voy a enviar» y el interruptor dice «esto está encendido ahora mismo»
 * (dictado 2026-09-04, sobre el criterio de concentración del reparto: «no
 * debe ser un check, debe ser un switch»).
 *
 * **La piel se pasa por CSS, no se reimplementa.** `className` existe para que
 * una superficie redefina `--pulso-switch-w/-h/-knob-size/-accent` sobre el
 * propio botón y se quede con su escala y el tono de su módulo —así vive la
 * suite de criterios, en 34x20 y morado, sin duplicar la mecánica—. Lo que NO
 * debe hacer una piel es redeclarar la geometría por selector: si una medida no
 * sale de esas variables, falta parametrizarla aquí.
 *
 * Presentacional y accesible: no guarda estado, y la etiqueta visible va AL
 * LADO, nunca dentro.
 */
export function Switch({
  checked,
  onToggle,
  ariaLabel,
  disabled = false,
  id,
  className,
}: {
  checked: boolean;
  onToggle: () => void;
  /** El nombre accesible; el interruptor no lleva texto dentro. */
  ariaLabel: string;
  disabled?: boolean;
  /** Para `aria-labelledby` cuando el rótulo vive al lado. */
  id?: string;
  /** Piel de la superficie: sólo para redefinir los tokens `--pulso-switch-*`. */
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      className={className ? `pulso-switch ${className}` : "pulso-switch"}
      onClick={onToggle}
    >
      <span className="pulso-switch-thumb" aria-hidden="true" />
    </button>
  );
}

/** Un grupo puede estar entero, a medias o vacío; `some` es el indeterminado. */
export type EstadoSwitchTri = "all" | "some" | "none";

/**
 * Interruptor de tres estados para grupos jerárquicos: `all` enciende, `none`
 * apaga y `some` deja la perilla a medio camino con `aria-checked="mixed"`.
 * Vive junto al `Switch` y no en la suite que lo pedía, porque el estado
 * intermedio lo dibuja el mismo CSS de la casa.
 */
export function SwitchTri({
  estado,
  onToggle,
  ariaLabel,
  disabled = false,
  className,
}: {
  estado: EstadoSwitchTri;
  onToggle: () => void;
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={estado === "some" ? "mixed" : estado === "all"}
      aria-label={ariaLabel}
      disabled={disabled}
      className={className ? `pulso-switch ${className}` : "pulso-switch"}
      onClick={onToggle}
    >
      <span className="pulso-switch-thumb" aria-hidden="true" />
    </button>
  );
}
