import type {
  CalcMuestraAulasCriterioRadiografiaV2Entry,
  CalcMuestraAulasCriterioRadiografiaV2Row,
  CalcMuestraAulasCriterioRadiografiaV2Snapshot,
  CalcMuestraAulasCriteriosRadiografia,
} from "../../../../api/calcMuestraCriteriosRadiografia";
import type {
  CalcMuestraCriteriosAnclasHistoricas,
  CalcMuestraCriteriosCascada,
  CalcMuestraCriteriosPreviewInput,
  CalcMuestraCriteriosTotalRow,
  CalcMuestraCriteriosTotales,
} from "../../../../api/calcMuestraCriteriosI18b";
import { useId } from "react";
import type { CriterioRadiografiaCard } from "./criteriosRadiografiaModel";
import { CriterioAnclaHistorica } from "./CriterioAnclaHistorica";
import { CriterioBoxplotPercentilar } from "./CriterioBoxplotPercentilar";
import { CriteriosEmbudoVivo } from "./CriteriosEmbudoVivo";
import "./criteriosRadiografia.css";

const NUMBER = new Intl.NumberFormat("es-PE", { maximumFractionDigits: 1 });

export const CRITERIO_RADIOGRAFIA_STATE_COPY = {
  v2: { label: "Radiografía v2", detail: "Contrato analítico completo del último marco ejecutado." },
  v1: { label: "Radiografía v1", detail: "Contrato I11 compatible para tipo de sesión." },
  legacy: { label: "Resumen legacy", detail: "Hay evidencia histórica parcial; faltan denominadores o contrafactual completo." },
  sin_dato: { label: "Sin dato", detail: "El engine no publicó señal suficiente para este criterio." },
  no_aplica: { label: "No aplica", detail: "Este gate no altera el marco ejecutado en el estado actual." },
  invalido: { label: "Contrato inválido", detail: "La evidencia no pasa el contrato y no se reemplaza por ceros." },
} as const;

const ACTION_COPY: Record<string, string> = {
  restringir_a_categoria: "Restringir a categoría",
  agregar_categoria: "Agregar categoría",
  quitar_categoria: "Quitar categoría",
  quitar_restriccion: "Quitar restricción",
  reemplazar_regla: "Reemplazar regla",
  activar: "Activar",
  desactivar: "Desactivar",
  reemplazar_umbral: "Reemplazar umbral",
  no_aplica: "No aplica",
};

function fmt(value: number | null): string {
  return value === null ? "NA" : NUMBER.format(value);
}

function signed(value: number | null, unit: string): string {
  if (value === null) return `NA ${unit}`;
  return `${value > 0 ? "+" : ""}${NUMBER.format(value)} ${unit}`;
}

function Snapshot({
  title,
  snapshot,
  label,
  variant,
}: {
  title: string;
  snapshot: CalcMuestraAulasCriterioRadiografiaV2Snapshot;
  label: string;
  variant: "actual" | "contraste";
}) {
  return (
    <div
      className="cmv2-crc-snapshot"
      data-qa-geometry-member
      data-qa-geometry-capacity="owned"
    >
      <strong>{title}</strong>
      <CriterioBoxplotPercentilar label={`${label} · ${title}`} distribution={snapshot.distribution} />
      <dl className="cmv2-crc-counts">
        <div><dt>{variant === "actual" ? "CH elegibles" : "CH de contraste"}</dt><dd>{fmt(snapshot.n_ch)}</dd></div>
        <div><dt>CH con dato</dt><dd>{fmt(snapshot.n_ch_con_dato)}</dd></div>
        <div><dt>Alumnos únicos</dt><dd>{fmt(snapshot.n_estudiantes_unicos)}</dd></div>
        <div><dt>Matrículas</dt><dd>{fmt(snapshot.n_matriculas)}</dd></div>
      </dl>
      <dl className="cmv2-crc-stats" aria-label={`${title}: media y cuantiles`}>
        <div data-main><dt>Media</dt><dd>{fmt(snapshot.distribution.media)}</dd></div>
        <div><dt>P10</dt><dd>{fmt(snapshot.distribution.p10)}</dd></div>
        <div><dt>P25</dt><dd>{fmt(snapshot.distribution.p25)}</dd></div>
        <div><dt>P50 · mediana</dt><dd>{fmt(snapshot.distribution.p50)}</dd></div>
        <div><dt>P75</dt><dd>{fmt(snapshot.distribution.p75)}</dd></div>
        <div><dt>P90</dt><dd>{fmt(snapshot.distribution.p90)}</dd></div>
      </dl>
    </div>
  );
}

