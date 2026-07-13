/**
 * Switch (toggle) macOS para la suite de criterios. Reemplaza los checkboxes:
 * un botón role="switch" con track + thumb, escalera del UI Kit (36x16, Mn) y
 * acento del módulo (morado/cmv2) en on. `SwitchTri` agrega el estado "mixed"
 * de un grupo jerárquico (algunos hijos marcados). Presentacional y accesible.
 */
type Estado = "all" | "some" | "none";

export function Switch({
  checked,
  onToggle,
  ariaLabel,
  disabled,
}: {
  checked: boolean;
  onToggle: () => void;
  ariaLabel: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      className="cmv2-crit-switch"
      onClick={onToggle}
    >
      <span className="cmv2-crit-switch-thumb" aria-hidden="true" />
    </button>
  );
}

/** Switch tri-estado para grupos: on=all, off=none, mixed=some (parcial). */
export function SwitchTri({
  estado,
  onToggle,
  ariaLabel,
}: {
  estado: Estado;
  onToggle: () => void;
  ariaLabel: string;
}) {
  const checked = estado === "all";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={estado === "some" ? "mixed" : checked}
      aria-label={ariaLabel}
      className="cmv2-crit-switch"
      data-mixed={estado === "some" ? "true" : "false"}
      onClick={onToggle}
    >
      <span className="cmv2-crit-switch-thumb" aria-hidden="true" />
    </button>
  );
}
