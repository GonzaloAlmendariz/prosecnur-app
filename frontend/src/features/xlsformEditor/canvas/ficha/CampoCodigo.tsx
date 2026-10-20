// Código en la base (C23): se edita sobre un borrador y, antes de aplicar, dice cuántas referencias `${x}` se
// reescriben. El renombre y su propagación los hace la página (updateSurveyField con `name`).
// 2026-10-20: Aplicar y Descartar van DENTRO del campo, cuadrados de 28 px, y sólo cuando el código cambió; la nota
// es una línea corta en 12 px.

import { useEffect, useId, useMemo, useState } from "react";
import { Check, Undo2 } from "../../../../vendor/lucide-react";
import type { XlsformEditorSheet } from "../../types";
import { contarReferencias, estadoCodigo, notaReferencias } from "./modeloFicha";

export function CampoCodigo({ valor, survey, onCambio }: { valor: string; survey: XlsformEditorSheet | null; onCambio: (v: string) => void }) {
  const id = useId();
  const idNota = `${id}-nota`;
  const [borrador, setBorrador] = useState(valor);
  useEffect(() => setBorrador(valor), [valor]);
  const referencias = useMemo(() => contarReferencias(survey, valor), [survey, valor]);
  const { limpio, cambio, puedeAplicar, problema } = estadoCodigo(borrador, valor);
  const aplicar = () => { if (puedeAplicar) onCambio(limpio); };
  const descartar = () => setBorrador(valor);
  const nota = problema ?? (puedeAplicar && valor.trim() ? notaReferencias(referencias) : null);
  return (
    <div className="xfh-campo xfh-campo--codigo">
      <label htmlFor={id}>Código en la base</label>
      <div className={`xfh-codigo${cambio ? " is-cambio" : ""}${problema ? " is-invalido" : ""}`}>
        <input
          id={id}
          className="xfh-codigo__input"
          value={borrador}
          onChange={(e) => setBorrador(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); aplicar(); }
            else if (e.key === "Escape" && cambio) { e.preventDefault(); e.stopPropagation(); descartar(); }
          }}
          aria-invalid={problema ? true : undefined}
          aria-describedby={nota ? idNota : undefined}
          placeholder="ej. p1_edad"
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
        />
        {cambio ? (
          <span className="xfh-codigo__acc">
            <button type="button" className="xfh-codigo__btn is-aplicar" onClick={aplicar} disabled={!puedeAplicar} title="Aplicar el código (Enter)" aria-label="Aplicar el código">
              <Check size={15} strokeWidth={2.4} aria-hidden="true" />
            </button>
            <button type="button" className="xfh-codigo__btn" onClick={descartar} title="Descartar el cambio (Esc)" aria-label="Descartar el cambio de código">
              <Undo2 size={14} aria-hidden="true" />
            </button>
          </span>
        ) : null}
      </div>
      {nota ? <small id={idNota} className={`xfh-codigo__nota${problema ? " is-invalido" : ""}`}>{nota}</small> : null}
    </div>
  );
}
