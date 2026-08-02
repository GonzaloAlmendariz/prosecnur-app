import {
  Database,
  GitCompareArrows,
  RefreshCw,
  TriangleAlert,
} from "../../../../vendor/lucide-react";
import type { CalcMuestraComponente } from "../../../../api/calcMuestra";
import {
  normalizeCalcMuestraComparacionI20,
  type CalcMuestraComparacionI20Payload,
  type CalcMuestraComparacionI20State,
} from "../../../../api/calcMuestraComparacionI20";
import { EmptyState } from "../../../../components/States";
import { fmtInt, fmtSignedInt } from "../../sharedCore";
import {
  UNIVERSITY_FACULTY_COMPONENT_ID,
  UNIVERSITY_TOTAL_COMPONENT_ID,
} from "../shared/constants";
import type { UniversityAulasScenario } from "../shared/study";
import "./calculoComparacionEscenarios.css";

const DECIMAL = new Intl.NumberFormat("es-PE", { maximumFractionDigits: 2 });
const DATE = new Intl.DateTimeFormat("es-PE", {
  dateStyle: "medium",
  timeStyle: "short",
});

function fmtDelta(value: number): string {
  return fmtSignedInt(value).replace("-", "−");
}

function fmtPrecision(value: number): string {
  return `${DECIMAL.format(value * 100)} pp`;
}

function fmtDate(value: string): string {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? DATE.format(parsed) : value;
}

function fmtHash(value: string): string {
  return value.length > 14 ? `${value.slice(0, 14)}…` : value;
}

function p1FormalGlobal(data: CalcMuestraComparacionI20Payload) {
  const precision = data.scenarios.p1_universidad.formal_precision;
  if (precision.scope !== "global_university_formal") {
    throw new Error("El normalizador I20 no acreditó el alcance formal global de P1.");
  }
  return precision.global;
}

function buildComparisonState(
  componentes: readonly CalcMuestraComponente[],
  currentFrameHash: string | null | undefined,
): CalcMuestraComparacionI20State {
  const p1Matches = componentes.filter((item) => item.actor_id === UNIVERSITY_TOTAL_COMPONENT_ID);
  const p2Matches = componentes.filter((item) => item.actor_id === UNIVERSITY_FACULTY_COMPONENT_ID);
  const p1 = p1Matches[0];
  const p2 = p2Matches[0];
  if (p1Matches.length !== 1 || p2Matches.length !== 1 || !p1 || !p2) {
    return {
      kind: "invalid",
      reasons: ["La comparación requiere exactamente los componentes universitario y por facultades."],
    };
  }
  return normalizeCalcMuestraComparacionI20(
    { p1: p1.resultado, p2: p2.resultado },
    {
      p1: {
        component_id: p1.id,
        actor_id: UNIVERSITY_TOTAL_COMPONENT_ID,
        scenario: "p1_universidad",
        technique: p1.tecnica,
      },
      p2: {
        component_id: p2.id,
        actor_id: UNIVERSITY_FACULTY_COMPONENT_ID,
        scenario: "p2_facultades",
        technique: p2.tecnica,
      },
      current_frame_hash: currentFrameHash,
    },
  );
}

function ComparisonState({
  state,
}: {
  state: Exclude<CalcMuestraComparacionI20State, { kind: "ready" }>;
}) {
  const copy = state.kind === "empty"
    ? {
        title: "Aún no hay dos propuestas calculadas",
        hint: "Calcula P1 y P2 para publicar una comparación común desde R.",
        icon: <Database size={20} aria-hidden="true" />,
      }
    : state.kind === "legacy"
      ? {
          title: "Estas propuestas usan el contrato anterior",
          hint: "Recalcula ambas propuestas antes de leer alcance o carga operativa.",
          icon: <RefreshCw size={20} aria-hidden="true" />,
        }
      : state.kind === "stale"
        ? {
            title: "La comparación pertenece a otro frame",
            hint: "Reconfirma el marco vigente y recalcula P1 y P2.",
            icon: <RefreshCw size={20} aria-hidden="true" />,
          }
        : {
            title: "R no pudo acreditar esta comparación",
            hint: "Corrige la incompatibilidad y recalcula las dos propuestas. No se muestra información parcial.",
            icon: <TriangleAlert size={20} aria-hidden="true" />,
          };
  return (
    <div
      className="cmv2-compare-state"
      role={state.kind === "invalid" ? "alert" : "status"}
      data-state={state.kind}
      data-qa-geometry-group="calc-muestra/comparacion-estado"
      data-qa-geometry-contract="intrinsic"
    >
      <div data-qa-geometry-member>
        <EmptyState icon={copy.icon} title={copy.title} hint={copy.hint} />
      </div>
      <ul aria-label="Razones del estado" data-qa-geometry-member>
        {state.reasons.map((reason) => <li key={reason}>{reason}</li>)}
      </ul>
    </div>
  );
}

