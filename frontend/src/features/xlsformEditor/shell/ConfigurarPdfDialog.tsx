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
// El estado de la preferencia (columnas / lógica / N.º / título de cabecera /
// instrucciones por defecto / tope de opciones / matrices) se restaura de
// localStorage por proyecto + formulario y se guarda en cada cambio
// (`pdfExportPreference.ts`). Las matrices se recuerdan por la firma de sus
// miembros, no por el id de fila del candidato.
//
// La lógica pura de armado del payload vive en `pdfExportPreference.ts`
// (`buildPaperExportOptions`) y la detección en `parsing/detectMatrixCandidates.ts`;
// aquí solo se presenta y se recolecta la elección del usuario.
//
// Overlay a z-index 1400 (por encima del chrome del módulo, `pulso-page-frame-
// toolbar` es z-1000), tokens `--pulso-*` y clases `.pulso-xf-pdf-dialog-*`;
// iconos lucide vía el shim compartido.
// =============================================================================

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Columns2, FileText, GitBranch, Grid3x3, LayoutTemplate, Route, ShieldCheck, Square, Table2, X } from "../../../vendor/lucide-react";
import type { MatrixCandidate } from "../parsing/detectMatrixCandidates";
import type { ConsentQuestion } from "../parsing/detectConsentQuestions";
import type { XlsformPaperExportOptions } from "../../../api/xlsformEditor";
import {
  MIN_MAX_OPTIONS_PER_QUESTION,
  buildPaperExportOptions,
  loadPdfDialogState,
  matrixChoiceFor,
  matrixSignature,
  parseMaxOptionsPerQuestion,
  savePdfDialogState,
  type PdfDialogState,
  type PdfMatrixChoice,
} from "./pdfExportPreference";

