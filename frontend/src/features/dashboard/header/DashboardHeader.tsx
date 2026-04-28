import { useDashboardStore } from "../store";

// Header del Dashboard — solo identidad de marca: logo(s) + título + subtítulo.
// Los botones de administración (Datos / Paletas / Personalizar) viven en
// el AdminToolbar fuera del Dashboard, sobre el header. Esa separación
// permite ocultarlos cuando se exporta el producto final.

export function DashboardHeader() {
  const config = useDashboardStore((s) => s.config);
  const logos = (config.logos ?? []).filter((l) => l && l.data_uri);
  const heightPx = config.logo_height_px ?? 36;

  return (
    <header className="dash-header">
      {logos.length > 0 && (
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
      )}
      <div className="dash-header-copy">
        <h1 className="dash-header-title">
          {config.titulo || "Dashboard"}
        </h1>
        {config.subtitulo && (
          <div className="dash-header-subtitle">
            {config.subtitulo}
          </div>
        )}
      </div>
    </header>
  );
}
