import type { ReactNode } from "react";

type Props = {
  title?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  noPadding?: boolean;
};

export function Panel({ title, eyebrow, actions, hint, children, noPadding }: Props) {
  const hasHeader = title || eyebrow || actions;
  return (
    <section className="pulso-panel" style={noPadding ? { padding: 0 } : undefined}>
      {hasHeader && (
        <div className="pulso-panel-header">
          <div>
            {eyebrow && <div className="pulso-section-eyebrow">{eyebrow}</div>}
            {title && <h3 className="pulso-panel-title">{title}</h3>}
          </div>
          {actions && <div style={{ display: "flex", gap: 8, alignItems: "center" }}>{actions}</div>}
        </div>
      )}
      {hint && <p className="pulso-panel-hint">{hint}</p>}
      {children}
    </section>
  );
}
