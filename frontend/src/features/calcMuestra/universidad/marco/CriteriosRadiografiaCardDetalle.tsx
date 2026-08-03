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

/**
 * ADR 0057 · Los rótulos nombran el dato, no la metáfora de la interfaz.
 *
 * «Cascada viva» describe una animación, no lo que la pieza informa —cuánto
 * recorta este criterio y qué queda—. Gonzalo lo señaló por su nombre: suena a
 * relleno. «Impacto marginal» y «Acción» son etiquetas de sistema, no de
 * estudio.
 */
const CRITERIO_PASOS: ReadonlyArray<{ id: CriterioPasoId; label: string }> = [
  { id: "distribucion", label: "Distribución" },
  { id: "cascada", label: "Cuánto recorta" },
  { id: "ancla", label: "Comparación con 2025" },
  { id: "impacto", label: "Si lo quitara" },
  { id: "accion", label: "Decidir" },
];

/**
 * Pasos visibles según dónde se monte la tarjeta.
 *
 * Dentro del bloque de una facultad, la distribución **ya vive en cada
 * categoría**, junto a su conmutador. Repetirla aquí no sólo duplicaba: lo hacía
 * con OTRA escala —17,8–43 arriba y 10–43 abajo en la misma pantalla—, y dos
 * escalas distintas para el mismo criterio invitan a comparar cosas que no son
 * comparables. En la consola independiente no hay categorías con evidencia, así
 * que ahí la distribución sigue siendo su contenido principal.
 */
function pasosVisibles(context: string) {
  return context === "faculty"
    ? CRITERIO_PASOS.filter((paso) => paso.id !== "distribucion")
    : CRITERIO_PASOS;
}
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
import { rotuloSegmento } from "./segmentoRotulo";

/**
 * F108 · Rótulo vigente por `segment_key`; el `segment_label` del payload sólo
 * como respaldo. Este componente sólo se monta desde la radiografía de
 * curso-horario (unidad «alumnos por CH»), así que el grano es fijo.
 */
const rotulo = (row: { segment_key?: string | null; segment_label?: string | null }) =>
  rotuloSegmento(row.segment_key, row.segment_label, "ch");

const NUMBER = new Intl.NumberFormat("es-PE", { maximumFractionDigits: 1 });

/**
 * ADR 0057 · Los estados se explican en palabras del estudio.
 *
 * Estos textos aparecen **cuando algo falta**, que es justo cuando el usuario
 * menos puede permitirse descifrar vocabulario: «R publicó el gate», «contrato
 * I11», «resumen legacy», «contrafactual». Un aviso de error escrito en jerga
 * deja a alguien bloqueado sin saber si el problema es suyo, del dato o de la
 * app.
 *
 * Se conserva íntegra la garantía que cada uno da —sobre todo la de que no se
 * rellenan ceros—, porque es lo que hace fiable la cifra de al lado.
 */
