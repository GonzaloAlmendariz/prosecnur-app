// =============================================================================
// shell/PdfExportButton.tsx — split-button de "Exportar PDF" con selector de diseño
// =============================================================================
// El botón principal exporta el cuestionario en PDF con la preferencia activa en
// varias dimensiones: número de columnas (default 2 = comportamiento histórico),
// lenguaje de lógica (default "saltos"), si se imprimen los recuadros de N.º de
// cuestionario en la cabecera (default ON) y qué grupos de preguntas contiguas
// se arman como matriz (candidatos detectados por `detectMatrixCandidates`,
// default todos ON). El caret abre un popover "DISEÑO DEL PDF" con secciones —
// Columnas, Lógica, Cabecera y Matrices.
//
// Columnas y Lógica son opciones mutuamente excluyentes que exportan al
// elegirlas; el N.º de cuestionario y cada matriz son switches que solo fijan la
// preferencia (el export sigue en el botón principal). Reusa el patrón de popover
// `.pulso-more-views-*` del command bar (mismo click-fuera / Escape que
// FormSwitcher).
//
// Cada candidato activo puede llevar un "tenor" (enunciado guía de la tabla):
// cuando viene, el motor le da el número X y las filas pasan a X.1, X.2…; sin
// tenor, numeración secuencial. El input de tenor solo se muestra cuando la
// matriz está activada.
//
// Contrato con el motor R: SIEMPRE enviamos `matrix_groups` con los candidatos
// activados (decisión (b) del brief), en la forma de objeto `{ members, tenor? }`,
// para que "lo que ves en el popover" sea "lo que sale". Un candidato
// desactivado se omite del arreglo y el motor lo renderiza como preguntas
// individuales. Si no hay candidatos, enviamos `[]`.
// =============================================================================

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Columns2, FileText, GitBranch, Grid3x3, Route, Square } from "../../../vendor/lucide-react";
import type { MatrixCandidate } from "../parsing/detectMatrixCandidates";
import {
  DEFAULT_PDF_EXPORT_PREFERENCE,
  buildMatrixGroups,
  exportButtonTitle,
  type MatrixGroupPayload,
  type PdfColumns,
  type PdfLogicLanguage,
} from "./pdfExportPreference";

export type PdfExportButtonProps = {
  onExport: (
    columns: PdfColumns,
    logicLanguage: PdfLogicLanguage,
    showQuestionnaireNumber: boolean,
    matrixGroups: MatrixGroupPayload[],
  ) => void;
  matrixCandidates?: MatrixCandidate[];
  disabled?: boolean;
};

/** Texto legible de un candidato de matriz para su fila del popover. */
function matrixCandidateSummary(candidate: MatrixCandidate): string {
  const first = candidate.questionLabels[0] ?? candidate.memberNames[0] ?? "pregunta";
  const shortFirst = first.length > 32 ? `${first.slice(0, 31)}…` : first;
  const extra = candidate.count - 1;
  const extraLabel = extra > 0 ? ` +${extra}` : "";
  return `«${shortFirst}»${extraLabel} · lista ${candidate.listName} · ${candidate.sectionLabel}`;
}

