import type { ReactNode } from "react";
import "./kit.css";

// Contenedor canónico del módulo: cabecera (título + meta/acciones), cuerpo y pie opcional.
// `fill` lo deja crecer hasta llenar la columna (el último contenedor de cada pantalla),
// pero nunca encoger por debajo de su contenido: es lo que evitaba los recortes del canvas.

export type PanelCardProps = {
  title: ReactNode;
  icon?: ReactNode;
  meta?: ReactNode;
  footer?: ReactNode;
  fill?: boolean;
  flush?: boolean;
  className?: string;
  children?: ReactNode;
  "aria-label"?: string;
};

export function PanelCard({ title, icon, meta, footer, fill, flush, className, children, ...rest }: PanelCardProps) {
  const cls = ["xfk-card", fill ? "xfk-card--fill" : "", className ?? ""].filter(Boolean).join(" ");
  return (
    <section className={cls} aria-label={rest["aria-label"]}>
      <header className="xfk-card__head">
        <span className="xfk-card__title">
          {icon}
          {title}
        </span>
        {meta ? <span className="xfk-card__meta">{meta}</span> : null}
      </header>
      <div className={flush ? "xfk-card__body xfk-card__body--flush" : "xfk-card__body"} data-qa-geometry-group="xlsform/card-cuerpo" data-qa-geometry-contract="intrinsic">{children}</div>
      {footer ? <footer className="xfk-card__foot">{footer}</footer> : null}
    </section>
  );
}
