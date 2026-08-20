/**
 * Pestaña «Cursos-horario titulares» (id seleccion) de la sección Aulas.
 *
 * Desde 2026-08-20 cuenta SOLO la historia operativa: qué se seleccionó, si
 * alcanza y el veredicto por facultad — Gonzalo: «tiene muchísima información
 * que podría ser separada en dos pestañas». El porqué (efectividad, margen,
 * comparaciones, solapes, ajuste al marco) vive en «Solidez de la selección»
 * (AulasSolidezTab). Command bar: Seleccionar titulares + Probar reemplazos.
 */
import { useState } from "react";
import type {
  CalcMuestraAulasCerteza,
  CalcMuestraCertificacionFacultad,
  CalcMuestraReferenciaAsistencia,
  CalcMuestraWorkspaceAulasConfig,
} from "../../../../api/client";
import { CertificacionFacultadCard } from "./CertificacionFacultadCard";
import { FijasPendientesAviso } from "./FijasPendientesAviso";
import { PresupuestoVisitasCard } from "./PresupuestoVisitasCard";
import { SeleccionPorFacultadCard } from "./SeleccionPorFacultadCard";
import { efectividadCalibradaPorFacultad } from "./efectividadCalibradaModel";
import { fmtInt } from "../../sharedCore";
import { classroomRowText } from "../shared/format";
import { classroomMetricValue } from "../shared/frame";
import { CoberturaObjetivoStrip } from "./CoberturaObjetivoStrip";
import { coberturaObjetivo } from "./coberturaObjetivoModel";
import { CifraFila, CifraMotor } from "../ui";
import { ClassroomSelectionMapWorkspace } from "./ClassroomSelectionMap";
import {
  ClassroomLabCommandBar,
  ClassroomSelectionPreparationPanel,
  classroomMethodLabel,
  classroomProbabilitySourceLabel,
  classroomScore,
  type ClassroomLabModel,
} from "./aulasParts";
import {
  AulasStageNotice,
  resolveAulasStageNotice,
  type AulasNavigate,
} from "./aulasSurfaceState";
import "../../didactica/didactica.css";
import "./aulas.css";

