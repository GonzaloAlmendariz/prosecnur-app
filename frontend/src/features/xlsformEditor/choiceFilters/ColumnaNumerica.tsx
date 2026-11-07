// Comparación numérica (E11 editor-conjoint, 2026-11-06): cada opción con su número en la columna que se compara
// (`edad_min <= ${edad}`), editable aquí. Antes la vista listaba las opciones sin su número y había que ir al Editor
// XLSForm para verlo o cambiarlo.

import type { XlsformEditorSheet } from "../../../api/multiIntegrado";
import type { OperadorComparacion } from "./escrituraFiltros";
import type { AnalisisFiltro } from "./modeloFiltros";

const LECTURA: Record<OperadorComparacion, string> = {
  "<=": "es menor o igual que",
  "<": "es menor que",
  ">=": "es mayor o igual que",
  ">": "es mayor que",
};

type Props = {
  a: AnalisisFiltro;
  choices: XlsformEditorSheet;
  columna: string;
  operador: OperadorComparacion;
  /** Texto de la pregunta numérica con que se compara. */
  pregunta: string;
  editable: boolean;
  onNumero: (codigo: string, valor: string) => void;
};

export function ColumnaNumerica({ a, choices, columna, operador, pregunta, editable, onNumero }: Props) {
  const iL = choices.columns.indexOf("list_name");
  const iN = choices.columns.indexOf("name");
  const iC = choices.columns.indexOf(columna);
  const numeroDe = (codigo: string) => {
    const fila = choices.rows.find((r) => (r[iL] ?? "").trim() === a.lista && (r[iN] ?? "").trim() === codigo);
    return iC >= 0 ? (fila?.[iC] ?? "").trim() : "";
  };
  return (
    <div className="xcf-matriz">
      <div className="xcf-matriz__cab">
        <div className="xcf-matriz__titulos">
          <h4>Número por opción</h4>
          <span className="xcf-matriz__sub">La opción se muestra si su número {LECTURA[operador]} la respuesta de {pregunta}</span>
        </div>
        <span className="xcf-nota">Columna <code>{columna}</code></span>
      </div>
      <ul className="xcf-numeros" aria-label={`Número de cada opción en ${columna}`}>
        {a.opciones.map((o) => {
          const n = numeroDe(o.codigo);
          return (
            <li key={o.codigo} className={n === "" ? "is-vacia" : undefined}>
              <span className="xcf-numeros__texto" title={`${o.etiqueta} (${o.codigo})`}>{o.etiqueta || o.codigo}</span>
              <input
                className="xcf-input xcf-numeros__valor"
                inputMode="decimal"
                aria-label={`${columna} de ${o.etiqueta || o.codigo}`}
                value={n}
                disabled={!editable}
                placeholder="—"
                onChange={(e) => onNumero(o.codigo, e.target.value.replace(/[^\d.,-]/g, "").replace(",", "."))}
              />
            </li>
          );
        })}
      </ul>
      {a.opciones.some((o) => numeroDe(o.codigo) === "") ? <p className="xcf-nota">Una opción sin número no se muestra nunca.</p> : null}
    </div>
  );
}
