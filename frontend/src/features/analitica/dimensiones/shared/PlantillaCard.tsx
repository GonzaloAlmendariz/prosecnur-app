import { ArrowRight, type LucideIcon } from "lucide-react";
import type { CSSProperties } from "react";

// Tarjeta grande de plantilla — patrón visual prestado de
// `xlsformEditor/templates/TemplateGallery.tsx`. Accent color top, icono
// en círculo soft, título grande, descripción, lista de highlights,
// stats opcional al pie y CTA en hover.

export function PlantillaCard({
  icon: Icon,
  iconBg,
  iconFg,
  iconBorder,
  accent,
  title,
  blurb,
  highlights,
  stats,
  ctaLabel,
  index,
  onClick,
  loading,
}: {
  // LucideIcon es el tipo nativo del paquete, evita el clash de propTypes
  // que tiene `React.ComponentType<{ size?: number }>` con
  // ForwardRefExoticComponent.
  icon: LucideIcon;
  iconBg: string;
  iconFg: string;
  iconBorder: string;
  accent: string;
  title: string;
  blurb: string;
  highlights: string[];
  stats?: string;
  ctaLabel: string;
  index: number;
  onClick: () => void;
  loading?: boolean;
}) {
  const vars = {
    "--plantilla-accent": accent,
    "--plantilla-icon-bg": iconBg,
    "--plantilla-icon-fg": iconFg,
    "--plantilla-icon-border": iconBorder,
    "--plantilla-delay": `${index * 70}ms`,
  } as CSSProperties;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={`analitica-plantilla-card ${loading ? "is-loading" : ""}`}
      style={vars}
    >
      <div className="analitica-plantilla-card-accent" />
      <div className="analitica-plantilla-card-body">
        <span
          aria-hidden="true"
          className="analitica-plantilla-card-icon"
        >
          <Icon size={26} strokeWidth={1.8} />
        </span>
        <div>
          <h3>
            {title}
          </h3>
          <p>
            {blurb}
          </p>
        </div>
        {highlights.length > 0 && (
          <ul>
            {highlights.map((h, i) => (
              <li key={i}>
                <span aria-hidden="true" />
                <span>{h}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="analitica-plantilla-card-cta">
          <span>{loading ? "Validando…" : ctaLabel}</span>
          <ArrowRight size={14} />
        </div>
        {stats && (
          <div className="analitica-plantilla-card-stats">
            {stats}
          </div>
        )}
      </div>
    </button>
  );
}
