/**
 * Tarjeta compacta del reporte metodológico: genera (vía job Quarto) el
 * documento que deja auditable todo el diseño muestral, y exporta el anexo
 * xlsx con la selección de aulas. Los estados (generable, en curso,
 * disponible) los decide el contenedor; aquí solo se presentan.
 */
import { FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import "./didacticaSalidas.css";

export function ReporteMetodologicoCard(props: {
  puedeGenerar: boolean;
  enCurso: boolean;
  disponible: boolean;
  formato: "html" | "pdf";
  onFormato: (f: "html" | "pdf") => void;
  onGenerar: () => void;
  descargarUrl: string | null;
  aulasListas: boolean;
  exportandoAulas: boolean;
  onExportarAulas?: () => void;
  aulasExportFilename?: string | null;
}) {
  const {
    puedeGenerar,
    enCurso,
    disponible,
    formato,
    onFormato,
    onGenerar,
    descargarUrl,
    aulasListas,
    exportandoAulas,
    onExportarAulas,
    aulasExportFilename,
  } = props;

  return (
    <div className="cmv2-did-sal-card">
      <span className="cmv2-eyebrow">Reporte metodológico</span>
      <p className="cmv2-did-note">
        El reporte documenta todo el diseño —parámetros, fórmula, distribución y selección de aulas— para que
        cualquier revisor pueda auditarlo.
      </p>

      {puedeGenerar ? (
        <div className="cmv2-did-sal-row">
          <div className="cmv2-did-segment" role="group" aria-label="Formato del reporte">
            <button type="button" data-active={formato === "html"} onClick={() => onFormato("html")}>
              HTML
            </button>
            <button type="button" data-active={formato === "pdf"} onClick={() => onFormato("pdf")}>
              PDF
            </button>
          </div>
          <button type="button" className="cmv2-primary" disabled={!puedeGenerar || enCurso} onClick={onGenerar}>
            {enCurso ? <Loader2 size={14} className="cmv2-spin" aria-hidden="true" /> : <FileText size={14} aria-hidden="true" />}
            {enCurso ? "Generando…" : "Generar reporte"}
          </button>
          {disponible && descargarUrl && (
            <a className="cmv2-ghost" href={descargarUrl} target="_blank" rel="noreferrer">
              Ver reporte
            </a>
          )}
        </div>
      ) : (
        <p className="cmv2-did-note">Calcula la muestra en el paso 3 para habilitar el reporte.</p>
      )}

      <div className="cmv2-did-sal-sub">
        <span className="cmv2-eyebrow">Anexo de aulas (xlsx)</span>
        <div className="cmv2-did-sal-row">
          <button
            type="button"
            className="cmv2-ghost"
            disabled={!aulasListas || exportandoAulas}
            onClick={onExportarAulas}
          >
            {exportandoAulas ? (
              <Loader2 size={14} className="cmv2-spin" aria-hidden="true" />
            ) : (
              <FileSpreadsheet size={14} aria-hidden="true" />
            )}
            {exportandoAulas ? "Exportando…" : "Exportar selección de aulas"}
          </button>
          {aulasExportFilename && <span className="cmv2-did-sal-file">{aulasExportFilename}</span>}
        </div>
      </div>
    </div>
  );
}