type V2DisplayRow = {
  criterionId: string;
  gateLabel: string;
  facultyKey: string;
  facultyLabel: string;
  segmentKey: string;
  segmentLabel: string;
  segmentKind: string;
  actual: CalcMuestraAulasCriterioRadiografiaV2Snapshot;
  contrasteTotal: CalcMuestraAulasCriterioRadiografiaV2Snapshot;
  signalDistribution?: CalcMuestraCriteriosTotalRow["signal_distribution"];
};

function v2Rows(card: CriterioRadiografiaCard): V2DisplayRow[] {
  return card.entries.flatMap((entry) => entry.rows.map((row) => ({
    criterionId: entry.id,
    gateLabel: entry.label,
    facultyKey: row.faculty_key,
    facultyLabel: row.faculty_label,
    segmentKey: row.segment_key,
    segmentLabel: row.segment_label,
    segmentKind: row.segment_kind,
    actual: row.actual,
    contrasteTotal: row.contraste_total,
    signalDistribution: row.signal_distribution,
  })));
}

function totalRows(card: CriterioRadiografiaCard, totals: CalcMuestraCriteriosTotales | null): V2DisplayRow[] {
  return (totals?.rows ?? [])
    .filter((row) => row.card_id === card.cardId && card.gateIds.includes(row.criterion_id))
    .map((row) => ({
      criterionId: row.criterion_id,
      gateLabel: row.label,
      facultyKey: "__total_r__",
      facultyLabel: "Total recalculado por R",
      segmentKey: row.segment_key,
      segmentLabel: row.segment_label,
      segmentKind: row.segment_kind,
      actual: row.actual,
      contrasteTotal: row.contraste_total,
      signalDistribution: row.signal_distribution,
    }));
}

function rowsByFaculty(rows: V2DisplayRow[]) {
  const groups = new Map<string, { key: string; label: string; rows: V2DisplayRow[] }>();
  for (const item of rows) {
    const existing = groups.get(item.facultyKey);
    if (existing) existing.rows.push(item);
    else groups.set(item.facultyKey, { key: item.facultyKey, label: item.facultyLabel, rows: [item] });
  }
  return [...groups.values()];
}

function GateMetadata({ entry }: { entry: CalcMuestraAulasCriterioRadiografiaV2Entry }) {
  return (
    <div className="cmv2-crc-gate" data-status={entry.status}>
      <div className="cmv2-crc-gate-title">
        <strong>{entry.label}</strong>
        <span>{entry.status.replace("_", " ")}</span>
      </div>
      <dl>
        <div><dt>Gate</dt><dd>{entry.id}</dd></div>
        <div><dt>Owner</dt><dd>{entry.owner}</dd></div>
        <div><dt>Grano</dt><dd>{entry.grain}</dd></div>
        <div><dt>Unidad</dt><dd>{entry.unit}</dd></div>
        <div><dt>Facultad</dt><dd>{entry.faculty_dimension}</dd></div>
        <div><dt>Capa</dt><dd>{entry.effective_layer ?? "marco"}</dd></div>
      </dl>
      {entry.gate === "informativo" ? (
        <p role="note">Se aplica o reportará en la capa <strong>{entry.effective_layer}</strong>; no altera el N del marco.</p>
      ) : null}
      {entry.overlap ? <p className="cmv2-crc-overlap">segmentos solapados · no aditivos</p> : null}
    </div>
  );
}