export function PdfExportButton({ onExport, matrixCandidates = [], disabled }: PdfExportButtonProps) {
  const [open, setOpen] = useState(false);
  const [columns, setColumns] = useState<PdfColumns>(DEFAULT_PDF_EXPORT_PREFERENCE.columns);
  const [logicLanguage, setLogicLanguage] = useState<PdfLogicLanguage>(
    DEFAULT_PDF_EXPORT_PREFERENCE.logicLanguage,
  );
  const [showQuestionnaireNumber, setShowQuestionnaireNumber] = useState<boolean>(
    DEFAULT_PDF_EXPORT_PREFERENCE.showQuestionnaireNumber,
  );
  // Ids de candidatos DESACTIVADOS (default = todos activos, set vacío).
  const [disabledMatrixIds, setDisabledMatrixIds] = useState<Set<string>>(() => new Set());
  // Tenor (enunciado guía) por candidato: map id→texto. Vacío = sin tenor.
  const [tenorById, setTenorById] = useState<Record<string, string>>({});
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  function activeMatrixGroups(): MatrixGroupPayload[] {
    return buildMatrixGroups(matrixCandidates, disabledMatrixIds, tenorById);
  }

  function exportNow(cols: PdfColumns, logic: PdfLogicLanguage) {
    setOpen(false);
    onExport(cols, logic, showQuestionnaireNumber, activeMatrixGroups());
  }

  function toggleMatrix(id: string) {
    setDisabledMatrixIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function setTenor(id: string, value: string) {
    setTenorById((prev) => ({ ...prev, [id]: value }));
  }

  return (
    <div
      ref={wrapperRef}
      className={`pulso-more-views-wrapper pulso-xlsform-pdf-export${open ? " is-open" : ""}`}
    >
      <button
        type="button"
        className="pulso-xlsform-toolbar-button pulso-xlsform-pdf-export-main"
        onClick={() => onExport(columns, logicLanguage, showQuestionnaireNumber, activeMatrixGroups())}
        disabled={disabled}
        title={exportButtonTitle({ columns, logicLanguage, showQuestionnaireNumber })}
      >
        <FileText size={14} /> PDF
      </button>
      <button
        type="button"
        className="pulso-xlsform-toolbar-button pulso-xlsform-pdf-export-caret"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Elegir diseño del PDF"
      >
        <ChevronDown size={13} />
      </button>
      {open && (
        <div className="pulso-more-views-menu pulso-xlsform-pdf-export-menu" role="menu">
          <span className="pulso-more-views-eyebrow">Diseño del PDF</span>
          <span className="pulso-more-views-section-label">Columnas</span>
          <button
            type="button"
            role="menuitemradio"
            aria-checked={columns === 1}
            className={`pulso-more-views-item${columns === 1 ? " is-active" : ""}`}
            onClick={() => { setColumns(1); exportNow(1, logicLanguage); }}
          >
            <span className="pulso-more-views-item-icon">
              {columns === 1 ? <Check size={16} /> : <Square size={16} />}
            </span>
            <span className="pulso-more-views-item-text">
              <strong>Una columna</strong>
              <em>Preguntas a lo ancho de la página.</em>
            </span>
          </button>
          <button
            type="button"
            role="menuitemradio"
            aria-checked={columns === 2}
            className={`pulso-more-views-item${columns === 2 ? " is-active" : ""}`}
            onClick={() => { setColumns(2); exportNow(2, logicLanguage); }}
          >
            <span className="pulso-more-views-item-icon">
              {columns === 2 ? <Check size={16} /> : <Columns2 size={16} />}
            </span>
            <span className="pulso-more-views-item-text">
              <strong>Dos columnas</strong>
              <em>Formato compacto, más preguntas por hoja.</em>
            </span>
          </button>
          <span className="pulso-more-views-section-label">Lógica</span>
          <button
            type="button"
            role="menuitemradio"
            aria-checked={logicLanguage === "saltos"}
            className={`pulso-more-views-item${logicLanguage === "saltos" ? " is-active" : ""}`}
            onClick={() => { setLogicLanguage("saltos"); exportNow(columns, "saltos"); }}
          >
            <span className="pulso-more-views-item-icon">
              {logicLanguage === "saltos" ? <Check size={16} /> : <Route size={16} />}
            </span>
            <span className="pulso-more-views-item-text">
              <strong>Saltos</strong>
              <em>Instrucciones de salto en las opciones — «Salto a la 15».</em>
            </span>
          </button>
          <button
            type="button"
            role="menuitemradio"
            aria-checked={logicLanguage === "condiciones"}
            className={`pulso-more-views-item${logicLanguage === "condiciones" ? " is-active" : ""}`}
            onClick={() => { setLogicLanguage("condiciones"); exportNow(columns, "condiciones"); }}
          >
            <span className="pulso-more-views-item-icon">
              {logicLanguage === "condiciones" ? <Check size={16} /> : <GitBranch size={16} />}
            </span>
            <span className="pulso-more-views-item-text">
              <strong>Condiciones</strong>
              <em>Apertura antes de cada pregunta condicionada — «En caso…».</em>
            </span>
          </button>
          <span className="pulso-more-views-section-label">Cabecera</span>
          <button
            type="button"
            role="switch"
            aria-checked={showQuestionnaireNumber}
            className={`pulso-more-views-item pulso-more-views-switch-item${showQuestionnaireNumber ? " is-active" : ""}`}
            onClick={() => setShowQuestionnaireNumber((v) => !v)}
          >
            <span className="pulso-more-views-item-text">
              <strong>Número de cuestionario</strong>
              <em>Imprime los recuadros de N.º de cuestionario en la cabecera.</em>
            </span>
            <span
              className={`pulso-more-views-switch${showQuestionnaireNumber ? " is-on" : ""}`}
              aria-hidden="true"
            >
              <span className="pulso-more-views-switch-thumb" />
            </span>
          </button>
          <span className="pulso-more-views-section-label">Matrices</span>
          {matrixCandidates.length === 0 ? (
            <span className="pulso-more-views-empty-note">No se detectaron grupos matrizables.</span>
          ) : (
            matrixCandidates.map((candidate) => {
              const enabled = !disabledMatrixIds.has(candidate.id);
              const tenorInputId = `pulso-matrix-tenor-${candidate.id}`;
              return (
                <div key={candidate.id} className="pulso-more-views-matrix">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    className={`pulso-more-views-item pulso-more-views-switch-item${enabled ? " is-active" : ""}`}
                    onClick={() => toggleMatrix(candidate.id)}
                  >
                    <span className="pulso-more-views-item-icon">
                      <Grid3x3 size={16} />
                    </span>
                    <span className="pulso-more-views-item-text">
                      <strong>{candidate.count} preguntas en matriz</strong>
                      <em>{matrixCandidateSummary(candidate)}</em>
                    </span>
                    <span
                      className={`pulso-more-views-switch${enabled ? " is-on" : ""}`}
                      aria-hidden="true"
                    >
                      <span className="pulso-more-views-switch-thumb" />
                    </span>
                  </button>
                  {enabled && (
                    <div className="pulso-more-views-matrix-tenor">
                      <label htmlFor={tenorInputId}>Tenor / enunciado de la tabla</label>
                      <input
                        id={tenorInputId}
                        type="text"
                        className="pulso-more-views-tenor-input"
                        value={tenorById[candidate.id] ?? ""}
                        placeholder="A continuación, indique cuán de acuerdo…"
                        onChange={(e) => setTenor(candidate.id, e.target.value)}
                        // Evita cerrar el popover / disparar el toggle al teclear.
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
