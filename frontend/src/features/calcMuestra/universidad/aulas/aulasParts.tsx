/**
 * Piezas compartidas de la sección Aulas (laboratorio de selección) del desk
 * universitario. Igual que marco/marcoCharts: aquí vive el código MOVIDO del
 * monolito (paneles, tablas y helpers Classroom*) que comparten las 7 pestañas
 * y algunas salidas, más el modelo derivado (`buildClassroomLabModel`) y la
 * barra de comandos del laboratorio. Los estilos nuevos usan aulas.css
 * (prefijo cmv2-aulas-*); los movidos conservan sus clases cmv2-classroom-*.
 */
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  CircleAlert,
  Database,
  Gauge,
  Layers3,
  Loader2,
  RefreshCw,
  Route,
  Table2,
  TriangleAlert,
  Users,
} from "lucide-react";
import {
  type CalcMuestraAulasMethodComparison,
  type CalcMuestraAulasMethodSummary,
  type CalcMuestraAulasObjectiveConfig,
  type CalcMuestraAulasProfileDistribution,
  type CalcMuestraAulasReplacementSimulation,
  type CalcMuestraAulasReplacementSuggestion,
  type CalcMuestraAulasRepresentativityMetric,
  type CalcMuestraAulasSelection,
  type CalcMuestraAulasSimulationSummary,
  type CalcMuestraAulasState,
  type CalcMuestraComponente,
  type CalcMuestraWorkspace,
  type CalcMuestraWorkspaceAulasConfig,
} from "../../../../api/client";
import { AulasApplicationFlow } from "../../../aulasFlow/AulasApplicationFlow";
import { fmtDec, fmtInt, fmtPct, rowsFrom, safeNumber } from "../../sharedCore";
import {
  DEFAULT_UNIVERSITY_AULAS_OBJECTIVE,
  UNIVERSITY_AULAS_MODALIDAD_OPTIONS,
  UNIVERSITY_AULAS_SELECTOR_OPTIONS,
} from "../shared/constants";
import { classroomRowNumber, classroomRowText } from "../shared/format";
import {
  classroomComparisonForState,
  classroomComparisonReady,
  classroomExtraReserveRowsForState,
  classroomFrameReady,
  classroomM1RowsForState,
  classroomMetricValue,
  classroomReplacementReady,
  classroomReplacementSimulationForState,
  classroomReserveRowsForState,
  classroomSelectionForState,
  classroomSelectionReady,
  classroomSelectionRowsForState,
  frameAuditCards,
  frameAuditNumber,
} from "../shared/frame";
import {
  estimateClassroomBase,
  estimateOperationalExtra,
  normalizeUniversityAulasConfig,
} from "../shared/study";
import { workspaceCategoryLabel } from "../shared/categorias";
import {
  ClassroomBarPlot,
  ClassroomPlotCard,
  ClassroomSexCompositionPlot,
  classroomSexCompositionRowsFromAulas,
  weightedDistributionRows,
} from "../marco/marcoCharts";
import "./aulas.css";

/* =============================================================================
   Primitivas compartidas (movidas del monolito; el monolito las importa de aquí)
   ============================================================================= */

function toInputNumber(value: number | null | undefined) {
  return value == null || Number.isNaN(value) ? "" : String(value);
}

export function NumberCell({
  value,
  onChange,
  min = 0,
  step = 1,
  suffix,
}: {
  value: number | null | undefined;
  onChange: (value: number) => void;
  min?: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <label className="cmv2-number-cell">
      <input
        type="number"
        min={min}
        step={step}
        value={toInputNumber(value)}
        onChange={(e) => onChange(safeNumber(e.currentTarget.value, 0))}
      />
      {suffix && <span>{suffix}</span>}
    </label>
  );
}

