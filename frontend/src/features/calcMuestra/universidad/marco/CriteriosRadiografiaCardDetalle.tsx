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
import { useId, useState } from "react";

/** Los cinco pasos del recorrido de un criterio, en su orden metodológico. */
type CriterioPasoId = "distribucion" | "cascada" | "ancla" | "impacto" | "accion";

const CRITERIO_PASOS: ReadonlyArray<{ id: CriterioPasoId; label: string }> = [
  { id: "distribucion", label: "Distribución" },
  { id: "cascada", label: "Cascada viva" },
  { id: "ancla", label: "Ancla histórica" },
  { id: "impacto", label: "Impacto marginal" },
  { id: "accion", label: "Acción" },
];
import type { CriterioRadiografiaCard } from "./criteriosRadiografiaModel";
import { CriterioAnclaHistorica } from "./CriterioAnclaHistorica";
import {
  boxplotDomain,
  CriterioBoxplotLeyenda,
  CriterioBoxplotPercentilar,
  type BoxplotDomain,
} from "./CriterioBoxplotPercentilar";
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
  domain,
}: {
  title: string;
  snapshot: CalcMuestraAulasCriterioRadiografiaV2Snapshot;
  label: string;
  variant: "actual" | "contraste";
  domain: BoxplotDomain | null;
}) {
  return (
    <div
      className="cmv2-crc-snapshot"
      data-qa-geometry-member
      data-qa-geometry-capacity="owned"
    >
      <strong>{title}</strong>
      <CriterioBoxplotPercentilar label={`${label} · ${title}`} distribution={snapshot.distribution} domain={domain} />
      <dl className="cmv2-crc-counts">
        <div><dt>{variant === "actual" ? "CH elegibles" : "CH de contraste"}</dt><dd>{fmt(snapshot.n_ch)}</dd></div>
        <div><dt>CH con dato</dt><dd>{fmt(snapshot.n_ch_con_dato)}</dd></div>
        <div><dt>Alumnos únicos</dt><dd>{fmt(snapshot.n_estudiantes_unicos)}</dd></div>
        <div><dt>Matrículas</dt><dd>{fmt(snapshot.n_matriculas)}</dd></div>
      </dl>
      {/* Media y mediana se leen de un vistazo; los cinco cuantiles siguen
          completos pero no repiten seis filas por snapshot × segmento ×
          facultad, que era el grueso de las 46 pantallas. */}
      <p className="cmv2-crc-stats-lead">
        <span><em>Media</em> {fmt(snapshot.distribution.media)}</span>
        <span><em>P50</em> {fmt(snapshot.distribution.p50)}</span>
        <span><em>P10–P90</em> {fmt(snapshot.distribution.p10)}–{fmt(snapshot.distribution.p90)}</span>
      </p>
      {/* F41 · Los cuantiles son EL dato de la distribución; plegarlos dejaba
          la decisión apoyada en una sola cifra visible. */}
      <div className="cmv2-crc-stats-full">
        <dl className="cmv2-crc-stats" aria-label={`${title}: media y cuantiles`}>
          <div data-main><dt>Media</dt><dd>{fmt(snapshot.distribution.media)}</dd></div>
          <div><dt>P10</dt><dd>{fmt(snapshot.distribution.p10)}</dd></div>
          <div><dt>P25</dt><dd>{fmt(snapshot.distribution.p25)}</dd></div>
          <div><dt>P50 · mediana</dt><dd>{fmt(snapshot.distribution.p50)}</dd></div>
          <div><dt>P75</dt><dd>{fmt(snapshot.distribution.p75)}</dd></div>
          <div><dt>P90</dt><dd>{fmt(snapshot.distribution.p90)}</dd></div>
        </dl>
      </div>
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

/**
 * F41 · Avisos del gate que el usuario SÍ necesita.
 *
 * Este bloque mezclaba dos cosas: metadatos del contrato interno (gate, owner,
 * grano, unidad, capa) y advertencias metodológicas —que un criterio es
 * informativo y no altera el N, o que sus segmentos se solapan y por tanto no se
 * suman—. Al retirar «Procedencia y contrato» se fueron las dos, y las segundas
 * hacen falta: sin ellas alguien suma segmentos solapados y se equivoca. Queda
 * sólo lo que cambia una lectura.
 */
function GateMetadata({ entry }: { entry: CalcMuestraAulasCriterioRadiografiaV2Entry }) {
  if (entry.gate !== "informativo" && !entry.overlap) return null;
  return (
    <div className="cmv2-crc-gate" data-status={entry.status}>
      <div className="cmv2-crc-gate-title">
        <strong>{entry.label}</strong>
        <span>{entry.status.replace("_", " ")}</span>
      </div>
      {entry.gate === "informativo" ? (
        <p role="note">Se aplica o reportará en la capa <strong>{entry.effective_layer}</strong>; no altera el N del marco.</p>
      ) : null}
      {entry.overlap ? <p className="cmv2-crc-overlap">segmentos solapados · no aditivos</p> : null}
    </div>
  );
}

function Segment({
  row,
  domain,
  signalDomain,
}: {
  row: V2DisplayRow;
  /** Escala del bloque para CH; la señal usa la suya porque es otra unidad. */
  domain: BoxplotDomain | null;
  signalDomain: BoxplotDomain | null;
}) {
  const label = `${row.facultyLabel} · ${row.gateLabel} · ${row.segmentLabel}`;
  // Un segmento sin CH ni distribución no merece el mismo espacio que uno con
  // datos: se declara en una línea. Sigue presente y contable — no desaparece,
  // que sería mentir sobre el inventario.
  const vacio = row.actual.n_ch === 0 && row.actual.distribution.media === null
    && row.contrasteTotal.n_ch === 0 && row.contrasteTotal.distribution.media === null;
  if (vacio) {
    return (
      <article
        className="cmv2-crc-segment"
        data-criterion-id={row.criterionId}
        data-segment-empty="true"
        data-qa-geometry-member
        data-qa-geometry-capacity="owned"
        role="status"
      >
        <header>
          <div><span>{row.gateLabel}</span><strong>{row.segmentLabel}</strong></div>
          <small>0 CH en esta facultad</small>
        </header>
      </article>
    );
  }
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
      {/* D2: elegibles como cifra principal y total como contraste, los dos a
          la vista y sobre la misma escala. Plegar el contraste no bajaba la
          altura (van en columnas) y escondía la comparación que la vara pide. */}
      <div
        className="cmv2-crc-snapshot-pair"
        data-qa-geometry-group="calc-muestra/criterios-radiografia-snapshots"
        data-qa-geometry-contract="intrinsic"
      >
        <Snapshot title="Actual" snapshot={row.actual} label={label} variant="actual" domain={domain} />
        <Snapshot title="Contraste total" snapshot={row.contrasteTotal} label={label} variant="contraste" domain={domain} />
      </div>
      {row.signalDistribution ? (
        <div className="cmv2-crc-signal">
          <p className="cmv2-crc-signal-head">
            Señal · {row.signalDistribution.unit.replace("_", " ")} · {fmt(row.signalDistribution.n_con_dato)} de {fmt(row.signalDistribution.n_total)} con dato
          </p>
          <CriterioBoxplotPercentilar label={`${label} · señal`} distribution={row.signalDistribution} domain={signalDomain} />
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
  const all = [...facultyRows, ...rTotals];
  const groups = rowsByFaculty(all);
  // S4: una sola escala para todo el bloque. Comparar facultades es el único
  // motivo por el que existe este gráfico; con normalización por figura todas
  // las cajas salían del mismo ancho.
  const domain = boxplotDomain(all.flatMap((row) => [row.actual.distribution, row.contrasteTotal.distribution]));
  const signalDomain = boxplotDomain(all.map((row) => row.signalDistribution ?? null));
  return (
    <>
      <CriterioBoxplotLeyenda domain={domain} unidad="alumnos por CH" />
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
              <Segment
                row={row}
                domain={domain}
                signalDomain={signalDomain}
                key={`${row.criterionId}:${row.segmentKey}:${row.segmentKind}`}
              />
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
    </>
  );
}

function V1Distribution({ card }: { card: CriterioRadiografiaCard }) {
  if (!card.v1Rows.length) return null;
  const domain = boxplotDomain(card.v1Rows.map((row) => row.distribucion_elegible));
  return (
    <>
      <CriterioBoxplotLeyenda domain={domain} unidad="alumnos por CH" />
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
          <CriterioBoxplotPercentilar label={`${row.facultad_label} · ${row.categoria_label}`} distribution={row.distribucion_elegible} domain={domain} />
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
    </>
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
  // Los cinco pasos publican cada uno las 19 facultades del criterio. Apilados
  // sumaban 23.244 px (Cascada 7.284, Distribución 5.672, Impacto 4.756,
  // Acción 3.379, Ancla 2.153): 36 pantallas de scroll para una tarjeta. Se
  // recorren como pasos, uno a la vez; ninguno se pierde y el orden
  // metodológico queda visible en el riel.
  const [pasoActivo, setPasoActivo] = useState<CriterioPasoId>("distribucion");
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

      <nav className="cmv2-crc-pasos" aria-label={`Pasos de ${card.label}`}>
        {CRITERIO_PASOS.map((paso, index) => (
          <button
            type="button"
            key={paso.id}
            data-paso={paso.id}
            aria-pressed={paso.id === pasoActivo}
            onClick={() => setPasoActivo(paso.id)}
          >
            <span>{index + 1}</span>
            {paso.label}
          </button>
        ))}
      </nav>

      <section className="cmv2-crc-step" hidden={pasoActivo !== "distribucion"} aria-labelledby={`crc-dist-${idSuffix}`} data-qa-geometry-member data-qa-geometry-capacity="owned">
        <header><span>1</span><h5 id={`crc-dist-${idSuffix}`}>Distribución</h5></header>
        {rows.length ? <V2Distribution card={card} totals={totals} includeTotal={context !== "faculty"} /> : v1Rows.length ? <V1Distribution card={card} /> : <EmptyDistribution card={card} />}
      </section>

      <section className="cmv2-crc-step" hidden={pasoActivo !== "cascada"} aria-labelledby={`crc-cascada-${idSuffix}`} data-qa-geometry-member data-qa-geometry-capacity="owned">
        <header><span>2</span><h5 id={`crc-cascada-${idSuffix}`}>Cascada viva</h5></header>
        <p>Secuencia real del motor. No es la matriz marginal y no suma impactos entre criterios.</p>
        <CriteriosEmbudoVivo cardId={card.cardId} executed={cascade} previewRequest={previewRequest} facultyKey={facultyKey} />
      </section>

      <section className="cmv2-crc-step" hidden={pasoActivo !== "ancla"} aria-labelledby={`crc-ancla-${idSuffix}`} data-qa-geometry-member data-qa-geometry-capacity="owned">
        <header><span>3</span><h5 id={`crc-ancla-${idSuffix}`}>Ancla histórica</h5></header>
        <p>Coincidencia o degradación publicada por R; nunca combina marginales ni enlaza CH históricos.</p>
        <CriterioAnclaHistorica cardId={card.cardId} rows={anchors?.rows ?? []} facultyKey={facultyKey} />
      </section>

      <section className="cmv2-crc-step" hidden={pasoActivo !== "impacto"} aria-labelledby={`crc-impacto-${idSuffix}`} data-qa-geometry-member data-qa-geometry-capacity="owned">
        <header><span>4</span><h5 id={`crc-impacto-${idSuffix}`}>Impacto marginal</h5></header>
        <p>Foto contrafactual por regla; no forma la cascada y sus deltas no son aditivos.</p>
        <ImpactoMarginal card={card} rows={rows} v1Rows={v1Rows} invalid={invalid} />
      </section>

      <section className="cmv2-crc-step" hidden={pasoActivo !== "accion"} aria-labelledby={`crc-accion-${idSuffix}`} data-qa-geometry-member data-qa-geometry-capacity="owned">
        <header><span>5</span><h5 id={`crc-accion-${idSuffix}`}>Acción</h5></header>
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

      {/* F41 · «Procedencia y contrato» —hash del marco, owner, grano, unidad—
          es información técnica del contrato interno, no del estudio. Gonzalo:
          «lo técnico no tiene por qué mostrarse». Se retira de la superficie;
          sigue viajando en el `.pulso` y en la auditoría del motor, que es
          donde se consulta cuando hace falta. */}
      {card.entries.some((entry) => entry.gate === "informativo" || entry.overlap) ? (
        <div className="cmv2-crc-gates">
          {card.entries.map((entry) => <GateMetadata entry={entry} key={entry.id} />)}
        </div>
      ) : null}
      {!hasDistribution && card.state === "legacy" ? (
        <p className="cmv2-crc-legacy-note">El resumen legacy permanece junto al control; no se presenta como contrato F1.</p>
      ) : null}
    </article>
  );
}
