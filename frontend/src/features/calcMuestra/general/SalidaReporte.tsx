import { ExternalLink, FileText, Loader2 } from "lucide-react";

import { motivoReporteDeshabilitado } from "./secciones";
import "./mesa.css";

/** Lo que la página sabe del reporte del estudio (job de Quarto). */
export type ReporteEstudio = {
  /** Componentes con un n calculado; sin ninguno no hay qué reportar. */
  resultados: number;
  enCurso: boolean;
  disponible: boolean;
  /** Enlace al último reporte generado, o null si aún no hay. */
  verUrl: string | null;
  onGenerar: () => void;
};

/**
 * El reporte del diseño vive en Resultados, junto a lo que reporta —como la
 * pestaña Salidas en aulas—, no como atajo en la barra del módulo. Pedido de
 * Gonzalo (2026-09-24): «cada tab y subtab tenia una fucion especificas que no
 * era necesario hacerle bypass». El botón deshabilitado dice por qué a la vista.
 */
export function SalidaReporte({ reporte }: { reporte: ReporteEstudio }) {
  const motivo = reporte.enCurso ? null : motivoReporteDeshabilitado(reporte.resultados);
  return (
    <div className="cmg-reporte" role="group" aria-labelledby="cmg-reporte-titulo">
      <h4 id="cmg-reporte-titulo" className="cmg-reporte-titulo">Reporte del diseño</h4>
      <div className="cmv2-inline-actions">
        <button
          type="button"
          className="cmv2-ghost"
          onClick={() => reporte.onGenerar()}
          disabled={reporte.enCurso || motivo !== null}
          aria-describedby={motivo ? "cmg-reporte-motivo" : undefined}
          aria-busy={reporte.enCurso || undefined}
        >
          {reporte.enCurso
            ? <Loader2 size={14} className="pulso-spin" aria-hidden="true" />
            : <FileText size={14} aria-hidden="true" />}
          {reporte.enCurso ? "Generando reporte…" : reporte.disponible ? "Regenerar reporte" : "Generar reporte"}
        </button>
        {reporte.verUrl && reporte.disponible && (
          <a className="cmv2-link-button" href={reporte.verUrl} target="_blank" rel="noreferrer">
            <ExternalLink size={14} aria-hidden="true" /> Ver reporte
          </a>
        )}
      </div>
      {motivo && <small id="cmg-reporte-motivo" className="cmg-motivo">{motivo}</small>}
    </div>
  );
}
