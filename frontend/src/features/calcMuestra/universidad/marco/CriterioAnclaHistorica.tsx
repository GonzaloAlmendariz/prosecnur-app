import type { CalcMuestraCriteriosAnchorRow } from "../../../../api/calcMuestraCriteriosI18b";
import "./criteriosI18b.css";

const INTEGER = new Intl.NumberFormat("es-PE", { maximumFractionDigits: 0 });
const PERCENT = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function fmtK(value: number | null): string {
  return value === null ? "NA" : INTEGER.format(value);
}

function fmtRate(value: number | null): string {
  return value === null ? "NA" : PERCENT.format(value);
}

function fmtInterval(low: number | null, high: number | null): string {
  return low === null || high === null
    ? "IC 95% NA"
    : `IC 95% ${fmtRate(low)}–${fmtRate(high)}`;
}

function facultyDimensionLabel(
  value: CalcMuestraCriteriosAnchorRow["faculty_dimension"] |
    CalcMuestraCriteriosAnchorRow["reference_faculty_dimension"],
): string {
  if (value === "alumno") return "Facultad del alumno";
  if (value === "curso_horario_efectiva") return "Facultad efectiva del CH";
  if (value === "facultad_historica") return "Facultad histórica";
  return "Sin referencia histórica";
}

export function CriterioAnclaHistorica({
  cardId,
  rows,
  facultyKey,
}: {
  cardId: string;
  rows: CalcMuestraCriteriosAnchorRow[];
  facultyKey?: string;
}) {
  const anchors = rows.filter((row) => (
    row.card_id === cardId && (!facultyKey || row.faculty_key === facultyKey)
  ));
  if (!anchors.length) {
    return (
      <div className="cmv2-i18b-anchor-empty" role="status" data-state="sin_ancla">
        <strong>Sin ancla histórica para este criterio</strong>
        <span>La referencia no publicó una coincidencia ni una degradación acreditable.</span>
      </div>
    );
  }

  return (
    <div
      className="cmv2-i18b-anchors"
      data-qa-geometry-group="calc-muestra/criterios-anclas"
      data-qa-geometry-contract="intrinsic"
    >
      {anchors.map((anchor, index) => (
        <article
          className="cmv2-i18b-anchor"
          key={`${anchor.criterion_id}:${anchor.faculty_key}:${anchor.requested_dimension ?? "na"}:${anchor.requested_key ?? index}`}
          data-match-level={anchor.match_level}
          data-qa-geometry-member
          data-qa-geometry-capacity="owned"
        >
          <header>
            <div>
              <strong>{anchor.faculty_label}</strong>
              <span>{anchor.requested_label ?? anchor.requested_dimension ?? "Criterio sin característica histórica"}</span>
            </div>
            <span className="cmv2-i18b-anchor-level">{anchor.match_level}</span>
          </header>
          <dl>
            <div><dt>Coincidencia</dt><dd>{anchor.matched_label ?? anchor.matched_dimension ?? "NA"}</dd></div>
            <div><dt>Facultad del criterio</dt><dd>{facultyDimensionLabel(anchor.faculty_dimension)}</dd></div>
            <div><dt>Facultad de referencia</dt><dd>{facultyDimensionLabel(anchor.reference_faculty_dimension)}</dd></div>
            <div><dt>Cobertura</dt><dd>k={fmtK(anchor.k)}</dd></div>
            <div><dt>Tasa</dt><dd>{fmtRate(anchor.tasa)}</dd></div>
            <div><dt>Intervalo</dt><dd>{fmtInterval(anchor.ic_low, anchor.ic_high)}</dd></div>
            <div><dt>Método IC</dt><dd>{anchor.metodo_ic}</dd></div>
            <div><dt>Suficiencia</dt><dd>{anchor.suficiencia}</dd></div>
            <div><dt>Periodo</dt><dd>{anchor.periodo}</dd></div>
          </dl>
          <p role="note">{anchor.warning}</p>
        </article>
      ))}
    </div>
  );
}
