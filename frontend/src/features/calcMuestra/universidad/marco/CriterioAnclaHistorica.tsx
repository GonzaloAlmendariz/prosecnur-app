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

/**
 * Traduce los códigos del ancla histórica para mostrarlos.
 *
 * `metodo_ic` y `suficiencia` son **valores de contrato**: el motor los compara
 * por nombre (`identical(cell$metodo_ic, "bootstrap_percentil")`), así que no se
 * pueden renombrar en R. Pero mostrarlos crudos deja «bootstrap_percentil» y
 * «delgada» en la pantalla de un cliente.
 *
 * Lo que no se reconoce pasa tal cual: un código nuevo del motor es preferible a
 * una etiqueta inventada que lo oculte.
 */
function etiquetaMetodoIC(valor: string | null | undefined): string {
  if (valor === "bootstrap_percentil") return "Bootstrap por percentiles";
  if (valor === "no_aplica") return "No aplica";
  return valor ?? "—";
}

function etiquetaSuficiencia(valor: string | null | undefined): string {
  if (valor === "solida") return "Sólida";
  if (valor === "delgada") return "Delgada";
  if (valor === "insuficiente") return "Insuficiente";
  if (valor === "vacia") return "Sin casos";
  return valor ?? "—";
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

  // Un aviso compartido por todas las facultades es UN hecho del criterio, no
  // dieciocho. Cuando además ninguna fila publica tasa ni k, las nueve filas de
  // metadatos por facultad no dicen nada que el bloque no diga mejor una vez.
  const avisos = new Set(anchors.map((anchor) => anchor.warning ?? ""));
  const avisoComun = avisos.size === 1 ? [...avisos][0] : null;
  const niveles = new Set(anchors.map((anchor) => anchor.match_level));
  const ningunaPublica = anchors.every((anchor) => anchor.k === null && anchor.tasa === null);

  if (avisoComun && ningunaPublica) {
    const primera = anchors[0];
    return (
      <div
        className="cmv2-i18b-anchors"
        data-qa-geometry-group="calc-muestra/criterios-anclas"
        data-qa-geometry-contract="intrinsic"
      >
        <article
          className="cmv2-i18b-anchor cmv2-i18b-anchor-comun"
          data-match-level={niveles.size === 1 ? primera.match_level : "mixto"}
          data-anchor-shared="true"
          data-qa-geometry-member
          data-qa-geometry-capacity="owned"
          role="status"
        >
          <header>
            <div>
              <strong>Sin coincidencia publicable en {anchors.length} {anchors.length === 1 ? "facultad" : "facultades"}</strong>
              <span>{primera.requested_label ?? primera.requested_dimension ?? "Criterio sin característica histórica"}</span>
            </div>
            <span className="cmv2-i18b-anchor-level">{niveles.size === 1 ? primera.match_level : "mixto"}</span>
          </header>
          <dl>
            <div><dt>Facultad del criterio</dt><dd>{facultyDimensionLabel(primera.faculty_dimension)}</dd></div>
            <div><dt>Facultad de referencia</dt><dd>{facultyDimensionLabel(primera.reference_faculty_dimension)}</dd></div>
            <div><dt>Periodo</dt><dd>{primera.periodo}</dd></div>
          </dl>
          <p role="note">{avisoComun}</p>
          <p className="cmv2-i18b-anchor-facultades">
            {anchors.map((anchor) => anchor.faculty_label).join(" · ")}
          </p>
        </article>
      </div>
    );
  }

  return (
    <div
      className="cmv2-i18b-anchors"
      data-qa-geometry-group="calc-muestra/criterios-anclas"
      data-qa-geometry-contract="intrinsic"
    >
      {avisoComun && anchors.length > 1 ? (
        <p className="cmv2-i18b-anchor-aviso-comun" role="note" data-anchor-shared="true">{avisoComun}</p>
      ) : null}
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
            <div><dt>Método IC</dt><dd>{etiquetaMetodoIC(anchor.metodo_ic)}</dd></div>
            <div><dt>Suficiencia</dt><dd>{etiquetaSuficiencia(anchor.suficiencia)}</dd></div>
            <div><dt>Periodo</dt><dd>{anchor.periodo}</dd></div>
          </dl>
          {avisoComun && anchors.length > 1 ? null : <p role="note">{anchor.warning}</p>}
        </article>
      ))}
    </div>
  );
}
