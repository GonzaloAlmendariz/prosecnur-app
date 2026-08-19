/**
 * Pestaña "Aulas titulares" (id seleccion) de la sección Aulas. Arriba la capa
 * didáctica, mapa completo, cifras del motor, cobertura/solape, razones por
 * aula, ajuste frente al marco e inspector compartido con la tabla filtrable.
 * El grid de métricas de representatividad NO se repite aquí (vive en
 * Simulación). Command bar: Seleccionar titulares + Probar reemplazos.
 */
import { useState } from "react";
import type {
  CalcMuestraAulasCerteza,
  CalcMuestraAulasEstrato,
  CalcMuestraCertificacionFacultad,
  CalcMuestraReferenciaAsistencia,
  CalcMuestraSexoPorFacultad,
  CalcMuestraWorkspace,
  CalcMuestraWorkspaceAulasConfig,
} from "../../../../api/client";
import { MargenPorFacultadCard } from "./MargenPorFacultadCard";
import { CertificacionFacultadCard } from "./CertificacionFacultadCard";
import { SustentoDimensionamientoCard } from "./SustentoDimensionamientoCard";
import { SexoPorFacultadCard } from "./SexoPorFacultadCard";
import { EmbudoComparadoFacultades } from "../salidas/EmbudoComparadoFacultades";
import type { FichaFacultad } from "../criterios/fichaFacultadModel";
import { SeleccionAulasVisual } from "../../didactica/SeleccionAulasVisual";
import { AporteTitularesCard } from "./AporteTitularesCard";
import { DocenteUnicoAviso } from "./DocenteUnicoAviso";
import { efectividadCalibradaPorFacultad } from "./efectividadCalibradaModel";
import { fmtInt } from "../../sharedCore";
import { classroomRowSearch, classroomRowText } from "../shared/format";
import { classroomMetricValue } from "../shared/frame";
import { CoberturaObjetivoStrip } from "./CoberturaObjetivoStrip";
import { coberturaObjetivo } from "./coberturaObjetivoModel";
import { CifraFila, CifraMotor } from "../ui";
import { ClassroomSelectionMapWorkspace } from "./ClassroomSelectionMap";
import { DescuentoRepetidosPanel } from "./DescuentoRepetidosPanel";
import {
  ClassroomLabCommandBar,
  ClassroomOverlapGraph,
  ClassroomSelectionPreparationPanel,
  ClassroomSelectionRationaleDashboard,
  ClassroomSelectionTable,
  CoverageOverlapPanel,
  ProfileBalanceChart,
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

const TABLE_PAGE_INITIAL = 80;
const TABLE_PAGE_STEP = 200;

export function AulasSeleccionTab({
  workspace,
  model,
  busy,
  onSelectMethod,
  onSimulateReplacements,
  onNavigate,
  certeza = null,
  margenFilas = null,
  sexoBalance = null,
  certificacion = null,
  onAgregarAula,
  onAjustarAula,
  fichas = null,
  periodoAnterior = "",
  referencia = null,
}: {
  workspace: CalcMuestraWorkspace;
  model: ClassroomLabModel;
  busy: string | null;
  /** Certeza medida en Cálculo; nombra las facultades que no sostienen cuota. */
  certeza?: CalcMuestraAulasCerteza | null;
  /** Filas de `aulas_por_estrato` con su bloque `margen`: cuántas aulas tiene
   *  cada facultad frente a las que necesita. */
  margenFilas?: CalcMuestraAulasEstrato[] | null;
  /** Balance de sexo por facultad de la selección vigente. */
  sexoBalance?: CalcMuestraSexoPorFacultad | null;
  certificacion?: CalcMuestraCertificacionFacultad | null;
  onAgregarAula?: (facultad: string, aulasActuales: number) => void;
  /** El par ±1 del reparto por facultad (pasa directo a la certificación). */
  onAjustarAula?: (facultad: string, aulasActuales: number, delta: 1 | -1) => void;
  /** Fichas hoy/antes por facultad para el embudo comparado (Gonzalo: «el
   *  embudo de facultad por facultad debería estar en selección»). */
  fichas?: FichaFacultad[] | null;
  periodoAnterior?: string;
  /** El estudio anterior, para la lectura REFERENCIAL del τ propio. */
  referencia?: CalcMuestraReferenciaAsistencia | null;
  onSelectMethod: (config: CalcMuestraWorkspaceAulasConfig, methodId?: string) => void | Promise<void>;
  onSimulateReplacements: (config: CalcMuestraWorkspaceAulasConfig) => void | Promise<void>;
  onNavigate?: AulasNavigate;
}) {
  const [tableQuery, setTableQuery] = useState("");
  // Tope visible de la tabla: parte en 80 filas y crece bajo demanda, con el
  // filtro operando SIEMPRE sobre el total de la selección (no solo lo visible).
  const [tableLimit, setTableLimit] = useState(TABLE_PAGE_INITIAL);
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
    framePopulationCount,
    coverageRows,
    visibleProfiles,
    m1Rows,
    reserveRows,
    replacementSimulation,
    recommendedMethodId,
    engineOption,
    targetForDisplay,
    m1ForDisplay,
  } = model;
  const filteredSelectionRows = selectionRows.filter((row) => classroomRowSearch(row, tableQuery));
  const visibleSelectionRows = filteredSelectionRows.slice(0, tableLimit);
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
      {/* K2 (censo f224af2d): la pestaña contaba dos historias entreveradas y
          la ACCIÓN quedaba enterrada en el bloque 8 de 11. Orden contratado:
          1 estado+acción · 2 el veredicto (certificación) · 3 el porqué del
          pedido (margen+sustento) · 4 comparaciones (embudo+sexo) · 5 lo
          defendible y el mapa · 6 la tabla al final con su buscador. */}
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

      {/* EF2 · El registro visible del docente único: qué se intercambió y
          por qué; sin ajustes no pinta nada. */}
      <DocenteUnicoAviso registro={selection?.diagnostics?.docente_unico} />

      {/* 3 · El porqué del pedido: cuántas aulas hay y de dónde sale cada titular. */}
      <MargenPorFacultadCard filas={margenFilas} />
      <SustentoDimensionamientoCard filas={margenFilas} referencia={referencia ?? null} />

      {/* 4 · Comparaciones: contra el estudio anterior y la oferta por sexo. */}
      {fichas && fichas.length ? (
        <EmbudoComparadoFacultades fichas={fichas} periodo={periodoAnterior} pasoInicial={7} />
      ) : null}
      <SexoPorFacultadCard balance={sexoBalance} />

      {/* 5-6 · Lo defendible, el mapa y la tabla, solo con selección corrida. */}
      {selectionReady ? (
        <>
          <SeleccionAulasVisual
            seleccion={selection}
            nObjetivo={targetForDisplay || null}
            totalFacultades={model.facultades.length || null}
          />
          {/* K3 · La distribución del aporte: ¿la muestra es pareja o unas
              pocas aulas grandes cargan con todo? */}
          <AporteTitularesCard filas={m1Rows} />
          <ClassroomSelectionMapWorkspace
            selectionRows={selectionRows}
            simulation={replacementSimulation}
            selectedRow={activeRow}
            methodLabel={methodUsedLabel}
            onInspect={setInspectedRow}
            onInspectById={inspectByClassroomId}
            onCloseInspector={() => setInspectedRow(null)}
          />

          <div className="cmv2-classroom-lab-grid">
            <div className="cmv2-classroom-lab-main">
              <div className="cmv2-subhead">
                <strong>Selección propuesta</strong>
              </div>
              <CoverageOverlapPanel rows={coverageRows} selectionRows={m1Rows} framePopulation={framePopulationCount} />
              <DescuentoRepetidosPanel selection={selection} m1Rows={m1Rows} />
              <ClassroomSelectionRationaleDashboard rows={m1Rows} workspace={workspace} />
              <div className="cmv2-subhead">
                <strong>Ajuste frente al marco</strong>
              </div>
              <ProfileBalanceChart rows={visibleProfiles} />
              <div
                className="cmv2-aulas-tabla-inspector-layout"
                data-qa-geometry-group="aulas-seleccion-tabla"
                data-qa-geometry-contract="intrinsic"
              >
                <div className="cmv2-aulas-tabla-main">
                  <label className="cmv2-compact-field cmv2-classroom-table-filter">
                    <span>Filtrar cursos-horario</span>
                    <input
                      value={tableQuery}
                      placeholder="facultad, curso, horario, estado..."
                      onChange={(e) => setTableQuery(e.currentTarget.value)}
                    />
                  </label>
                  <ClassroomSelectionTable
                    rows={visibleSelectionRows}
                    selectedRow={activeRow}
                    onSelectRow={setInspectedRow}
                  />
                  {filteredSelectionRows.length > 0 && (
                    <div className="cmv2-aulas-tabla-pie">
                      <span>
                        mostrando {fmtInt(Math.min(tableLimit, filteredSelectionRows.length))} de {fmtInt(filteredSelectionRows.length)} cursos-horario
                        {tableQuery.trim() ? ` (filtro sobre ${fmtInt(selectionRows.length)})` : ""}
                      </span>
                      {filteredSelectionRows.length > tableLimit && (
                        <button
                          type="button"
                          className="cmv2-ghost"
                          onClick={() => setTableLimit((limit) => limit + TABLE_PAGE_STEP)}
                        >
                          Mostrar {fmtInt(Math.min(TABLE_PAGE_STEP, filteredSelectionRows.length - tableLimit))} más
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <aside className="cmv2-classroom-lab-side">
              <ClassroomOverlapGraph rows={m1Rows} />
            </aside>
          </div>
        </>
      ) : null}
    </div>
  );
}
