import { PanelCard, PropRow } from "../kit";
import type { BuilderDiagnostic, XlsformEditorSheet } from "../types";
import { COLUMN_HELP } from "./hojasModel";
import type { CeldaElegida } from "./BarraFormula";
import { columnaDeIdComillas } from "../parsing/comillas";

// Panel derecho del Editor XLSForm (revamp E7, 2026-10-16): la fila elegida columna por columna (sólo las que
// tienen algo, con el nombre XLSForm y su ayuda) y la revisión del archivo, con los avisos de esa fila primero.

export function PanelFila({ hoja, celda, diagnosticos, onIrAFila, onArreglar }: {
  hoja: XlsformEditorSheet;
  celda: CeldaElegida | null;
  diagnosticos: BuilderDiagnostic[];
  onIrAFila: (fila: number) => void;
  /** Arreglo de un clic para los avisos que lo tienen (hoy: comillas tipográficas). */
  onArreglar?: (diagnostico: BuilderDiagnostic) => void;
}) {
  const fila = celda ? hoja.rows[celda.fila] ?? [] : [];
  const llenas = celda ? hoja.columns.map((c, i) => [c, fila[i] ?? ""] as const).filter(([, v]) => v.trim()) : [];
  const deLaFila = celda && hoja.name !== "choices" ? diagnosticos.filter((d) => d.rowIndex === celda.fila) : [];
  const resto = diagnosticos.filter((d) => !deLaFila.includes(d));
  const errores = diagnosticos.filter((d) => d.level === "error").length;
  const avisos = diagnosticos.filter((d) => d.level === "warn").length;
  return (
    <aside className="xfx-panel" aria-label="Fila elegida y revisión">
      <PanelCard title={celda ? `Fila ${celda.fila + 1}` : "Fila"} meta={celda ? `${llenas.length} columnas con datos` : undefined} flush>
        {celda ? (
          <div className="xfx-panel__props">
            {llenas.map(([c, v]) => (
              <PropRow key={c} label={<span title={COLUMN_HELP[c]?.detail}>{c}</span>} mono={!["label", "hint", "constraint_message", "required_message"].some((x) => c.startsWith(x))}>
                {v}
              </PropRow>
            ))}
          </div>
        ) : (
          <p className="xfx-panel__nada">Elige una celda para ver su fila completa.</p>
        )}
      </PanelCard>
      <PanelCard title="Revisión del archivo" meta={`${errores} errores · ${avisos} avisos`} flush fill>
        {diagnosticos.length === 0 ? (
          <p className="xfx-panel__nada">Sin problemas detectados.</p>
        ) : (
          <ul className="xfx-diag">
            {[...deLaFila, ...resto].slice(0, 40).map((d) => (
              <li key={d.id} className={`is-${d.level}${deLaFila.includes(d) ? " is-fila" : ""}`}>
                <span className="xfx-diag__marca" aria-hidden="true" />
                <span className="xfx-diag__txt">
                  <span className="xfx-diag__tit">{d.title}</span>
                  <span className="xfx-diag__det">{d.detail}</span>
                  {onArreglar && columnaDeIdComillas(d.id) ? (
                    <button type="button" className="xfx-diag__fix" onClick={() => onArreglar(d)}>Cambiar por comillas rectas</button>
                  ) : null}
                  {typeof d.rowIndex === "number" ? (
                    <button type="button" className="xfx-diag__ir" onClick={() => onIrAFila(d.rowIndex!)}>survey · fila {d.rowIndex + 1}</button>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </PanelCard>
    </aside>
  );
}