function Segment({ row }: { row: V2DisplayRow }) {
  const label = `${row.facultyLabel} · ${row.gateLabel} · ${row.segmentLabel}`;
  return (
    <article
      className="cmv2-crc-segment"
      data-criterion-id={row.criterionId}
      data-qa-geometry-member
      data-qa-geometry-capacity="owned"
    >
      <header>
        <div><span>{row.gateLabel}</span><strong>{row.segmentLabel}</strong></div>
        <small>{row.segmentKind.replace("_", " ")}</small>
      </header>
      <div
        className="cmv2-crc-snapshot-pair"
        data-qa-geometry-group="calc-muestra/criterios-radiografia-snapshots"
        data-qa-geometry-contract="intrinsic"
      >
        <Snapshot title="Actual" snapshot={row.actual} label={label} variant="actual" />
        <Snapshot title="Contraste total" snapshot={row.contrasteTotal} label={label} variant="contraste" />
      </div>
      {row.signalDistribution ? (
        <div className="cmv2-crc-signal">
          <strong>Señal · {row.signalDistribution.unit.replace("_", " ")}</strong>
          <span>{fmt(row.signalDistribution.n_con_dato)} de {fmt(row.signalDistribution.n_total)} con dato</span>
          <CriterioBoxplotPercentilar label={`${label} · señal`} distribution={row.signalDistribution} />
          <dl className="cmv2-crc-stats" aria-label={`Señal de ${row.segmentLabel}: media y cuantiles`}>
            <div data-main><dt>Media</dt><dd>{fmt(row.signalDistribution.media)}</dd></div>
            <div><dt>P10</dt><dd>{fmt(row.signalDistribution.p10)}</dd></div>
            <div><dt>P25</dt><dd>{fmt(row.signalDistribution.p25)}</dd></div>
            <div><dt>P50 · mediana</dt><dd>{fmt(row.signalDistribution.p50)}</dd></div>
            <div><dt>P75</dt><dd>{fmt(row.signalDistribution.p75)}</dd></div>
            <div><dt>P90</dt><dd>{fmt(row.signalDistribution.p90)}</dd></div>
          </dl>
        </div>
      ) : null}
    </article>
  );
}

function V2Distribution({
  card,
  totals,
  includeTotal = true,
}: {
  card: CriterioRadiografiaCard;
  totals: CalcMuestraCriteriosTotales | null;
  includeTotal?: boolean;
}) {
  const facultyRows = v2Rows(card);
  const rTotals = includeTotal ? totalRows(card, totals) : [];
  const groups = rowsByFaculty([...facultyRows, ...rTotals]);
  return (
    <div
      className="cmv2-crc-faculties"
      data-qa-geometry-group="calc-muestra/criterios-radiografia-facultades"
      data-qa-geometry-contract="intrinsic"
    >
      {groups.map((group) => (
        <section
          className="cmv2-crc-faculty"
          key={group.key}
          data-row-kind={group.key === "__total_r__" ? "total" : "faculty"}
          data-qa-geometry-member
          data-qa-geometry-capacity="owned"
          aria-label={`Radiografía en ${group.label}`}
        >
          <header><strong>{group.label}</strong><span>{group.rows.length} segmentos</span></header>
          <div
            className="cmv2-crc-segments"
            data-qa-geometry-group="calc-muestra/criterios-radiografia-segmentos"
            data-qa-geometry-contract="intrinsic"
          >
            {group.rows.map((row) => (
              <Segment row={row} key={`${row.criterionId}:${row.segmentKey}:${row.segmentKind}`} />
            ))}
          </div>
        </section>
      ))}
      {includeTotal && facultyRows.length > 0 && rTotals.length === 0 ? (
        <section
          className="cmv2-crc-faculty cmv2-crc-total-empty"
          data-row-kind="total"
          data-qa-geometry-member
          data-qa-geometry-capacity="owned"
          role="status"
        >
          <header><strong>Total recalculado por R</strong><span>No publicado</span></header>
          <p>El frontend no suma facultades, estudiantes únicos, matrículas ni deltas para fabricar este Total.</p>
        </section>
      ) : null}
    </div>
  );
}

