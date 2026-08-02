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

export function RepresentativityMetricGrid({ metrics }: { metrics?: CalcMuestraAulasRepresentativityMetric[] | unknown }) {
  const visible = rowsFrom<CalcMuestraAulasRepresentativityMetric>(metrics)
    .filter((metric) => metric.active !== false && metric.score != null && Number.isFinite(safeNumber(metric.score, Number.NaN)))
    .slice(0, 8);
  if (!visible.length) return null;
  // Nivel semántico del puntaje (0-100): el meter y la cifra lo heredan para
  // que un 0/100 no se lea igual de neutro que un 100/100.
  const scoreLevel = (value: number) => (value < 40 ? "bajo" : value < 70 ? "medio" : "alto");
  return (
    <div className="cmv2-representativity-metric-grid">
      {visible.map((metric) => {
        const score = Math.max(0, Math.min(100, safeNumber(metric.score, 0)));
        return (
          <article key={metric.metric_id} data-nivel={scoreLevel(score)}>
            <small>{METRIC_GROUP_LABELS[String(metric.metric_group ?? "")] ?? metric.metric_group}</small>
            <strong>{classroomScore(metric.score)}</strong>
            <span>{motorCopyText(metric.label)}</span>
            <div aria-hidden="true"><i style={{ width: `${score}%` }} /></div>
          </article>
        );
      })}
    </div>
  );
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
      {visible.map((row, index) => {
        const frame = Math.max(0, Math.min(1, safeNumber(row.frame_prop, 0)));
        const selected = Math.max(0, Math.min(1, safeNumber(row.selected_prop, 0)));
        const tolerance = safeNumber(row.tolerance, Number.NaN);
        const hasTolerance = Number.isFinite(tolerance) && tolerance > 0;
        const gap = Math.abs(selected - frame);
        const within = row.within_tolerance != null ? Boolean(row.within_tolerance) : !hasTolerance || gap <= tolerance;
        const bandStart = hasTolerance ? Math.max(0, frame - tolerance) : 0;
        const bandWidth = hasTolerance ? Math.min(1, frame + tolerance) - bandStart : 0;
        return (
          <div
            key={`${row.dimension}-${row.category}-${index}`}
            className={hasTolerance ? (within ? "is-dentro" : "is-alert") : ""}
          >
            <div>
              <strong>{row.label || row.dimension}</strong>
              <span>{row.category}</span>
              <em>{fmtPct(gap)} brecha{hasTolerance ? ` · tol. ±${fmtPct(tolerance)}` : ""}</em>
            </div>
            <div
              className="cmv2-profile-track"
              aria-label={`${row.category}: marco ${fmtPct(frame)}, seleccionado ${fmtPct(selected)}${hasTolerance ? `, tolerancia ±${fmtPct(tolerance)} (${within ? "dentro" : "fuera"} de banda)` : ""}`}
            >
              {hasTolerance && (
                <i
                  className="cmv2-aulas-tol-banda"
                  data-estado={within ? "ok" : "alerta"}
                  style={{ left: `${bandStart * 100}%`, width: `${Math.max(1.5, bandWidth * 100)}%` }}
                />
              )}
              <i className="is-frame" style={{ width: `${frame * 100}%` }} />
              <i className="is-selected" style={{ width: `${selected * 100}%` }} />
            </div>
          </div>
        );
      })}
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
  if (!summaryRows.length) {
    return (
      <div className="cmv2-classroom-empty is-compact">
        <span><BarChart3 size={16} /></span>
        <div>
          <strong>Simulación pendiente</strong>
          <em>Corre el comparador para estimar estabilidad, cobertura y pérdida por estudiantes repetidos.</em>
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
          <span>{fmtInt(safeNumber(row.executed_runs, 0))}/{fmtInt(safeNumber(row.requested_runs, 0))} corridas</span>
          <div className="cmv2-simulation-range" aria-label={`Rango ${classroomScore(row.score_p10)} a ${classroomScore(row.score_p90)}`}>
            <i style={{
              left: `${Math.max(0, Math.min(100, safeNumber(row.score_p10, 0)))}%`,
              width: `${Math.max(2, Math.min(100, safeNumber(row.score_p90, 0)) - Math.max(0, safeNumber(row.score_p10, 0)))}%`,
            }} />
          </div>
          <em>{motorCopyText(row.note)}</em>
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
        <strong>{method.method_label}</strong>
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
        <small>Recomendación</small>
        <strong>{fallbackMethod}</strong>
        <span>Corre el comparador para que Prosecnur recomiende un método con métricas reales del marco.</span>
      </div>
    );
  }
  return (
    <div className="cmv2-classroom-reco-panel is-ready">
      <small>Recomendación del laboratorio</small>
      <strong>{comparison.recommendation.method_label ?? classroomMethodLabel(comparison.recommendation.method_id ?? "")}</strong>
      <span>{comparison.recommendation.operational_reason}</span>
      <b>Calidad {classroomScore(comparison.recommendation.representativity_score ?? comparison.recommendation.overall_score)} · distancia {classroomNumberText(comparison.recommendation as Record<string, unknown>, ["representativity_distance"])}</b>
      <em>{comparison.recommendation.methodological_reason}</em>
    </div>
  );
}

export function ClassroomBalanceTable({ rows, methodId }: { rows?: Array<Record<string, unknown>> | unknown; methodId: string }) {
  const visible = rowsFrom<Record<string, unknown>>(rows)
    .filter((row) => !methodId || classroomRowText(row, ["method_id"]) === methodId)
    .slice(0, 10);
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
    </div>
  );
}
