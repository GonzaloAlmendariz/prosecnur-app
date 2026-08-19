import type { ComponentPropsWithoutRef, ReactNode } from "react";

type Props = {
  title?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  noPadding?: boolean;
  variant?: "content" | "subtle";
  className?: string;
} & Omit<ComponentPropsWithoutRef<"section">, "title" | "className" | "children">;

export function Panel({
  title, eyebrow, actions, hint, children, noPadding, variant = "content", className, ...rest
}: Props) {
  const hasHeader = title || eyebrow || actions;
  const classes = [
    "pulso-panel",
    `pulso-panel--${variant}`,
    noPadding ? "pulso-panel--no-padding" : "",
    className,
  ].filter(Boolean).join(" ");
  return (
    <section className={classes} {...rest}>
      {hasHeader && (
        <div className="pulso-panel-header">
          <div className="pulso-panel-heading">
            {eyebrow && <div className="pulso-section-eyebrow">{eyebrow}</div>}
            {title && <h3 className="pulso-panel-title">{title}</h3>}
          </div>
          {actions && <div className="pulso-panel-actions">{actions}</div>}
        </div>
      )}
      {hint && <p className="pulso-panel-hint">{hint}</p>}
      {children}
    </section>
  );
}
