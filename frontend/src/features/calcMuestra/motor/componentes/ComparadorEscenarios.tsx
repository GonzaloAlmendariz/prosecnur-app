/**
 * Comparador de escenarios: E1 (muestra única, inferencia al total) frente a
 * E2 (cada unidad como estrato propio, con ponderación W). Con tabla oficial
 * disponible, expone la cifra de diseño junto al despeje recomputado.
 */
import { CheckCircle2 } from "lucide-react";
import { fmtDec, fmtInt } from "../../sharedCore";
import type { ResultadoEscenario1, ResultadoEscenario2 } from "../../dominio";
import { TerminoChip } from "../../universidad/ui";

export function ComparadorEscenarios({
  e1,
  e2,
  escenario,
  onEscenario,
  etiquetaUnidad,
}: {
  e1: ResultadoEscenario1;
  e2: ResultadoEscenario2 | null;
  escenario: "e1" | "e2";
  onEscenario: (escenario: "e1" | "e2") => void;
  etiquetaUnidad: string;
}) {
  return (
    <div className="rec-escenarios">
      <div className="rec-escenarios-cards">
        <button
          type="button"
          className="rec-escenario-card"
          data-activo={escenario === "e1" || undefined}
          onClick={() => onEscenario("e1")}
        >
          {escenario === "e1" && <CheckCircle2 size={15} className="rec-escenario-check" aria-hidden="true" />}
          <h4>Escenario 1 · global</h4>
          <p className="rec-escenario-cifra">{fmtInt(e1.nDiseno)} encuestas · {fmtInt(e1.aulasBase)} aulas</p>
          <p>
            Muestra única con afijación proporcional por {etiquetaUnidad} × sexo. Nivel de
            inferencia: total institución.
          </p>
        </button>
        <button
          type="button"
          className="rec-escenario-card"
          data-activo={escenario === "e2" || undefined}
          data-deshabilitado={!e2 || undefined}
          disabled={!e2}
          onClick={() => e2 && onEscenario("e2")}
        >
          {escenario === "e2" && <CheckCircle2 size={15} className="rec-escenario-check" aria-hidden="true" />}
          <h4>Escenario 2 · por {etiquetaUnidad}</h4>
          <p className="rec-escenario-cifra">
            {e2
              ? `${fmtInt(e2.totalDiseno ?? e2.totalOficial ?? e2.totalFormula)} encuestas${e2.aulasOficial != null ? ` · ${fmtInt(e2.aulasOficial)} aulas` : ""}`
              : "requiere configuración E2"}
          </p>
          <p>
            Cada {etiquetaUnidad} como estrato con muestra propia (parámetros escalonados por
            tamaño, p observada). Nivel de inferencia: por {etiquetaUnidad}; el total se reporta
            con <TerminoChip termino="ponderación">ponderación (W)</TerminoChip>.
          </p>
        </button>
      </div>

      {escenario === "e2" && e2 && (
        <div className="rec-e2-tabla" role="table" aria-label={`Escenario 2 por ${etiquetaUnidad}`}>
          <div className="rec-e2-fila rec-e2-head" role="row">
            <span role="columnheader">{etiquetaUnidad}</span>
            <span role="columnheader">Parámetros</span>
            <span role="columnheader">p</span>
            <span role="columnheader">n diseño</span>
            <span role="columnheader">n recomputado</span>
            <span role="columnheader">W</span>
          </div>
          {e2.filas.map((fila) => (
            <div key={fila.facultadId} className="rec-e2-fila" role="row">
              <span role="rowheader">{fila.nombre}</span>
              <span role="cell">{Math.round(fila.confianza * 100)}% · e {fmtDec(fila.margenError * 100, 0)}%</span>
              <span role="cell">{fmtDec(fila.p * 100, 0)}%</span>
              <span role="cell"><strong>{fila.nOficial != null ? fmtInt(fila.nOficial) : "—"}</strong></span>
              <span role="cell">{fmtInt(fila.nFormula)}</span>
              <span role="cell">{fila.W != null ? fmtDec(fila.W, 2) : "—"}</span>
            </div>
          ))}
          <div className="rec-e2-fila rec-e2-total" role="row">
            <span role="rowheader">Total</span>
            <span role="cell" />
            <span role="cell" />
            <span role="cell">
              <strong>{(e2.totalDiseno ?? e2.totalOficial) != null ? fmtInt(e2.totalDiseno ?? e2.totalOficial) : "—"}</strong>
            </span>
            <span role="cell">{fmtInt(e2.totalFormula)}</span>
            <span role="cell" />
          </div>
        </div>
      )}
    </div>
  );
}
