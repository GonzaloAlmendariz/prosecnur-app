/**
 * Tarjeta compacta del reporte metodológico: genera (vía job Quarto) el
 * documento que deja auditable todo el diseño muestral, y exporta el anexo
 * xlsx con la selección de aulas. Las dos generaciones viven en la página
 * (kit de entregables, ADR 0133): aquí los botones sólo se deshabilitan
 * mientras se genera y cada uno lleva debajo su contenedor en bloque con la
 * espera, el archivo o el fallo.
 */
import { FileSpreadsheet, FileText } from "lucide-react";
import { ContenedorEntregable } from "../../../components/entregables/ContenedorEntregable";
import type { EntregaEnPantalla } from "../entregas/modeloEntrega";
import "./didacticaSalidas.css";

export function ReporteMetodologicoCard(props: {
  puedeGenerar: boolean;
  formato: "html" | "pdf";
  onFormato: (f: "html" | "pdf") => void;
  onGenerar: () => void;
  reporte: EntregaEnPantalla;
  aulasListas: boolean;
  onExportarAulas?: () => void;
  anexo?: EntregaEnPantalla;
}) {
  const { puedeGenerar, formato, onFormato, onGenerar, reporte, aulasListas, onExportarAulas, anexo } = props;
  const reporteEnCurso = reporte.estado.fase === "en_curso";
  const anexoEnCurso = anexo?.estado.fase === "en_curso";

  return (
    <div className="cmv2-did-sal-card">
      <span className="cmv2-eyebrow">Reporte metodológico</span>

      {puedeGenerar ? (
        <>
          <div className="cmv2-did-sal-row">
            <div className="cmv2-did-segment" role="group" aria-label="Formato del reporte">
              <button type="button" data-active={formato === "html"} onClick={() => onFormato("html")}>
                HTML
              </button>
              <button type="button" data-active={formato === "pdf"} onClick={() => onFormato("pdf")}>
                PDF
              </button>
            </div>
            <button type="button" className="cmv2-primary" disabled={reporteEnCurso} onClick={onGenerar}>
              <FileText size={14} aria-hidden="true" />
              Generar reporte
            </button>
          </div>
          <ContenedorEntregable estado={reporte.estado} forma="bloque" onCerrar={reporte.onCerrar} />
        </>
      ) : (
        <p className="cmv2-did-note">Calcula la muestra en Cálculo › Propuestas para habilitar el reporte.</p>
      )}

      <div className="cmv2-did-sal-sub">
        <span className="cmv2-eyebrow">Anexo de cursos-horario (xlsx)</span>
        <div className="cmv2-did-sal-row">
          <button
            type="button"
            className="cmv2-ghost"
            disabled={!aulasListas || anexoEnCurso}
            onClick={onExportarAulas}
          >
            <FileSpreadsheet size={14} aria-hidden="true" />
            Exportar selección de cursos-horario
          </button>
        </div>
        {anexo && <ContenedorEntregable estado={anexo.estado} forma="bloque" onCerrar={anexo.onCerrar} />}
      </div>
    </div>
  );
}
