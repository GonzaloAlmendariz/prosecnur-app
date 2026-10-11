import {
  forwardRef,
  type ButtonHTMLAttributes,
} from "react";
import { ArrowRight } from "../vendor/lucide-react";
import "./kit-buttons.css";

export type PulsoButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "icon"
  | "link";

export type PulsoButtonSize = "sm" | "md" | "lg";

type NativeButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "aria-label"
>;

type NavCapable = {
  /**
   * K4 — acción de navegación: el texto nombra el DESTINO («Abrir Cuotas»,
   * «Ver avance») y el botón añade la flecha de lucide, que se desplaza 2 px
   * al hover. «Ir» suelto y «→» tipeado no existen.
   */
  nav?: boolean;
};

type StandardPulsoButtonProps = NativeButtonProps & NavCapable & {
  variant: "primary" | "secondary" | "ghost" | "link";
  size?: PulsoButtonSize;
  "aria-label"?: string;
};

type DangerPulsoButtonProps = NativeButtonProps & {
  variant: "danger";
  /**
   * D13 — `danger` es CONTORNO en el rojo vivo `--pulso-danger-solid`
   * (distinto del carmesí de Monitoreo) y va con ícono. `confirm` lo vuelve
   * RELLENO SÓLIDO y se reserva al botón FINAL de confirmación de una acción
   * destructiva (el «Eliminar» del diálogo, no el que lo abre).
   */
  confirm?: boolean;
  size?: PulsoButtonSize;
  "aria-label"?: string;
};

type IconPulsoButtonProps = NativeButtonProps & {
  variant: "icon";
  size?: PulsoButtonSize;
  /**
   * K2 — `remove` para las «×» de quitar: la caja hairline enrojece SOLO al
   * hover. Sale como `data-intent="remove"`.
   */
  intent?: "remove";
  "aria-label": string;
};

export type PulsoButtonProps =
  | StandardPulsoButtonProps
  | DangerPulsoButtonProps
  | IconPulsoButtonProps;

/**
 * **El botón del kit.** Variantes y reglas (spec §4 K2–K4, D13):
 *
 * - `primary` · `secondary` · `ghost`: acento del módulo.
 * - `danger`: contorno rojo vivo + ícono; `confirm` = relleno sólido, solo en
 *   el paso final de confirmación.
 * - `icon` (K2): caja hairline con superficie en reposo (28 px en `sm`/`md`,
 *   36 en `lg` con la escala actual de `--pulso-control-height-*`), más
 *   contraste al hover; `intent="remove"` enrojece solo al hover. Exige
 *   `aria-label`.
 * - `link` (K3): botón de texto SIN subrayado que gana caja al hover; dos
 *   vecinos se separan con un filete fino. Dentro de prosa (`p`) vuelve al
 *   subrayado al hover.
 * - `nav` (K4, en primary/secondary/ghost/link): flecha `ArrowRight` tras el
 *   destino.
 */
export const PulsoButton = forwardRef<HTMLButtonElement, PulsoButtonProps>(
  function PulsoButton(props, ref) {
    const {
      variant,
      size = "md",
      type = "button",
      className,
      children,
      ...rest
    } = props;
    const {
      nav: _nav,
      confirm: _confirm,
      intent: _intent,
      ...buttonProps
    } = rest as typeof rest & { nav?: boolean; confirm?: boolean; intent?: "remove" };
    const nav = props.variant !== "icon" && props.variant !== "danger" && props.nav === true;
    const confirm = props.variant === "danger" && props.confirm === true;
    const intent = props.variant === "icon" ? props.intent : undefined;

    return (
      <button
        {...buttonProps}
        ref={ref}
        type={type}
        data-intent={intent}
        className={[
          "pulso-button",
          `pulso-button--${variant}`,
          `pulso-button--${size}`,
          confirm ? "pulso-button--danger-confirm" : null,
          nav ? "pulso-button--nav" : null,
          className,
        ].filter(Boolean).join(" ")}
      >
        {children}
        {nav ? (
          <ArrowRight
            size={size === "sm" ? 13 : 14}
            className="pulso-button-nav-arrow"
            aria-hidden="true"
          />
        ) : null}
      </button>
    );
  },
);