export type ConfigurarPdfDialogProps = {
  open: boolean;
  onClose: () => void;
  onExport: (format: "pdf" | "word", options: XlsformPaperExportOptions) => void;
  matrixCandidates?: MatrixCandidate[];
  /** Preguntas candidatas a variable de consentimiento (select_one/acknowledge). */
  consentQuestions?: ConsentQuestion[];
  /** Nombre del formulario/archivo, mostrado como subtítulo si viene. */
  fileName?: string | null;
  /** Clave de localStorage (proyecto + formulario); null = no se persiste. */
  storageKey?: string | null;
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
  storageKey = null,
  busy = false,
}: ConfigurarPdfDialogProps) {
  // Un solo estado para todas las elecciones; se restaura de localStorage al
  // montar (el `key` del padre remonta por proyecto + formulario) y se guarda
  // en cada cambio. Las matrices van por firma de miembros, no por id de fila.
  const [state, setState] = useState<PdfDialogState>(() => loadPdfDialogState(storageKey));
  const [maxOptionsDraft, setMaxOptionsDraft] = useState<string>(() => String(state.maxOptionsPerQuestion));
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!touched) return;
    savePdfDialogState(storageKey, state, matrixCandidates);
  }, [touched, storageKey, state, matrixCandidates]);

  function update(patch: Partial<PdfDialogState>) {
    setTouched(true);
    setState((prev) => ({ ...prev, ...patch }));
  }

  function updateMatrix(candidate: MatrixCandidate, patch: PdfMatrixChoice) {
    const signature = matrixSignature(candidate);
    setTouched(true);
    setState((prev) => ({
      ...prev,
      matrices: { ...prev.matrices, [signature]: { ...prev.matrices[signature], ...patch } },
    }));
  }

  const consentNames = consentQuestions.map((q) => q.name);
  const consentValue = consentNames.includes(state.consentVar) ? state.consentVar : "";

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

  function exportNow(format: "pdf" | "word") {
    onExport(format, buildPaperExportOptions(state, matrixCandidates, consentNames));
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
                  aria-checked={state.columns === 1}
                  className={`pulso-xf-pdf-card${state.columns === 1 ? " is-active" : ""}`}
                  onClick={() => update({ columns: 1 })}
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
                  aria-checked={state.columns === 2}
                  className={`pulso-xf-pdf-card${state.columns === 2 ? " is-active" : ""}`}
                  onClick={() => update({ columns: 2 })}
                >
                  <span className="pulso-xf-pdf-card-icon"><Columns2 size={18} /></span>
                  <span className="pulso-xf-pdf-card-text">
                    <strong>Dos columnas</strong>
                    <em>Compacto, más preguntas por hoja.</em>
                  </span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={state.columns === "auto"}
                  className={`pulso-xf-pdf-card pulso-xf-pdf-card--ancha${state.columns === "auto" ? " is-active" : ""}`}
                  onClick={() => update({ columns: "auto" })}
                >
                  <span className="pulso-xf-pdf-card-icon"><LayoutTemplate size={18} /></span>
                  <span className="pulso-xf-pdf-card-text">
                    <strong>Automáticas</strong>
                    <em>Una o dos según el tramo: las baterías anchas a toda la página.</em>
                  </span>
                </button>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={state.showQuestionnaireNumber}
              className={`pulso-xf-pdf-switch-row${state.showQuestionnaireNumber ? " is-on" : ""}`}
              onClick={() => update({ showQuestionnaireNumber: !state.showQuestionnaireNumber })}
            >
              <span className="pulso-xf-pdf-switch-text">
                <strong>Número de cuestionario</strong>
                <em>Imprime los recuadros de N.º en la cabecera.</em>
              </span>
              <span className={`pulso-xf-pdf-switch${state.showQuestionnaireNumber ? " is-on" : ""}`} aria-hidden="true">
                <span className="pulso-xf-pdf-switch-thumb" />
              </span>
            </button>
            <button
              type="button"
              role="switch"
              aria-checked={state.showHeaderTitle}
              className={`pulso-xf-pdf-switch-row${state.showHeaderTitle ? " is-on" : ""}`}
              onClick={() => update({ showHeaderTitle: !state.showHeaderTitle })}
            >
              <span className="pulso-xf-pdf-switch-text">
                <strong>Título en la cabecera</strong>
                <em>Repite el título del formulario arriba de cada página.</em>
              </span>
              <span className={`pulso-xf-pdf-switch${state.showHeaderTitle ? " is-on" : ""}`} aria-hidden="true">
                <span className="pulso-xf-pdf-switch-thumb" />
              </span>
            </button>
            <div className="pulso-xf-pdf-field">
              <span className="pulso-xf-pdf-field-label">Ancho de matrices</span>
              <div className="pulso-xf-pdf-cards" role="radiogroup" aria-label="Ancho de matrices">
                <button
                  type="button"
                  role="radio"
                  aria-checked={state.matrixLayout === "full"}
                  className={`pulso-xf-pdf-card${state.matrixLayout === "full" ? " is-active" : ""}`}
                  onClick={() => update({ matrixLayout: "full" })}
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
                  aria-checked={state.matrixLayout === "column"}
                  className={`pulso-xf-pdf-card${state.matrixLayout === "column" ? " is-active" : ""}`}
                  onClick={() => update({ matrixLayout: "column" })}
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
                aria-checked={state.logicLanguage === "saltos"}
                className={`pulso-xf-pdf-card${state.logicLanguage === "saltos" ? " is-active" : ""}`}
                onClick={() => update({ logicLanguage: "saltos" })}
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
                aria-checked={state.logicLanguage === "condiciones"}
                className={`pulso-xf-pdf-card${state.logicLanguage === "condiciones" ? " is-active" : ""}`}
                onClick={() => update({ logicLanguage: "condiciones" })}
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
                  value={consentValue}
                  onChange={(e) => update({ consentVar: e.target.value })}
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

          {/* ── Contenido ───────────────────────────────────────────── */}
          <section className="pulso-xf-pdf-section">
            <h3 className="pulso-xf-pdf-section-title">Contenido</h3>
            <button
              type="button"
              role="switch"
              aria-checked={state.defaultIntro}
              className={`pulso-xf-pdf-switch-row${state.defaultIntro ? " is-on" : ""}`}
              onClick={() => update({ defaultIntro: !state.defaultIntro })}
            >
              <span className="pulso-xf-pdf-switch-text">
                <strong>Instrucciones al inicio</strong>
                <em>Banda «INSTRUCCIONES» si el formulario no trae introducción propia.</em>
              </span>
              <span className={`pulso-xf-pdf-switch${state.defaultIntro ? " is-on" : ""}`} aria-hidden="true">
                <span className="pulso-xf-pdf-switch-thumb" />
              </span>
            </button>
            <div className="pulso-xf-pdf-switch-row pulso-xf-pdf-number-row">
              <label className="pulso-xf-pdf-switch-text" htmlFor="pulso-xf-pdf-max-options">
                <strong>Máximo de opciones impresas</strong>
                <em>Con más opciones, la pregunta sale con casilla de código.</em>
              </label>
              <input
                id="pulso-xf-pdf-max-options"
                type="number"
                inputMode="numeric"
                min={MIN_MAX_OPTIONS_PER_QUESTION}
                step={1}
                className="pulso-xf-pdf-input pulso-xf-pdf-number"
                value={maxOptionsDraft}
                onChange={(e) => {
                  setMaxOptionsDraft(e.target.value);
                  const parsed = parseMaxOptionsPerQuestion(e.target.value);
                  if (parsed !== null) update({ maxOptionsPerQuestion: parsed });
                }}
                onBlur={() => setMaxOptionsDraft(String(state.maxOptionsPerQuestion))}
              />
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
                  const choice = matrixChoiceFor(candidate, state.matrices);
                  const enabled = choice.enabled;
                  const tenorInputId = `pulso-xf-pdf-tenor-${candidate.id}`;
                  const specialSelectId = `pulso-xf-pdf-special-${candidate.id}`;
                  const headerSelectId = `pulso-xf-pdf-header-${candidate.id}`;
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
                        onClick={() => updateMatrix(candidate, { enabled: !enabled })}
                      >
                        <span className="pulso-xf-pdf-matrix-badge" aria-hidden="true">
                          <Grid3x3 size={16} />
                        </span>
                        <span className="pulso-xf-pdf-matrix-info">
                          <strong>
                            {candidate.count} {candidate.count === 1 ? "pregunta" : "preguntas"} · lista {candidate.listName}
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
                              value={choice.tenor}
                              placeholder="A continuación, indique cuán de acuerdo…"
                              onChange={(e) =>
                                updateMatrix(candidate, { tenor: e.target.value })
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
                                value={choice.special}
                                onChange={(e) =>
                                  updateMatrix(candidate, { special: e.target.value })
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
                                value={choice.header}
                                onChange={(e) =>
                                  updateMatrix(candidate, { header: e.target.value })
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
            className="pulso-xf-pdf-dialog-export pulso-xf-pdf-dialog-export-word"
            onClick={() => exportNow("word")}
            disabled={busy}
          >
            <FileText size={15} />
            {busy ? "Exportando…" : "Exportar Word"}
          </button>
          <button
            type="button"
            className="pulso-xf-pdf-dialog-export"
            onClick={() => exportNow("pdf")}
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
