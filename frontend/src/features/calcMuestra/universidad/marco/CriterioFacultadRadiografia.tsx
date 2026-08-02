import type { CalcMuestraAulasCriteriosRadiografia } from "../../../../api/calcMuestraCriteriosRadiografia";
import type {
  CalcMuestraCriteriosAnclasHistoricas,
  CalcMuestraCriteriosCascada,
  CalcMuestraCriteriosPreviewInput,
  CalcMuestraCriteriosTotales,
} from "../../../../api/calcMuestraCriteriosI18b";
import {
  boxplotDomain,
  CriterioBoxplotLeyenda,
  CriterioBoxplotPercentilar,
} from "./CriterioBoxplotPercentilar";
import { CriteriosRadiografiaCardDetalle } from "./CriteriosRadiografiaCardDetalle";
import type { CriterioRadiografiaCard } from "./criteriosRadiografiaModel";
import "./criterioFacultadRadiografia.css";

const NUMBER = new Intl.NumberFormat("es-PE", { maximumFractionDigits: 1 });
const MAX_VISIBLE_SEGMENTS = 4;

function fmt(value: number | null): string {
  return value === null ? "NA" : NUMBER.format(value);
}

export type CriterioFacultadEvidence = {
  radiografia: CalcMuestraAulasCriteriosRadiografia;
  totals: CalcMuestraCriteriosTotales | null;
  cascade: CalcMuestraCriteriosCascada | null;
  anchors: CalcMuestraCriteriosAnclasHistoricas | null;
  previewRequest: CalcMuestraCriteriosPreviewInput | null;
  complete: boolean;
};

function rowsForFaculty<Row extends { key: string }>(
  rows: Row[],
  facultyKey: string,
): Row[] {
  return rows.filter((row) => row.key === facultyKey);
}

export function criterioCardForFaculty(
  card: CriterioRadiografiaCard,
  facultyKey: string,
  _facultyLabel: string,
): CriterioRadiografiaCard {
  return {
    ...card,
    entries: card.entries.map((entry) => ({
      ...entry,
      rows: rowsForFaculty(
        entry.rows.map((row) => ({ ...row, key: row.faculty_key, label: row.faculty_label })),
        facultyKey,
      ).map(({ key: _key, label: _label, ...row }) => row),
    })),
    v1Rows: rowsForFaculty(
      card.v1Rows.map((row) => ({ ...row, key: row.facultad_key, label: row.facultad_label })),
      facultyKey,
    ).map(({ key: _key, label: _label, ...row }) => row),
  };
}

