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
  CalcMuestraWorkspace,
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
import { fmtInt, safeNumber } from "../../sharedCore";
import { PanelAvanzado } from "../ui/PanelAvanzado";
import { HistorialCorridas } from "../salidas/HistorialCorridas";
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
import { avisoDuracionSorteo } from "./duracionComparacion";
import { AvisoModulo } from "../shared/AvisoModulo";

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
  workspace,
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
  /** Para el historial de corridas del panel avanzado. */
  workspace?: CalcMuestraWorkspace;
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
  // La comparación avisa de su coste; el sorteo no avisaba de ninguno, y
  // «Optimizar repetidos» hace `candidate_pool_size` sorteos completos en vez
  // de uno. Costó una espera de más de seis minutos hasta cancelarla.
  const avisoSorteo = avisoDuracionSorteo({
    metodoId: model.metodoParaSortear,
    candidatas: Number(
      (model.config as Record<string, unknown>).candidate_pool_size
      ?? ((model.config as Record<string, unknown>).selector as Record<string, unknown> | undefined)?.candidate_pool_size
      ?? Number.NaN,
    ),
  });
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
            recommendedMethodLabel={classroomMethodLabel(recommendedMethodId) || comparison?.recommendation?.method_label || recommendedMethodId}
            metodoVigenteLabel={classroomMethodLabel(model.metodoParaSortear)}
            // Las seleccionables, que es lo que el rótulo promete («Una fila
            // por curso-horario seleccionable»). Antes contaba todas.
            frameCount={model.frameIncludedCount}
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

          {/* La comparación avisa de su coste; el sorteo no avisaba de
              ninguno, y «Optimizar repetidos» hace `candidate_pool_size`
              sorteos completos en vez de uno. Costó una espera de más de seis
              minutos hasta cancelarla, y días buscando la causa en el entorno
              del job. Sin condicionar a que no haya selección: re-sortear con
              este método cuesta exactamente lo mismo. */}
          {avisoSorteo.avisar && (
            <AvisoModulo tone="info" title="Este método sortea muchas veces" compact>
              <p>
                <b>{classroomMethodLabel(model.metodoParaSortear)}</b> no hace un sorteo: hace{" "}
                <b>{fmtInt(avisoSorteo.sorteos)}</b> y se queda con el que mejor puntúa. Los otros
                tres hacen uno. Sobre un marco de este tamaño la diferencia se mide en minutos, no
                en segundos, así que cuenta con ese tiempo antes de lanzarlo.
              </p>
            </AvisoModulo>
          )}

          <ClassroomLabCommandBar
            model={model}
            busy={busy}
            acciones={["seleccionar", "reemplazos"]}
            onSelectMethod={onSelectMethod}
            onSimulateReplacements={onSimulateReplacements}
          />

          {/*
            * Lo que gobierna el sorteo, junto al botón que lo dispara. La
            * semilla vivía en Selección → Auditoría y el historial de corridas
            * en Entrega → Cierre: los dos lejos del punto donde se decide
            * sortear. Gonzalo, 2026-08-22: «no veo dónde se pone la semilla ni
            * el historial de corridas». Va agrupado y ABIERTO: el contrato de
            * `cssHuerfano` prohíbe plegar en Aulas, y esa regla nació de que un
            * panel cerrado escondiera la semilla en esta misma pestaña.
            */}
          <PanelAvanzado
            titulo="Semilla e historial de corridas"
            descripcion="Con qué se sortea y qué se sorteó antes"
            // Abierto a propósito. El contrato de `cssHuerfano` prohíbe plegar
            // en esta área, y nació justamente de que un PanelAvanzado cerrado
            // escondía la semilla aquí mismo. Agrupar sí, ocultar no.
            defaultOpen
          >
            <CifraFila>
              <CifraMotor
                label="Semilla vigente"
                value={String(safeNumber(model.selection?.seed, model.config.semilla))}
                detalle={model.selection ? "la que produjo la selección actual" : "la que usará el próximo sorteo"}
                origen={model.selection ? "motor" : "preview"}
                monospace
              />
              <CifraMotor
                label="Firma del marco"
                value={String(model.frame?.frame_hash ?? model.selection?.frame_hash ?? "").slice(0, 12) || "pendiente"}
                detalle="cambia si cambia el marco"
                origen="motor"
                monospace
              />
            </CifraFila>
            <p className="cmv2-aulas-nota-semilla">
              La semilla y la firma del marco determinan el sorteo por completo: con las
              mismas dos, el resultado es idéntico. Si una corrida no reproduce a otra, la
              diferencia está en el marco y no en el azar.
            </p>
            {workspace ? <HistorialCorridas workspace={workspace} /> : null}
          </PanelAvanzado>
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