export function AulasSeleccionTab({
  model,
  busy,
  onSelectMethod,
  onSimulateReplacements,
  onNavigate,
  certeza = null,
  certificacion = null,
  onAgregarAula,
  onAjustarAula,
  referencia = null,
}: {
  model: ClassroomLabModel;
  busy: string | null;
  /** Certeza medida en Cálculo; nombra las facultades que no sostienen cuota. */
  certeza?: CalcMuestraAulasCerteza | null;
  certificacion?: CalcMuestraCertificacionFacultad | null;
  onAgregarAula?: (facultad: string, aulasActuales: number) => void;
  /** El par ±1 del reparto por facultad (pasa directo a la certificación). */
  onAjustarAula?: (facultad: string, aulasActuales: number, delta: 1 | -1) => void;
  /** El estudio anterior, para la lectura REFERENCIAL del τ propio. */
  referencia?: CalcMuestraReferenciaAsistencia | null;
  onSelectMethod: (config: CalcMuestraWorkspaceAulasConfig, methodId?: string) => void | Promise<void>;
  onSimulateReplacements: (config: CalcMuestraWorkspaceAulasConfig) => void | Promise<void>;
  onNavigate?: AulasNavigate;
}) {
  // Fila inspeccionada (identidad de objeto: las filas del motor son estables
  // mientras no se regenere la selección; si se regenera, el guard de abajo
  // cierra el inspector solo).
  const [inspectedRow, setInspectedRow] = useState<Record<string, unknown> | null>(null);
  const {
    selection,
    selectionReady,
    selectionRows,
    comparison,
    comparisonReady,
    frameRows,
    coverageRows,
    m1Rows,
    reserveRows,
    replacementSimulation,
    recommendedMethodId,
    engineOption,
    targetForDisplay,
    m1ForDisplay,
  } = model;
  // Si la selección se regeneró, la fila guardada ya no existe: inspector cerrado.
  const activeRow = inspectedRow && selectionRows.includes(inspectedRow) ? inspectedRow : null;
  const methodUsedLabel = classroomMethodLabel(
    String(selection?.selector_engine_used ?? selection?.selector_engine ?? engineOption.label),
  );
  const stageNotice = resolveAulasStageNotice(model, "seleccion");
  const inspectByClassroomId = (classroomId: string) => {
    if (!classroomId) return;
    // Prefiere titular/reemplazo sobre la bolsa extra si el id se repitiera.
    const candidate =
      selectionRows.find(
        (row) =>
          classroomRowText(row, ["classroom_id"]) === classroomId &&
          classroomRowText(row, ["sample_role"]) !== "extra_reserve_pool",
      ) ?? selectionRows.find((row) => classroomRowText(row, ["classroom_id"]) === classroomId);
    if (candidate) setInspectedRow(candidate);
  };

  return (
    <div className="cmv2-aulas-stack">
      {/* EF8c: la fijación pendiente se NOMBRA — sin esto, fijar un aula
          hacía desaparecer la selección sin explicación (click-test). */}
      <FijasPendientesAviso estratos={model.facultades} aulasPorEstrato={model.aulasPorEstrato} />
      {/* Opción B: el techo manda — el presupuesto se ve donde se decide. */}
      <PresupuestoVisitasCard techo={model.config.techo_aulas_visitadas} titulares={m1Rows} />
      {stageNotice && (
        <AulasStageNotice
          notice={stageNotice}
          onNavigate={onNavigate}
          onAction={stageNotice.localAction === "select"
            ? () => void onSelectMethod(model.config, recommendedMethodId)
            : undefined}
          disabled={Boolean(stageNotice.localAction) && (Boolean(busy) || !comparisonReady)}
          disabledReason={
            busy
              ? `No se puede generar mientras corre «${busy}».`
              : !comparisonReady
                ? "Falta una comparación de métodos vigente: se genera desde Comparar métodos."
                : undefined
          }
        />
      )}
      {!selectionReady ? (
        <section className="cmv2-panel cmv2-aulas-panel">
          <div className="cmv2-subhead">
            <strong>Preparación de la selección</strong>
          </div>
          <ClassroomSelectionPreparationPanel
            frameReady={model.frameReady}
            comparisonReady={comparisonReady}
            recommendedMethodLabel={comparison?.recommendation?.method_label ?? classroomMethodLabel(recommendedMethodId)}
            frameCount={frameRows.length}
            targetForDisplay={targetForDisplay}
            m1ForDisplay={m1ForDisplay}
          />
        </section>
      ) : (
        <>
          <CoberturaObjetivoStrip
            cobertura={coberturaObjetivo({
              cubiertos: classroomMetricValue(coverageRows, "selected_unique_students"),
              objetivo: targetForDisplay,
              // La métrica que juzga: Σ efectivas_esperadas de los titulares.
              esperadas: m1Rows.reduce((suma, fila) => {
                const v = Number((fila as Record<string, unknown>).efectivas_esperadas);
                return Number.isFinite(v) ? suma + v : suma;
              }, 0),
              certeza,
            })}
          />

          <section className="cmv2-panel cmv2-aulas-panel cmv2-aulas-hero-panel">
            <div className="cmv2-subhead">
              <strong>Selección vigente</strong>
              <small>resultado acreditado por objetivo y firma del marco</small>
            </div>
            <div>
              <CifraFila>
                <CifraMotor
                  label="Cursos-horario titulares"
                  value={fmtInt(m1Rows.length)}
                  detalle="primera cadena que intenta campo"
                  origen="motor"
                  hero
                />
                <CifraMotor
                  label="Reemplazos"
                  value={fmtInt(reserveRows.length)}
                  detalle="asociados a titulares"
                  origen="motor"
                />
                <CifraMotor
                  label="Calidad representativa"
                  value={classroomScore(selection?.representativity_score)}
                  detalle="score del objetivo"
                  origen="motor"
                />
                <CifraMotor
                  label="Método usado"
                  value={methodUsedLabel}
                  detalle={classroomProbabilitySourceLabel(selection?.probability_source)}
                  origen="motor"
                />
              </CifraFila>
            </div>
          </section>

          <ClassroomLabCommandBar
            model={model}
            busy={busy}
            acciones={["seleccionar", "reemplazos"]}
            onSelectMethod={onSelectMethod}
            onSimulateReplacements={onSimulateReplacements}
          />
        </>
      )}

      {/* 2 · El veredicto: ¿la selección garantiza la meta, por facultad y sexo? */}
      <CertificacionFacultadCard certificacion={certificacion} onAgregarAula={onAgregarAula} onAjustarAula={onAjustarAula} referencia={referencia ?? null} calibrada={efectividadCalibradaPorFacultad(m1Rows)} />

      {/* 3 · La selección misma, con selección corrida: el mapa con su
          inspector y la lista por facultad con las cadenas plegadas (T1). */}
      {selectionReady ? (
        <>
          <ClassroomSelectionMapWorkspace
            selectionRows={selectionRows}
            simulation={replacementSimulation}
            selectedRow={activeRow}
            methodLabel={methodUsedLabel}
            onInspect={setInspectedRow}
            onInspectById={inspectByClassroomId}
            onCloseInspector={() => setInspectedRow(null)}
          />
          <div
            className="cmv2-aulas-tabla-inspector-layout"
            data-qa-geometry-group="aulas-seleccion-tabla"
            data-qa-geometry-contract="intrinsic"
          >
            <div className="cmv2-aulas-tabla-main">
              <SeleccionPorFacultadCard
                rows={selectionRows}
                selectedRow={activeRow}
                onSelectRow={setInspectedRow}
              />
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