export function CriterioFacultadRadiografia({
  card,
  facultyKey,
  facultyLabel,
  evidence,
}: {
  card: CriterioRadiografiaCard | null;
  facultyKey: string;
  facultyLabel: string;
  evidence: CriterioFacultadEvidence | null;
}) {
  if (!card || !evidence) {
    return (
      <div className="cmv2-crc-inline-empty" role="status">
        El motor no publicó una radiografía acreditable para este criterio en {facultyLabel}.
      </div>
    );
  }

  const facultyCard = criterioCardForFaculty(card, facultyKey, facultyLabel);
  const localRows = facultyCard.entries.reduce((total, entry) => total + entry.rows.length, 0) + facultyCard.v1Rows.length;
  if (card.state === "v2" && localRows === 0) {
    return (
      <div className="cmv2-crc-contract-alert" role="alert">
        El contrato v2 existe, pero no publica la fila de {facultyLabel} para este criterio. La interfaz no la
        reemplaza con el total ni con otra facultad.
      </div>
    );
  }

  const invalid = facultyCard.state === "invalido";
  const compactRows = invalid
    ? []
    : facultyCard.entries.flatMap((entry) => entry.rows.map((row) => ({ entry, row })));
  const visibleRows = compactRows.slice(0, MAX_VISIBLE_SEGMENTS);
  const hiddenRows = Math.max(0, compactRows.length - visibleRows.length);
  // S4: las categorías de un criterio se comparan entre sí sobre una escala
  // única. El dominio se calcula sobre TODAS las filas del criterio, no solo
  // las visibles, para que recortar la lista no cambie el gráfico.
  const domain = boxplotDomain(compactRows.map(({ row }) => row.actual.distribution));

  return (
    <div
      className="cmv2-crc-faculty-inline"
      aria-label={`Radiografía de ${card.label} en ${facultyLabel}`}
      data-card-id={card.cardId}
      data-faculty-key={facultyKey}
    >
      <section className="cmv2-crc-compact" data-state={card.state}>
        <header className="cmv2-crc-compact-head">
          <div>
            <span>Radiografía en {facultyLabel}</span>
            {/* «Dato de R» nombra de dónde sale el número, no qué es. */}
            <strong>Elegibles por curso-horario según {card.label.toLocaleLowerCase("es-PE")}</strong>
          </div>
          <span className="cmv2-crc-compact-state">{card.state === "v2" ? "vigente" : card.state.replace("_", " ")}</span>
        </header>

        {visibleRows.length ? <CriterioBoxplotLeyenda domain={domain} unidad="alumnos por CH" /> : null}
        {visibleRows.length ? (
          <div
            className="cmv2-crc-compact-segments"
            data-qa-geometry-group="calc-muestra/radiografia-compacta-facultad"
            data-qa-geometry-contract="intrinsic"
          >
            {visibleRows.map(({ entry, row }) => row.actual.n_ch === 0 && row.actual.distribution.media === null ? (
              // Categoría sin CH en esta facultad: se declara, no se oculta,
              // pero no ocupa el mismo ancho que una con distribución.
              <article
                className="cmv2-crc-compact-segment"
                key={`${entry.id}:${row.segment_key}:${row.segment_kind}`}
                data-criterion-id={entry.id}
                data-segment-empty="true"
                data-qa-geometry-member
                data-qa-geometry-capacity="owned"
                role="status"
              >
                <header>
                  <strong>{row.segment_label}</strong>
                  {facultyCard.entries.length > 1 ? <span>{entry.label}</span> : null}
                </header>
                <p>0 CH</p>
              </article>
            ) : (
              <article
                className="cmv2-crc-compact-segment"
                key={`${entry.id}:${row.segment_key}:${row.segment_kind}`}
                data-criterion-id={entry.id}
                data-qa-geometry-member
                data-qa-geometry-capacity="owned"
              >
                <header>
                  <strong>{row.segment_label}</strong>
                  {facultyCard.entries.length > 1 ? <span>{entry.label}</span> : null}
                </header>
                <CriterioBoxplotPercentilar
                  label={`${facultyLabel} · ${entry.label} · ${row.segment_label} · elegibles`}
                  distribution={row.actual.distribution}
                  domain={domain}
                />
                <dl aria-label={`Cifras elegibles de ${row.segment_label}`}>
                  <div><dt>CH</dt><dd>{fmt(row.actual.n_ch)}</dd></div>
                  <div><dt>CH con dato</dt><dd>{fmt(row.actual.n_ch_con_dato)}</dd></div>
                  <div><dt>Alumnos</dt><dd>{fmt(row.actual.n_estudiantes_unicos)}</dd></div>
                  <div><dt>Matrículas</dt><dd>{fmt(row.actual.n_matriculas)}</dd></div>
                  <div><dt>Media</dt><dd>{fmt(row.actual.distribution.media)}</dd></div>
                  <div><dt>P10</dt><dd>{fmt(row.actual.distribution.p10)}</dd></div>
                  <div><dt>P25</dt><dd>{fmt(row.actual.distribution.p25)}</dd></div>
                  <div><dt>Mediana</dt><dd>{fmt(row.actual.distribution.p50)}</dd></div>
                  <div><dt>P75</dt><dd>{fmt(row.actual.distribution.p75)}</dd></div>
                  <div><dt>P90</dt><dd>{fmt(row.actual.distribution.p90)}</dd></div>
                </dl>
                <p>
                  Contraste total: {fmt(row.contraste_total.n_ch)} CH · media {fmt(row.contraste_total.distribution.media)}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <div className="cmv2-crc-inline-empty" role={invalid ? "alert" : "status"}>
            {invalid
              ? facultyCard.issue ?? "La tarjeta no cumple el contrato y sus filas quedan retenidas."
              : "R publicó el gate, pero no hay un segmento estadístico visible para esta facultad."}
          </div>
        )}

        {/* F43 · Acotado a la facultad en foco, este bloque deja de ser «las
            quince dentro de una» —4.719 px, el módulo duplicado por criterio— y
            pasa a ser lo que su nombre prometía: el detalle de esta facultad.
            Ya no hay motivo para plegarlo, y por eso desaparece el último
            `<details>` de la pestaña. La comparación entre facultades vive
            arriba, en el panorama y la matriz, que es su sitio. */}
        <section className="cmv2-crc-compact-detail">
          {hiddenRows ? (
            <p className="cmv2-crc-compact-count">{hiddenRows} segmentos más de esta facultad</p>
          ) : null}
          <CriteriosRadiografiaCardDetalle
            card={facultyCard}
            radiografia={evidence.radiografia}
            totals={null}
            cascade={evidence.cascade}
            anchors={evidence.anchors}
            previewRequest={evidence.previewRequest}
            i18bComplete={evidence.complete}
            context="faculty"
            facultyKey={facultyKey}
            facultyLabel={facultyLabel}
          />
        </section>
      </section>
    </div>
  );
}
