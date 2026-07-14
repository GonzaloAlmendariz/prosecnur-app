/**
 * Pestaña "Sustento técnico" (id auditoria) de la sección Aulas. Las cuatro
 * fórmulas que antes eran <code> plano ahora son KaTeX con valores REALES del
 * motor sustituidos (peor brecha de perfil, peso de un aula concreta, π del
 * estudiante y n efectivo), con chips que referencian términos ya explicados
 * en Método y Simulación. La tarjeta de reproducibilidad defendible reúne
 * semilla, firma del marco, método, fuente de probabilidad, corrida y
 * corridas MC. Se conservan fuentes metodológicas, riesgos, brechas top y el
 * handoff operativo.
 */
import { FileText } from "lucide-react";
import { fmtDec, fmtInt, fmtPct, safeNumber } from "../../sharedCore";
import { classroomRowNumber, classroomRowText } from "../shared/format";
import { CifraFila, CifraMotor, FormulaLatex } from "../ui";
import {
  ClassroomMethodSources,
  ClassroomOperationalHandoffPanel,
  ClassroomRiskList,
  ProfileBalanceChart,
  classroomMethodLabel,
  classroomProbabilitySourceLabel,
  type ClassroomLabModel,
} from "./aulasParts";
import "../../didactica/didactica.css";
import "./aulas.css";

