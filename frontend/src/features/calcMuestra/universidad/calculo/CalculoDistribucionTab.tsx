import { useState } from "react";
import {
  Activity,
  Database,
  Gauge,
  RefreshCw,
  Table2,
  TriangleAlert,
} from "../../../../vendor/lucide-react";
import type { CalcMuestraComponente } from "../../../../api/calcMuestra";
import { DistribucionPasos, type DistribucionPasoId } from "./DistribucionPasos";
import type {
  CalcMuestraDistribucionI19Faculty,
  CalcMuestraDistribucionI19SensitivityAxis,
  CalcMuestraDistribucionI19State,
  CalcMuestraDistribucionUniversitariaPayload,
} from "../../../../api/calcMuestraDistribucionI19";
import { EmptyState } from "../../../../components/States";
import { fmtInt, fmtSignedInt } from "../../sharedCore";
import type { UniversityAulasScenario } from "../shared/study";
import {
  buildCalculoDistribucionModel,
  type CalculoDistribucionScenarioMeta,
} from "./calculoDistribucionModel";
import { CalculoComparacionEscenarios } from "./CalculoComparacionEscenarios";
import "./calculoDistribucion.css";

const DECIMAL = new Intl.NumberFormat("es-PE", { maximumFractionDigits: 2 });
const DATE = new Intl.DateTimeFormat("es-PE", {
  dateStyle: "medium",
  timeStyle: "short",
});

function fmtPct(value: number): string {
  return `${DECIMAL.format(value * 100)}%`;
}

function fmtPp(value: number): string {
  return `${DECIMAL.format(value * 100)} pp`;
}

function fmtHash(value: string): string {
  return value.length > 14 ? `${value.slice(0, 14)}…` : value;
}

function fmtDate(value: string): string {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? DATE.format(parsed) : value;
}

function fmtSensitivityValue(axis: CalcMuestraDistribucionI19SensitivityAxis, value: number | null): string {
  if (value == null) return "Por facultad";
  if (axis.parameter === "p" || axis.parameter === "confidence") return fmtPct(value);
  if (axis.parameter === "e") return fmtPp(value);
  return DECIMAL.format(value);
}

function DistributionState({ state }: { state: Exclude<CalcMuestraDistribucionI19State, { kind: "ready" }> }) {
  const copy = state.kind === "empty"
    ? {
        title: "Aún no hay una distribución calculada",
        hint: "Ve a Propuestas y ejecuta Calcular muestra para publicar P1 y P2 desde R.",
        icon: <Database size={20} aria-hidden="true" />,
      }
    : state.kind === "legacy"
      ? {
          title: "Esta corrida usa el contrato anterior",
          hint: "Ve a Propuestas y recalcula la muestra. No se reutilizan la distribución TS ni perfiles de ejemplo.",
          icon: <RefreshCw size={20} aria-hidden="true" />,
        }
      : state.kind === "stale"
        ? {
            title: "La distribución pertenece a otro frame",
            hint: "Reconfirma el marco vigente y recalcula ambas propuestas antes de leer cuotas o precisión.",
            icon: <RefreshCw size={20} aria-hidden="true" />,
          }
        : {
            title: "R no pudo acreditar esta distribución",
            hint: "Corrige la incompatibilidad indicada y recalcula en Propuestas. No se muestra un escenario alternativo.",
            icon: <TriangleAlert size={20} aria-hidden="true" />,
          };
  return (
    <section
      className="cmv2-dist-state"
      role={state.kind === "invalid" ? "alert" : "status"}
      data-state={state.kind}
      data-qa-geometry-group="calc-muestra/distribucion-estado"
      data-qa-geometry-contract="intrinsic"
    >
      <div data-qa-geometry-member>
        <EmptyState icon={copy.icon} title={copy.title} hint={copy.hint} />
      </div>
      <ul className="cmv2-dist-state-reasons" aria-label="Razones del estado" data-qa-geometry-member>
        {state.reasons.map((reason) => <li key={reason}>{reason}</li>)}
      </ul>
    </section>
  );
}

