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
  // ADR 0057 · Un criterio que no recorta se dice una vez, no tres.
  //
  // Medido: la matriz mostraba «0 CH / 0 matrículas / 0 estudiantes únicos» en
  // las noventa celdas. Los ceros eran correctos —el motor publica
  // `action: "no_aplica"`—, pero repetir el cero en tres unidades no informa de
  // nada y **entierra las celdas que sí tienen impacto**, que son las únicas por
  // las que existe esta tabla.
  const sinImpacto =
    cell.delta.delta_ch === 0 &&
    cell.delta.delta_matriculas === 0 &&
    cell.delta.delta_estudiantes_unicos === 0;
  if (sinImpacto) {
    return (
      // Coherente con el Panorama: lo normal se marca, no se narra. «No recorta
      // aquí» repetido 128 veces vuelve a ser el ruido que acabábamos de quitar.
      <td
        className="cmv2-matriz-embudo-impact"
        data-status={cell.status}
        data-sin-impacto="true"
        title="Este criterio no recorta cursos-horario en esta facultad"
      >
        <strong>·</strong>
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
            <h3 id="cmv2-matriz-embudo-title">Qué pasaría si quitara cada criterio</h3>
          </div>
        </header>
        <AvisoModulo tone={rawPresent ? "warn" : "info"} role="status">
          {rawPresent
            ? "Esta comparación llegó incompleta o no corresponde al marco ejecutado. Reconstruye el marco para volver a calcularla."
            : "Reconstruye el marco para ver qué pasaría si quitaras cada criterio, facultad por facultad."}
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
          {/* ADR 0057 · «Matriz marginal», «impactos marginales, no aditivos»
              y «dato → impacto» son vocabulario de método. Dicen la verdad y no
              se entienden sin saberlo de antes. Lo que la tabla responde, en
              cambio, es una pregunta concreta que el usuario sí se hace. */}
          <small>Comparación</small>
          <h3 id="cmv2-matriz-embudo-title">Qué pasaría si quitara cada criterio</h3>
          <p>
            Cada celda muestra cuántos cursos-horario entrarían de más en esa facultad si ese criterio
            —y sólo ese— no se aplicara. <strong>No se suman entre columnas</strong>: cada una responde
            por su cuenta, quitando un criterio a la vez sobre el marco ya construido.
          </p>
        </div>
      </header>

      <div
        className="cmv2-matriz-embudo-scroll"
        tabIndex={0}
        aria-label="Tabla desplazable: efecto de quitar cada criterio, por facultad"
        data-qa-geometry-member
      >
        <table className="cmv2-matriz-embudo-table">
          <thead>
            <tr>
              <th scope="col">Facultad</th>
              <th scope="col" className="cmv2-matriz-embudo-frame">Marco ejecutado</th>
              {matriz.columns.map((column) => (
                /* Prueba del vocabulario: el encabezado publicaba la clave del
                   gate en mayúsculas antes del nombre (`COMPOSITION Composición
                   · nivel del curso`). Con tres columnas empezando igual, lo que
                   las distingue quedaba cortado. La clave pasa al `title`, donde
                   sigue disponible para trazar sin ocupar el rótulo. */
                <th key={column.criterion_id} scope="col" data-status={column.status} title={`${column.label} · gate ${column.card_id}`}>
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
