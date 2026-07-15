// =============================================================================
// shell/ConfigurarPdfDialog.tsx — diálogo "Configurar PDF" del editor XLSForm
// =============================================================================
// Reemplaza al split-button + popover apretado por un diálogo modal amplio con
// tres secciones claras: Formato (columnas + N.º de cuestionario), Lógica
// (saltos/condiciones) y Matrices (por candidato: toggle + tenor + columna
// especial). El principio es control explícito del usuario con microcopy corto:
// se exponen todas las opciones de forma discoverable, sin clutter de "metadata
// detectada".
//
// El estado de la preferencia (columnas / lógica / N.º / matrices desactivadas /
// tenor / columna especial) vive en este componente, que se mantiene MONTADO
// aunque esté cerrado (renderiza `null` con `open=false`) para que las
// elecciones sobrevivan a abrir/cerrar dentro de una sesión de edición.
//
// La lógica pura de armado del payload sigue en `pdfExportPreference.ts`
// (`buildMatrixGroups`) y la detección en `parsing/detectMatrixCandidates.ts`;
// aquí solo se presenta y se recolecta la elección del usuario.
//
// Overlay a z-index 1400 (por encima del chrome del módulo, `pulso-page-frame-
// toolbar` es z-1000), tokens `--pulso-*` y clases `.pulso-xf-pdf-dialog-*`;
// iconos lucide vía el shim compartido.
// =============================================================================

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Columns2, FileText, GitBranch, Grid3x3, Route, ShieldCheck, Square, Table2, X } from "../../../vendor/lucide-react";
import type { MatrixCandidate } from "../parsing/detectMatrixCandidates";
import type { ConsentQuestion } from "../parsing/detectConsentQuestions";
import {
  DEFAULT_PDF_EXPORT_PREFERENCE,
  buildMatrixGroups,
  type MatrixGroupPayload,
  type PdfColumns,
  type PdfLogicLanguage,
  type PdfMatrixLayout,
} from "./pdfExportPreference";

export type ConfigurarPdfDialogProps = {
  open: boolean;
  onClose: () => void;
  onExport: (
    columns: PdfColumns,
    logicLanguage: PdfLogicLanguage,
    showQuestionnaireNumber: boolean,
    matrixGroups: MatrixGroupPayload[],
    matrixLayout: PdfMatrixLayout,
    consentVar: string | null,
  ) => void;
  matrixCandidates?: MatrixCandidate[];
  /** Preguntas candidatas a variable de consentimiento (select_one/acknowledge). */
  consentQuestions?: ConsentQuestion[];
  /** Nombre del formulario/archivo, mostrado como subtítulo si viene. */
  fileName?: string | null;
  /** Bloquea el botón de exportar mientras hay un job en curso. */
  busy?: boolean;
};

/** Etiqueta corta de las preguntas de una matriz: «primera» +N. */
function matrixQuestionsSummary(candidate: MatrixCandidate): string {
  const first = candidate.questionLabels[0] ?? candidate.memberNames[0] ?? "pregunta";
  const shortFirst = first.length > 40 ? `${first.slice(0, 39)}…` : first;
  const extra = candidate.count - 1;
  return extra > 0 ? `«${shortFirst}» +${extra}` : `«${shortFirst}»`;
}

