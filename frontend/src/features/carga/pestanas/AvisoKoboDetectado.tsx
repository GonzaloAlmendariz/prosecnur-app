import { CloudDownload, Loader2 } from "../../../vendor/lucide-react";
import { faseTerritorialLabel, type DetectedKoboSource } from "./cargaPaginaModelo";

export function DetectedKoboSourceCallout({
  source,
  busy,
  hasConnection,
  compact = false,
  onImport,
  onReview,
}: {
  source: DetectedKoboSource;
  busy: boolean;
  hasConnection: boolean;
  compact?: boolean;
  onImport: () => void;
  onReview: () => void;
}) {
  return (
    <section
      className={`pulso-kobo-detected is-from-monitoreo${compact ? " is-compact" : ""}`}
      aria-label="Instrumento detectado desde Monitoreo"
    >
      <span className="pulso-kobo-detected-icon" aria-hidden="true">
        <CloudDownload size={16} />
      </span>
      <div className="pulso-kobo-detected-copy">
        <span className="pulso-kobo-detected-origin">Detectado desde Monitoreo</span>
        <strong>{source.name || source.source_title || source.asset_uid}</strong>
        <span className="pulso-kobo-detected-meta">
          {faseTerritorialLabel(source.phase) ? (
            <em className="pulso-kobo-detected-fase">{faseTerritorialLabel(source.phase)}</em>
          ) : null}
          {source.base_url ? (
            <span className="pulso-kobo-detected-host">{source.base_url.replace(/^https?:\/\//, "")}</span>
          ) : null}
        </span>
      </div>
      <div className="pulso-kobo-detected-actions">
        <button
          type="button"
          className="pulso-kobo-detected-secondary"
          onClick={onReview}
          disabled={busy}
        >
          Revisar
        </button>
        <button
          type="button"
          className="pulso-kobo-detected-primary"
          onClick={onImport}
          disabled={busy || !hasConnection}
          title={hasConnection ? "Importar fuente Kobo detectada" : "Conecta KoboToolbox en Configuración"}
        >
          {busy ? <Loader2 size={14} className="pulso-spin" /> : <CloudDownload size={14} />}
          Importar fuente detectada
        </button>
      </div>
    </section>
  );
}
