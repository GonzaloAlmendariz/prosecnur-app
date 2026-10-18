import type { LogicScope } from "../logic";
import type { BuilderNode } from "../types";
import { describeExpression, describeValidation } from "../canvas/reglasHumanas";
import { COLUMN_HELP } from "./hojasModel";

// Barra de fórmula del Editor XLSForm (revamp E7, 2026-10-16): la celda elegida con su dirección XLSForm
// (fila · columna), editable a todo el ancho, y debajo «Se lee» para las columnas con expresiones.

const LEIBLES = new Set(["relevant", "constraint", "calculation", "choice_filter", "repeat_count", "default"]);

export type CeldaElegida = { hoja: string; fila: number; columna: string };

export function BarraFormula({ celda, valor, nodo, scope, onCambiar }: {
  celda: CeldaElegida | null;
  valor: string;
  nodo: BuilderNode | null;
  scope?: LogicScope;
  onCambiar: (valor: string) => void;
}) {
  if (!celda) {
    return (
      <div className="xfx-barra is-vacia">
        <span className="xfx-barra__dir">Elige una celda</span>
        <span className="xfx-barra__nota">Verás aquí su contenido completo y, si es una regla, cómo se lee.</span>
      </div>
    );
  }
  const ayuda = COLUMN_HELP[celda.columna];
  const lectura = scope && valor.trim() && LEIBLES.has(celda.columna)
    ? celda.columna === "constraint" && nodo
      ? describeValidation(valor, nodo, scope)
      : describeExpression(valor, scope)
    : null;
  const lee = lectura?.summary ?? null;
  // El aviso (comillas tipográficas que ODK no reconoce) viaja aparte de la frase: si sólo se lee `summary`, se pierde.
  const aviso = lectura?.aviso ?? null;
  return (
    <div className="xfx-barra">
      <span className="xfx-barra__dir" title={ayuda?.detail}>
        <span className="xfx-barra__hoja">{celda.hoja}</span> fila {celda.fila + 1} · <code>{celda.columna}</code>
        {ayuda ? <span className="xfx-barra__ayuda">{ayuda.label}</span> : null}
      </span>
      <input
        className="xfx-barra__valor"
        value={valor}
        onChange={(e) => onCambiar(e.target.value)}
        aria-label={`Contenido de ${celda.columna}, fila ${celda.fila + 1}`}
        spellCheck={false}
      />
      {lee ? <span className="xfx-barra__lee"><span className="xfk-over">Se lee</span> {lee}</span> : null}
      {aviso ? <span className="xfx-barra__lee is-aviso" role="note"><span className="xfk-over">Aviso</span> {aviso}</span> : null}
    </div>
  );
}
