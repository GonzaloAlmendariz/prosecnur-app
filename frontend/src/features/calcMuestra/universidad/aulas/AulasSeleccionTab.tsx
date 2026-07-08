/**
 * Pestaña "Aulas titulares" (id seleccion) de la sección Aulas. Arriba la capa
 * didáctica (SeleccionAulasVisual); luego cifras con procedencia del motor,
 * cobertura/solape, razones operativas por aula, el ajuste muestra vs. marco
 * con banda de tolerancia explícita y la tabla filtrable de la selección.
 * El grid de métricas de representatividad NO se repite aquí (vive en
 * Simulación). Command bar: Seleccionar titulares + Probar reemplazos.
 */
import { useState } from "react";
import { Table2 } from "lucide-react";
import type {
  CalcMuestraWorkspace,
  CalcMuestraWorkspaceAulasConfig,
} from "../../../../api/client";
import { SeleccionAulasVisual } from "../../didactica/SeleccionAulasVisual";
import { fmtInt } from "../../sharedCore";
import { classroomRowSearch } from "../shared/format";
import { CifraFila, CifraMotor } from "../ui";
import {
  ClassroomEmptyState,
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
import "../../didactica/didactica.css";
import "./aulas.css";

export function AulasSeleccionTab({
  workspace,
  model,
  busy,
  onSelectMethod,
  onSimulateReplacements,
}: {
  workspace: CalcMuestraWorkspace;
  model: ClassroomLabModel;
  busy: string | null;
  onSelectMethod: (config: CalcMuestraWorkspaceAulasConfig, methodId?: string) => void | Promise<void>;
  onSimulateReplacements: (config: CalcMuestraWorkspaceAulasConfig) => void | Promise<void>;
}) {
  const [tableQuery, setTableQuery] = useState("");
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
    totalTarget,
  } = model;
  const filteredSelectionRows = selectionRows.filter((row) => classroomRowSearch(row, tableQuery));

  return (
    <div className="cmv2-aulas-stack">
      <SeleccionAulasVisual seleccion={selection} nObjetivo={totalTarget || targetForDisplay || null} />

      <ClassroomLabCommandBar
        model={model}
        busy={busy}
        acciones={["seleccionar", "reemplazos"]}
        onSelectMethod={onSelectMethod}
        onSimulateReplacements={onSimulateReplacements}
      />

      <div className="cmv2-classroom-lab-grid">
        <div className="cmv2-classroom-lab-main">
          <div className="cmv2-subhead">
            <span className="cmv2-eyebrow">Selección propuesta</span>
            <strong>Aulas titulares, reemplazos y trazabilidad</strong>
          </div>
          {!selectionReady ? (
            <>
              <ClassroomSelectionPreparationPanel
                frameReady={model.frameReady}
                comparisonReady={comparisonReady}
                recommendedMethodLabel={comparison?.recommendation?.method_label ?? classroomMethodLabel(recommendedMethodId)}
                frameCount={frameRows.length}
                targetForDisplay={targetForDisplay}
                m1ForDisplay={m1ForDisplay}
              />
              <ClassroomEmptyState
                icon={Table2}
                title="Todavía no hay selección"
                detail="Genera una selección desde el método recomendado o desde una tarjeta del comparador. Aquí aparecerán titulares, brechas, razones de selección y estudiantes repetidos."
                actionLabel="Generar selección"
                onAction={() => void onSelectMethod(model.config, recommendedMethodId)}
                disabled={Boolean(busy) || !comparisonReady}
              />
            </>
          ) : (
            <>
              <CifraFila>
                <CifraMotor
                  label="Aulas titulares"
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
                  value={classroomMethodLabel(String(selection?.selector_engine_used ?? selection?.selector_engine ?? engineOption.label))}
                  detalle={classroomProbabilitySourceLabel(selection?.probability_source)}
                  origen="motor"
                />
              </CifraFila>
              <CoverageOverlapPanel rows={coverageRows} selectionRows={m1Rows} framePopulation={framePopulationCount} />
              <ClassroomSelectionRationaleDashboard rows={m1Rows} workspace={workspace} />
              <div className="cmv2-subhead">
                <span className="cmv2-eyebrow">Ajuste frente al marco</span>
                <strong>Cada categoría dentro de su banda de tolerancia</strong>
              </div>
              <ProfileBalanceChart rows={visibleProfiles} />
              <label className="cmv2-compact-field cmv2-classroom-table-filter">
                <span>Filtrar aulas</span>
                <input
                  value={tableQuery}
                  placeholder="facultad, curso, horario, estado..."
                  onChange={(e) => setTableQuery(e.currentTarget.value)}
                />
              </label>
              <ClassroomSelectionTable rows={filteredSelectionRows.slice(0, 80)} />
            </>
          )}
        </div>
        <aside className="cmv2-classroom-lab-side">
          <ClassroomOverlapGraph rows={m1Rows} />
        </aside>
      </div>
    </div>
  );
}