function AuditHeader({
  data,
  selection,
}: {
  data: CalcMuestraDistribucionUniversitariaPayload;
  selection: CalculoDistribucionScenarioMeta;
}) {
  const metrics = [
    { label: "Población del frame", value: fmtInt(data.totals.population_frame_n) },
    { label: "Población del diseño", value: fmtInt(data.totals.population_design_n) },
    { label: "Cuota planificada", value: fmtInt(data.totals.sample_n) },
    { label: "Facultades", value: fmtInt(data.totals.faculty_n) },
  ];
  return (
    <section className="cmv2-dist-section cmv2-dist-audit" data-qa-geometry-member>
      <header className="cmv2-dist-section-head">
        <div>
          <span className="cmv2-dist-eyebrow">Dato acreditado</span>
          <h3>{selection.longLabel}</h3>
          <p>Cuotas objetivo planificadas; no son respuestas recolectadas ni avance de campo.</p>
        </div>
        <span className="cmv2-dist-owner"><Database size={14} aria-hidden="true" /> owner · engine_r</span>
      </header>
      <dl
        className="cmv2-dist-kpis"
        data-qa-geometry-group="calc-muestra/distribucion-totales"
        data-qa-geometry-contract="equal"
      >
        {metrics.map((metric) => (
          <div key={metric.label} className="cmv2-dist-kpi" data-qa-geometry-member data-qa-geometry-capacity="owned">
            <dt>{metric.label}</dt>
            <dd>{metric.value}</dd>
          </div>
        ))}
      </dl>
      <dl className="cmv2-dist-provenance" aria-label="Procedencia de la distribución">
        <div><dt>Calculado</dt><dd>{fmtDate(data.computed_at)}</dd></div>
        <div><dt>Frame fuente</dt><dd title={data.source_frame_hash}>{fmtHash(data.source_frame_hash)}</dd></div>
        <div><dt>Población</dt><dd title={data.population_hash}>{fmtHash(data.population_hash)}</dd></div>
        <div><dt>Diseño</dt><dd title={data.design_hash}>{fmtHash(data.design_hash)}</dd></div>
        <div><dt>Grano</dt><dd>facultad efectiva × sexo</dd></div>
        <div><dt>Etapa</dt><dd>planificada</dd></div>
      </dl>
    </section>
  );
}

