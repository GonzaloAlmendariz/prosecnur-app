import { ArrowRight, Table2 } from "../../../../vendor/lucide-react";
import type {
  CalcMuestraMatrizEmbudo,
  CalcMuestraMatrizEmbudoCell,
} from "../../../../api/calcMuestraMatrizEmbudo";
import { fmtInt } from "../../sharedCore";
import { AvisoModulo } from "../shared/AvisoModulo";
import "./matrizEmbudo.css";

function signed(value: number | null): string {
  if (value === null) return "—";
  return `${value > 0 ? "+" : ""}${fmtInt(value)}`;
}

function ImpactCell({ cell }: { cell: CalcMuestraMatrizEmbudoCell }) {
  const publishable = cell.status === "disponible" && cell.delta.reconstruccion_valida;
  if (!publishable) {
    return (
      <td className="cmv2-matriz-embudo-impact" data-status={cell.status}>
        <strong>—</strong>
        <small>{cell.status === "no_aplica" ? "No aplica" : "Sin impacto acreditable"}</small>
      </td>
    );
  }
  return (
    <td className="cmv2-matriz-embudo-impact" data-status={cell.status}>
      <strong>{signed(cell.delta.delta_ch)} CH</strong>
      <small>{signed(cell.delta.delta_matriculas)} matrículas</small>
      <small>{signed(cell.delta.delta_estudiantes_unicos)} estudiantes únicos</small>
    </td>
  );
}

export function MatrizEmbudoCriterios({
  matriz,
  rawPresent,
}: {
  matriz: CalcMuestraMatrizEmbudo | null;
  rawPresent: boolean;
}) {
  if (!matriz) {
    return (
      <section
        className="cmv2-panel cmv2-matriz-embudo"
        aria-labelledby="cmv2-matriz-embudo-title"
        data-qa-geometry-group="calc-muestra/matriz-criterios"
        data-qa-geometry-contract="intrinsic"
      >
        <header className="cmv2-matriz-embudo-head">
          <span aria-hidden="true"><Table2 size={18} /></span>
          <div>
            <small>Dato → impacto</small>
            <h3 id="cmv2-matriz-embudo-title">Matriz marginal por facultad</h3>
          </div>
        </header>
        <AvisoModulo tone={rawPresent ? "warn" : "info"} role="status">
          {rawPresent
            ? "La matriz marginal llegó incompleta o no corresponde al marco ejecutado. Reconstruye el marco para volver a acreditarla."
            : "Reconstruye el marco para publicar el impacto marginal de cada criterio por facultad."}
        </AvisoModulo>
      </section>
    );
  }

  const rows = [
    ...matriz.rows.filter((row) => row.row_kind === "total"),
    ...matriz.rows.filter((row) => row.row_kind === "faculty"),
  ];

  return (
    <section
      className="cmv2-panel cmv2-matriz-embudo"
      aria-labelledby="cmv2-matriz-embudo-title"
      data-surface-group="calc-muestra-marco"
      data-surface-contract="matriz-marginal-criterios"
      data-surface-member="impactos-por-facultad"
      data-qa-geometry-group="calc-muestra/matriz-criterios"
      data-qa-geometry-contract="intrinsic"
    >
      <header className="cmv2-matriz-embudo-head">
        <span aria-hidden="true"><Table2 size={18} /></span>
        <div>
          <small>Dato → impacto</small>
          <h3 id="cmv2-matriz-embudo-title">Matriz marginal por facultad</h3>
          <p>
            Cada celda compara una regla con el <strong>marco ejecutado</strong> y muestra su impacto si se
            reconstruyera. Son <strong>impactos marginales, no aditivos</strong>: no se suman entre columnas ni
            forman un embudo secuencial.
          </p>
        </div>
      </header>

      <div
        className="cmv2-matriz-embudo-scroll"
        tabIndex={0}
        aria-label="Matriz desplazable de impactos marginales"
        data-qa-geometry-member
      >
        <table className="cmv2-matriz-embudo-table">
          <thead>
            <tr>
              <th scope="col">Facultad</th>
              <th scope="col" className="cmv2-matriz-embudo-frame">Marco ejecutado</th>
              {matriz.columns.map((column) => (
                <th key={column.criterion_id} scope="col" data-status={column.status}>
                  <small>{column.card_id}</small>
                  <span>{column.label}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const cells = new Map(row.cells.map((cell) => [cell.criterion_id, cell]));
              return (
                <tr key={row.faculty_key} data-row-kind={row.row_kind}>
                  <th scope="row">{row.faculty_label}</th>
                  <td className="cmv2-matriz-embudo-frame">
                    <strong>{fmtInt(row.n_ch_bruto)}</strong>
                    <ArrowRight size={13} aria-hidden="true" />
                    <strong>{fmtInt(row.n_ch_elegibles)}</strong>
                    <small>CH bruto → elegible</small>
                  </td>
                  {matriz.columns.map((column) => {
                    const cell = cells.get(column.criterion_id);
                    return cell
                      ? <ImpactCell key={column.criterion_id} cell={cell} />
                      : <td key={column.criterion_id}>—</td>;
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <footer className="cmv2-matriz-embudo-foot">
        Unidad: curso-horario único · Facultad efectiva del curso-horario · Firma {matriz.frame_hash.slice(0, 10)}
      </footer>
    </section>
  );
}
