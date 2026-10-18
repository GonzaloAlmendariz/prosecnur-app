// Edición directa de un filtro que no es cascada ni por opción (REF16: «${Country} = 'PER' and (name = '1' or …)»):
// antes no tenía «Editar filtro» y la única salida era el Constructor (S15). La expresión se escribe y se guarda en la
// columna choice_filter de la pregunta; la lectura de la ficha se rehace al guardar.

import { useState } from "react";
import type { XlsformEditorWorkbook } from "../../../api/multiIntegrado";
import { PanelCard } from "../kit";
import { quitarCascada } from "./cascada";
import "./editorFiltro.css";

export function conExpresion(wb: XlsformEditorWorkbook, fila: number, expresion: string): XlsformEditorWorkbook {
  const cols = wb.survey.columns.includes("choice_filter") ? wb.survey.columns : [...wb.survey.columns, "choice_filter"];
  const iF = cols.indexOf("choice_filter");
  const rows = wb.survey.rows.map((r, i) => {
    const base = r.length < cols.length ? [...r, ...Array(cols.length - r.length).fill("")] : r;
    return i === fila ? base.map((v, j) => (j === iF ? expresion : v)) : base;
  });
  return { ...wb, survey: { ...wb.survey, columns: cols, rows } };
}

export function EditorExpresionFiltro({ workbook, fila, nombre, inicial, onGuardar, onCancelar }: {
  workbook: XlsformEditorWorkbook;
  fila: number;
  nombre: string;
  inicial: string;
  onGuardar: (wb: XlsformEditorWorkbook, pregunta: string) => void;
  onCancelar: () => void;
}) {
  const [texto, setTexto] = useState(inicial);
  const cambio = texto.trim() !== inicial.trim();
  return (
    <div className="xff" data-qa-geometry-group="xlsform/filtro-editor" data-qa-geometry-contract="intrinsic">
      <PanelCard title="Editar filtro" meta={<span className="xff-paso">Este filtro combina condiciones: se edita como expresión</span>}>
        <label className="xff-campo__rot" htmlFor="xff-expresion">Expresión del filtro (choice_filter)</label>
        <textarea id="xff-expresion" className="xff-expresion" value={texto} rows={4} spellCheck={false} onChange={(e) => setTexto(e.target.value)} />
        <div className="xff-pie">
          <button type="button" className="xff-btn is-peligro" onClick={() => onGuardar(quitarCascada(workbook, fila), nombre)}>Quitar filtro</button>
          <span className="xff-pie__esp" />
          <button type="button" className="xff-btn" onClick={onCancelar}>Cancelar</button>
          <button type="button" className="xff-btn is-primario" disabled={!cambio || !texto.trim()} onClick={() => onGuardar(conExpresion(workbook, fila, texto.trim()), nombre)}>Guardar filtro</button>
        </div>
      </PanelCard>
    </div>
  );
}
