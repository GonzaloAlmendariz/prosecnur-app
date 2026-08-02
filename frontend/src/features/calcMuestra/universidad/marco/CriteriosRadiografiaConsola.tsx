import { useEffect, useMemo, useState } from "react";
import type {
  CalcMuestraAulasCriterioRadiografiaV2Entry,
  CalcMuestraAulasCriterioRadiografiaV2Row,
  CalcMuestraAulasCriterioRadiografiaV2Snapshot,
  CalcMuestraAulasCriteriosRadiografia,
  CriterioScope,
  CriteriosCatalogo,
} from "../../../../api/client";
import {
  buildCriteriosRadiografiaModel,
  criterioCardsForScope,
  type CriterioRadiografiaCard,
} from "./criteriosRadiografiaModel";
import "./criteriosRadiografia.css";

const NUMBER = new Intl.NumberFormat("es-PE", { maximumFractionDigits: 1 });

const STATE_COPY = {
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
  return value == null ? "NA" : NUMBER.format(value);
}

function signed(value: number | null, unit: string): string {
  if (value == null) return `NA ${unit}`;
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${NUMBER.format(value)} ${unit}`;
}

function Snapshot({
  title,
  snapshot,
}: {
  title: string;
  snapshot: CalcMuestraAulasCriterioRadiografiaV2Snapshot;
}) {
  return (
    <div
      className="cmv2-crc-snapshot"
      data-qa-geometry-member
      data-qa-geometry-capacity="owned"
    >
      <strong>{title}</strong>
      <dl className="cmv2-crc-counts">
        <div><dt>N CH</dt><dd>{fmt(snapshot.n_ch)}</dd></div>
        <div><dt>CH con dato</dt><dd>{fmt(snapshot.n_ch_con_dato)}</dd></div>
        <div><dt>Estudiantes únicos</dt><dd>{fmt(snapshot.n_estudiantes_unicos)}</dd></div>
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
  entry: CalcMuestraAulasCriterioRadiografiaV2Entry;
  row: CalcMuestraAulasCriterioRadiografiaV2Row;
};

function v2Rows(card: CriterioRadiografiaCard): V2DisplayRow[] {
  return card.entries.flatMap((entry) => entry.rows.map((row) => ({ entry, row })));
}

function rowsByFaculty(rows: V2DisplayRow[]) {
  const groups = new Map<string, { key: string; label: string; rows: V2DisplayRow[] }>();
  for (const item of rows) {
    const key = item.row.faculty_key;
    const existing = groups.get(key);
    if (existing) existing.rows.push(item);
    else groups.set(key, { key, label: item.row.faculty_label, rows: [item] });
  }
  return [...groups.values()];
}

function GateMetadata({ entry }: { entry: CalcMuestraAulasCriterioRadiografiaV2Entry }) {
  const informative = entry.gate === "informativo";
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
      {informative ? (
        <p role="note">
          Se aplica o reportará en la capa <strong>{entry.effective_layer}</strong>; no altera el N del marco.
        </p>
      ) : null}
      {entry.overlap ? <p className="cmv2-crc-overlap">segmentos solapados · no aditivos</p> : null}
    </div>
  );
}

function V2Distribution({ card }: { card: CriterioRadiografiaCard }) {
  const groups = rowsByFaculty(v2Rows(card));
  if (!groups.length) return null;
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
            {group.rows.map(({ entry, row }) => (
              <article
                className="cmv2-crc-segment"
                key={`${entry.id}:${row.segment_key}:${row.segment_kind}`}
                data-qa-geometry-member
                data-qa-geometry-capacity="owned"
              >
                <header>
                  <div><span>{entry.label}</span><strong>{row.segment_label}</strong></div>
                  <small>{row.segment_kind.replace("_", " ")}</small>
                </header>
                <div
                  className="cmv2-crc-snapshot-pair"
                  data-qa-geometry-group="calc-muestra/criterios-radiografia-snapshots"
                  data-qa-geometry-contract="intrinsic"
                >
                  <Snapshot title="Actual" snapshot={row.actual} />
                  <Snapshot title="Contraste total" snapshot={row.contraste_total} />
                </div>
                {row.signal_distribution ? (
                  <div className="cmv2-crc-signal">
                    <strong>Señal · {row.signal_distribution.unit.replace("_", " ")}</strong>
                    <span>{fmt(row.signal_distribution.n_con_dato)} de {fmt(row.signal_distribution.n_total)} con dato</span>
                    <dl className="cmv2-crc-stats" aria-label={`Señal de ${row.segment_label}: media y cuantiles`}>
                      <div data-main><dt>Media</dt><dd>{fmt(row.signal_distribution.media)}</dd></div>
                      <div><dt>P10</dt><dd>{fmt(row.signal_distribution.p10)}</dd></div>
                      <div><dt>P25</dt><dd>{fmt(row.signal_distribution.p25)}</dd></div>
                      <div><dt>P50 · mediana</dt><dd>{fmt(row.signal_distribution.p50)}</dd></div>
                      <div><dt>P75</dt><dd>{fmt(row.signal_distribution.p75)}</dd></div>
                      <div><dt>P90</dt><dd>{fmt(row.signal_distribution.p90)}</dd></div>
                    </dl>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ))}
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
  const meta = STATE_COPY[card.state];
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

export function CriteriosRadiografiaCardDetalle({
  card,
  radiografia,
}: {
  card: CriterioRadiografiaCard;
  radiografia: CalcMuestraAulasCriteriosRadiografia | null;
}) {
  const invalid = card.state === "invalido";
  const rows = invalid ? [] : v2Rows(card);
  const v1Rows = invalid ? [] : card.v1Rows;
  const meta = STATE_COPY[card.state];
  const hasDistribution = rows.length > 0 || v1Rows.length > 0;
  return (
    <article
      className="cmv2-crc-card"
      data-state={card.state}
      data-audit-ready={card.state === "v2" || card.state === "v1"}
      data-qa-geometry-group="calc-muestra/criterios-radiografia-pasos"
      data-qa-geometry-contract="intrinsic"
    >
      <header className="cmv2-crc-card-head">
        <div><span>{card.scope === "alumno" ? "Estudiante" : "Curso-horario"}</span><h4>{card.label}</h4></div>
        <span className="cmv2-crc-state" data-state={card.state}>{meta.label}</span>
      </header>

      <section
        className="cmv2-crc-step"
        aria-labelledby={`crc-dato-${card.cardId}`}
        data-qa-geometry-member
        data-qa-geometry-capacity="owned"
      >
        <header><span>1</span><h5 id={`crc-dato-${card.cardId}`}>Dato</h5></header>
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

      <section
        className="cmv2-crc-step"
        aria-labelledby={`crc-dist-${card.cardId}`}
        data-qa-geometry-member
        data-qa-geometry-capacity="owned"
      >
        <header><span>2</span><h5 id={`crc-dist-${card.cardId}`}>Distribución</h5></header>
        <p>Denominadores y estadísticos publicados por el engine; NA permanece NA.</p>
        {rows.length ? <V2Distribution card={card} /> : v1Rows.length ? <V1Distribution card={card} /> : <EmptyDistribution card={card} />}
      </section>

      <section
        className="cmv2-crc-step"
        aria-labelledby={`crc-impacto-${card.cardId}`}
        data-qa-geometry-member
        data-qa-geometry-capacity="owned"
      >
        <header><span>3</span><h5 id={`crc-impacto-${card.cardId}`}>Impacto</h5></header>
        {rows.length ? (
          <ul className="cmv2-crc-impact-list">
            {rows.map(({ entry, row }) => (
              <li key={`${entry.id}:${row.faculty_key}:${row.segment_key}`}>
                <span><strong>{row.faculty_label}</strong> · {entry.label} · {row.segment_label}</span>
                <span>{signed(row.delta.delta_ch, "CH")} · {signed(row.delta.delta_matriculas, "matrículas")} · {signed(row.delta.delta_estudiantes_unicos, "estudiantes únicos")}</span>
                <small>{row.delta.reconstruccion_valida ? "Contrafactual reconstruido" : "Reconstrucción no válida · deltas NA"}</small>
              </li>
            ))}
          </ul>
        ) : v1Rows.length ? (
          <ul className="cmv2-crc-impact-list">
            {v1Rows.map((row) => (
              <li key={`${row.facultad_key}:${row.categoria_key}`}>
                <span><strong>{row.facultad_label}</strong> · {row.categoria_label}</span>
                <span>{signed(row.delta_marginal.delta_ch, "CH")} · {signed(row.delta_marginal.delta_matriculas_elegibles, "matrículas")}</span>
                <small>Adapter I11 · referencia {row.delta_marginal.referencia}</small>
              </li>
            ))}
          </ul>
        ) : <p className="cmv2-crc-inline-empty">{invalid ? "Impacto retenido: el contrato de la tarjeta es inválido." : "No hay delta publicable para esta tarjeta."}</p>}
      </section>

      <section
        className="cmv2-crc-step"
        aria-labelledby={`crc-accion-${card.cardId}`}
        data-qa-geometry-member
        data-qa-geometry-capacity="owned"
      >
        <header><span>4</span><h5 id={`crc-accion-${card.cardId}`}>Acción</h5></header>
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
            {card.entries.map((entry) => (
              <li key={entry.id}><strong>{entry.label}</strong><span>{entry.status.replace("_", " ")}</span></li>
            ))}
          </ul>
        ) : (
          <p className="cmv2-crc-inline-empty">
            {invalid
              ? "Acción bloqueada hasta recibir una tarjeta contractual completa."
              : "Ajusta el control del criterio debajo y recalcula para medir su efecto."}
          </p>
        )}
      </section>
      {!hasDistribution && card.state === "legacy" ? (
        <p className="cmv2-crc-legacy-note">El resumen legacy permanece junto al control; no se presenta como contrato F1.</p>
      ) : null}
    </article>
  );
}

export function CriteriosRadiografiaConsola({
  catalogo,
  radiografia,
  rawPresent,
  scope,
  legacyCardIds,
}: {
  catalogo: CriteriosCatalogo;
  radiografia: CalcMuestraAulasCriteriosRadiografia | null;
  rawPresent: boolean;
  scope: CriterioScope;
  legacyCardIds?: ReadonlySet<string>;
}) {
  const model = useMemo(
    () => buildCriteriosRadiografiaModel({ catalogo, radiografia, rawPresent, legacyCardIds }),
    [catalogo, legacyCardIds, radiografia, rawPresent],
  );
  const cards = useMemo(() => criterioCardsForScope(model, scope), [model, scope]);
  const [focusedId, setFocusedId] = useState(() => cards[0]?.cardId ?? "");
  useEffect(() => {
    if (!cards.some((card) => card.cardId === focusedId)) setFocusedId(cards[0]?.cardId ?? "");
  }, [cards, focusedId]);
  const focused = cards.find((card) => card.cardId === focusedId) ?? cards[0] ?? null;

  if (!cards.length || !focused) return null;
  return (
    <section className="cmv2-crc" aria-label={`Consola analítica de criterios de ${scope === "alumno" ? "estudiante" : "curso-horario"}`}>
      <header className="cmv2-crc-head">
        <div>
          <span className="cmv2-crc-eyebrow">Radiografía antes de decidir</span>
          <h3>Dato → distribución → impacto → acción</h3>
          <p>{cards.length} tarjetas de este bloque · {model.expectedGateIds.length} gates en el denominador completo.</p>
        </div>
        <label className="cmv2-crc-focus" htmlFor={`cmv2-crc-focus-${scope}`}>
          <span>Enfocar criterio</span>
          <select
            id={`cmv2-crc-focus-${scope}`}
            value={focused.cardId}
            onChange={(event) => setFocusedId(event.target.value)}
          >
            {cards.map((card) => <option value={card.cardId} key={card.cardId}>{card.label} · {STATE_COPY[card.state].label}</option>)}
          </select>
        </label>
      </header>
      {model.orphanGateIds.length || model.duplicateCardIds.length ? (
        <div className="cmv2-crc-contract-alert" role="alert">
          Contrato incompleto: {model.orphanGateIds.length ? `gates huérfanos ${model.orphanGateIds.join(", ")}` : ""}
          {model.orphanGateIds.length && model.duplicateCardIds.length ? " · " : ""}
          {model.duplicateCardIds.length ? `tarjetas duplicadas ${model.duplicateCardIds.join(", ")}` : ""}.
        </div>
      ) : null}
      <div
        className="cmv2-crc-frame"
        data-qa-geometry-group="calc-muestra/criterios-radiografia-consola"
        data-qa-geometry-contract="intrinsic"
        aria-live="polite"
      >
        <div data-qa-geometry-member data-qa-geometry-capacity="owned">
          <CriteriosRadiografiaCardDetalle card={focused} radiografia={radiografia} />
        </div>
      </div>
    </section>
  );
}
