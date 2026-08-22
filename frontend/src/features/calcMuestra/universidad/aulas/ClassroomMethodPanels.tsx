import { ArrowRight, BarChart3, Gauge, Layers3, Users } from "lucide-react";
import type {
  CalcMuestraAulasMethodComparison,
  CalcMuestraAulasMethodSummary,
  CalcMuestraAulasProfileDistribution,
  CalcMuestraAulasRepresentativityMetric,
  CalcMuestraAulasSimulationSummary,
} from "../../../../api/client";
import { fmtInt, fmtPct, rowsFrom, safeNumber } from "../../sharedCore";
import { classroomRowNumber, classroomRowText } from "../shared/format";
import { classroomMetricValue } from "../shared/frame";
import {
  classroomMethodLabel,
  classroomMethodReason,
  classroomNumberText,
  classroomScore,
  selectorFieldLabelTitulo,
} from "./classroomLabels";

/** Etiquetas en español para los grupos de métricas que reporta el motor R. */
const METRIC_GROUP_LABELS: Record<string, string> = {
  balance: "Balance",
  coverage: "Cobertura",
  overlap: "Repetidos",
  dispersion: "Dispersión",
  weights: "Pesos",
  reserves: "Reservas",
};

/**
 * Copys conocidos del motor R que llegan sin tildes; se corrigen solo en la
 * presentación (el dato del motor no se altera).
 */
const MOTOR_COPY_FIXES: Record<string, string> = {
  "Cobertura unica": "Cobertura única",
  "Perdida por repetidos": "Pérdida por repetidos",
  "Evitar concentracion": "Evitar concentración",
};

export function motorCopyText(value: string | null | undefined) {
  const raw = String(value ?? "");
  return MOTOR_COPY_FIXES[raw] ?? raw.replace(/\bSimulacion\b/g, "Simulación");
}

/**
 * Qué compara cada familia de métricas, en una línea y sin jerga.
 *
 * Gonzalo, 2026-08-22: «hay distintos mecanismos para medir el balance, hay
 * distintos balances, no termino de entender». Tenía razón por partida doble:
 * la tarjeta ponía de eyebrow «BALANCE» —idéntico en las siete— y dejaba la
 * dimensión, que es lo único que las distingue, en letra pequeña abajo; y
 * ninguna decía contra qué se comparaba el puntaje.
 */
const METRIC_GROUP_GLOSA: Record<string, string> = {
  balance: "Qué tan parecido es el reparto de las aulas sorteadas al del marco completo. 100 sería idéntico.",
  coverage: "Cuánto del marco queda representado en la selección.",
  overlap: "Cuántos estudiantes aparecen en más de un aula seleccionada.",
  dispersion: "Qué tan repartida quedó la selección, sin concentrarse en unos pocos sitios.",
  weights: "Qué tan parejo es lo que representa cada aula seleccionada.",
  reserves: "Cuántos reemplazos quedaron disponibles por titular.",
};

