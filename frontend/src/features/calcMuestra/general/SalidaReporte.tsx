import { FileText } from "lucide-react";

import { ContenedorEntregable } from "../../../components/entregables/ContenedorEntregable";
import type { EstadoGeneracion } from "../../../components/entregables/tipos";
import { motivoReporteDeshabilitado } from "./secciones";
import "./mesa.css";

/** Lo que la página sabe del reporte del estudio (job de Quarto, por el kit de entregables). */
export type ReporteEstudio = {
  /** Componentes con un n calculado; sin ninguno no hay qué reportar. */
  resultados: number;
  /** Hay un reporte generado en el backend: el botón dice «Regenerar». */
  disponible: boolean;
  /** La generación en curso, lista o fallida (ADR 0133). */
  estado: EstadoGeneracion;
  onCerrar: () => void;
  onGenerar: () => void;
};

/**
 * El reporte del diseño vive en Resultados, junto a lo que reporta —como la
 * pestaña Salidas en aulas—, no como atajo en la barra del módulo. Pedido de
 * Gonzalo (2026-09-24): «cada tab y subtab tenia una fucion especificas que no
 * era necesario hacerle bypass». El botón deshabilitado dice por qué a la vista.
 * Mientras se genera, el botón sólo se deshabilita; la espera, el archivo y el
 * fallo van en el contenedor del kit, en bloque bajo el botón.
 */
export function SalidaReporte({ reporte }: { reporte: ReporteEstudio }) {
  const enCurso = reporte.estado.fase === "en_curso";
  const motivo = enCurso ? null : motivoReporteDeshabilitado(reporte.resultados);
  return (
    <div className="cmg-reporte" role="group" aria-labelledby="cmg-reporte-titulo">
      <h4 id="cmg-reporte-titulo" className="cmg-reporte-titulo">Reporte del diseño</h4>
      <div className="cmv2-inline-actions">
        <button
          type="button"
          className="cmv2-ghost"
          onClick={() => reporte.onGenerar()}
          disabled={enCurso || motivo !== null}
          aria-describedby={motivo ? "cmg-reporte-motivo" : undefined}
        >
          <FileText size={14} aria-hidden="true" />
          {reporte.disponible ? "Regenerar reporte" : "Generar reporte"}
        </button>
      </div>
      {motivo && <small id="cmg-reporte-motivo" className="cmg-motivo">{motivo}</small>}
      <ContenedorEntregable estado={reporte.estado} forma="bloque" onCerrar={reporte.onCerrar} />
    </div>
  );
}
