import {
  forwardRef,
  type ButtonHTMLAttributes,
} from "react";

export type PulsoButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "icon";

export type PulsoButtonSize = "sm" | "md" | "lg";

type NativeButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "aria-label"
>;

type StandardPulsoButtonProps = NativeButtonProps & {
  variant: Exclude<PulsoButtonVariant, "icon">;
  size?: PulsoButtonSize;
  "aria-label"?: string;
};

type IconPulsoButtonProps = NativeButtonProps & {
  variant: "icon";
  size?: PulsoButtonSize;
  "aria-label": string;
};

export type PulsoButtonProps =
  | StandardPulsoButtonProps
  | IconPulsoButtonProps;

export const PulsoButton = forwardRef<HTMLButtonElement, PulsoButtonProps>(
  function PulsoButton(
    {
      variant,
      size = "md",
      type = "button",
      className,
      ...buttonProps
    },
    ref,
  ) {
    return (
      <button
        {...buttonProps}
        ref={ref}
        type={type}
        className={[
          "pulso-button",
          `pulso-button--${variant}`,
          `pulso-button--${size}`,
          className,
        ].filter(Boolean).join(" ")}
      />
    );
  },
);