export function RepresentativityMetricGrid({ metrics }: { metrics?: CalcMuestraAulasRepresentativityMetric[] | unknown }) {
  const visible = rowsFrom<CalcMuestraAulasRepresentativityMetric>(metrics)
    .filter((metric) => metric.active !== false && metric.score != null && Number.isFinite(safeNumber(metric.score, Number.NaN)))
    .slice(0, 8);
  if (!visible.length) return null;
  // Nivel semántico del puntaje (0-100): el meter y la cifra lo heredan para
  // que un 0/100 no se lea igual de neutro que un 100/100.
  const scoreLevel = (value: number) => (value < 40 ? "bajo" : value < 70 ? "medio" : "alto");
  // La familia se dice UNA vez, con su glosa, y cada tarjeta se identifica por
  // su dimensión. Mismo patrón que `agruparPorDimension` aplica a las filas de
  // perfil unas líneas más abajo, por el mismo motivo.
  const familias: { grupo: string; metricas: CalcMuestraAulasRepresentativityMetric[] }[] = [];
  for (const metric of visible) {
    const grupo = String(metric.metric_group ?? "");
    const ultima = familias[familias.length - 1];
    if (ultima && ultima.grupo === grupo) ultima.metricas.push(metric);
    else familias.push({ grupo, metricas: [metric] });
  }
  return (
    <div className="cmv2-representativity-metric-families">
      {familias.map((familia) => (
        <section key={familia.grupo || "sin-grupo"}>
          <header>
            <strong>{METRIC_GROUP_LABELS[familia.grupo] ?? familia.grupo}</strong>
            {METRIC_GROUP_GLOSA[familia.grupo] ? <p>{METRIC_GROUP_GLOSA[familia.grupo]}</p> : null}
          </header>
          <div className="cmv2-representativity-metric-grid">
            {familia.metricas.map((metric) => {
              const score = Math.max(0, Math.min(100, safeNumber(metric.score, 0)));
              return (
                <article key={metric.metric_id} data-nivel={scoreLevel(score)}>
                  <small>{motorCopyText(metric.label)}</small>
                  <strong>{classroomScore(metric.score)}</strong>
                  <div aria-hidden="true"><i style={{ width: `${score}%` }} /></div>
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

/**
 * Agrupa las filas de perfil por su dimensión conservando el orden de llegada.
 *
 * La dimensión es constante dentro del grupo: escribirla en cada fila la
 * convierte en el elemento más prominente de una lista donde lo que identifica
 * a la fila es la CATEGORÍA. En el estudio real eran doce «Facultad» seguidas,
 * el rótulo repetido más frecuente de toda la pestaña.
 */
function agruparPorDimension(rows: CalcMuestraAulasProfileDistribution[]) {
  const grupos: { dimension: string; filas: CalcMuestraAulasProfileDistribution[] }[] = [];
  for (const row of rows) {
    const dimension = String(row.label || row.dimension || "").trim();
    const ultimo = grupos.length ? grupos[grupos.length - 1] : null;
    // Se agrupa por corridas contiguas: el motor entrega las dimensiones juntas
    // y respetar su orden mantiene la lectura que ya tenía la lista.
    if (ultimo && ultimo.dimension === dimension) ultimo.filas.push(row);
    else grupos.push({ dimension, filas: [row] });
  }
  return grupos;
}

/**
 * Ajuste muestra vs. marco con banda de tolerancia explícita: cada categoría
 * muestra el rango aceptado (marco ± tolerancia del objetivo) y colorea la
 * fila según la brecha quede dentro (success) o fuera (warn) de la banda.
 */
export function ProfileBalanceChart({ rows }: { rows?: CalcMuestraAulasProfileDistribution[] | unknown }) {
  const visible = rowsFrom<CalcMuestraAulasProfileDistribution>(rows)
    .filter((row) => Number.isFinite(safeNumber(row.frame_prop, Number.NaN)) || Number.isFinite(safeNumber(row.selected_prop, Number.NaN)))
    .slice(0, 12);
  if (!visible.length) {
    return (
      <div className="cmv2-classroom-empty is-compact">
        <span><BarChart3 size={16} /></span>
        <div>
          <strong>Sin perfil calculado</strong>
          <em>Construye el marco y corre comparación o selección para ver el ajuste frente al marco.</em>
        </div>
      </div>
    );
  }
  return (
    <div className="cmv2-profile-bars">
      <div className="cmv2-aulas-tol-leyenda" aria-hidden="true">
        <span className="is-banda">banda de tolerancia (marco ± tol.)</span>
        <span className="is-marco">marco</span>
        <span className="is-muestra">muestra</span>
      </div>
      {agruparPorDimension(visible).flatMap((grupo, grupoIndex) => [
        grupo.dimension ? (
          <p className="cmv2-profile-dimension" key={`dim-${grupo.dimension}-${grupoIndex}`}>
            {grupo.dimension}
          </p>
        ) : null,
        ...grupo.filas.map((row, index) => (
          <ProfileBalanceRow key={`${grupo.dimension}-${row.category}-${index}`} row={row} />
        )),
      ])}
    </div>
  );
}

function ProfileBalanceRow({ row }: { row: CalcMuestraAulasProfileDistribution }) {
  const frame = Math.max(0, Math.min(1, safeNumber(row.frame_prop, 0)));
  const selected = Math.max(0, Math.min(1, safeNumber(row.selected_prop, 0)));
  const tolerance = safeNumber(row.tolerance, Number.NaN);
  const hasTolerance = Number.isFinite(tolerance) && tolerance > 0;
  const gap = Math.abs(selected - frame);
  const within = row.within_tolerance != null ? Boolean(row.within_tolerance) : !hasTolerance || gap <= tolerance;
  const bandStart = hasTolerance ? Math.max(0, frame - tolerance) : 0;
  const bandWidth = hasTolerance ? Math.min(1, frame + tolerance) - bandStart : 0;
  return (
    <div className={hasTolerance ? (within ? "is-dentro" : "is-alert") : ""}>
      <div>
        {/* La categoría es lo que identifica la fila, así que es la que va en
            negrita; la dimensión quedó arriba, una vez por grupo. */}
        <strong>{row.category}</strong>
        {/* Marco y muestra solo vivían en el aria-label de la barra: se leían
            con lector de pantalla y no con los ojos. */}
        <span>marco {fmtPct(frame)} · muestra {fmtPct(selected)}</span>
        <em>{fmtPct(gap)} de brecha{hasTolerance ? ` · tolerancia ±${fmtPct(tolerance)}` : ""}</em>
      </div>
      {/* Barras PAREADAS (2026-08-20): las dos superpuestas desde cero se
          leian como un grafico «partido a la mitad» (Gonzalo). Marco arriba
          en tinta tenue, muestra debajo en acento — el idioma de la casa. */}
      <div
        className="cmv2-profile-track cmv2-profile-par"
        aria-label={`${row.category}: marco ${fmtPct(frame)}, seleccionado ${fmtPct(selected)}${hasTolerance ? `, tolerancia ±${fmtPct(tolerance)} (${within ? "dentro" : "fuera"} de banda)` : ""}`}
      >
        {hasTolerance && (
          <i
            className="cmv2-aulas-tol-banda"
            data-estado={within ? "ok" : "alerta"}
            style={{ left: `${bandStart * 100}%`, width: `${Math.max(1.5, bandWidth * 100)}%` }}
          />
        )}
        <span className="cmv2-profile-linea">
          <b className="is-frame" style={{ width: `${frame * 100}%` }} />
        </span>
        <span className="cmv2-profile-linea">
          <b className="is-selected" style={{ width: `${selected * 100}%` }} />
        </span>
      </div>
    </div>
  );
}

function sumClassroomMetric(rows: Array<Record<string, unknown>>, keys: string[]) {
  return rows.reduce((sum, row) => sum + Math.max(0, classroomRowNumber(row, keys)), 0);
}

export function CoverageOverlapPanel({
  rows,
  selectionRows,
  framePopulation,
}: {
  rows?: Array<Record<string, unknown>> | unknown;
  selectionRows?: Array<Record<string, unknown>> | unknown;
  framePopulation?: number;
}) {
  const metricRows = rowsFrom<Record<string, unknown>>(rows);
  const selectedRows = rowsFrom<Record<string, unknown>>(selectionRows);
  const covered = classroomMetricValue(metricRows, "selected_unique_students");
  const exposure = classroomMetricValue(metricRows, "selected_student_course_exposure");
  const coverage = classroomMetricValue(metricRows, "coverage_population_pct");
  const efficiency = classroomMetricValue(metricRows, "coverage_efficiency");
  const duplicateLoss = classroomMetricValue(metricRows, "duplicate_loss");
  const estimatedExposure = sumClassroomMetric(selectedRows, ["eligible_n", "expected_valid", "enrolled_total"]);
  const duplicateOverlap = sumClassroomMetric(selectedRows, ["duplicate_overlap", "overlap_n", "repeated_students"]);
  const exactCoverage = Number.isFinite(covered);
  const exactExposure = Number.isFinite(exposure);
  const exactDuplicateLoss = Number.isFinite(duplicateLoss);
  const frameN = safeNumber(framePopulation, 0);
  const coverageDetail = Number.isFinite(coverage)
    ? `${fmtPct(coverage)} del marco`
    : frameN && estimatedExposure
      ? `${fmtInt(frameN)} estudiantes en el marco`
      : selectedRows.length
        ? `${fmtInt(selectedRows.length)} cursos-horario titulares`
        : "genera una selección";
  const exposureDetail = Number.isFinite(efficiency)
    ? `${fmtPct(efficiency)} eficiencia única`
    : exactExposure
      ? "exposición reportada por la calculadora"
      : selectedRows.length
        ? "estimación desde cursos-horario seleccionados"
        : "sin selección";
  const duplicateValue = exactDuplicateLoss
    ? fmtPct(duplicateLoss)
    : duplicateOverlap
      ? `${fmtInt(duplicateOverlap)} repetidos`
      : selectedRows.length
        ? "sin métrica exacta"
        : "pendiente";
  const duplicateDetail = exactDuplicateLoss
    ? "calculado con llaves estudiante–curso-horario"
    : duplicateOverlap
      ? "suma observada en cursos-horario titulares"
      : selectedRows.length
        ? "requiere llave estudiante–curso-horario para medir repetidos"
        : "se calcula después de seleccionar cursos-horario";
  return (
    <div className="cmv2-coverage-panel">
      <article>
        <Users size={16} />
        <small>{exactCoverage ? "Estudiantes únicos cubiertos" : "Elegibles esperados en titulares"}</small>
        <strong>{exactCoverage ? fmtInt(covered) : estimatedExposure ? fmtInt(estimatedExposure) : "sin estimación"}</strong>
        <span>{coverageDetail}</span>
      </article>
      <article>
        <Layers3 size={16} />
        <small>Exposición alumno-curso</small>
        <strong>{exactExposure ? fmtInt(exposure) : estimatedExposure ? fmtInt(estimatedExposure) : "sin estimación"}</strong>
        <span>{exposureDetail}</span>
      </article>
      <article>
        <Gauge size={16} />
        <small>Pérdida por repetidos</small>
        <strong>{duplicateValue}</strong>
        <span>{duplicateDetail}</span>
      </article>
    </div>
  );
}

export function SimulationSummaryPanel({ rows }: { rows?: CalcMuestraAulasSimulationSummary[] | unknown }) {
  const summaryRows = rowsFrom<CalcMuestraAulasSimulationSummary>(rows);
  // El motor devuelve una fila por método AUNQUE no se hayan pedido corridas, y
  // entonces las cuatro decían «0/0 corridas · Simulación no solicitada»: un
  // vacío repetido cuatro veces que ocupa una pantalla y no dice qué hacer.
  // El vacío se declara una vez y nombra el botón que lo llena (C3).
  const ningunaCorrida = summaryRows.length > 0
    && summaryRows.every((row) => safeNumber(row.executed_runs, 0) <= 0);
  if (!summaryRows.length || ningunaCorrida) {
    return (
      <div className="cmv2-classroom-empty is-compact">
        <span><BarChart3 size={16} /></span>
        <div>
          <strong>Todavía no se ha repetido el sorteo</strong>
          <em>
            Cada método se sortea muchas veces con semillas distintas para ver cuánto cambia
            el resultado de una vez a otra. Pulsa <b>Medir estabilidad</b> arriba para correrlo.
          </em>
        </div>
      </div>
    );
  }
  return (
    <div className="cmv2-simulation-grid">
      {summaryRows.map((row) => (
        <article key={row.method_id}>
          <small>{classroomMethodLabel(row.method_id)}</small>
          <strong>{classroomScore(row.score_mean)}</strong>
          <span>puntaje medio de {fmtInt(safeNumber(row.executed_runs, 0))} sorteos</span>
          <span className="cmv2-simulation-range-label">
            8 de cada 10 cayeron entre {classroomScore(row.score_p10)} y {classroomScore(row.score_p90)}
          </span>
          <div className="cmv2-simulation-range" aria-label={`8 de cada 10 sorteos entre ${classroomScore(row.score_p10)} y ${classroomScore(row.score_p90)}`}>
            <i style={{
              left: `${Math.max(0, Math.min(100, safeNumber(row.score_p10, 0)))}%`,
              width: `${Math.max(2, Math.min(100, safeNumber(row.score_p90, 0)) - Math.max(0, safeNumber(row.score_p10, 0)))}%`,
            }} />
          </div>
          <em>{motorCopyText(row.note)}</em>
          {/* La tarjeta decia solo el NOMBRE del metodo: «Sistemático por
              facultad — 0/0 corridas». Gonzalo, 2026-08-22: «¿qué es sistemático
              por facultad?». La explicación ya existía en las constantes y no se
              pintaba en ninguna parte de Simulación. */}
          <p className="cmv2-simulation-method-detail">{classroomMethodReason(row.method_id)}</p>
        </article>
      ))}
    </div>
  );
}

export function MethodSummaryCard({
  method,
  active,
  onSelect,
}: {
  method: CalcMuestraAulasMethodSummary;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <article className={`cmv2-classroom-quality-card ${active ? "is-recommended" : ""}`}>
      <div>
        <small>{active ? "Recomendado" : method.method_id}</small>
        <strong>{classroomMethodLabel(String(method.method_id ?? "")) || method.method_label}</strong>
        <span>{method.operational_reason ?? classroomMethodReason(String(method.method_id))}</span>
      </div>
      <div className="cmv2-classroom-quality-metrics">
        <span><strong>{classroomScore(method.representativity_score ?? method.overall_score)}</strong> representatividad</span>
        <span><strong>{classroomScore(method.balance_score)}</strong> balance</span>
        <span><strong>{fmtPct(method.duplicate_loss ?? 0)}</strong> repetidos</span>
        <span><strong>{fmtPct(method.coverage_unique_pct ?? 0)}</strong> cobertura</span>
      </div>
      <button type="button" className={active ? "cmv2-primary" : "cmv2-ghost"} onClick={onSelect}>
        Usar método <ArrowRight size={13} />
      </button>
    </article>
  );
}

export function ClassroomRecommendation({
  comparison,
  fallbackMethod,
}: {
  comparison: CalcMuestraAulasMethodComparison | null;
  fallbackMethod: string;
}) {
  if (!comparison?.recommendation) {
    return (
      <div className="cmv2-classroom-reco-panel">
        <small>Método configurado</small>
        <strong>{fallbackMethod}</strong>
        <span>No es una recomendación del engine. Corre el comparador para acreditarla con métricas del marco vigente.</span>
      </div>
    );
  }
  return (
    <div className="cmv2-classroom-reco-panel is-ready">
      <small>Recomendación del laboratorio</small>
      <strong>{classroomMethodLabel(comparison.recommendation.method_id ?? "") || comparison.recommendation.method_label}</strong>
      <span>{comparison.recommendation.operational_reason}</span>
      <b>Calidad {classroomScore(comparison.recommendation.representativity_score ?? comparison.recommendation.overall_score)} · distancia {classroomNumberText(comparison.recommendation as Record<string, unknown>, ["representativity_distance"])}</b>
      <em>{comparison.recommendation.methodological_reason}</em>
    </div>
  );
}

const BALANCE_FILAS_VISIBLES = 10;

export function ClassroomBalanceTable({ rows, methodId }: { rows?: Array<Record<string, unknown>> | unknown; methodId: string }) {
  const delMetodo = rowsFrom<Record<string, unknown>>(rows)
    .filter((row) => !methodId || classroomRowText(row, ["method_id"]) === methodId);
  // El recorte era `slice(0, 10)` sobre filas que llegan agrupadas por
  // dimensión, así que las diez visibles eran siempre las diez primeras
  // categorías de la PRIMERA dimensión. Medido en HSVG2026 el 2026-08-22: 90
  // filas para el método recomendado en cinco dimensiones —facultad, programa,
  // nivel, tamaño y sexo— de las que se veían diez, todas de facultad, y las
  // otras cuatro dimensiones no aparecían en absoluto. Nada lo decía.
  //
  // Ahora el recorte tiene criterio: las diez categorías donde la selección más
  // se aparta del marco, que es lo que hay que mirar, vengan de la dimensión que
  // vengan. Y el pie declara qué se está viendo.
  const visible = [...delMetodo]
    .sort((a, b) => Math.abs(classroomRowNumber(b, ["diferencia_abs", "delta"]) || 0)
      - Math.abs(classroomRowNumber(a, ["diferencia_abs", "delta"]) || 0))
    .slice(0, BALANCE_FILAS_VISIBLES);
  const dimensiones = new Set(delMetodo.map((row) => classroomRowText(row, ["variable"])));
  if (!visible.length) {
    return (
      <div className="cmv2-classroom-empty is-compact">
        <span><BarChart3 size={16} /></span>
        <div>
          <strong>Sin diagnóstico de balance visible</strong>
          <em>El comparador no devolvió filas de balance para este método.</em>
        </div>
      </div>
    );
  }
  return (
    <div className="cmv2-classroom-table-wrap">
      <table className="cmv2-table cmv2-classroom-table">
        <thead>
          <tr>
            <th>Variable</th>
            <th>Categoría</th>
            <th className="is-num">Marco</th>
            <th className="is-num">Seleccionado</th>
            <th className="is-num">Diferencia</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((row, index) => (
            <tr key={index}>
              <td>{selectorFieldLabelTitulo(classroomRowText(row, ["variable"]))}</td>
              <td>{classroomRowText(row, ["categoria", "category"])}</td>
              <td className="is-num">{fmtPct(classroomRowNumber(row, ["marco_prop", "frame_share"]))}</td>
              <td className="is-num">{fmtPct(classroomRowNumber(row, ["seleccion_m1_prop", "selected_share"]))}</td>
              <td className="is-num">{fmtPct(classroomRowNumber(row, ["diferencia_abs", "delta"]))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {delMetodo.length > visible.length && (
        <p className="cmv2-classroom-table-pie">
          Se muestran las <b>{visible.length} categorías con mayor diferencia</b> de las{" "}
          {delMetodo.length} que se comparan, repartidas en {dimensiones.size}{" "}
          {dimensiones.size === 1 ? "variable" : "variables"}. El detalle completo está en
          Auditoría.
        </p>
      )}
    </div>
  );
}