export function ConfigurarPdfDialog({
  open,
  onClose,
  onExport,
  matrixCandidates = [],
  consentQuestions = [],
  fileName,
  busy = false,
}: ConfigurarPdfDialogProps) {
  const [columns, setColumns] = useState<PdfColumns>(DEFAULT_PDF_EXPORT_PREFERENCE.columns);
  const [logicLanguage, setLogicLanguage] = useState<PdfLogicLanguage>(
    DEFAULT_PDF_EXPORT_PREFERENCE.logicLanguage,
  );
  const [showQuestionnaireNumber, setShowQuestionnaireNumber] = useState<boolean>(
    DEFAULT_PDF_EXPORT_PREFERENCE.showQuestionnaireNumber,
  );
  // Ancho de las tablas de matriz (GLOBAL): "full" (default) / "column".
  const [matrixLayout, setMatrixLayout] = useState<PdfMatrixLayout>("full");
  // Ids de candidatos DESACTIVADOS (default = todos activos, set vacío).
  const [disabledMatrixIds, setDisabledMatrixIds] = useState<Set<string>>(() => new Set());
  // Tenor (enunciado guía) por candidato: map id→texto. Vacío = sin tenor.
  const [tenorById, setTenorById] = useState<Record<string, string>>({});
  // Columna especial por candidato: map id→valor. Ausente/"auto" = heurística
  // del motor (no se anuncia como metadata detectada).
  const [specialById, setSpecialById] = useState<Record<string, string>>({});
  // Cabecera por candidato: map id→"auto"|"extremos"|"categorias". Ausente/
  // "auto" = el motor decide (se omite del payload).
  const [headerById, setHeaderById] = useState<Record<string, string>>({});
  // Variable de consentimiento (name de la pregunta) o "" = ninguna.
  const [consentVar, setConsentVar] = useState<string>("");

  // Cerrar con Escape (salvo mientras se exporta).
  useEffect(() => {
    if (!open) return;
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [open, busy, onClose]);

  if (!open) return null;

  function toggleMatrix(id: string) {
    setDisabledMatrixIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exportNow() {
    const groups = buildMatrixGroups(
      matrixCandidates,
      disabledMatrixIds,
      tenorById,
      specialById,
      headerById,
    );
    const consent = consentVar.trim() ? consentVar.trim() : null;
    onExport(columns, logicLanguage, showQuestionnaireNumber, groups, matrixLayout, consent);
    onClose();
  }

  // Se porta a `document.body` para escapar de los ancestros con `transform`
  // (el chrome del módulo, `pulso-page-frame-toolbar`, crea contexto de apilado
  // y recorta un `position: fixed` interno). Mismo patrón que Coachmarks /
  // DiagnosticsPopover / FormSimulator.
  return createPortal(
    <div
      className="pulso-xf-pdf-dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pulso-xf-pdf-dialog-title"
      onMouseDown={(e) => {
        // Cerrar al hacer click fuera del panel (no mientras se exporta).
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="pulso-xf-pdf-dialog">
        <header className="pulso-xf-pdf-dialog-head">
          <span className="pulso-xf-pdf-dialog-badge" aria-hidden="true">
            <FileText size={18} />
          </span>
          <div className="pulso-xf-pdf-dialog-heading">
            <h2 id="pulso-xf-pdf-dialog-title">Configurar PDF</h2>
            {fileName ? <p className="pulso-xf-pdf-dialog-sub">{fileName}</p> : null}
          </div>
          <button
            type="button"
            className="pulso-xf-pdf-dialog-close"
            onClick={onClose}
            disabled={busy}
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </header>

        <div className="pulso-xf-pdf-dialog-body">
          {/* ── Formato ─────────────────────────────────────────────── */}
          <section className="pulso-xf-pdf-section">
            <h3 className="pulso-xf-pdf-section-title">Formato</h3>
            <div className="pulso-xf-pdf-field">
              <span className="pulso-xf-pdf-field-label">Columnas</span>
              <div className="pulso-xf-pdf-cards" role="radiogroup" aria-label="Columnas">
                <button
                  type="button"
                  role="radio"
                  aria-checked={columns === 1}
                  className={`pulso-xf-pdf-card${columns === 1 ? " is-active" : ""}`}
                  onClick={() => setColumns(1)}
                >
                  <span className="pulso-xf-pdf-card-icon"><Square size={18} /></span>
                  <span className="pulso-xf-pdf-card-text">
                    <strong>Una columna</strong>
                    <em>Preguntas a lo ancho de la página.</em>
                  </span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={columns === 2}
                  className={`pulso-xf-pdf-card${columns === 2 ? " is-active" : ""}`}
                  onClick={() => setColumns(2)}
                >
                  <span className="pulso-xf-pdf-card-icon"><Columns2 size={18} /></span>
                  <span className="pulso-xf-pdf-card-text">
                    <strong>Dos columnas</strong>
                    <em>Compacto, más preguntas por hoja.</em>
                  </span>
                </button>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={showQuestionnaireNumber}
              className={`pulso-xf-pdf-switch-row${showQuestionnaireNumber ? " is-on" : ""}`}
              onClick={() => setShowQuestionnaireNumber((v) => !v)}
            >
              <span className="pulso-xf-pdf-switch-text">
                <strong>Número de cuestionario</strong>
                <em>Imprime los recuadros de N.º en la cabecera.</em>
              </span>
              <span className="pulso-xf-pdf-switch" aria-hidden="true">
                <span className="pulso-xf-pdf-switch-thumb" />
              </span>
            </button>
            <div className="pulso-xf-pdf-field">
              <span className="pulso-xf-pdf-field-label">Ancho de matrices</span>
              <div className="pulso-xf-pdf-cards" role="radiogroup" aria-label="Ancho de matrices">
                <button
                  type="button"
                  role="radio"
                  aria-checked={matrixLayout === "full"}
                  className={`pulso-xf-pdf-card${matrixLayout === "full" ? " is-active" : ""}`}
                  onClick={() => setMatrixLayout("full")}
                >
                  <span className="pulso-xf-pdf-card-icon"><Table2 size={18} /></span>
                  <span className="pulso-xf-pdf-card-text">
                    <strong>Ancho completo</strong>
                    <em>Las tablas ocupan todo el ancho de la página.</em>
                  </span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={matrixLayout === "column"}
                  className={`pulso-xf-pdf-card${matrixLayout === "column" ? " is-active" : ""}`}
                  onClick={() => setMatrixLayout("column")}
                >
                  <span className="pulso-xf-pdf-card-icon"><Columns2 size={18} /></span>
                  <span className="pulso-xf-pdf-card-text">
                    <strong>Una columna</strong>
                    <em>Las matrices fluyen dentro de una columna.</em>
                  </span>
                </button>
              </div>
            </div>
          </section>

          {/* ── Lógica ──────────────────────────────────────────────── */}
          <section className="pulso-xf-pdf-section">
            <h3 className="pulso-xf-pdf-section-title">Lógica</h3>
            <div className="pulso-xf-pdf-cards" role="radiogroup" aria-label="Lógica">
              <button
                type="button"
                role="radio"
                aria-checked={logicLanguage === "saltos"}
                className={`pulso-xf-pdf-card${logicLanguage === "saltos" ? " is-active" : ""}`}
                onClick={() => setLogicLanguage("saltos")}
              >
                <span className="pulso-xf-pdf-card-icon"><Route size={18} /></span>
                <span className="pulso-xf-pdf-card-text">
                  <strong>Saltos</strong>
                  <em>Instrucciones en las opciones — «Salto a la 15».</em>
                </span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={logicLanguage === "condiciones"}
                className={`pulso-xf-pdf-card${logicLanguage === "condiciones" ? " is-active" : ""}`}
                onClick={() => setLogicLanguage("condiciones")}
              >
                <span className="pulso-xf-pdf-card-icon"><GitBranch size={18} /></span>
                <span className="pulso-xf-pdf-card-text">
                  <strong>Condiciones</strong>
                  <em>Apertura antes de la pregunta — «En caso…».</em>
                </span>
              </button>
            </div>
            <div className="pulso-xf-pdf-control pulso-xf-pdf-control--consent">
              <label htmlFor="pulso-xf-pdf-consent">
                <ShieldCheck size={14} aria-hidden="true" /> Variable de consentimiento
              </label>
              <div className="pulso-xf-pdf-select-wrap">
                <select
                  id="pulso-xf-pdf-consent"
                  className="pulso-xf-pdf-select"
                  value={consentVar}
                  onChange={(e) => setConsentVar(e.target.value)}
                >
                  <option value="">Ninguna</option>
                  {consentQuestions.map((question) => (
                    <option key={question.name} value={question.name}>
                      {question.name} — {question.label}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} aria-hidden="true" className="pulso-xf-pdf-select-caret" />
              </div>
              <span className="pulso-xf-pdf-control-hint">
                Se asume que todo el formulario depende del consentimiento: sus condiciones no
                se repiten y su rechazo marca «Termina la encuesta».
              </span>
            </div>
          </section>

          {/* ── Matrices ────────────────────────────────────────────── */}
          <section className="pulso-xf-pdf-section">
            <h3 className="pulso-xf-pdf-section-title">Matrices</h3>
            <p className="pulso-xf-pdf-section-note">
              Agrupa preguntas contiguas que comparten la misma escala en una tabla.
            </p>
            {matrixCandidates.length === 0 ? (
              <p className="pulso-xf-pdf-empty">No se detectaron grupos matrizables.</p>
            ) : (
              <div className="pulso-xf-pdf-matrix-list">
                {matrixCandidates.map((candidate) => {
                  const enabled = !disabledMatrixIds.has(candidate.id);
                  const tenorInputId = `pulso-xf-pdf-tenor-${candidate.id}`;
                  const specialSelectId = `pulso-xf-pdf-special-${candidate.id}`;
                  const headerSelectId = `pulso-xf-pdf-header-${candidate.id}`;
                  const specialValue = specialById[candidate.id] ?? "auto";
                  const headerValue = headerById[candidate.id] ?? "auto";
                  return (
                    <div
                      key={candidate.id}
                      className={`pulso-xf-pdf-matrix${enabled ? " is-active" : ""}`}
                    >
                      <button
                        type="button"
                        role="switch"
                        aria-checked={enabled}
                        className="pulso-xf-pdf-matrix-head"
                        onClick={() => toggleMatrix(candidate.id)}
                      >
                        <span className="pulso-xf-pdf-matrix-badge" aria-hidden="true">
                          <Grid3x3 size={16} />
                        </span>
                        <span className="pulso-xf-pdf-matrix-info">
                          <strong>
                            {candidate.count} preguntas · lista {candidate.listName}
                          </strong>
                          <em>
                            {matrixQuestionsSummary(candidate)} · {candidate.sectionLabel}
                          </em>
                        </span>
                        <span className="pulso-xf-pdf-matrix-toggle-label">¿Va como matriz?</span>
                        <span
                          className={`pulso-xf-pdf-switch${enabled ? " is-on" : ""}`}
                          aria-hidden="true"
                        >
                          <span className="pulso-xf-pdf-switch-thumb" />
                        </span>
                      </button>
                      {enabled ? (
                        <div className="pulso-xf-pdf-matrix-controls">
                          <div className="pulso-xf-pdf-control pulso-xf-pdf-control--tenor">
                            <label htmlFor={tenorInputId}>Tenor</label>
                            <input
                              id={tenorInputId}
                              type="text"
                              className="pulso-xf-pdf-input"
                              value={tenorById[candidate.id] ?? ""}
                              placeholder="A continuación, indique cuán de acuerdo…"
                              onChange={(e) =>
                                setTenorById((prev) => ({ ...prev, [candidate.id]: e.target.value }))
                              }
                            />
                            <span className="pulso-xf-pdf-control-hint">
                              Enunciado que encabeza la tabla; numera las filas X.1, X.2.
                            </span>
                          </div>
                          <div className="pulso-xf-pdf-control pulso-xf-pdf-control--special">
                            <label htmlFor={specialSelectId}>Columna especial</label>
                            <div className="pulso-xf-pdf-select-wrap">
                              <select
                                id={specialSelectId}
                                className="pulso-xf-pdf-select"
                                value={specialValue}
                                onChange={(e) =>
                                  setSpecialById((prev) => ({ ...prev, [candidate.id]: e.target.value }))
                                }
                              >
                                <option value="auto">Automática</option>
                                <option value="none">Ninguna</option>
                                {candidate.scaleOptions.map((option) => (
                                  <option key={option.code} value={option.code}>
                                    {option.code} — {option.label}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown
                                size={14}
                                aria-hidden="true"
                                className="pulso-xf-pdf-select-caret"
                              />
                            </div>
                          </div>
                          <div className="pulso-xf-pdf-control pulso-xf-pdf-control--header">
                            <label htmlFor={headerSelectId}>Cabecera</label>
                            <div className="pulso-xf-pdf-select-wrap">
                              <select
                                id={headerSelectId}
                                className="pulso-xf-pdf-select"
                                value={headerValue}
                                onChange={(e) =>
                                  setHeaderById((prev) => ({ ...prev, [candidate.id]: e.target.value }))
                                }
                              >
                                <option value="auto">Automática</option>
                                <option value="extremos">Extremos</option>
                                <option value="categorias">Categorías</option>
                              </select>
                              <ChevronDown
                                size={14}
                                aria-hidden="true"
                                className="pulso-xf-pdf-select-caret"
                              />
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <footer className="pulso-xf-pdf-dialog-foot">
          <button
            type="button"
            className="pulso-xf-pdf-dialog-cancel"
            onClick={onClose}
            disabled={busy}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="pulso-xf-pdf-dialog-export"
            onClick={exportNow}
            disabled={busy}
          >
            <FileText size={15} />
            {busy ? "Exportando…" : "Exportar PDF"}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
