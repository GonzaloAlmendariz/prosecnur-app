/**
 * Pestaña "Sustento técnico" (id auditoria) de la sección Aulas. Las cuatro
 * fórmulas que antes eran <code> plano ahora son KaTeX con valores REALES del
 * motor sustituidos (peor brecha de perfil, peso de un aula concreta, π del
 * estudiante y n efectivo), con chips que referencian términos ya explicados
 * en Método y Simulación. La tarjeta de reproducibilidad defendible reúne
 * semilla, firmas histórica y vigente del marco, método, fuente de
 * probabilidad, corrida y corridas MC. Se conservan fuentes metodológicas,
 * riesgos, brechas top y el handoff operativo.
 */
import { FileText } from "lucide-react";
import { RespaldoMetodologico } from "../../didactica/PasoDidactico";
import { fmtDec, fmtInt, fmtPct, safeNumber } from "../../sharedCore";
import { AvisoModulo } from "../shared/AvisoModulo";
import { classroomRowNumber, classroomRowText } from "../shared/format";
import { CifraFila, CifraMotor, FormulaLatex } from "../ui";
import {
  ClassroomMethodSources,
  ClassroomOperationalHandoffPanel,
  ProfileBalanceChart,
  classroomMethodLabel,
  classroomProbabilitySourceLabel,
  type ClassroomLabModel,
} from "./aulasParts";
import {
  AulasStageNotice,
  resolveAulasStageNotice,
  type AulasNavigate,
} from "./aulasSurfaceState";
import { ClassroomRiskList } from "./ClassroomRiskList";
import "../../didactica/didactica.css";
import "./aulas.css";

export function AulasAuditoriaTab({
  model,
  onNavigate,
}: {
  model: ClassroomLabModel;
  onNavigate?: AulasNavigate;
}) {
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
  const frameHash = frame?.frame_hash ? String(frame.frame_hash) : "";
  const selectionHash = selection?.frame_hash ? String(selection.frame_hash) : "";
  const frameChangedAfterSelection = Boolean(frameHash && selectionHash && frameHash !== selectionHash);
  const generatedAt = frame?.generated_at ? String(frame.generated_at).slice(0, 16).replace("T", " ") : "";
  const stageNotice = resolveAulasStageNotice(model, "auditoria");

  return (
    <div className="cmv2-aulas-stack">
      {stageNotice && (
        <AulasStageNotice notice={stageNotice} onNavigate={onNavigate} />
      )}
      <div className="cmv2-classroom-lab-grid">
        <div className="cmv2-classroom-lab-main cmv2-aulas-audit-main">
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
          <div
            key={corridaKey}
            className="cmv2-aulas-formulas cmv2-uni-stagger"
            data-qa-geometry-group="aulas-auditoria-formulas"
            data-qa-geometry-contract="intrinsic"
          >
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

          <section
            className="cmv2-aulas-repro cmv2-aulas-sello"
            aria-label="Reproducibilidad defendible"
            data-qa-geometry-group="aulas-auditoria-reproducibilidad"
            data-qa-geometry-contract="intrinsic"
          >
            <div className="cmv2-subhead">
              <strong>Reproducibilidad</strong>
            </div>
            <CifraFila>
              <CifraMotor
                label="Semilla"
                value={String(safeNumber(selection?.seed, config.semilla))}
                detalle="fija el sorteo completo"
                origen={selection ? "motor" : "preview"}
                monospace
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
                label="Firma usada por la selección"
                value={selectionHash ? selectionHash.slice(0, 10) : "pendiente"}
                detalle="marco usado al ejecutar la selección"
                origen={selectionHash ? "motor" : undefined}
                monospace
              />
              <CifraMotor
                label="Firma del marco actual"
                value={frameHash ? frameHash.slice(0, 10) : "pendiente"}
                detalle="firma del marco vigente"
                origen={frameHash ? "motor" : undefined}
                monospace
              />
              <CifraMotor
                label="Marco actual generado"
                value={generatedAt || "pendiente"}
                detalle="fecha de construcción del marco vigente"
                origen={generatedAt ? "motor" : undefined}
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
                monospace
              />
              <CifraMotor
                label="Corridas MC"
                value={mcRuns ? fmtInt(mcRuns) : "—"}
                detalle="auditoría por simulación"
                origen={mcRuns ? "motor" : undefined}
              />
            </CifraFila>
          </section>

          {frameChangedAfterSelection && (
            <AvisoModulo tone="warn" title="El marco cambió después de la selección.">
              La selección vigente ({classroomMethodLabel(String(selection?.selector_engine_used ?? selection?.selector_engine ?? ""))}) se sorteó sobre la firma {selectionHash.slice(0, 10)}, pero el marco actual tiene la firma {frameHash.slice(0, 10)}. Vuelve a comparar métodos y seleccionar para que titulares y reemplazos correspondan al marco vigente.
            </AvisoModulo>
          )}

          <ClassroomMethodSources selection={selection} comparison={comparison} />
        </div>
        <aside className="cmv2-classroom-lab-side">
          <ClassroomRiskList risks={comparison?.risk_flags ?? []} audited={model.comparisonReady} />
          <ProfileBalanceChart rows={topGaps} />
          <ClassroomOperationalHandoffPanel selection={selection} replacementSimulation={replacementSimulation} />
        </aside>
      </div>
      <RespaldoMetodologico paso="aulas" />
    </div>
  );
}
