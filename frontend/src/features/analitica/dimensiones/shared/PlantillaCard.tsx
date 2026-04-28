import { ArrowRight, type LucideIcon } from "lucide-react";

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
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      style={{
        position: "relative",
        textAlign: "left",
        background: "white",
        border: "1px solid var(--pulso-border)",
        borderRadius: 14,
        padding: 0,
        overflow: "hidden",
        boxShadow: "var(--pulso-shadow-low)",
        cursor: loading ? "wait" : "pointer",
        opacity: loading ? 0.6 : 1,
        // Stagger entrance: cada card aparece con delay según su índice.
        animation: `pulso-lens-slide-in-kf var(--anim-dur-long) var(--anim-ease-expressive) both`,
        animationDelay: `${index * 70}ms`,
        transition:
          "transform var(--anim-dur-short) var(--anim-ease-smooth), box-shadow var(--anim-dur-short) var(--anim-ease-smooth), border-color var(--anim-dur-short) var(--anim-ease-smooth)",
      }}
      onMouseEnter={(e) => {
        if (loading) return;
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "var(--pulso-shadow-med)";
        e.currentTarget.style.borderColor = accent;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "var(--pulso-shadow-low)";
        e.currentTarget.style.borderColor = "var(--pulso-border)";
      }}
    >
      <div
        style={{
          height: 5,
          background: accent,
          width: "100%",
        }}
      />
      <div style={{ padding: "20px 22px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
        <span
          aria-hidden="true"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 48,
            height: 48,
            borderRadius: 12,
            background: iconBg,
            color: iconFg,
            border: `1px solid ${iconBorder}`,
          }}
        >
          <Icon size={26} strokeWidth={1.8} />
        </span>
        <div>
          <h3
            style={{
              margin: 0,
              fontSize: 17,
              fontWeight: 800,
              color: "var(--pulso-text)",
              lineHeight: 1.25,
            }}
          >
            {title}
          </h3>
          <p
            style={{
              margin: "6px 0 0 0",
              fontSize: 12,
              color: "var(--pulso-text-soft)",
              lineHeight: 1.5,
            }}
          >
            {blurb}
          </p>
        </div>
        {highlights.length > 0 && (
          <ul
            style={{
              margin: 0,
              padding: 0,
              listStyle: "none",
              display: "flex",
              flexDirection: "column",
              gap: 4,
              fontSize: 11,
              color: "var(--pulso-text-soft)",
            }}
          >
            {highlights.map((h, i) => (
              <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                <span
                  aria-hidden="true"
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: 999,
                    background: accent,
                    marginTop: 7,
                    flexShrink: 0,
                  }}
                />
                <span>{h}</span>
              </li>
            ))}
          </ul>
        )}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            paddingTop: 6,
            borderTop: "1px solid var(--pulso-border-soft, #eef0f5)",
            fontSize: 12,
            fontWeight: 700,
            color: accent,
          }}
        >
          <span style={{ flex: 1 }}>{loading ? "Validando…" : ctaLabel}</span>
          <ArrowRight size={14} />
        </div>
        {stats && (
          <div style={{ fontSize: 10, color: "var(--pulso-text-soft)", letterSpacing: 0.3 }}>
            {stats}
          </div>
        )}
      </div>
    </button>
  );
}