export function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="cmv2-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function ClassroomEmptyState({
  icon: Icon,
  title,
  detail,
  actionLabel,
  onAction,
  disabled,
}: {
  icon: typeof Database;
  title: string;
  detail: string;
  actionLabel?: string;
  onAction?: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="cmv2-classroom-empty">
      <span><Icon size={18} /></span>
      <div>
        <strong>{title}</strong>
        <em>{detail}</em>
        {actionLabel && onAction && (
          <button type="button" className="cmv2-ghost" onClick={onAction} disabled={disabled}>
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}

/* =============================================================================
   Helpers de etiquetado (movidos)
   ============================================================================= */

export function classroomNumberText(row: Record<string, unknown>, keys: string[]) {
  const n = classroomRowNumber(row, keys);
  if (!Number.isFinite(n)) return "—";
  return Math.abs(n) >= 100 ? fmtInt(n) : n.toFixed(3).replace(/\.?0+$/, "");
}

export function classroomMethodLabel(methodId: string) {
  return UNIVERSITY_AULAS_SELECTOR_OPTIONS.find((option) => option.id === methodId)?.label ?? methodId;
}

export function classroomMethodReason(methodId: string) {
  return UNIVERSITY_AULAS_SELECTOR_OPTIONS.find((option) => option.id === methodId)?.detail ??
    "Método auditable registrado en la bitácora metodológica.";
}

export function classroomProbabilitySourceLabel(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw) return "Diseño probabilístico base";
  const key = raw.toLowerCase().replace(/[\s-]+/g, "_");
  const labels: Record<string, string> = {
    prescribed_design: "Diseño definido por el cálculo",
    design: "Diseño probabilístico base",
    base_design: "Diseño probabilístico base",
    pps: "PPS sistemático",
    pps_systematic: "PPS sistemático",
    balanced_probability: "Balance probabilístico",
    probability_with_operational_optimization: "Optimización con probabilidad auditada",
    simulation: "Simulación de probabilidades",
    simulated: "Simulación de probabilidades",
    monte_carlo: "Simulación Monte Carlo",
    monte_carlo_after_optimization: "Simulación Monte Carlo tras optimización",
  };
  return labels[key] ?? raw.replace(/_/g, " ");
}

export function classroomScore(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  // Formato único "N/100" para todos los puntajes, vengan en escala 0-1 o 0-100,
  // para que un score de 0 no se lea distinto ("0%") al resto de tarjetas.
  const score = value >= 0 && value <= 1 ? value * 100 : value;
  return `${Math.round(score)}/100`;
}

export function selectorFieldLabel(field: string) {
  const labels: Record<string, string> = {
    faculty: "facultad",
    sex_top_1: "sexo esperado",
    size_group: "tamaño del curso-horario",
  };
  return labels[field] ?? field;
}

/* =============================================================================
   Modelo derivado del laboratorio: una sola lectura del estado del motor que
   comparten las 7 pestañas (código movido del cuerpo del panel del monolito).
   ============================================================================= */

export type ClassroomLabModel = ReturnType<typeof buildClassroomLabModel>;

export function buildClassroomLabModel({
  workspace,
  totalComp,
  facultyComp,
  aulasState,
}: {
  workspace: CalcMuestraWorkspace;
  totalComp: CalcMuestraComponente;
  facultyComp: CalcMuestraComponente;
  aulasState: CalcMuestraAulasState | null;
}) {
  const frame = aulasState?.frame ?? null;
  const comparison = classroomComparisonForState(aulasState);
  const selection = classroomSelectionForState(aulasState);
  const replacementSimulation = classroomReplacementSimulationForState(aulasState);
  const frameRows = rowsFrom<Record<string, unknown>>(frame?.aula_frame);
  const populationRows = rowsFrom<Record<string, unknown>>(frame?.population);
  const frameReady = classroomFrameReady(aulasState);
  const comparisonReady = classroomComparisonReady(aulasState);
  const selectionReady = classroomSelectionReady(aulasState);
  const replacementReady = classroomReplacementReady(aulasState);
  const framePopulationCount = Math.max(
    populationRows.length,
    safeNumber((frame as Record<string, unknown> | null)?.population_n, 0),
    safeNumber((frame as Record<string, unknown> | null)?.unique_students_n, 0),
    frameAuditNumber(frame, "population_n"),
    frameAuditNumber(frame, "unique_students_n"),
  );
  const selectionRows = classroomSelectionRowsForState(aulasState);
  const config = normalizeUniversityAulasConfig((aulasState?.config as CalcMuestraWorkspaceAulasConfig | undefined) ?? workspace.aulas_config);
  const objective = comparison?.objective_config ?? selection?.objective_config ?? config.objective ?? DEFAULT_UNIVERSITY_AULAS_OBJECTIVE;
  const objectiveVariables = rowsFrom<CalcMuestraAulasObjectiveConfig["variables"][number]>(objective.variables);
  const representativity = selection?.representativity ?? null;
  const comparisonMethods = rowsFrom<CalcMuestraAulasMethodSummary>(comparison?.methods);
  const representativityMetrics = rowsFrom<CalcMuestraAulasRepresentativityMetric>(representativity?.metrics ?? selection?.diagnostics?.representativity_metrics);
  const comparisonMetrics = rowsFrom<CalcMuestraAulasRepresentativityMetric>(comparison?.representativity_metrics);
  const simulationRows = rowsFrom<CalcMuestraAulasSimulationSummary>(comparison?.simulation_summary);
  const profileRows = rowsFrom<CalcMuestraAulasProfileDistribution>(
    representativity?.profile_distributions ?? selection?.diagnostics?.profile_distributions ?? comparison?.method_profiles,
  );
  const recommendedMethodId = comparison?.recommendation?.method_id ?? String(config.selector_engine ?? config.selector);
  const recommendedProfileRows = profileRows.filter((row) => !row.method_id || row.method_id === (comparison?.recommendation?.method_id ?? ""));
  const visibleProfiles = (recommendedProfileRows.length ? recommendedProfileRows : profileRows).slice(0, 36);
  const coverageRows = rowsFrom<Record<string, unknown>>(representativity?.coverage_overlap ?? selection?.diagnostics?.coverage_overlap);
  const currentRepresentativityScore = safeNumber(selection?.representativity_score ?? representativity?.representativity_score ?? comparison?.recommendation?.representativity_score, Number.NaN);
  const engineOption = UNIVERSITY_AULAS_SELECTOR_OPTIONS.find((option) => option.id === config.selector_engine) ?? UNIVERSITY_AULAS_SELECTOR_OPTIONS[0];
  const modalidad = UNIVERSITY_AULAS_MODALIDAD_OPTIONS.find((option) => option.id === config.modalidad) ?? UNIVERSITY_AULAS_MODALIDAD_OPTIONS[0];
  const m1Rows = classroomM1RowsForState(aulasState);
  const reserveRows = classroomReserveRowsForState(aulasState);
  const extraReserveRows = classroomExtraReserveRowsForState(aulasState);
  const recommendedMethod = comparisonMethods.find((method) => method.method_id === recommendedMethodId) ?? null;
  const totalBase = estimateClassroomBase(totalComp);
  const facultyBase = estimateClassroomBase(facultyComp);
  const referenciaBase = Math.max(totalBase ?? 0, facultyBase ?? 0);
  const facultades = totalComp.marco.estratos ?? [];
  const extraOperativo = estimateOperationalExtra(facultades, config);
  const sobremuestraPct = Math.max(totalComp.parametros.oversample_pct, facultyComp.parametros.oversample_pct);
  const selectorFields = config.estratos_selector.map(selectorFieldLabel);
  const facultyTarget = safeNumber(facultyComp.resultado?.n_objetivo, 0);
  const totalTarget = safeNumber(totalComp.resultado?.n_objetivo, 0);
  const frameTarget = safeNumber((frame as Record<string, unknown> | null)?.target_n, 0);
  const targetForDisplay = Math.max(facultyTarget, totalTarget, frameTarget);
  const calculatedQuotaEstimate = targetForDisplay > 0 ? Math.max(referenciaBase, safeNumber((frame as Record<string, unknown> | null)?.planned_m1, 0)) : 0;
  const m1ForDisplay = selectionReady ? m1Rows.length : calculatedQuotaEstimate;
  const hasCalculatedQuota = targetForDisplay > 0 || selectionReady;
  const frameAuditCardsForDisplay = frameAuditCards(frame);
  const topGaps = visibleProfiles
    .filter((row) => Number.isFinite(safeNumber(row.abs_error, Number.NaN)))
    .sort((a, b) => safeNumber(b.abs_error, 0) - safeNumber(a.abs_error, 0))
    .slice(0, 6);
  // Diagnósticos del motor usados por Simulación, Reemplazos y Auditoría.
  const diagnostics = selection?.diagnostics ?? {};
  const weightStability = rowsFrom<Record<string, unknown>>(diagnostics.weight_stability ?? representativity?.weight_stability)[0] ?? null;
  const reserveDepthRows = rowsFrom<Record<string, unknown>>(diagnostics.reserve_depth ?? representativity?.reserve_depth ?? comparison?.reserve_depth);
  const waveRows = rowsFrom<Record<string, unknown>>(diagnostics.waves);
  const probabilityRows = rowsFrom<Record<string, unknown>>(diagnostics.probabilities);
  // Traducción validada del motor: cuota → aulas por facultad (si existe).
  const aulasPorEstrato = totalComp.resultado?.aulas_por_estrato ?? facultyComp.resultado?.aulas_por_estrato ?? [];

  return {
    totalComp,
    facultyComp,
    frame,
    comparison,
    selection,
    replacementSimulation,
    frameRows,
    frameReady,
    comparisonReady,
    selectionReady,
    replacementReady,
    framePopulationCount,
    selectionRows,
    config,
    objective,
    objectiveVariables,
    representativity,
    comparisonMethods,
    representativityMetrics,
    comparisonMetrics,
    simulationRows,
    visibleProfiles,
    coverageRows,
    currentRepresentativityScore,
    engineOption,
    modalidad,
    m1Rows,
    reserveRows,
    extraReserveRows,
    recommendedMethodId,
    recommendedMethod,
    facultades,
    extraOperativo,
    sobremuestraPct,
    selectorFields,
    facultyTarget,
    totalTarget,
    frameTarget,
    targetForDisplay,
    m1ForDisplay,
    hasCalculatedQuota,
    frameAuditCardsForDisplay,
    topGaps,
    weightStability,
    reserveDepthRows,
    waveRows,
    probabilityRows,
    aulasPorEstrato,
  };
}

/* =============================================================================
   Barra de comandos del laboratorio: cada pestaña pide solo las acciones que
   corresponden a su decisión (no se repite una barra global en las 7).
   ============================================================================= */

export function ClassroomLabCommandBar({
  model,
  busy,
  acciones,
  onCompare,
  onSelectMethod,
  onSimulateReplacements,
}: {
  model: ClassroomLabModel;
  busy: string | null;
  acciones: Array<"comparar" | "seleccionar" | "reemplazos">;
  onCompare?: (config: CalcMuestraWorkspaceAulasConfig, simulationRuns: number) => void | Promise<void>;
  onSelectMethod?: (config: CalcMuestraWorkspaceAulasConfig, methodId?: string) => void | Promise<void>;
  onSimulateReplacements?: (config: CalcMuestraWorkspaceAulasConfig) => void | Promise<void>;
}) {
  const { config } = model;
  return (
    <div className="cmv2-classroom-commandbar" aria-label="Acciones de selección de cursos-horario">
      {acciones.includes("comparar") && onCompare && (
        <button
          type="button"
          className="cmv2-ghost"
          onClick={() => void onCompare(config, config.simulation_runs ?? config.monte_carlo_n ?? 500)}
          disabled={Boolean(busy) || !model.frameReady || !model.hasCalculatedQuota}
        >
          {busy === "Comparando métodos" ? <Loader2 size={14} className="pulso-spin" /> : <BarChart3 size={14} />}
          Comparar métodos
        </button>
      )}
      {acciones.includes("seleccionar") && onSelectMethod && (
        <button
          type="button"
          className="cmv2-primary"
          onClick={() => void onSelectMethod(config, model.recommendedMethodId)}
          disabled={Boolean(busy) || !model.comparisonReady}
        >
          {busy === "Seleccionando cursos-horario" ? <Loader2 size={14} className="pulso-spin" /> : <Table2 size={14} />}
          Seleccionar cursos-horario titulares
        </button>
      )}
      {acciones.includes("reemplazos") && onSimulateReplacements && (
        <button
          type="button"
          className="cmv2-ghost"
          onClick={() => void onSimulateReplacements(config)}
          disabled={Boolean(busy) || !model.selectionReady}
        >
          {busy === "Simulando reemplazos" ? <Loader2 size={14} className="pulso-spin" /> : <RefreshCw size={14} />}
          Probar reemplazos
        </button>
      )}
      {model.comparison?.recommendation && (
        <span className="cmv2-classroom-recommendation">
          Recomendado: <strong>{model.comparison.recommendation.method_label ?? classroomMethodLabel(model.recommendedMethodId)}</strong>
        </span>
      )}
    </div>
  );
}

/* =============================================================================
   Paneles de objetivo y métricas (movidos)
   ============================================================================= */

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

/* =============================================================================
   Selección: razones operativas, cobertura y tabla (movidos)
   ============================================================================= */

function classroomExpectedSexLabel(row: Record<string, unknown>, workspace?: CalcMuestraWorkspace) {
  const parts = [
    [classroomRowText(row, ["sex_top_1", "sexo_top_1"]), classroomRowNumber(row, ["sex_top_1_n", "sexo_top_1_n"])],
    [classroomRowText(row, ["sex_top_2", "sexo_top_2"]), classroomRowNumber(row, ["sex_top_2_n", "sexo_top_2_n"])],
  ]
    .filter(([label, value]) => String(label ?? "").trim() && safeNumber(value, 0) > 0)
    .map(([label, value]) => `${workspaceCategoryLabel(workspace, "sex", String(label ?? ""))}: ${fmtInt(safeNumber(value, 0))}`);
  return parts.length ? parts.join(" · ") : "sexo esperado pendiente";
}

function classroomSelectionReason(row: Record<string, unknown>) {
  const explicit = classroomRowText(row, ["selection_reason", "reason", "motivo"]);
  if (explicit) return explicit;
  const faculty = classroomRowText(row, ["faculty", "stratum"]);
  const eligible = classroomRowNumber(row, ["eligible_n"]);
  const pi = classroomRowNumber(row, ["pi_final"]);
  const parts = [
    faculty ? `aporta a ${faculty}` : "",
    eligible > 0 ? `${fmtInt(eligible)} elegibles esperados` : "",
    pi > 0 ? `prob. final ${fmtPct(pi)}` : "",
  ].filter(Boolean);
  return parts.length ? parts.join("; ") : "curso-horario incluido por el método seleccionado";
}

export function ClassroomSelectionRationaleDashboard({ rows, workspace }: { rows?: Array<Record<string, unknown>> | unknown; workspace?: CalcMuestraWorkspace }) {
  const m1Rows = rowsFrom<Record<string, unknown>>(rows).filter((row) => classroomRowText(row, ["wave"]) === "M1" || !classroomRowText(row, ["wave"]));
  if (!m1Rows.length) return null;
  const facultyRows = weightedDistributionRows(m1Rows, ["faculty", "facultad", "stratum"], ["eligible_n"], 12, (value) => workspaceCategoryLabel(workspace, "faculty", value), "faculty");
  const classroomSexRows = classroomSexCompositionRowsFromAulas(m1Rows, workspace, 10);
  const topRows = m1Rows
    .slice()
    .sort((a, b) => classroomRowNumber(b, ["eligible_n"]) - classroomRowNumber(a, ["eligible_n"]))
    .slice(0, 10);
  return (
    <div className="cmv2-selection-rationale">
      <div className="cmv2-subhead">
        <strong>Por qué estos cursos-horario</strong>
      </div>
      <div className="cmv2-selection-rationale-grid">
        <ClassroomPlotCard title="Titulares por facultad" subtitle="elegibles esperados en titulares">
          <ClassroomBarPlot rows={facultyRows} ariaLabel="Cursos-horario titulares por facultad" unit="elegibles" height={235} />
        </ClassroomPlotCard>
        <ClassroomPlotCard title="Sexo esperado por curso-horario titular" subtitle="aporte esperado de titulares">
          <ClassroomSexCompositionPlot rows={classroomSexRows} ariaLabel="Sexo esperado por curso-horario titular" height={260} />
        </ClassroomPlotCard>
      </div>
      <div className="cmv2-classroom-table-wrap">
        <table className="cmv2-table cmv2-classroom-table">
          <thead>
            <tr>
              <th>Curso-horario titular</th>
              <th>Facultad / programa</th>
              <th>Esperado</th>
              <th>Razón operativa</th>
            </tr>
          </thead>
          <tbody>
            {topRows.map((row, index) => (
              <tr key={`${classroomRowText(row, ["classroom_id"])}-${index}`}>
                <td>
                  <span className="cmv2-table-code">{classroomOperationalCode(row, `CH ${index + 1}`)}</span>
                  <strong>{classroomRowText(row, ["course_name", "label", "classroom_id"])}</strong>
                  <small>{classroomRowText(row, ["classroom_id", "schedule"])}</small>
                </td>
                <td>
                  {classroomRowText(row, ["faculty", "stratum"])}
                  <small>{classroomRowText(row, ["program", "level"])}</small>
                </td>
                <td>
                  {fmtInt(classroomRowNumber(row, ["eligible_n"]))} elegibles
                  <small>{classroomExpectedSexLabel(row, workspace)}</small>
                </td>
                <td>{classroomSelectionReason(row)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* =============================================================================
   Cadenas de reemplazo (movidas)
   ============================================================================= */

type ClassroomReplacementSlot = {
  id: string;
  code: string;
  titularCode: string;
  label: string;
  wave: string;
  order: number;
  match: string;
  scoreDelta: number;
  warning: string;
};

type ClassroomReplacementChain = {
  titularId: string;
  code: string;
  titularLabel: string;
  faculty: string;
  stratum: string;
  eligible: number;
  slots: ClassroomReplacementSlot[];
};

export function classroomWaveNumber(wave: string) {
  const match = String(wave ?? "").match(/(\d+)/);
  return match ? Number(match[1]) : 99;
}

export function classroomPlanLabel(row: Record<string, unknown>) {
  const role = classroomRowText(row, ["sample_role"]);
  const wave = classroomRowText(row, ["wave"]);
  if (role === "titular" || wave === "M1") return "Titular";
  if (role === "extra_reserve_pool") return "Extra";
  const order = classroomRowNumber(row, ["replacement_order"]);
  if (order > 0) return `Reemplazo ${fmtInt(order)}`;
  const waveNumber = classroomWaveNumber(wave);
  if (waveNumber > 1 && waveNumber < 99) return `Reemplazo ${fmtInt(waveNumber - 1)}`;
  return wave || "Plan";
}

function classroomReplacementRouteLabel(wave: string | undefined, rank?: number) {
  const numericRank = safeNumber(rank, 0);
  if (numericRank > 0) return `Reemplazo ${fmtInt(numericRank)}`;
  const waveNumber = classroomWaveNumber(String(wave ?? ""));
  if (waveNumber > 1 && waveNumber < 99) return `Reemplazo ${fmtInt(waveNumber - 1)}`;
  return String(wave ?? "Ruta");
}

function classroomSlotNumber(slotId: string, fallback: number) {
  const match = String(slotId ?? "").match(/(\d+)/);
  const parsed = match ? Number(match[1]) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function classroomOperationalCode(row: Record<string, unknown>, fallback: string) {
  const raw = classroomRowText(row, ["operational_code", "codigo_operativo", "codigo_aula_operativa"]) || fallback;
  return raw.replace(/^AULA\b/i, "CH");
}

function classroomReplacementMatchLabel(value: string) {
  const normalized = String(value ?? "").trim().toLowerCase();
  const labels: Record<string, string> = {
    misma_celda: "Mantiene la celda",
    celda_cercana: "Celda cercana",
    misma_facultad: "Misma facultad",
    mismo_dominio: "Mismo dominio",
    mismo_programa: "Mismo programa",
    cambia_programa: "Cambia programa",
    cambia_carrera: "Cambia carrera",
    cambia_nivel: "Cambia nivel",
    baja_equivalencia: "Baja equivalencia",
    sin_reserva: "Sin reemplazo viable",
  };
  const fallback = normalized.replace(/_/g, " ");
  return labels[normalized] ?? (fallback || "equivalencia pendiente");
}

function classroomReplacementSlotTone(value: string, warning?: string) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (warning) return "is-warning";
  if (["misma_celda", "mismo_programa", "mismo_dominio"].includes(normalized)) return "is-strong";
  if (["celda_cercana", "misma_facultad"].includes(normalized)) return "is-good";
  return "is-soft";
}

function classroomReplacementWarningText(value: string, status: string, match: string) {
  const warning = String(value ?? "").trim();
  if (!warning) return "";
  const normalizedStatus = String(status ?? "").trim().toLowerCase();
  const normalizedMatch = String(match ?? "").trim().toLowerCase();
  const isExpectedReserve = normalizedStatus === "reserve_conditional";
  const isMethodologicallyClose = ["misma_celda", "mismo_programa", "mismo_dominio", "celda_cercana", "misma_facultad"].includes(normalizedMatch);
  return isExpectedReserve && isMethodologicallyClose ? "" : warning;
}

export function classroomReplacementChains(
  selectionRows: Array<Record<string, unknown>>,
  simulation?: CalcMuestraAulasReplacementSimulation | null,
  depth = 6,
): ClassroomReplacementChain[] {
  const titulars = selectionRows.filter((row) => classroomRowText(row, ["sample_role"]) === "titular" || classroomRowText(row, ["wave"]) === "M1");
  const reserves = selectionRows
    .filter((row) => classroomRowText(row, ["sample_role"]) === "chain_reserve" || (classroomRowText(row, ["wave"]) !== "M1" && classroomRowText(row, ["sample_role"]) !== "extra_reserve_pool"))
    .sort((a, b) => safeNumber(a.replacement_order, classroomWaveNumber(classroomRowText(a, ["wave"]))) - safeNumber(b.replacement_order, classroomWaveNumber(classroomRowText(b, ["wave"]))));
  const suggestions = rowsFrom<CalcMuestraAulasReplacementSuggestion>(simulation?.suggestions);
  return titulars.slice(0, 24).map((titular, titularIndex) => {
    const titularId = classroomRowText(titular, ["classroom_id"]);
    const slotId = classroomRowText(titular, ["selection_slot_id"]);
    const slotNumber = classroomSlotNumber(slotId, titularIndex + 1);
    const titularCode = classroomOperationalCode(titular, `CH ${slotNumber}`);
    const faculty = classroomRowText(titular, ["faculty", "stratum"]);
    const stratum = classroomRowText(titular, ["stratum", "faculty"]);
    const suggestionByReserveId = new Map(suggestions
      .filter((item) => item.titular_classroom_id === titularId)
      .sort((a, b) => safeNumber(a.rank, 99) - safeNumber(b.rank, 99))
      .map((item) => [item.reserve_classroom_id, item] as const));
    const tiedReserves = reserves.filter((reserve) => {
      const reserveId = classroomRowText(reserve, ["classroom_id"]);
      if (!reserveId) return false;
      return Boolean((slotId && classroomRowText(reserve, ["selection_slot_id"]) === slotId) || classroomRowText(reserve, ["replacement_for"]) === titularId);
    });
    const fallbackSource = tiedReserves.length ? tiedReserves : reserves;
    const slotsFromPlan = fallbackSource
      .filter((reserve) => {
        const reserveId = classroomRowText(reserve, ["classroom_id"]);
        if (!reserveId) return false;
        if (tiedReserves.length) return true;
        const sameStratum = stratum && classroomRowText(reserve, ["stratum", "faculty"]) === stratum;
        const sameFaculty = faculty && classroomRowText(reserve, ["faculty", "stratum"]) === faculty;
        return sameStratum || sameFaculty;
      })
      .slice(0, depth)
      .map((reserve) => {
        const reserveId = classroomRowText(reserve, ["classroom_id"]);
        const suggestion = suggestionByReserveId.get(reserveId);
        const match = classroomRowText(reserve, ["equivalence_level"]) || (classroomRowText(reserve, ["stratum"]) === stratum ? "misma_celda" : "misma_facultad");
        return {
          id: reserveId,
          code: classroomOperationalCode(reserve, `R${slotNumber}.${classroomRowNumber(reserve, ["replacement_order"]) || Math.max(1, classroomWaveNumber(classroomRowText(reserve, ["wave"])) - 1)}`),
          titularCode: classroomRowText(reserve, ["titular_operational_code"]) || titularCode,
          label: classroomRowText(reserve, ["course_name", "label", "classroom_id"]),
          wave: classroomRowText(reserve, ["wave"]),
          order: classroomRowNumber(reserve, ["replacement_order"]) || classroomWaveNumber(classroomRowText(reserve, ["wave"])),
          match: suggestion?.match_level || match,
          scoreDelta: safeNumber(suggestion?.score_delta, classroomRowNumber(reserve, ["replacement_impact_score", "chain_score"])),
          warning: suggestion?.warning || classroomReplacementWarningText(
            classroomRowText(reserve, ["analysis_weight_warning"]),
            classroomRowText(reserve, ["activation_weight_status"]),
            match,
          ),
        };
      });
    return {
      titularId,
      code: titularCode,
      titularLabel: classroomRowText(titular, ["course_name", "label", "classroom_id"]),
      faculty,
      stratum,
      eligible: classroomRowNumber(titular, ["eligible_n"]),
      slots: slotsFromPlan.slice(0, depth),
    };
  });
}

export function ClassroomReplacementChainPanel({
  selectionRows,
  simulation,
  depth = 6,
}: {
  selectionRows?: Array<Record<string, unknown>> | unknown;
  simulation?: CalcMuestraAulasReplacementSimulation | null;
  depth?: number;
}) {
  const rows = rowsFrom<Record<string, unknown>>(selectionRows);
  const chains = classroomReplacementChains(rows, simulation, depth);
  const extraPool = rows.filter((row) => classroomRowText(row, ["sample_role"]) === "extra_reserve_pool").length;
  const maxDepth = Math.max(1, Math.min(depth, 6));
  if (!chains.length) {
    return (
      <ClassroomEmptyState
        icon={Route}
        title="Cadena de reemplazos pendiente"
        detail="Genera la selección para ver cada curso-horario titular y sus reemplazos Rn.1, Rn.2 y siguientes."
      />
    );
  }
  return (
    <div className="cmv2-replacement-chain-panel">
      <div className="cmv2-subhead">
        <strong>Rutas operativas</strong>
        <small>Estos códigos viajan a agenda, Excel/Sheets y Monitoreo para activar reemplazos sin cambiar el diseño.</small>
      </div>
      <div className="cmv2-replacement-chain-summary">
        <Metric label="Titulares con ruta" value={fmtInt(chains.length)} />
        <Metric label="Código operativo" value="CH n / Rn.k" />
        <Metric label="Reemplazos por ruta" value={`R1-R${maxDepth}`} />
        <Metric label="Cursos-horario extra" value={extraPool ? fmtInt(extraPool) : "sin extra"} />
      </div>
      <div className="cmv2-backend-field-strip" aria-label="Datos visibles usados en rutas de reemplazo">
        <span>Código visible del curso-horario</span>
        <span>Titular asociada</span>
        <span>Orden de reemplazo</span>
      </div>
      <div className="cmv2-chain-route-list">
        {chains.map((chain) => (
          <article key={chain.titularId} className="cmv2-chain-route-card">
            <div className="cmv2-chain-route-head">
              <div className="cmv2-chain-titular">
                <span className="cmv2-chain-code">{chain.code}</span>
                <strong>{chain.titularLabel}</strong>
                <small>{chain.faculty} · {fmtInt(chain.eligible)} elegibles</small>
              </div>
              <div className="cmv2-chain-monitoring-note">
                <strong>Activación ordenada</strong>
                <small>Si cae {chain.code}, Monitoreo toma el primer reemplazo viable y registra el motivo.</small>
              </div>
            </div>
            <div className="cmv2-chain-route-slots" aria-label={`Reemplazos para ${chain.titularLabel}`}>
              {Array.from({ length: maxDepth }, (_, index) => {
                const slot = chain.slots[index];
                if (!slot) {
                  return (
                    <span key={index} className="cmv2-chain-empty-slot">
                      <b>M{index + 2}</b>
                      sin reemplazo
                    </span>
                  );
                }
                return (
                  <div key={slot.id || index} className={`cmv2-chain-slot ${classroomReplacementSlotTone(slot.match, slot.warning)}`}>
                    <span>
                      <strong>{slot.label}</strong>
                      <b>{slot.code || (slot.order ? `R${slot.order}` : slot.wave)}</b>
                    </span>
                    <small>{classroomReplacementMatchLabel(slot.match)} · reemplaza {slot.titularCode}{slot.scoreDelta ? ` · impacto ${classroomNumberText({ value: slot.scoreDelta }, ["value"])}` : ""}</small>
                    {slot.warning && <em>{slot.warning}</em>}
                  </div>
                );
              })}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export function ClassroomOperationalHandoffPanel({
  selection,
  replacementSimulation,
}: {
  selection: CalcMuestraAulasSelection | null;
  replacementSimulation?: CalcMuestraAulasReplacementSimulation | null;
}) {
  const selectionRows = rowsFrom<Record<string, unknown>>(selection?.selection);
  const titulares = selectionRows.filter((row) => classroomRowText(row, ["sample_role"]) === "titular" || classroomRowText(row, ["wave"]) === "M1").length;
  const reservas = selectionRows.filter((row) => classroomRowText(row, ["sample_role"]) === "chain_reserve" || (classroomRowText(row, ["wave"]) !== "M1" && classroomRowText(row, ["sample_role"]) !== "extra_reserve_pool")).length;
  const reservaExtra = selectionRows.filter((row) => classroomRowText(row, ["sample_role"]) === "extra_reserve_pool").length;
  const sugerencias = rowsFrom<CalcMuestraAulasReplacementSuggestion>(replacementSimulation?.suggestions).length;
  const hasSelection = selectionRows.length > 0;
  return (
    <div className="cmv2-handoff-map">
      <div className="cmv2-subhead">
        <strong>Aplicación por cursos-horario</strong>
      </div>
      <AulasApplicationFlow
        tone="calc-muestra"
        current="muestra"
        compact
        title="Del diseño de cursos-horario al campo del estudio"
        summary="El cálculo de muestra de cursos-horario produce titulares, reservas, pesos y códigos. El generador QR/PDF convierte esa agenda en fichas y el monitoreo de cursos-horario registra aplicación, caídas y reemplazos."
        metrics={[
          { label: "Titulares", value: fmtInt(titulares), tone: titulares ? "ready" : "warning" },
          { label: "Reservas", value: fmtInt(reservas + reservaExtra), tone: reservas || reservaExtra ? "ready" : "neutral" },
          { label: "Sugerencias", value: fmtInt(sugerencias), tone: sugerencias ? "current" : "neutral" },
        ]}
        secondaryAction={{ to: "/monitoreo", label: "Ver monitoreo de cursos-horario" }}
        action={{ to: "/recopiladores", label: "Abrir fichas QR", disabled: !hasSelection }}
      />
    </div>
  );
}

/* =============================================================================
   Cobertura, simulación y comparación (movidos)
   ============================================================================= */

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

export function ClassroomRiskList({ risks }: { risks?: NonNullable<CalcMuestraAulasMethodComparison["risk_flags"]> | unknown }) {
  // El comparador agrega los risk_flags de cada motor evaluado; un mismo
  // riesgo (ej. "Baja profundidad de reservas") puede venir repetido con
  // distinto `method`. Como la lista no muestra el método, se deduplica por
  // severidad + título + detalle para no pintar entradas idénticas.
  const seen = new Set<string>();
  const riskRows = rowsFrom<Record<string, unknown>>(risks).filter((risk) => {
    const key = `${String(risk.severity ?? "")}|${String(risk.title ?? "")}|${String(risk.detail ?? "")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const visible = riskRows.length ? riskRows.slice(0, 8) : [{
    code: "sin_alertas",
    severity: "ok",
    title: "Sin alertas críticas",
    detail: "La auditoría interna no reporta riesgos activos para el último cálculo.",
  }];
  // Icono por severidad: el color solo no alcanza para escanear el rail.
  const severityIcon = (severity: string) => {
    if (severity === "alta") return TriangleAlert;
    if (severity === "ok" || severity === "baja") return CheckCircle2;
    return CircleAlert;
  };
  return (
    <div className="cmv2-classroom-risk-list">
      <div className="cmv2-subhead">
        <strong>Riesgos</strong>
      </div>
      {visible.map((risk, index) => {
        const severity = String(risk.severity ?? "media");
        const Icon = severityIcon(severity);
        return (
          <div key={`${String(risk.code ?? "riesgo")}-${index}`} className={`is-${severity}`}>
            <small><Icon size={12} aria-hidden="true" />{severity}</small>
            <strong>{String(risk.title ?? "Alerta metodológica")}</strong>
            <span>{String(risk.detail ?? "Revisa la auditoría técnica del selector.")}</span>
          </div>
        );
      })}
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
              <td>{classroomRowText(row, ["variable"])}</td>
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

export function ClassroomSelectionTable({
  rows,
  selectedRow,
  onSelectRow,
}: {
  rows?: Array<Record<string, unknown>> | unknown;
  /** Fila inspeccionada (identidad de objeto): pinta el estado selected. */
  selectedRow?: Record<string, unknown> | null;
  /** Si existe, las filas se vuelven clickeables y abren el inspector. */
  onSelectRow?: (row: Record<string, unknown>) => void;
}) {
  const tableRows = rowsFrom<Record<string, unknown>>(rows);
  if (!tableRows.length) {
    return (
      <div className="cmv2-classroom-empty is-compact">
        <span><Table2 size={16} /></span>
        <div>
          <strong>Sin filas para mostrar</strong>
          <em>Ajusta el filtro o genera una selección.</em>
        </div>
      </div>
    );
  }
  return (
    <div className="cmv2-classroom-table-wrap">
      <table className="cmv2-table cmv2-classroom-table">
        <thead>
          <tr>
            <th>Plan</th>
            <th>Código y curso-horario</th>
            <th>Facultad / programa</th>
            <th>Horario</th>
            <th className="is-num">Elegibles</th>
            <th className="is-num">Prob. usada</th>
            <th className="is-num">Peso</th>
            <th className="is-num">Repetidos</th>
          </tr>
        </thead>
        <tbody>
          {tableRows.map((row, index) => (
            <tr
              key={`${classroomRowText(row, ["classroom_id"])}-${index}`}
              className={
                onSelectRow
                  ? `is-clickable${selectedRow === row ? " is-selected" : ""}`
                  : undefined
              }
              tabIndex={onSelectRow ? 0 : undefined}
              aria-label={onSelectRow ? `Inspeccionar ${classroomRowText(row, ["course_name", "label", "classroom_id"])}` : undefined}
              onClick={onSelectRow ? () => onSelectRow(row) : undefined}
              onKeyDown={
                onSelectRow
                  ? (event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelectRow(row);
                      }
                    }
                  : undefined
              }
            >
              <td>{classroomPlanLabel(row)}<small>{classroomRowText(row, ["wave"])}</small></td>
              <td>
                <span className="cmv2-table-code">{classroomOperationalCode(row, classroomRowText(row, ["wave"]) === "M1" ? `CH ${index + 1}` : classroomRowText(row, ["wave"]))}</span>
                <strong>{classroomRowText(row, ["course_name", "label", "classroom_id"])}</strong>
                <small>{classroomRowText(row, ["field_status", "operation_status", "estado", "classroom_id"])}</small>
              </td>
              <td>
                {classroomRowText(row, ["faculty", "stratum"])}
                <small>{classroomRowText(row, ["program", "level"])}</small>
              </td>
              <td>{classroomRowText(row, ["schedule", "modality"])}</td>
              <td className="is-num">{fmtInt(classroomRowNumber(row, ["eligible_n"]))}</td>
              <td className="is-num">{fmtPct(classroomRowNumber(row, ["pi_final"]))}</td>
              <td className="is-num">{classroomRowNumber(row, ["weight_classroom"]) > 0 ? fmtDec(classroomRowNumber(row, ["weight_classroom"]), 2) : "—"}</td>
              <td className="is-num">{fmtInt(classroomRowNumber(row, ["duplicate_overlap"]))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ClassroomOverlapGraph({ rows }: { rows?: Array<Record<string, unknown>> | unknown }) {
  const visible = rowsFrom<Record<string, unknown>>(rows)
    .slice(0, 8)
    .map((row, index) => ({
      id: classroomRowText(row, ["classroom_id"]) || `aula-${index}`,
      label: classroomOperationalCode(row, `CH ${index + 1}`),
      overlap: classroomRowNumber(row, ["duplicate_overlap"]),
      x: 36 + (index % 2) * 128,
      y: 36 + Math.floor(index / 2) * 54,
    }));
  const maxOverlap = Math.max(1, ...visible.map((item) => item.overlap));
  return (
    <div className="cmv2-classroom-overlap-graph">
      <div className="cmv2-subhead">
        <strong>Cursos-horario repetidos</strong>
      </div>
      {!visible.length ? (
        <span className="cmv2-classroom-muted">Genera la selección para ver si los cursos-horario comparten muchos estudiantes.</span>
      ) : (
        <svg viewBox="0 0 230 250" role="img" aria-label="Grafo simple de estudiantes repetidos entre cursos-horario" className="cmv2-aulas-overlap-svg">
          {visible.slice(1).map((item, index) => (
            <line
              key={`line-${item.id}`}
              x1={visible[index].x}
              y1={visible[index].y}
              x2={item.x}
              y2={item.y}
              strokeWidth={1}
            />
          ))}
          {visible.map((item) => {
            const radius = 11 + Math.min(14, (item.overlap / maxOverlap) * 14);
            return (
              <g key={item.id}>
                <circle cx={item.x} cy={item.y} r={radius} strokeWidth={1.2} />
                <text x={item.x} y={item.y + 3} textAnchor="middle">{fmtInt(item.overlap)}</text>
                <text x={item.x} y={item.y + radius + 13} textAnchor="middle">{String(item.label).slice(0, 16)}</text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

export function ClassroomReplacementTables({ simulation }: { simulation: CalcMuestraAulasReplacementSimulation }) {
  const suggestions = rowsFrom<CalcMuestraAulasReplacementSuggestion>(simulation?.suggestions).slice(0, 18);
  if (!suggestions.length) {
    return (
      <ClassroomEmptyState
        icon={RefreshCw}
        title="Sin reemplazos sugeridos"
        detail="La simulación existe, pero no trae sugerencias compatibles con este estado. Vuelve a simular reemplazos con la selección actual."
      />
    );
  }
  return (
    <div className="cmv2-classroom-replacement-stack">
      <div className="cmv2-classroom-table-wrap">
        <table className="cmv2-table cmv2-classroom-table">
          <thead>
            <tr>
              <th>Si cae</th>
              <th>Usar reemplazo</th>
              <th>Ruta</th>
              <th>Equivalencia</th>
              <th className="is-num">Representatividad</th>
              <th className="is-num">Cambio</th>
              <th className="is-num">Repetidos</th>
            </tr>
          </thead>
          <tbody>
            {suggestions.map((item) => (
              <tr key={`${item.titular_classroom_id}-${item.reserve_classroom_id}-${item.rank}`}>
                <td>
                  <span className="cmv2-table-code">{String(item.titular_operational_code || "CH").replace(/^AULA\b/i, "CH")}</span>
                  {item.titular_label || item.titular_classroom_id}
                  <small>{item.titular_classroom_id}</small>
                </td>
                <td>
                  <span className="cmv2-table-code">{item.reserve_operational_code || item.replacement_chain_code || `R${item.rank}`}</span>
                  {item.reserve_label || item.reserve_classroom_id}
                  <small>{item.reserve_classroom_id}</small>
                </td>
                <td>{classroomReplacementRouteLabel(item.wave, item.rank)}<small>{item.wave}</small></td>
                <td>{item.match_level}</td>
                <td className="is-num">{classroomScore(item.after_score ?? item.score)}</td>
                <td className="is-num">{classroomNumberText(item as unknown as Record<string, unknown>, ["score_delta"])}</td>
                <td className="is-num">{fmtInt(item.overlap_delta ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ClassroomImpactTable rows={simulation?.impact ?? []} />
    </div>
  );
}

function ClassroomImpactTable({ rows }: { rows?: Array<Record<string, unknown>> | unknown }) {
  const visible = rowsFrom<Record<string, unknown>>(rows).slice(0, 12);
  if (!visible.length) return null;
  return (
    <div className="cmv2-classroom-table-wrap">
      <table className="cmv2-table cmv2-classroom-table">
        <thead>
          <tr>
            <th>Titular</th>
            <th>Reemplazo</th>
            <th className="is-num">Representatividad</th>
            <th>Efecto en cuotas</th>
            <th className="is-num">Cambio de elegibles</th>
            <th>Advertencia</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((row, index) => (
            <tr key={index}>
              <td>
                <span className="cmv2-table-code">{(classroomRowText(row, ["titular_operational_code"]) || "CH").replace(/^AULA\b/i, "CH")}</span>
                {classroomRowText(row, ["titular_classroom_id"])}
              </td>
              <td>
                <span className="cmv2-table-code">{classroomRowText(row, ["replacement_operational_code"]) || "R"}</span>
                {classroomRowText(row, ["suggested_replacement_id"])}
              </td>
              <td className="is-num">{classroomScore(classroomRowNumber(row, ["after_score"]))}<small>{classroomNumberText(row, ["score_delta"])}</small></td>
              <td>{classroomRowText(row, ["balance_effect"])}</td>
              <td className="is-num">{classroomNumberText(row, ["eligible_delta"])}</td>
              <td>{classroomRowText(row, ["warning"]) || "sin alerta"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ClassroomMethodSources({
  selection,
  comparison,
}: {
  selection: CalcMuestraAulasSelection | null;
  comparison: CalcMuestraAulasMethodComparison | null;
}) {
  const sourceRows = [
    { label: "Fuente oficial", value: selection?.official_reference ?? "OECD/PISA, NCES/NAEP, UN, Eurostat, AAPOR" },
    { label: "Fuente académica", value: selection?.academic_reference ?? "Deville & Tillé; Statistics Canada; Groves & Heeringa" },
    { label: "Implementación", value: selection?.implementation_reference ?? "sampling::samplecube(); BalancedSampling::lcube/lpm2" },
    { label: "Probabilidades", value: selection ? classroomProbabilitySourceLabel(selection.probability_source) : classroomMethodLabel(comparison?.recommendation?.method_id ?? "") || "pendiente" },
    { label: "Pesos", value: selection?.weight_source ?? "peso del curso-horario = 1 / probabilidad final; probabilidad estudiantil agregada" },
    { label: "No respuesta", value: selection?.nonresponse_policy ?? "códigos de disposición y ajuste posterior por dominio" },
  ];
  return (
    <div className="cmv2-classroom-source-grid">
      {sourceRows.map((row) => (
        <div key={row.label}>
          <small>{row.label}</small>
          <span>{row.value}</span>
        </div>
      ))}
    </div>
  );
}

/* =============================================================================
   Preparación y blueprint (movidos; se usan cuando aún no hay selección)
   ============================================================================= */

export function ClassroomSelectionPreparationPanel({
  frameReady,
  comparisonReady,
  recommendedMethodLabel,
  frameCount,
  targetForDisplay,
  m1ForDisplay,
}: {
  frameReady: boolean;
  comparisonReady: boolean;
  recommendedMethodLabel: string;
  frameCount: number;
  targetForDisplay: number;
  m1ForDisplay: number;
}) {
  return (
    <div className="cmv2-classroom-preparation-panel">
      <div className="cmv2-classroom-tab-note">
        <span><Table2 size={15} /></span>
        <div>
          <strong>Esta pestaña se llena recién cuando existe una selección.</strong>
          <em>Antes de seleccionar, muestra el estado de preparación sin repetir los gráficos de Marco. La revisión descriptiva vive en Marco; aquí se decide qué cursos-horario serán titulares.</em>
        </div>
      </div>
      <div className="cmv2-classroom-readiness-map">
        <article className={frameReady ? "is-ready" : "is-pending"}>
          <small>1. Marco listo</small>
          <strong>{frameCount ? `${fmtInt(frameCount)} cursos-horario` : "pendiente"}</strong>
          <span>Una fila por curso-horario seleccionable.</span>
        </article>
        <article className={targetForDisplay ? "is-ready" : "is-working"}>
          <small>2. Tamaño definido</small>
          <strong>{targetForDisplay ? `${fmtInt(targetForDisplay)} entrevistas` : "pendiente"}</strong>
          <span>El cálculo fija cuánto se necesita representar.</span>
        </article>
        <article className={comparisonReady ? "is-ready" : "is-working"}>
          <small>3. Método comparado</small>
          <strong>{comparisonReady ? recommendedMethodLabel : "por comparar"}</strong>
          <span>La app elige la opción con mejor balance y menos repetidos.</span>
        </article>
        <article className={m1ForDisplay ? "is-ready" : "is-working"}>
          <small>4. Cursos-horario titulares</small>
          <strong>{m1ForDisplay ? fmtInt(m1ForDisplay) : "pendiente"}</strong>
          <span>Después aparecerán códigos CH n y sus razones de selección.</span>
        </article>
      </div>
    </div>
  );
}

export function ClassroomReplacementBlueprintPanel({
  depth,
  titularCount,
  reserveCount,
  extraReserveCount,
}: {
  depth: number;
  titularCount: number;
  reserveCount: number;
  extraReserveCount: number;
}) {
  const routeDepth = Math.max(1, Math.min(5, depth || 3));
  const replacementCodes = Array.from({ length: routeDepth }, (_, index) => `R5.${index + 1}`);
  return (
    <div className="cmv2-classroom-replacement-blueprint">
      <div className="cmv2-classroom-route-preview" aria-label="Ejemplo de cadena de reemplazos">
        <span className="is-primary">CH 5</span>
        {replacementCodes.map((code) => (
          <span key={code}>
            <ArrowRight size={13} />
            <b>{code}</b>
          </span>
        ))}
        <span>
          <ArrowRight size={13} />
          <b>Reserva extra</b>
        </span>
      </div>
      <div className="cmv2-classroom-readiness-map">
        <article className={titularCount ? "is-ready" : "is-working"}>
          <small>Cursos-horario titulares</small>
          <strong>{titularCount ? fmtInt(titularCount) : "pendiente"}</strong>
          <span>Cada titular tendrá su propia ruta de reemplazos.</span>
        </article>
        <article className={reserveCount ? "is-ready" : "is-working"}>
          <small>Reemplazos asociados</small>
          <strong>{reserveCount ? fmtInt(reserveCount) : "pendiente"}</strong>
          <span>No son una bolsa suelta: pertenecen a una titular específica.</span>
        </article>
        <article className={extraReserveCount ? "is-ready" : "is-working"}>
          <small>Reserva extra</small>
          <strong>{extraReserveCount ? fmtInt(extraReserveCount) : "pendiente"}</strong>
          <span>Solo se usa cuando la cadena no alcanza o la celda queda frágil.</span>
        </article>
      </div>
    </div>
  );
}
