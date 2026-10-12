// Menú «Exportar ▾» del informe (PowerPoint y Word) con el guardado al lado del proyecto. Extraído de GraficosHeader
// (F6.1, parte 2) para que lo usen tanto la barra del Editor anterior como la barra de la pestaña Láminas, con el
// mismo comportamiento: un solo lugar decide qué se exporta, qué se guarda y qué se avisa.

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, ChevronDown, Database, Download, FileText, Loader2 } from "../../vendor/lucide-react";
import { apiSaveFileAs, downloadUrl } from "../../api/client";
import { useProjectShell } from "../project/ProjectShell";
import { ColoresPendientesAviso, useColoresPendientes } from "./estilo/ColoresPendientesAviso";

export type ExportarInformeMenuProps = {
  onExportPpt: () => void;
  onExportWord: () => void;
  pptFileId: string | null;
  docxFileId: string | null;
  pptFilename: string | null;
  docxFilename: string | null;
  exportBusy: boolean;
  exportJobKind: "ppt" | "word" | null;
  /** El padre lo permite Y el validador del plan no tiene errores. */
  canExportFinal: boolean;
  isSharedReport: boolean;
  prepBlocked: boolean;
};

// Archivos cuyo diálogo de guardado ya se ofreció. Vive fuera del componente: al cambiar de pestaña el menú se
// vuelve a montar y no debe volver a ofrecer guardar un archivo que ya se ofreció.
const ofrecidos = new Set<string>();

export function ExportarInformeMenu({
  onExportPpt, onExportWord, pptFileId, docxFileId, pptFilename, docxFilename,
  exportBusy, exportJobKind, canExportFinal, isSharedReport, prepBlocked,
}: ExportarInformeMenuProps) {
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const { project } = useProjectShell();
  const [saveStatus, setSaveStatus] = useState("");
  const generatedReports = Number(Boolean(pptFileId)) + Number(Boolean(!isSharedReport && docxFileId));
  // P8: un gráfico que pinta cada respuesta con su color no se exporta con respuestas sin color.
  const { pendientes: coloresPendientes, completar: completarColores } = useColoresPendientes();
  const puedeGenerar = canExportFinal && coloresPendientes.length === 0;

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

  useEffect(() => {
    const candidate = [
      { fileId: pptFileId, filename: pptFilename ?? "reporte.pptx" },
      { fileId: docxFileId, filename: docxFilename ?? "reporte.docx" },
    ].find((item) => item.fileId && !ofrecidos.has(item.fileId));
    if (!candidate?.fileId || exportBusy || !window.prosecnurApi) return;
    const fileId = candidate.fileId;
    const filename = candidate.filename;
    ofrecidos.add(fileId);
    const ext = filename.split(".").pop() || "*";
    const defaultPath = project.status.path
      ? (() => {
          const sep = project.status.path!.includes("\\") ? "\\" : "/";
          return `${project.status.path!.replace(/[/\\][^/\\]+$/, "")}${sep}${filename}`;
        })()
      : undefined;
    let cancelled = false;
    async function saveGeneratedReport() {
      try {
        const target = await window.prosecnurApi!.saveEntregableDialog({
          defaultName: filename,
          defaultPath,
          filters: [{ name: ext.toUpperCase(), extensions: [ext] }, { name: "Todos", extensions: ["*"] }],
        });
        if (!target || cancelled) return;
        const saved = await apiSaveFileAs(fileId, target, { overwrite: true });
        if (!cancelled) setSaveStatus(`Guardado como ${saved.filename}`);
      } catch (e) {
        if (!cancelled) {
          ofrecidos.delete(fileId);
          setSaveStatus((e as Error).message);
        }
      }
    }
    void saveGeneratedReport();
    return () => { cancelled = true; };
  }, [pptFileId, docxFileId, pptFilename, docxFilename, exportBusy, project.status.path]);

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
              <button
                type="button"
                className="pulso-primary pulso-gv2-pill-button pulso-gv2-pill-button--primary pulso-gv2-export-menu-trigger"
                onClick={() => setExportMenuOpen((v) => !v)}
                disabled={!canExportFinal && !pptFileId && (isSharedReport || !docxFileId)}
                aria-haspopup="dialog"
                aria-expanded={exportMenuOpen}
                title={canExportFinal
                  ? isSharedReport ? "Exportar el informe compartido en PowerPoint" : "Exportar el reporte en PowerPoint o Word"
                  : "Revisa el estado del plan antes de exportar"}
              >
                {exportBusy ? <Loader2 size={13} className="pulso-spin" /> : <Download size={13} />}
                <span>Exportar</span>
                {generatedReports > 0 && <b>{generatedReports}</b>}
                <ChevronDown size={13} />
              </button>

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

                  {!canExportFinal && (
                    <div className="pulso-gv2-export-menu-warning">
                      Revisa el estado del plan antes de generar archivos.
                    </div>
                  )}
                  <ColoresPendientesAviso pendientes={coloresPendientes} onCompletar={completarColores} onVer={() => setExportMenuOpen(false)} />

                  <div className="pulso-gv2-export-menu-actions">
                    <button
                      type="button"
                      onClick={() => {
                        setExportMenuOpen(false);
                        onExportPpt();
                      }}
                      disabled={!puedeGenerar || exportBusy}
                    >
                      <span className="pulso-gv2-export-menu-action-icon" aria-hidden="true">
                        {exportJobKind === "ppt" ? <Loader2 size={14} className="pulso-spin" /> : <FileText size={14} />}
                      </span>
                      <span>
                        <strong>PowerPoint</strong>
                        <small>PPTX editable</small>
                      </span>
                    </button>
                    {!isSharedReport && <button
                      type="button"
                      onClick={() => {
                        setExportMenuOpen(false);
                        onExportWord();
                      }}
                      disabled={!puedeGenerar || exportBusy}
                    >
                      <span className="pulso-gv2-export-menu-action-icon" aria-hidden="true">
                        {exportJobKind === "word" ? <Loader2 size={14} className="pulso-spin" /> : <FileText size={14} />}
                      </span>
                      <span>
                        <strong>Word</strong>
                        <small>DOCX narrativo</small>
                      </span>
                    </button>}
                  </div>

                  {(pptFileId || docxFileId || saveStatus) && (
                    <div className="pulso-gv2-export-menu-files">
                      {pptFileId && !exportBusy && (
                        <a href={downloadUrl(pptFileId)}>
                          <Download size={12} /> {pptFilename ?? "reporte.pptx"}
                        </a>
                      )}
                      {!isSharedReport && docxFileId && !exportBusy && (
                        <a href={downloadUrl(docxFileId)}>
                          <Download size={12} /> {docxFilename ?? "reporte.docx"}
                        </a>
                      )}
                      {saveStatus && (
                        <span className={saveStatus.startsWith("[") || /\s·\s(?:E_|HTTP_)[A-Z0-9_]+$/.test(saveStatus) ? "is-error" : "is-ok"}>
                          {!(saveStatus.startsWith("[") || /\s·\s(?:E_|HTTP_)[A-Z0-9_]+$/.test(saveStatus)) && <CheckCircle2 size={12} />}
                          {saveStatus}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

    </>
  );
}