function CompositionTable({ data }: { data: CalcMuestraDistribucionUniversitariaPayload }) {
  return (
    <section className="cmv2-dist-section" data-qa-geometry-member>
      <header className="cmv2-dist-section-head">
        <div>
          <span className="cmv2-dist-eyebrow">Composición</span>
          <h3>Población × cuota planificada por facultad y sexo</h3>
          <p>La población del frame y la usada por el diseño viajan separadas; el redondeo de cada celda queda visible.</p>
        </div>
        <span className="cmv2-dist-count"><Table2 size={14} aria-hidden="true" /> {fmtInt(data.totals.sex_cell_n)} celdas</span>
      </header>
      <div
        className="cmv2-dist-table-surface"
        tabIndex={0}
        aria-label="Composición de población y cuota planificada por facultad y sexo"
        data-qa-geometry-capacity="owned"
      >
        <table className="cmv2-dist-table">
          <thead>
            <tr>
              <th>Facultad</th>
              <th>Sexo</th>
              <th>Población frame</th>
              <th>Población diseño</th>
              <th>Cuota planificada</th>
              <th>Afijación cruda</th>
              <th>Δ redondeo</th>
            </tr>
          </thead>
          <tbody>
            {data.faculties.map((faculty) => faculty.cells.map((cell, index) => (
              <tr key={`${faculty.faculty_key}:${cell.sex_key}`}>
                {index === 0 && (
                  <th scope="rowgroup" rowSpan={faculty.cells.length}>
                    <strong>{faculty.faculty_label}</strong>
                    <small>
                      N diseño {fmtInt(faculty.population_design_n)} · cuota {fmtInt(faculty.sample_n)}
                    </small>
                  </th>
                )}
                <th scope="row">{cell.sex_label}</th>
                <td>{fmtInt(cell.population_frame_n)}</td>
                <td>{fmtInt(cell.population_design_n)}</td>
                <td><strong>{fmtInt(cell.sample_n)}</strong></td>
                <td>{DECIMAL.format(cell.allocation_raw)}</td>
                <td data-zero={cell.rounding_delta === 0 || undefined}>{DECIMAL.format(cell.rounding_delta)}</td>
              </tr>
            ))) }
          </tbody>
          <tfoot>
            <tr>
              <th colSpan={2}>Total reconciliado</th>
              <td>{fmtInt(data.totals.population_frame_n)}</td>
              <td>{fmtInt(data.totals.population_design_n)}</td>
              <td><strong>{fmtInt(data.totals.sample_n)}</strong></td>
              <td colSpan={2}>Δ frame→diseño {fmtSignedInt(data.reconciliation.frame_design_delta)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

function PrecisionTable({
  faculties,
  scenario,
}: {
  faculties: CalcMuestraDistribucionI19Faculty[];
  scenario: CalcMuestraDistribucionUniversitariaPayload["scenario"];
}) {
  const p1 = scenario === "p1_universidad";
  return (
    <section className="cmv2-dist-section" data-qa-geometry-member>
      <header className="cmv2-dist-section-head">
        <div>
          <span className="cmv2-dist-eyebrow">Precisión</span>
          <h3>{p1 ? "Promesa global con diagnóstico por facultad" : "Promesa formal por facultad"}</h3>
          <p>{p1
            ? "P1 promete precisión al total de la universidad; cada fila sirve para diagnóstico y no crea una promesa facultativa."
            : "P2 acredita objetivo y precisión alcanzada en cada facultad. Las filas de sexo nunca reciben una promesa formal."}</p>
        </div>
        <span className="cmv2-dist-count"><Gauge size={14} aria-hidden="true" /> {p1 ? "alcance global" : "alcance facultad"}</span>
      </header>
      <div className="cmv2-dist-table-surface" tabIndex={0} aria-label="Bandas de precisión publicadas por R" data-qa-geometry-capacity="owned">
        <table className="cmv2-dist-table cmv2-dist-table--precision">
          <thead><tr><th>Facultad</th><th>Alcance</th><th>Objetivo</th><th>Alcanzada</th><th>Banda</th><th>Confianza</th><th>p</th><th>deff</th><th>{p1 ? "Lectura diagnóstica" : "Resultado formal"}</th></tr></thead>
          <tbody>
            {faculties.map((faculty) => (
              <tr key={faculty.faculty_key}>
                <th scope="row">{faculty.faculty_label}</th>
                <td>{p1 ? "Diagnóstico" : "Formal"}</td>
                <td>{fmtPp(faculty.precision.target_e)}</td>
                <td>{fmtPp(faculty.precision.achieved_e)}</td>
                <td><span className="cmv2-dist-band" data-band={faculty.precision.band_key}>{faculty.precision.band_label}</span></td>
                <td>{fmtPct(faculty.precision.confidence)}</td>
                <td>{fmtPct(faculty.precision.p)}</td>
                <td>{DECIMAL.format(faculty.precision.deff)}</td>
                <td data-meets={faculty.precision.meets_target || undefined}>{p1
                  ? faculty.precision.meets_target ? "Dentro del umbral global" : "Fuera del umbral global"
                  : faculty.precision.meets_target ? "Cumple" : "No cumple"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Sensitivity({ data }: { data: CalcMuestraDistribucionUniversitariaPayload }) {
  const baseline = data.sensitivity.baseline;
  return (
    <section className="cmv2-dist-section" data-qa-geometry-member>
      <header className="cmv2-dist-section-head">
        <div>
          <span className="cmv2-dist-eyebrow">Sensibilidad</span>
          <h3>Una variable a la vez · OFAT</h3>
          <p>Cada eje parte del n de fórmula y cambia un solo parámetro. La meta planificada se informa aparte y conserva el divisor Alumnos por CH firmado.</p>
        </div>
        <dl className="cmv2-dist-baseline" aria-label="Línea base de sensibilidad">
          <div><dt>n fórmula</dt><dd>{fmtInt(baseline.n_formula)}</dd></div>
          <div><dt>meta planificada</dt><dd>{fmtInt(baseline.n_target)}</dd></div>
          <div><dt>CH para la meta</dt><dd>{fmtInt(baseline.ch_required)}</dd></div>
        </dl>
      </header>
      <div
        className="cmv2-dist-sensitivity-grid"
        data-qa-geometry-group="calc-muestra/distribucion-sensibilidad"
        data-qa-geometry-contract="equal"
      >
        {data.sensitivity.axes.map((axis) => (
          <article key={axis.parameter} className="cmv2-dist-axis" data-qa-geometry-member data-qa-geometry-capacity="owned">
            <header><Activity size={14} aria-hidden="true" /><strong>{axis.label}</strong></header>
            <table>
              <thead><tr><th>Valor</th><th>n requerido</th><th>Δ n</th><th>CH</th></tr></thead>
              <tbody>
                {axis.points.map((point) => (
                  <tr key={point.key}>
                    <th scope="row"><span>{point.label}</span><small>{fmtSensitivityValue(axis, point.value)}</small></th>
                    <td>{fmtInt(point.n_required)}</td>
                    <td>{fmtSignedInt(point.delta_n)}</td>
                    <td>{fmtInt(point.ch_required)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
        ))}
      </div>
    </section>
  );
}

export function CalculoDistribucionTab({
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
  const [pasoActivo, setPasoActivo] = useState<DistribucionPasoId>("composicion");
  const model = buildCalculoDistribucionModel({ componentes, currentFrameHash, escenario });
  const ready = model.state.kind === "ready";
  return (
    <div
      className="cmv2-dist"
      data-audit-ready={ready ? "true" : "false"}
      data-surface-group="calc-muestra-calculo"
      data-surface-contract="distribucion-universitaria-r"
    >
      <CalculoComparacionEscenarios
        componentes={componentes}
        currentFrameHash={currentFrameHash}
        escenario={escenario}
        onEscenario={onEscenario}
      />
      <header className="cmv2-dist-toolbar">
        <div>
          <strong>Distribución universitaria</strong>
          <span>{model.selection.shortLabel} · resultado vigente del engine R</span>
        </div>
      </header>
      {model.state.kind !== "ready" ? (
        <DistributionState state={model.state} />
      ) : (
        <div
          className="cmv2-dist-sections"
          data-qa-geometry-group="calc-muestra/calculo-distribucion"
          data-qa-geometry-contract="intrinsic"
        >
          {/* El dato acreditado encabeza siempre: es la procedencia del bloque.
              Las tres lecturas —composición, precisión y sensibilidad— son un
              recorrido, no una pila: apiladas sumaban 2.253 px sobre 645
              visibles. Se recorren, y las tres siguen en el DOM. */}
          <AuditHeader data={model.state.data} selection={model.selection} />
          <DistribucionPasos activo={pasoActivo} onPaso={setPasoActivo} />
          <div hidden={pasoActivo !== "composicion"}>
            <CompositionTable data={model.state.data} />
          </div>
          <div hidden={pasoActivo !== "precision"}>
            <PrecisionTable faculties={model.state.data.faculties} scenario={model.state.data.scenario} />
          </div>
          <div hidden={pasoActivo !== "sensibilidad"}>
            <Sensitivity data={model.state.data} />
          </div>
        </div>
      )}
    </div>
  );
}
