import { Palette, Settings, UploadCloud } from "lucide-react";
import { useDashboardStore } from "../store";

// Header del Dashboard. v1 (Fase 2): solo título/subtítulo + logo
// (si existe) + botón Personalizar (deshabilitado hasta Fase 3 que
// implementa el drawer). Sin acciones Recargar/Publicar todavía
// (esas vienen en sus fases respectivas).

export function DashboardHeader({
  onPersonalizarClick,
  onImportarClick,
  onPaletasClick,
}: {
  onPersonalizarClick?: () => void;
  onImportarClick?: () => void;
  onPaletasClick?: () => void;
}) {
  const config = useDashboardStore((s) => s.config);

  return (
    <header className="dash-header">
      {config.logo_data_uri && (
        <img
          src={config.logo_data_uri}
          alt={config.logo_alt}
          className="dash-header-logo"
          style={{ height: config.logo_height_px }}
        />
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
      <div className="dash-header-actions">
        <button
          type="button"
          onClick={onImportarClick}
          disabled={!onImportarClick}
          title="Cambiar XLSForm y data del dashboard"
          className="dash-header-action"
        >
          <UploadCloud size={14} /> Datos
        </button>
        <button
          type="button"
          onClick={onPaletasClick}
          disabled={!onPaletasClick}
          title="Paletas de colores por lista"
          className="dash-header-action"
        >
          <Palette size={14} /> Paletas
        </button>
        <button
          type="button"
          onClick={onPersonalizarClick}
          disabled={!onPersonalizarClick}
          title="Personalizar apariencia (logo, paleta, título)"
          className="dash-header-action"
        >
          <Settings size={14} /> Personalizar
        </button>
      </div>
    </header>
  );
}
