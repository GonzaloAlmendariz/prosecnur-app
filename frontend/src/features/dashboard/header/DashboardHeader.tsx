import { useDashboardStore } from "../store";

// Franja compacta de marca. No renderiza título/subtítulo: la identidad del
// proyecto no debe ocupar una fila introductoria en el workbench.

export function DashboardHeader() {
  const config = useDashboardStore((s) => s.config);
  const logos = (config.logos ?? []).filter((l) => l && l.data_uri);
  const heightPx = config.logo_height_px ?? 36;

  if (logos.length === 0) return null;

  return (
    <header className="dash-header">
      <div className="dash-header-logos" style={{ ["--dash-logo-h" as never]: `${heightPx}px` }}>
        {logos.map((logo, i) => (
          <img
            key={i}
            src={logo.data_uri}
            alt={logo.alt || `Logo ${i + 1}`}
            className="dash-header-logo"
            style={{ height: heightPx }}
          />
        ))}
      </div>
    </header>
  );
}