function V1Distribution({ card }: { card: CriterioRadiografiaCard }) {
  if (!card.v1Rows.length) return null;
  return (
    <div
      className="cmv2-crc-faculties"
      data-qa-geometry-group="calc-muestra/criterios-radiografia-facultades"
      data-qa-geometry-contract="intrinsic"
    >
      {card.v1Rows.map((row) => (
        <section
          className="cmv2-crc-faculty"
          key={`${row.facultad_key}:${row.categoria_key}`}
          data-qa-geometry-member
          data-qa-geometry-capacity="owned"
        >
          <header><strong>{row.facultad_label}</strong><span>{row.categoria_label}</span></header>
          <CriterioBoxplotPercentilar label={`${row.facultad_label} · ${row.categoria_label}`} distribution={row.distribucion_elegible} />
          <dl className="cmv2-crc-counts">
            <div><dt>N CH total</dt><dd>{fmt(row.n_ch_total)}</dd></div>
            <div><dt>N CH elegibles</dt><dd>{fmt(row.n_ch_elegibles)}</dd></div>
            <div><dt>Matrículas</dt><dd>{fmt(row.n_matriculas_elegibles)}</dd></div>
            <div><dt>CH con dato</dt><dd>{fmt(row.distribucion_elegible.n_ch_con_dato)}</dd></div>
          </dl>
          <dl className="cmv2-crc-stats" aria-label={`Media y cuantiles de ${row.categoria_label}`}>
            <div data-main><dt>Media</dt><dd>{fmt(row.distribucion_elegible.media)}</dd></div>
            <div><dt>P10</dt><dd>{fmt(row.distribucion_elegible.p10)}</dd></div>
            <div><dt>P25</dt><dd>{fmt(row.distribucion_elegible.p25)}</dd></div>
            <div><dt>P50 · mediana</dt><dd>{fmt(row.distribucion_elegible.p50)}</dd></div>
            <div><dt>P75</dt><dd>{fmt(row.distribucion_elegible.p75)}</dd></div>
            <div><dt>P90</dt><dd>{fmt(row.distribucion_elegible.p90)}</dd></div>
          </dl>
        </section>
      ))}
    </div>
  );
}

function EmptyDistribution({ card }: { card: CriterioRadiografiaCard }) {
  const meta = CRITERIO_RADIOGRAFIA_STATE_COPY[card.state];
  return (
    <div
      className="cmv2-crc-empty"
      data-qa-geometry-group="calc-muestra/criterios-radiografia-facultades"
      data-qa-geometry-contract="intrinsic"
    >
      <div data-qa-geometry-member data-qa-geometry-capacity="owned">
        <strong>{meta.label}</strong>
        <p>{card.issue ?? meta.detail}</p>
      </div>
    </div>
  );
}

