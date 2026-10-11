import { forwardRef, type InputHTMLAttributes } from "react";
import { joinDescribedBy, usePulsoFieldControl } from "./PulsoField";
import "./kit-inputs.css";

export type PulsoInputSize = "md" | "sm";

export type PulsoInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  /** `md` = 36 px · `sm` = 30 px (filas y formularios densos). */
  size?: PulsoInputSize;
  /** Marca el control en error (`aria-invalid`). Dentro de un `PulsoField` con `error` se activa solo. */
  invalid?: boolean;
  /** Número tabular en una caja angosta (88 px). */
  numeric?: boolean;
};

/**
 * **El campo de texto del kit** (L26). Alturas 36/30, radio 9, foco con anillo
 * `--pulso-primary-focus`. Dentro de un `PulsoField` toma el id del label y el
 * `aria-describedby` del hint o del error.
 *
 * No es un booleano: para eso está `PulsoSwitch` (K1). Casillas y radios no
 * se pasan por aquí.
 */
export const PulsoInput = forwardRef<HTMLInputElement, PulsoInputProps>(function PulsoInput(
  {
    size = "md",
    invalid,
    numeric = false,
    type = "text",
    id,
    className,
    "aria-describedby": ariaDescribedBy,
    "aria-invalid": ariaInvalid,
    ...inputProps
  },
  ref,
) {
  const field = usePulsoFieldControl();
  const isInvalid = Boolean(invalid) || Boolean(field?.invalid) || ariaInvalid === true || ariaInvalid === "true";
  return (
    <input
      {...inputProps}
      ref={ref}
      type={type}
      id={id ?? field?.controlId}
      aria-describedby={joinDescribedBy(field?.describedBy, ariaDescribedBy)}
      aria-invalid={isInvalid ? true : undefined}
      className={[
        "pulso-input",
        size === "sm" ? "pulso-input--sm" : null,
        numeric ? "is-numeric" : null,
        className,
      ].filter(Boolean).join(" ")}
    />
  );
});