export function AulasAuditoriaTab({ model }: { model: ClassroomLabModel }) {
  const {
    frame,
    selection,
    comparison,
    config,
    topGaps,
    probabilityRows,
    weightStability,
    replacementSimulation,
  } = model;
  const hasEvidence = Boolean(selection || comparison);

  // Valores reales para sustituir en las fórmulas.
  const worstGap = topGaps[0] ?? null;
  const worstFrame = worstGap ? safeNumber(worstGap.frame_prop, Number.NaN) : Number.NaN;
  const worstSelected = worstGap ? safeNumber(worstGap.selected_prop, Number.NaN) : Number.NaN;
  const worstDelta = Number.isFinite(worstFrame) && Number.isFinite(worstSelected) ? worstSelected - worstFrame : Number.NaN;
  const probRow = probabilityRows.find((row) => classroomRowNumber(row, ["pi_final"]) > 0) ?? null;
  const piEjemplo = probRow ? classroomRowNumber(probRow, ["pi_final"]) : Number.NaN;
  const pesoEjemplo = probRow ? classroomRowNumber(probRow, ["weight_classroom"]) : Number.NaN;
  const aulaEjemplo = probRow ? classroomRowText(probRow, ["operational_code", "classroom_id"]) : "";
  const piStudentRow = probabilityRows.find((row) => classroomRowNumber(row, ["pi_student"]) > 0) ?? null;
  const piStudent = piStudentRow ? classroomRowNumber(piStudentRow, ["pi_student"]) : Number.NaN;
  const nEff = weightStability ? classroomRowNumber(weightStability, ["n_eff"]) : Number.NaN;
  const nEffRatio = weightStability ? classroomRowNumber(weightStability, ["n_eff_ratio"]) : Number.NaN;
  const nNominal = Number.isFinite(nEff) && nEffRatio > 0 ? Math.round(nEff / nEffRatio) : model.m1Rows.length;
  const mcRuns = probabilityRows
    .map((row) => classroomRowNumber(row, ["mc_runs"]))
    .find((value) => Number.isFinite(value) && value > 0) ?? safeNumber(config.simulation_runs, 0);
  // Al cambiar la corrida (selection_run_id) el grid de fórmulas se remonta y
  // replay-a su cascada: la evidencia nueva se ve llegar. Las cifras del sello
  // no se remontan: CifraMotor ya funde sus valores con blur-swap.
  const corridaKey = selection?.selection_run_id ? String(selection.selection_run_id) : "sin-corrida";

  return (
    <div className="cmv2-aulas-stack">
      <div className="cmv2-classroom-lab-grid">
        <div className="cmv2-classroom-lab-main">
          <div className="cmv2-subhead">
            <strong>Fórmulas del diseño</strong>
          </div>
          {!hasEvidence && (
            <div className="cmv2-classroom-empty is-compact">
              <span><FileText size={16} /></span>
              <div>
                <strong>Sustento en construcción</strong>
                <em>Compara métodos o genera una selección para que las fórmulas muestren los valores reales del estudio.</em>
              </div>
            </div>
          )}
          <div key={corridaKey} className="cmv2-aulas-formulas cmv2-uni-stagger">
            <FormulaLatex
              caption="Brecha de balance por categoría"
              expression={"b(c) = \\%_{\\mathit{muestra}}(c) - \\%_{\\mathit{marco}}(c)"}
              badge={worstGap ? "validado" : undefined}
              terms={worstGap ? [
                {
                  symbol: "peor c",
                  termino: "estrato",
                  value: `${worstGap.category ?? worstGap.dimension}`,
                },
                {
                  symbol: "b(c)",
                  termino: "marco muestral",
                  value: Number.isFinite(worstDelta)
                    ? `${fmtPct(worstSelected)} − ${fmtPct(worstFrame)} = ${worstDelta >= 0 ? "+" : "−"}${fmtPct(Math.abs(worstDelta))}`
                    : undefined,
                },
              ] : undefined}
            />
            <FormulaLatex
              caption="Peso de cada curso-horario seleccionado"
              expression={"w_i = \\tfrac{1}{\\pi_i}"}
              badge={probRow ? "validado" : undefined}
              terms={probRow ? [
                {
                  symbol: "π_i",
                  termino: "pi (probabilidad",
                  value: `${aulaEjemplo ? `${aulaEjemplo}: ` : ""}${fmtPct(piEjemplo)}`,
                },
                {
                  symbol: "w_i",
                  termino: "ponderación (peso)",
                  value: Number.isFinite(pesoEjemplo) && pesoEjemplo > 0 ? fmtDec(pesoEjemplo, 2) : fmtDec(1 / piEjemplo, 2),
                },
              ] : undefined}
            />
            <FormulaLatex
              caption="Probabilidad interna del estudiante"
              expression={"\\pi_{est} = 1 - \\prod_a \\left(1 - \\pi_a\\right)"}
              badge={piStudentRow ? "validado" : undefined}
              terms={piStudentRow ? [
                {
                  symbol: "π_a",
                  termino: "pi (probabilidad",
                  value: fmtPct(piEjemplo),
                },
                {
                  symbol: "π_est",
                  termino: "pi (probabilidad",
                  value: fmtPct(piStudent),
                },
              ] : undefined}
            />
            <FormulaLatex
              caption="n efectivo tras ponderar"
              expression={"n_{\\mathit{eff}} \\approx \\dfrac{\\left(\\sum_i w_i\\right)^2}{\\sum_i w_i^2}"}
              badge={weightStability ? "validado" : undefined}
              terms={weightStability ? [
                {
                  symbol: "n_eff",
                  termino: "ponderación (peso)",
                  value: `${fmtDec(nEff, 1)} de ${fmtInt(nNominal)} titulares`,
                },
              ] : undefined}
            />
          </div>

          <section className="cmv2-aulas-repro cmv2-aulas-sello" aria-label="Reproducibilidad defendible">
            <div className="cmv2-subhead">
              <strong>Reproducibilidad</strong>
            </div>
            <CifraFila>
              <CifraMotor
                label="Semilla"
                value={String(safeNumber(selection?.seed, config.semilla))}
                detalle="fija el sorteo completo"
                origen={selection ? "motor" : "preview"}
              />
              <CifraMotor
                label="Firma del marco"
                value={selection?.frame_hash ? String(selection.frame_hash).slice(0, 10) : frame?.frame_hash ? String(frame.frame_hash).slice(0, 10) : "pendiente"}
                detalle="marco congelado usado"
                origen={selection?.frame_hash || frame?.frame_hash ? "motor" : undefined}
              />
              <CifraMotor
                label="Método usado"
                value={selection ? classroomMethodLabel(String(selection.selector_engine_used ?? selection.selector_engine ?? "")) : classroomMethodLabel(model.recommendedMethodId)}
                detalle={selection ? "cálculo ejecutado" : "recomendado vigente"}
                origen={selection ? "motor" : undefined}
              />
            </CifraFila>
            <CifraFila>
              <CifraMotor
                label="Probabilidad reportada"
                value={classroomProbabilitySourceLabel(selection?.probability_source)}
                detalle="fuente de π usada en pesos"
                origen={selection ? "motor" : undefined}
              />
              <CifraMotor
                label="Corrida de selección"
                value={selection?.selection_run_id ? String(selection.selection_run_id) : "pendiente"}
                detalle="identificador auditable"
                origen={selection?.selection_run_id ? "motor" : undefined}
              />
              <CifraMotor
                label="Corridas MC"
                value={mcRuns ? fmtInt(mcRuns) : "—"}
                detalle="auditoría por simulación"
                origen={mcRuns ? "motor" : undefined}
              />
            </CifraFila>
          </section>

          <ClassroomMethodSources selection={selection} comparison={comparison} />
        </div>
        <aside className="cmv2-classroom-lab-side">
          <ClassroomRiskList risks={comparison?.risk_flags ?? []} />
          <ProfileBalanceChart rows={topGaps} />
          <ClassroomOperationalHandoffPanel selection={selection} replacementSimulation={replacementSimulation} />
        </aside>
      </div>
    </div>
  );
}