export const CRITERIO_RADIOGRAFIA_STATE_COPY = {
  v2: { label: "Del marco ejecutado", detail: "Calculado sobre el último marco que se construyó." },
  v1: { label: "Formato anterior", detail: "Calculado con la versión previa; sólo cubre tipo de sesión." },
  legacy: { label: "Evidencia incompleta", detail: "Hay datos históricos parciales: faltan las bases de cálculo o la comparación con el escenario sin este criterio." },
  sin_dato: { label: "Sin dato", detail: "El motor no encontró información suficiente para este criterio." },
  no_aplica: { label: "No aplica", detail: "Este criterio no cambia el marco con la configuración actual." },
  invalido: { label: "No verificable", detail: "La evidencia no cumple las comprobaciones del motor, y no se rellena con ceros para disimularlo." },
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

/**
 * Ausencia declarada, en la notación del usuario y no en la de R.
 *
 * La intención original era la correcta —no fabricar un cero donde el motor no
 * publicó valor—, pero se escribía «NA», que es la notación de R. En pantalla
 * quedaba «Media NA» y «NA CH». El guion largo dice lo mismo, es el que usa el
 * resto del módulo, y no obliga a saber en qué lenguaje está escrito el motor.
 */
const AUSENTE = "—";

function fmt(value: number | null): string {
  return value === null ? AUSENTE : NUMBER.format(value);
}

function signed(value: number | null, unit: string): string {
  if (value === null) return `${AUSENTE} ${unit}`;
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
      {/* F42 · Los cuantiles se muestran, pero en una línea y no en una tabla
          por segmento: desplegados como `dl` completo, ~20 segmentos por
          criterio llevaban la pestaña a 28 pantallas. Nada queda oculto —los
          seis estadísticos siguen a la vista— y el criterio vuelve a caber. */}
      <div className="cmv2-crc-stats-full" data-compacta="true">
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
    segmentLabel: rotulo(row),
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
      segmentLabel: rotulo(row),
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
      {/* F42 · La señal es un gráfico ADICIONAL por segmento: con ~20 segmentos
          multiplicaba la pestaña a 26 pantallas. Su sitio es el bloque de mayor
          detalle —«ver uno por uno», el último del embudo—, no repetido dentro
          de cada criterio. Aquí se declara con su cifra, que es el dato. */}
      {row.signalDistribution ? (
        <div className="cmv2-crc-signal" data-solo-cifra="true">
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
  soloFacultad = null,
}: {
  card: CriterioRadiografiaCard;
  totals: CalcMuestraCriteriosTotales | null;
  includeTotal?: boolean;
  /**
   * F43 · Acota la distribución a UNA facultad.
   *
   * Dentro del bloque de una facultad este componente pintaba las quince
   * —4.719 px medidos, el módulo entero duplicado por criterio—. La comparación
   * entre facultades ya vive arriba, en el panorama y la matriz; aquí lo que se
   * busca es el mayor detalle **de la facultad abierta**, que es la que el
   * usuario eligió en el selector.
   */
  soloFacultad?: string | null;
}) {
  const todasLasFilas = v2Rows(card);
  const facultyRows = soloFacultad
    ? todasLasFilas.filter(
        (row) => row.facultyKey === soloFacultad || row.facultyLabel === soloFacultad,
      )
    : todasLasFilas;
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
            <span><strong>{row.faculty_label}</strong> · {entry.label} · {rotulo(row)}</span>
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
  const pasos = pasosVisibles(context);
  // El número del encabezado sale del riel realmente visible. Escrito a mano se
  // descuadró en cuanto un paso dejó de mostrarse: el riel decía «1 Cuánto
  // recorta» y el contenido «2 Cuánto recorta este criterio». Un número que no
  // coincide con su propio índice hace dudar de todo lo demás de la pantalla.
  const numeroPaso = (id: CriterioPasoId) =>
    pasos.findIndex((paso) => paso.id === id) + 1;
  const [pasoActivo, setPasoActivo] = useState<CriterioPasoId>(pasos[0].id);
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
          <span>{context === "faculty" ? "Efecto de este criterio" : card.scope === "alumno" ? "Estudiante" : "Curso-horario"}</span>
          <h4>{card.label}</h4>
        </div>
        <span className="cmv2-crc-state" data-state={card.state}>{meta.label}</span>
      </header>

      <nav className="cmv2-crc-pasos" aria-label={`Pasos de ${card.label}`}>
        {pasos.map((paso, index) => (
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
        <header><span>{numeroPaso("distribucion")}</span><h5 id={`crc-dist-${idSuffix}`}>Distribución</h5></header>
        {rows.length ? (
          <V2Distribution
            card={card}
            totals={totals}
            includeTotal={context !== "faculty"}
            soloFacultad={context === "faculty" ? (facultyKey || facultyLabel || null) : null}
          />
        ) : v1Rows.length ? <V1Distribution card={card} /> : <EmptyDistribution card={card} />}
      </section>

      <section className="cmv2-crc-step" hidden={pasoActivo !== "cascada"} aria-labelledby={`crc-cascada-${idSuffix}`} data-qa-geometry-member data-qa-geometry-capacity="owned">
        <header><span>{numeroPaso("cascada")}</span><h5 id={`crc-cascada-${idSuffix}`}>Cuánto recorta este criterio</h5></header>
        {/* La distinción es real y hay que conservarla —aquí los criterios se
            aplican en orden, uno sobre el resultado del anterior—, pero decirla
            nombrando otra tabla por su nombre técnico obliga a conocer las dos
            para entender ésta. */}
        <p>Los criterios se aplican en orden, cada uno sobre lo que dejó el anterior.</p>
        <CriteriosEmbudoVivo cardId={card.cardId} executed={cascade} previewRequest={previewRequest} facultyKey={facultyKey} />
      </section>

      <section className="cmv2-crc-step" hidden={pasoActivo !== "ancla"} aria-labelledby={`crc-ancla-${idSuffix}`} data-qa-geometry-member data-qa-geometry-capacity="owned">
        <header><span>{numeroPaso("ancla")}</span><h5 id={`crc-ancla-${idSuffix}`}>Comparación con 2025</h5></header>
        <p>Coincidencia o degradación publicada por R; nunca combina marginales ni enlaza CH históricos.</p>
        <CriterioAnclaHistorica cardId={card.cardId} rows={anchors?.rows ?? []} facultyKey={facultyKey} />
      </section>

      <section className="cmv2-crc-step" hidden={pasoActivo !== "impacto"} aria-labelledby={`crc-impacto-${idSuffix}`} data-qa-geometry-member data-qa-geometry-capacity="owned">
        <header><span>{numeroPaso("impacto")}</span><h5 id={`crc-impacto-${idSuffix}`}>Si quitara este criterio</h5></header>
        <p>Foto contrafactual por regla; no forma la cascada y sus deltas no son aditivos.</p>
        <ImpactoMarginal card={card} rows={rows} v1Rows={v1Rows} invalid={invalid} />
      </section>

      <section className="cmv2-crc-step" hidden={pasoActivo !== "accion"} aria-labelledby={`crc-accion-${idSuffix}`} data-qa-geometry-member data-qa-geometry-capacity="owned">
        <header><span>{numeroPaso("accion")}</span><h5 id={`crc-accion-${idSuffix}`}>Decidir</h5></header>
        {rows.length ? (
          <ul className="cmv2-crc-actions">
            {rows.map(({ entry, row }) => (
              <li key={`${entry.id}:${row.faculty_key}:${row.segment_key}`}>
                <strong>{ACTION_COPY[row.delta.action] ?? row.delta.action}</strong>
                <span>{row.faculty_label} · {rotulo(row)}</span>
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