function ScenarioValue({
  scenario,
  label,
  value,
  note,
}: {
  scenario: "p1" | "p2";
  label: string;
  value: string;
  note: string;
}) {
  return (
    <article className="cmv2-compare-value" data-scenario={scenario} data-qa-geometry-member>
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{note}</p>
    </article>
  );
}

function MetricStep({
  number,
  title,
  description,
  p1Value,
  p1Note,
  p2Value,
  p2Note,
  delta,
  deltaNote,
}: {
  number: string;
  title: string;
  description: string;
  p1Value: string;
  p1Note: string;
  p2Value: string;
  p2Note: string;
  delta: number;
  deltaNote: string;
}) {
  return (
    <section className="cmv2-compare-step" data-qa-geometry-member>
      <header>
        <span className="cmv2-compare-step-number">{number}</span>
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      </header>
      <div
        className="cmv2-compare-pair"
        data-qa-geometry-group={`calc-muestra/comparacion-${number}`}
        data-qa-geometry-contract="equal"
        data-stack-order="p1-p2-delta"
      >
        <ScenarioValue scenario="p1" label="P1 · Universidad" value={p1Value} note={p1Note} />
        <ScenarioValue scenario="p2" label="P2 · Facultades" value={p2Value} note={p2Note} />
      </div>
      <aside className="cmv2-compare-delta" aria-label={`Diferencia publicada para ${title}`}>
        <span>Δ publicado · P2−P1</span>
        <strong>{fmtDelta(delta)}</strong>
        <p>{deltaNote}</p>
      </aside>
    </section>
  );
}