function ImpactoMarginal({
  card,
  rows,
  v1Rows,
  invalid,
}: {
  card: CriterioRadiografiaCard;
  rows: Array<{ entry: CalcMuestraAulasCriterioRadiografiaV2Entry; row: CalcMuestraAulasCriterioRadiografiaV2Row }>;
  v1Rows: CriterioRadiografiaCard["v1Rows"];
  invalid: boolean;
}) {
  if (rows.length) {
    return (
      <ul className="cmv2-crc-impact-list">
        {rows.map(({ entry, row }) => (
          <li key={`${entry.id}:${row.faculty_key}:${row.segment_key}`}>
            <span><strong>{row.faculty_label}</strong> · {entry.label} · {row.segment_label}</span>
            <span>{signed(row.delta.delta_ch, "CH")} · {signed(row.delta.delta_matriculas, "matrículas")} · {signed(row.delta.delta_estudiantes_unicos, "alumnos únicos")}</span>
            <small>{row.delta.reconstruccion_valida ? "Contrafactual reconstruido" : "Reconstrucción no válida · deltas NA"}</small>
          </li>
        ))}
      </ul>
    );
  }
  if (v1Rows.length) {
    return (
      <ul className="cmv2-crc-impact-list">
        {v1Rows.map((row) => (
          <li key={`${row.facultad_key}:${row.categoria_key}`}>
            <span><strong>{row.facultad_label}</strong> · {row.categoria_label}</span>
            <span>{signed(row.delta_marginal.delta_ch, "CH")} · {signed(row.delta_marginal.delta_matriculas_elegibles, "matrículas")}</span>
            <small>Adapter I11 · referencia {row.delta_marginal.referencia}</small>
          </li>
        ))}
      </ul>
    );
  }
  return <p className="cmv2-crc-inline-empty">{invalid ? "Impacto retenido: el contrato de la tarjeta es inválido." : `No hay delta marginal publicable para ${card.label}.`}</p>;
}

