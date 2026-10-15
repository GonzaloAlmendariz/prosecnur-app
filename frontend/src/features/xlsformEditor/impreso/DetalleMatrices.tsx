// Matrices de la pestaña «Impreso». Las candidatas de 2 o más preguntas van primero, en el orden del formulario;
// las de una sola pregunta (en acrconta, la mayoría de las 27) se agrupan plegadas en «Preguntas sueltas con escala
// (N)» para no enterrar a las matrices reales. La elección por candidata y su persistencia no cambian.

import type { ReactNode } from "react";
import { ChevronDown, Grid3x3 } from "../../../vendor/lucide-react";
import type { MatrixCandidate } from "../parsing/detectMatrixCandidates";
import { matrixChoiceFor, type PdfDialogState, type PdfMatrixChoice } from "../shell/pdfExportPreference";
import { separarCandidatas } from "./modeloImpreso";
import { TarjetaImpreso } from "./TarjetaImpreso";

/** Etiqueta corta de las preguntas de una matriz: «primera» +N. */
function resumenPreguntas(c: MatrixCandidate): string {
  const primera = c.questionLabels[0] ?? c.memberNames[0] ?? "pregunta";
  const corta = primera.length > 48 ? `${primera.slice(0, 47)}…` : primera;
  const extra = c.count - 1;
  return extra > 0 ? `«${corta}» +${extra}` : `«${corta}»`;
}

function SelectMatriz({ id, etiqueta, valor, onCambiar, children }: {
  id: string;
  etiqueta: string;
  valor: string;
  onCambiar: (v: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="pulso-xf-pdf-control">
      <label htmlFor={id}>{etiqueta}</label>
      <div className="pulso-xf-pdf-select-wrap">
        <select id={id} className="pulso-xf-pdf-select" value={valor} onChange={(e) => onCambiar(e.target.value)}>
          {children}
        </select>
        <ChevronDown size={14} aria-hidden="true" className="pulso-xf-pdf-select-caret" />
      </div>
    </div>
  );
}

function CandidataMatriz({ candidata, matrices, onCambiar }: {
  candidata: MatrixCandidate;
  matrices: PdfDialogState["matrices"];
  onCambiar: (c: MatrixCandidate, patch: PdfMatrixChoice) => void;
}) {
  const eleccion = matrixChoiceFor(candidata, matrices);
  const base = `pulso-xf-imp-matriz-${candidata.id}`;
  return (
    <div className={`pulso-xf-pdf-matrix${eleccion.enabled ? " is-active" : ""}`} data-qa-geometry-member="">
      <button
        type="button"
        role="switch"
        aria-checked={eleccion.enabled}
        className="pulso-xf-pdf-matrix-head"
        onClick={() => onCambiar(candidata, { enabled: !eleccion.enabled })}
      >
        <span className="pulso-xf-pdf-matrix-badge" aria-hidden="true"><Grid3x3 size={16} /></span>
        <span className="pulso-xf-pdf-matrix-info">
          <strong>{candidata.count} {candidata.count === 1 ? "pregunta" : "preguntas"} · lista {candidata.listName}</strong>
          <em>{resumenPreguntas(candidata)} · {candidata.sectionLabel}</em>
        </span>
        <span className="pulso-xf-pdf-matrix-toggle-label">¿Va como matriz?</span>
        <span className={`pulso-xf-pdf-switch${eleccion.enabled ? " is-on" : ""}`} aria-hidden="true">
          <span className="pulso-xf-pdf-switch-thumb" />
        </span>
      </button>
      {eleccion.enabled ? (
        <div className="pulso-xf-pdf-matrix-controls">
          <div className="pulso-xf-pdf-control pulso-xf-pdf-control--tenor">
            <label htmlFor={`${base}-tenor`}>Tenor</label>
            <input
              id={`${base}-tenor`}
              type="text"
              className="pulso-xf-pdf-input"
              value={eleccion.tenor}
              placeholder="A continuación, indique cuán de acuerdo…"
              aria-describedby={`${base}-tenor-ayuda`}
              onChange={(e) => onCambiar(candidata, { tenor: e.target.value })}
            />
            <span id={`${base}-tenor-ayuda`} className="pulso-xf-pdf-control-hint">
              Enunciado que encabeza la tabla; numera las filas X.1, X.2.
            </span>
          </div>
          <SelectMatriz id={`${base}-especial`} etiqueta="Columna especial" valor={eleccion.special}
            onCambiar={(special) => onCambiar(candidata, { special })}>
            <option value="auto">Automática</option>
            <option value="none">Ninguna</option>
            {candidata.scaleOptions.map((o) => (
              <option key={o.code} value={o.code}>{o.code} — {o.label}</option>
            ))}
          </SelectMatriz>
          <SelectMatriz id={`${base}-cabecera`} etiqueta="Cabecera" valor={eleccion.header}
            onCambiar={(header) => onCambiar(candidata, { header })}>
            <option value="auto">Automática</option>
            <option value="extremos">Extremos</option>
            <option value="categorias">Categorías</option>
          </SelectMatriz>
        </div>
      ) : null}
    </div>
  );
}

export function DetalleMatrices({ candidatas, matrices, onCambiar }: {
  candidatas: readonly MatrixCandidate[];
  matrices: PdfDialogState["matrices"];
  onCambiar: (c: MatrixCandidate, patch: PdfMatrixChoice) => void;
}) {
  const { matrices: reales, sueltas } = separarCandidatas(candidatas);
  if (candidatas.length === 0) {
    return (
      <TarjetaImpreso
        id="imp-matrices"
        titulo="Matrices"
        ayuda="No se detectaron grupos matrizables: ninguna pregunta contigua comparte la misma escala."
      />
    );
  }
  return (
    <>
      <TarjetaImpreso
        id="imp-matrices"
        titulo={`Matrices (${reales.length})`}
        ayuda="Preguntas contiguas que comparten la misma escala, impresas como una tabla."
      >
        {reales.length === 0 ? (
          <p className="pulso-xf-imp-vacio">Ningún grupo de dos o más preguntas comparte escala.</p>
        ) : (
          <div className="pulso-xf-pdf-matrix-list" data-qa-geometry-group="xlsform/impreso-matrices" data-qa-geometry-contract="intrinsic">
            {reales.map((c) => <CandidataMatriz key={c.id} candidata={c} matrices={matrices} onCambiar={onCambiar} />)}
          </div>
        )}
      </TarjetaImpreso>
      {sueltas.length > 0 && (
        <details className="pulso-xf-imp-sueltas">
          <summary>
            <span>Preguntas sueltas con escala ({sueltas.length})</span>
            <small>Una sola pregunta con su escala: sale como pregunta, salvo que la actives como tabla.</small>
          </summary>
          <div className="pulso-xf-pdf-matrix-list" data-qa-geometry-group="xlsform/impreso-sueltas" data-qa-geometry-contract="intrinsic">
            {sueltas.map((c) => <CandidataMatriz key={c.id} candidata={c} matrices={matrices} onCambiar={onCambiar} />)}
          </div>
        </details>
      )}
    </>
  );
}