export function CalculoComparacionEscenarios({
  componentes,
  currentFrameHash,
  escenario,
  onEscenario,
}: {
  componentes: [CalcMuestraComponente, CalcMuestraComponente];
  currentFrameHash: string | null | undefined;
  escenario: UniversityAulasScenario;
  onEscenario: (escenario: UniversityAulasScenario) => void;
}) {
  const state = buildComparisonState(componentes, currentFrameHash);
  const ready = state.kind === "ready";
  return (
    <section
      className="cmv2-compare"
      data-audit-ready={ready ? "true" : "false"}
      data-surface-group="calc-muestra-calculo"
      data-surface-contract="comparacion-p1-p2-r"
    >
      <header className="cmv2-compare-question">
        <div>
          <span className="cmv2-compare-eyebrow">Pregunta de decisión</span>
          <h2>P1 frente a P2</h2>
          <p>¿Cómo cambian el alcance estadístico y la carga operativa entre las dos propuestas?</p>
        </div>
        <span className="cmv2-compare-owner">
          <GitCompareArrows size={15} aria-hidden="true" /> comparación acreditada por R
        </span>
      </header>

      {state.kind !== "ready" ? (
        <ComparisonState state={state} />
      ) : (
        <div
          className="cmv2-compare-flow"
          data-qa-geometry-group="calc-muestra/comparacion-escenarios"
          data-qa-geometry-contract="intrinsic"
          data-qa-geometry-capacity="owned"
        >
          <section className="cmv2-compare-step cmv2-compare-scope" data-qa-geometry-member>
            <header>
              <span className="cmv2-compare-step-number">01</span>
              <div>
                <h3>Alcance estadístico</h3>
                <p>Las propuestas responden preguntas formales distintas; el comparador conserva ese alcance.</p>
              </div>
            </header>
            <div
              className="cmv2-compare-pair"
              role="radiogroup"
              aria-label="Propuesta visible en el detalle de distribución"
              data-qa-geometry-group="calc-muestra/comparacion-alcance"
              data-qa-geometry-contract="equal"
              data-stack-order="p1-p2-delta"
            >
              <article className="cmv2-compare-scenario" data-scenario="p1" data-active={escenario === "e1" || undefined} data-qa-geometry-member>
                <span>P1 · Universidad</span>
                <h4>Alcance formal global</h4>
                <p>Una unidad formal para la universidad completa.</p>
                <dl>
                  <div><dt>Unidades formales</dt><dd>{state.data.scenarios.p1_universidad.formal_precision.formal_units}</dd></div>
                  <div><dt>Precisión global</dt><dd>{fmtPrecision(p1FormalGlobal(state.data).achieved_e)}</dd></div>
                  <div><dt>Banda</dt><dd>{p1FormalGlobal(state.data).band.label}</dd></div>
                </dl>
                <button
                  type="button"
                  role="radio"
                  aria-checked={escenario === "e1"}
                  data-detail-scenario="e1"
                  onClick={() => onEscenario("e1")}
                >
                  Ver detalle P1
                </button>
              </article>
              <article className="cmv2-compare-scenario" data-scenario="p2" data-active={escenario === "e2" || undefined} data-qa-geometry-member>
                <span>P2 · Facultades</span>
                <h4>Alcances formales independientes</h4>
                <p>Cada facultad conserva su propio alcance formal.</p>
                <dl>
                  <div><dt>Unidades formales</dt><dd>{state.data.scenarios.p2_facultades.formal_precision.formal_units}</dd></div>
                  <div><dt>Agregado global</dt><dd>No publicado</dd></div>
                </dl>
                <button
                  type="button"
                  role="radio"
                  aria-checked={escenario === "e2"}
                  data-detail-scenario="e2"
                  onClick={() => onEscenario("e2")}
                >
                  Ver detalle P2
                </button>
              </article>
            </div>
          </section>

          <MetricStep
            number="02"
            title="Cuota planificada"
            description="Estudiantes objetivo publicados para la etapa de planificación."
            p1Value={fmtInt(state.data.scenarios.p1_universidad.sample_n)}
            p1Note="Cuota objetivo para el alcance global."
            p2Value={fmtInt(state.data.scenarios.p2_facultades.sample_n)}
            p2Note="Suma reconciliada de cuotas por facultad."
            delta={state.data.deltas_p2_minus_p1.values.sample_n}
            deltaNote="Diferencia de carga muestral planificada; no resume por sí sola el alcance formal."
          />
          <MetricStep
            number="03"
            title="CH titulares"
            description="Cursos-horario base requeridos bajo el divisor y τ firmados por facultad."
            p1Value={fmtInt(state.data.scenarios.p1_universidad.ch.base_required)}
            p1Note="Carga base publicada para P1."
            p2Value={fmtInt(state.data.scenarios.p2_facultades.ch.base_required)}
            p2Note="Carga base publicada para P2."
            delta={state.data.deltas_p2_minus_p1.values.ch_base_required}
            deltaNote="La diferencia es comparable porque ambos escenarios comparten la base CH firmada."
          />
          <MetricStep
            number="04"
            title="Reserva por política"
            description="CH adicionales que cada propuesta incorpora según su política vigente."
            p1Value={fmtInt(state.data.scenarios.p1_universidad.ch.reserve_required)}
            p1Note={`Política publicada: ${state.data.scenarios.p1_universidad.ch.reserve_policy_code}.`}
            p2Value={fmtInt(state.data.scenarios.p2_facultades.ch.reserve_required)}
            p2Note={`Política publicada: ${state.data.scenarios.p2_facultades.ch.reserve_policy_code}.`}
            delta={state.data.deltas_p2_minus_p1.values.ch_reserve_policy_dependent}
            deltaNote="Depende de las políticas publicadas para cada propuesta."
          />
          <MetricStep
            number="05"
            title="Saldo operativo"
            description="Total de CH que combina titulares y reserva bajo la política de cada propuesta."
            p1Value={fmtInt(state.data.scenarios.p1_universidad.ch.total_operational)}
            p1Note="Titulares más reserva publicada para P1."
            p2Value={fmtInt(state.data.scenarios.p2_facultades.ch.total_operational)}
            p2Note="Titulares más reserva publicada para P2."
            delta={state.data.deltas_p2_minus_p1.values.ch_total_operational}
            deltaNote="Balance operativo bajo las políticas vigentes; se mantiene separado del alcance estadístico."
          />

          <footer className="cmv2-compare-provenance" data-qa-geometry-member>
            <span><Database size={14} aria-hidden="true" /> owner · engine_r</span>
            <dl aria-label="Procedencia de la comparación">
              <div><dt>Calculado</dt><dd>{fmtDate(state.data.computed_at)}</dd></div>
              <div><dt>Frame</dt><dd title={state.data.source_frame_hash}>{fmtHash(state.data.source_frame_hash)}</dd></div>
              <div><dt>Población</dt><dd title={state.data.population_hash}>{fmtHash(state.data.population_hash)}</dd></div>
              <div><dt>Comparación</dt><dd title={state.data.comparison_hash}>{fmtHash(state.data.comparison_hash)}</dd></div>
            </dl>
          </footer>
        </div>
      )}
    </section>
  );
}
