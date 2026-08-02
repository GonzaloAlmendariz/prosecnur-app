/**
 * Pestaña "Aulas titulares" (id seleccion) de la sección Aulas. Arriba la capa
 * didáctica (SeleccionAulasVisual); luego cifras con procedencia del motor,
 * cobertura/solape, razones operativas por aula, el ajuste muestra vs. marco
 * con banda de tolerancia explícita y la tabla filtrable de la selección.
 * El grid de métricas de representatividad NO se repite aquí (vive en
 * Simulación). Command bar: Seleccionar titulares + Probar reemplazos.
 */
import { useState } from "react";
import type {
  CalcMuestraWorkspace,
  CalcMuestraWorkspaceAulasConfig,
} from "../../../../api/client";
import { SeleccionAulasVisual } from "../../didactica/SeleccionAulasVisual";
import { fmtInt } from "../../sharedCore";
import { classroomRowSearch, classroomRowText } from "../shared/format";
import { CifraFila, CifraMotor } from "../ui";
import { AulaInspectorPanel } from "./AulaInspectorPanel";
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
}: {
  workspace: CalcMuestraWorkspace;
  model: ClassroomLabModel;
  busy: string | null;
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
      {stageNotice && (
        <AulasStageNotice
          notice={stageNotice}
          onNavigate={onNavigate}
          onAction={stageNotice.localAction === "select"
            ? () => void onSelectMethod(model.config, recommendedMethodId)
            : undefined}
          disabled={Boolean(stageNotice.localAction) && (Boolean(busy) || !comparisonReady)}
        />
      )}

      {!selectionReady ? (
        <section
          className="cmv2-panel cmv2-aulas-panel"
        >
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

          <SeleccionAulasVisual
            seleccion={selection}
            nObjetivo={targetForDisplay || null}
            totalFacultades={model.facultades.length || null}
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
                className={`cmv2-aulas-tabla-inspector-layout${activeRow ? " has-inspector" : ""}`}
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
                {activeRow && (
                  <AulaInspectorPanel
                    row={activeRow}
                    selectionRows={selectionRows}
                    methodLabel={methodUsedLabel}
                    onClose={() => setInspectedRow(null)}
                    onInspect={inspectByClassroomId}
                  />
                )}
              </div>
            </div>
            <aside className="cmv2-classroom-lab-side">
              <ClassroomOverlapGraph rows={m1Rows} />
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