export function CriteriosRadiografiaCardDetalle({
  card,
  radiografia,
  totals = null,
  cascade = null,
  anchors = null,
  previewRequest = null,
  i18bComplete = false,
  context = "standalone",
  facultyKey,
  facultyLabel,
}: {
  card: CriterioRadiografiaCard;
  radiografia: CalcMuestraAulasCriteriosRadiografia | null;
  totals?: CalcMuestraCriteriosTotales | null;
  cascade?: CalcMuestraCriteriosCascada | null;
  anchors?: CalcMuestraCriteriosAnclasHistoricas | null;
  previewRequest?: CalcMuestraCriteriosPreviewInput | null;
  i18bComplete?: boolean;
  context?: "standalone" | "faculty";
  facultyKey?: string;
  facultyLabel?: string;
}) {
  const instanceId = useId().replace(/:/g, "");
  const invalid = card.state === "invalido";
  const rows = invalid
    ? []
    : card.entries.flatMap((entry) => entry.rows.map((row) => ({ entry, row })));
  const v1Rows = invalid ? [] : card.v1Rows;
  const meta = CRITERIO_RADIOGRAFIA_STATE_COPY[card.state];
  const hasDistribution = rows.length > 0 || v1Rows.length > 0;
  const idSuffix = `${card.cardId}-${context === "faculty" ? facultyKey ?? "facultad" : "global"}-${instanceId}`;
  return (
    <article
      className="cmv2-crc-card"
      data-card-id={card.cardId}
      data-gates={card.gateIds.length}
      data-state={card.state}
      data-context={context}
      data-audit-ready={card.state === "v2" && i18bComplete}
      data-qa-geometry-group="calc-muestra/criterios-radiografia-pasos"
      data-qa-geometry-contract="intrinsic"
    >
      <header className="cmv2-crc-card-head">
        <div>
          <span>{context === "faculty" ? `Radiografía de ${facultyLabel ?? "la facultad"}` : card.scope === "alumno" ? "Estudiante" : "Curso-horario"}</span>
          <h4>{card.label}</h4>
        </div>
        <span className="cmv2-crc-state" data-state={card.state}>{meta.label}</span>
      </header>

      <section className="cmv2-crc-step" aria-labelledby={`crc-dato-${idSuffix}`} data-qa-geometry-member data-qa-geometry-capacity="owned">
        <header><span>1</span><h5 id={`crc-dato-${idSuffix}`}>Dato</h5></header>
        <p>{meta.detail}</p>
        {radiografia ? (
          <dl className="cmv2-crc-root-meta">
            <div><dt>Marco</dt><dd title={radiografia.frame_hash}>{radiografia.frame_hash}</dd></div>
            <div><dt>Momento</dt><dd>{radiografia.momento}</dd></div>
          </dl>
        ) : null}
        {!invalid && card.entries.length ? (
          <div className="cmv2-crc-gates">{card.entries.map((entry) => <GateMetadata entry={entry} key={entry.id} />)}</div>
        ) : null}
      </section>

      <section className="cmv2-crc-step" aria-labelledby={`crc-dist-${idSuffix}`} data-qa-geometry-member data-qa-geometry-capacity="owned">
        <header><span>2</span><h5 id={`crc-dist-${idSuffix}`}>Distribución</h5></header>
        <p>Boxplot percentilar P10–P90, media, denominadores y estadísticos publicados por R; NA permanece NA.</p>
        {rows.length ? <V2Distribution card={card} totals={totals} includeTotal={context !== "faculty"} /> : v1Rows.length ? <V1Distribution card={card} /> : <EmptyDistribution card={card} />}
      </section>

      <section className="cmv2-crc-step" aria-labelledby={`crc-cascada-${idSuffix}`} data-qa-geometry-member data-qa-geometry-capacity="owned">
        <header><span>3</span><h5 id={`crc-cascada-${idSuffix}`}>Cascada viva</h5></header>
        <p>Secuencia real del motor. No es la matriz marginal y no suma impactos entre criterios.</p>
        <CriteriosEmbudoVivo cardId={card.cardId} executed={cascade} previewRequest={previewRequest} facultyKey={facultyKey} />
      </section>

      <section className="cmv2-crc-step" aria-labelledby={`crc-ancla-${idSuffix}`} data-qa-geometry-member data-qa-geometry-capacity="owned">
        <header><span>4</span><h5 id={`crc-ancla-${idSuffix}`}>Ancla histórica</h5></header>
        <p>Coincidencia o degradación publicada por R; nunca combina marginales ni enlaza CH históricos.</p>
        <CriterioAnclaHistorica cardId={card.cardId} rows={anchors?.rows ?? []} facultyKey={facultyKey} />
      </section>

      <section className="cmv2-crc-step" aria-labelledby={`crc-impacto-${idSuffix}`} data-qa-geometry-member data-qa-geometry-capacity="owned">
        <header><span>5</span><h5 id={`crc-impacto-${idSuffix}`}>Impacto marginal</h5></header>
        <p>Foto contrafactual por regla; no forma la cascada y sus deltas no son aditivos.</p>
        <ImpactoMarginal card={card} rows={rows} v1Rows={v1Rows} invalid={invalid} />
      </section>

      <section className="cmv2-crc-step" aria-labelledby={`crc-accion-${idSuffix}`} data-qa-geometry-member data-qa-geometry-capacity="owned">
        <header><span>6</span><h5 id={`crc-accion-${idSuffix}`}>Acción</h5></header>
        {rows.length ? (
          <ul className="cmv2-crc-actions">
            {rows.map(({ entry, row }) => (
              <li key={`${entry.id}:${row.faculty_key}:${row.segment_key}`}>
                <strong>{ACTION_COPY[row.delta.action] ?? row.delta.action}</strong>
                <span>{row.faculty_label} · {row.segment_label}</span>
                {entry.gate === "informativo" ? <small>No altera el N del marco.</small> : null}
              </li>
            ))}
          </ul>
        ) : !invalid && card.entries.length ? (
          <ul className="cmv2-crc-actions">
            {card.entries.map((entry) => <li key={entry.id}><strong>{entry.label}</strong><span>{entry.status.replace("_", " ")}</span></li>)}
          </ul>
        ) : (
          <p className="cmv2-crc-inline-empty">
            {invalid ? "Acción bloqueada hasta recibir una tarjeta contractual completa." : "Ajusta el control del criterio debajo y recalcula para medir su efecto."}
          </p>
        )}
      </section>
      {!hasDistribution && card.state === "legacy" ? (
        <p className="cmv2-crc-legacy-note">El resumen legacy permanece junto al control; no se presenta como contrato F1.</p>
      ) : null}
    </article>
  );
}
