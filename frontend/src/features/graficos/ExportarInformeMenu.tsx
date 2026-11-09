// Menú «Exportar ▾» del informe (PowerPoint y Word). Extraído de GraficosHeader (F6.1, parte 2) para que lo usen tanto
// la barra del Editor anterior como la barra de la pestaña Láminas, con el mismo comportamiento.
//
// La espera y el resultado van en el contenedor de entregables, en forma «anclada» (ADR 0133, fase 4): al elegir
// un formato el menú se cierra y el contenedor queda colgado del disparador con la fase del job y «Cancelar»; el
// resultado se ve ahí mismo sin reabrir el menú. Sin diálogo de guardado: el archivo ya quedó en
// `Entregables\<Módulo>` o se descargó; «Guardar como…» vive en «Más» del contenedor.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronDown, Database, Download, FileText } from "../../vendor/lucide-react";
import { PulsoButton } from "../../components/PulsoButton";
import { ContenedorEntregable } from "../../components/entregables/ContenedorEntregable";
import type { Generacion } from "../../components/entregables/useGeneracion";
import { ColoresPendientesAviso, ID_COLORES_PENDIENTES, useColoresPendientes } from "./estilo/ColoresPendientesAviso";
import { puedeGenerarInforme } from "./exportarInformeRegla";
import "./kitEnLaBarra.css";

export type ExportarInformeMenuProps = {
  onExportPpt: () => void;
  onExportWord: () => void;
  /** La exportación en curso o su resultado (`useGeneracion` de GraficosPage). */
  generacion: Pick<Generacion, "estado" | "cerrar">;
  /** Acción extra al pie del contenedor cuando la exportación falla (p. ej. ir a la lámina que la detuvo). */
  pieDelFallo?: ReactNode;
  /** El padre lo permite Y el validador del plan no tiene errores. */
  canExportFinal: boolean;
  isSharedReport: boolean;
  prepBlocked: boolean;
};

export function ExportarInformeMenu({
  onExportPpt, onExportWord, generacion, pieDelFallo, canExportFinal, isSharedReport, prepBlocked,
}: ExportarInformeMenuProps) {
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const exportBusy = generacion.estado.fase === "en_curso";
  // P8: un gráfico que pinta cada respuesta con su color no se exporta con respuestas sin color (exportarInformeRegla.ts).
  const { pendientes: coloresPendientes, completar: completarColores } = useColoresPendientes();
  const puedeGenerar = puedeGenerarInforme({ planSinErrores: canExportFinal, coloresPendientes: coloresPendientes.length });

  useEffect(() => {
    if (!exportMenuOpen) return;
    function onDocMouseDown(e: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) setExportMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setExportMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [exportMenuOpen]);

  function elegir(exportar: () => void) {
    setExportMenuOpen(false);
    generacion.cerrar();
    exportar();
  }

  return (
    <>
          {prepBlocked ? (
            <Link
              to="/analitica"
              className="pulso-primary pulso-gv2-pill-button pulso-gv2-pill-button--primary pulso-gv2-export-menu-trigger pulso-gv2-prepare-trigger"
              title="Preparar la base en Analítica"
            >
              <Database size={13} />
              <span>Preparar</span>
              <ArrowRight size={13} />
            </Link>
          ) : (
            <div className="pulso-gv2-export-menu" ref={exportMenuRef}>
              <PulsoButton
                variant="primary"
                className="pulso-gv2-export-menu-trigger"
                onClick={() => setExportMenuOpen((v) => !v)}
                disabled={!canExportFinal || exportBusy}
                // Mientras exporta, el disparador solo se deshabilita: conserva rótulo y forma (a ≤1180 px el
                // `:disabled` sin exportación se compacta a ícono, editor-v2.css).
                data-exportando={exportBusy ? "true" : undefined}
                aria-haspopup="dialog"
                aria-expanded={exportMenuOpen}
                title={!canExportFinal ? "Revisa el estado del plan antes de exportar"
                  : coloresPendientes.length ? "Faltan colores: complétalos para exportar"
                  : isSharedReport ? "Exportar el informe compartido en PowerPoint" : "Exportar el reporte en PowerPoint o Word"}
              >
                <Download size={14} aria-hidden="true" />
                <span>Exportar</span>
                <ChevronDown size={14} aria-hidden="true" />
              </PulsoButton>

              {exportMenuOpen && (
                <div className="pulso-gv2-export-menu-popover" role="dialog" aria-label="Exportar reporte">
                  <div className="pulso-gv2-export-menu-head">
                    <span className="pulso-gv2-export-menu-mark" aria-hidden="true">
                      <Download size={15} />
                    </span>
                    <div>
                      <strong>{isSharedReport ? "Exportar informe compartido" : "Exportar reporte"}</strong>
                      <span>{isSharedReport ? "Genera el PPTX conjunto de todas las fuentes." : "Elige el archivo final que necesitas generar."}</span>
                    </div>
                  </div>

                  {/* El motivo y el arreglo en un clic antes de las acciones que deshabilita (P8, U9). */}
                  <ColoresPendientesAviso pendientes={coloresPendientes} onCompletar={completarColores} onVer={() => setExportMenuOpen(false)} />

                  <div className="pulso-gv2-export-menu-actions">
                    <button
                      type="button"
                      onClick={() => elegir(onExportPpt)}
                      disabled={!puedeGenerar || exportBusy}
                      aria-describedby={coloresPendientes.length ? ID_COLORES_PENDIENTES : undefined}
                    >
                      <span className="pulso-gv2-export-menu-action-icon" aria-hidden="true">
                        <FileText size={14} />
                      </span>
                      <span>
                        <strong>PowerPoint</strong>
                        <small>PPTX editable</small>
                      </span>
                    </button>
                    {!isSharedReport && <button
                      type="button"
                      onClick={() => elegir(onExportWord)}
                      disabled={!puedeGenerar || exportBusy}
                      aria-describedby={coloresPendientes.length ? ID_COLORES_PENDIENTES : undefined}
                    >
                      <span className="pulso-gv2-export-menu-action-icon" aria-hidden="true">
                        <FileText size={14} />
                      </span>
                      <span>
                        <strong>Word</strong>
                        <small>DOCX narrativo</small>
                      </span>
                    </button>}
                  </div>

                </div>
              )}

              <ContenedorEntregable
                estado={generacion.estado}
                forma="anclada"
                onCerrar={generacion.cerrar}
                pie={generacion.estado.fase === "fallo" ? pieDelFallo : undefined}
              />
            </div>
          )}

    </>
  );
}
