import { useId, type ReactNode } from "react";
import { joinDescribedBy, usePulsoFieldControl } from "./PulsoField";
import "./kit-inputs.css";

export type PulsoSwitchSize = "md" | "sm";

type PulsoSwitchBaseProps = {
  checked: boolean;
  /** Recibe el valor NUEVO; el switch no guarda estado. */
  onCheckedChange: (next: boolean) => void;
  /** `md` = maestro 44×24 · `sm` = chica 30×17 para filas densas. */
  size?: PulsoSwitchSize;
  /**
   * `chip`: etiqueta + conteo dentro de una píldora de 30 px, encendida con
   * `primary-soft`. Implica tamaño `sm` y exige `label`.
   */
  variant?: "default" | "chip";
  /** Texto chico secundario bajo la etiqueta. */
  description?: ReactNode;
  /** Conteo tabular junto a la etiqueta (sobre todo en `chip`). */
  count?: ReactNode;
  disabled?: boolean;
  id?: string;
  className?: string;
  title?: string;
  /** Ids extra de `aria-describedby`. */
  describedBy?: string;
};

type LabelledSwitchProps = PulsoSwitchBaseProps & {
  /** Etiqueta visible AL LADO (nunca dentro); nombra al switch. */
  label: ReactNode;
  /** Nombre accesible si la etiqueta visible no basta (p. ej. sin texto). */
  ariaLabel?: string;
};

type UnlabelledSwitchProps = PulsoSwitchBaseProps & {
  label?: undefined;
  /** Sin etiqueta visible el nombre accesible es obligatorio. */
  ariaLabel: string;
};

export type PulsoSwitchProps = LabelledSwitchProps | UnlabelledSwitchProps;

/** El valor que produce una activación (click, Espacio o Enter). */
export function nextSwitchValue(checked: boolean, disabled: boolean): boolean | null {
  return disabled ? null : !checked;
}

/**
 * **K1 — todo booleano es un switch; el checkbox no existe en el kit.**
 *
 * Un `<button role="switch">` nativo: Espacio y Enter lo activan por el propio
 * HTML, el foco se ve con `outline` y el estado viaja en `aria-checked`. El
 * maestro reutiliza `.pulso-switch` de `app/theme.css` (pista cóncava, perilla
 * elevada); `size="sm"` y `variant="chip"` viven en `kit-inputs.css`.
 *
 * - Sin `label` renderiza solo el botón (mismo markup que el `Switch` heredado).
 * - Con `label` agrega la etiqueta al lado, asociada por `aria-labelledby`, y
 *   un click en la etiqueta también conmuta.
 * - Dentro de un `PulsoField` toma su id y su `aria-describedby`.
 *
 * Radios solo para elección excluyente; de 2 a 4 opciones, segmented.
 */
export function PulsoSwitch(props: PulsoSwitchProps) {
  const {
    checked,
    onCheckedChange,
    size = "md",
    variant = "default",
    label,
    ariaLabel,
    description,
    count,
    disabled = false,
    id,
    className,
    title,
    describedBy,
  } = props;
  const field = usePulsoFieldControl();
  const autoId = useId();
  const switchId = id ?? field?.controlId ?? `pulso-switch-${autoId}`;
  const labelId = `${switchId}-label`;
  const descriptionId = `${switchId}-description`;
  const chip = variant === "chip";
  const effectiveSize: PulsoSwitchSize = chip ? "sm" : size;
  const hasLabel = label !== undefined && label !== null && label !== false && label !== "";

  function activate() {
    const next = nextSwitchValue(checked, disabled);
    if (next !== null) onCheckedChange(next);
  }

  const button = (
    <button
      type="button"
      role="switch"
      id={switchId}
      aria-checked={checked}
      aria-label={ariaLabel}
      aria-labelledby={!ariaLabel && hasLabel ? labelId : undefined}
      aria-describedby={joinDescribedBy(
        description ? descriptionId : undefined,
        field?.describedBy,
        describedBy,
      )}
      aria-invalid={field?.invalid ? true : undefined}
      disabled={disabled}
      title={title}
      className={[
        "pulso-switch",
        effectiveSize === "sm" ? "pulso-switch--sm" : null,
        !hasLabel ? className : null,
      ].filter(Boolean).join(" ")}
      onClick={activate}
    >
      <span className="pulso-switch-thumb" aria-hidden="true" />
    </button>
  );

  if (!hasLabel) return button;

  return (
    <span
      className={[
        "pulso-switch-field",
        effectiveSize === "sm" ? "is-sm" : null,
        chip ? "is-chip" : null,
        description ? "is-described" : null,
        disabled ? "is-disabled" : null,
        className,
      ].filter(Boolean).join(" ")}
      data-checked={checked ? "true" : "false"}
    >
      {button}
      <span className="pulso-switch-field-copy">
        <label id={labelId} htmlFor={switchId} className="pulso-switch-field-label">
          {label}
          {count !== undefined && count !== null ? (
            <small className="pulso-switch-field-count">{count}</small>
          ) : null}
        </label>
        {description ? (
          <span id={descriptionId} className="pulso-switch-field-description">{description}</span>
        ) : null}
      </span>
    </span>
  );
}
