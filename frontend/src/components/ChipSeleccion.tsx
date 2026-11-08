import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { X } from "../vendor/lucide-react";
import { PulsoButton } from "./PulsoButton";
import "./kit-chip-seleccion.css";

export type ChipSeleccionProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "onClick" | "aria-pressed" | "children" | "type" | "disabled" | "className" | "title" | "onChange"
> & {
  /** Texto del chip; si no cabe se corta con elipsis (y va completo en `title`). */
  etiqueta: string;
  /** Estado de selección; sale como `aria-pressed`. */
  activo: boolean;
  /** Se llama con el estado siguiente al pulsar el chip. */
  onAlternar: (siguiente: boolean) => void;
  /** Si se pasa, el chip lleva una X de quitar (botón quieto de 14). */
  onQuitar?: () => void;
  /** Nombre accesible de la X. Por defecto «Quitar <etiqueta>». */
  etiquetaQuitar?: string;
  /** Ícono opcional antes del texto (14 px del shim; se marca `aria-hidden`). */
  icono?: ReactNode;
  disabled?: boolean;
  /** Tooltip; por defecto la etiqueta. */
  title?: string;
  className?: string;
};

/**
 * **Chip de selección múltiple** (Excluir, Destacar…; contrato A del acabado de
 * Láminas). Botón conmutador con `aria-pressed`: 28 px de alto, radio
 * `--pulso-radius-chip`, y en activo el tinte del módulo
 * (`--module-accent-soft` + `--module-accent-border`). La X opcional es un
 * botón hermano (nunca anidado) PulsoButton `icon` `tone="quiet"`
 * `intent="remove"` con ícono de 14.
 *
 * Para elegir UN valor entre varios no es esto: es `GlidingRadioGroup`.
 * **Escape no es asunto del chip**: no abre ni cierra nada.
 *
 * El contenedor de varios chips los pone en `flex-wrap` con gap `--pulso-space-1`
 * y sin reservar alto vacío (contrato C5).
 */
export const ChipSeleccion = forwardRef<HTMLButtonElement, ChipSeleccionProps>(function ChipSeleccion(
  {
    etiqueta,
    activo,
    onAlternar,
    onQuitar,
    etiquetaQuitar,
    icono,
    disabled = false,
    title,
    className,
    ...rest
  },
  ref,
) {
  return (
    <span
      className={[
        "pulso-chip-seleccion",
        activo ? "is-activo" : null,
        disabled ? "is-deshabilitado" : null,
        onQuitar ? "pulso-chip-seleccion--con-quitar" : null,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <button
        {...rest}
        ref={ref}
        type="button"
        className="pulso-chip-seleccion__alternar"
        aria-pressed={activo}
        disabled={disabled}
        title={title ?? etiqueta}
        onClick={() => onAlternar(!activo)}
      >
        {icono ? (
          <span className="pulso-chip-seleccion__icono" aria-hidden="true">
            {icono}
          </span>
        ) : null}
        <span className="pulso-chip-seleccion__texto">{etiqueta}</span>
      </button>
      {onQuitar ? (
        <PulsoButton
          variant="icon"
          tone="quiet"
          intent="remove"
          size="sm"
          className="pulso-chip-seleccion__quitar"
          aria-label={etiquetaQuitar ?? `Quitar ${etiqueta}`}
          disabled={disabled}
          onClick={onQuitar}
        >
          <X aria-hidden="true" focusable="false" />
        </PulsoButton>
      ) : null}
    </span>
  );
});
