import { fmtPct, rowsFrom } from "../../sharedCore";
import { classroomRowNumber, classroomRowText } from "../shared/format";

export function ObjectiveWeightsPanel({ variables }: { variables?: Array<Record<string, unknown>> | unknown }) {
  const rows = rowsFrom<Record<string, unknown>>(variables);
  const total = rows.reduce((sum, row) => sum + Math.max(0, classroomRowNumber(row, ["weight"])), 0) || 1;
  return (
    <div className="cmv2-representativity-panel">
      <div className="cmv2-subhead">
        <strong>Pesos y tolerancias activas</strong>
      </div>
      <div className="cmv2-objective-bars">
        {rows.map((row) => {
          const weight = Math.max(0, classroomRowNumber(row, ["weight"]));
          const tolerance = classroomRowNumber(row, ["tolerance"]);
          return (
            <div key={classroomRowText(row, ["dimension", "label"])} className="cmv2-objective-row">
              <span>{classroomRowText(row, ["label", "dimension"])}</span>
              <div aria-hidden="true"><i style={{ width: `${Math.max(4, (weight / total) * 100)}%` }} /></div>
              <strong>{fmtPct(weight)}</strong>
              <em>tol. {fmtPct(tolerance)}</em>
            </div>
          );
        })}
      </div>
    </div>
  );
}
