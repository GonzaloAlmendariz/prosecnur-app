import { Table2 } from "lucide-react";
import type { CalcMuestraWorkspace } from "../../../../api/client";
import {
  DISCOUNT_CELL_KEYS,
  discountCellText,
  hasDiscountColumns,
} from "./descuentoRepetidosModel";
import { fmtDec, fmtInt, fmtPct, rowsFrom, safeNumber } from "../../sharedCore";
import { workspaceCategoryLabel } from "../shared/categorias";
import { classroomRowNumber, classroomRowText } from "../shared/format";
import {
  ClassroomBarPlot,
  ClassroomPlotCard,
  ClassroomSexCompositionPlot,
  classroomSexCompositionRowsFromAulas,
  weightedDistributionRows,
} from "../marco/marcoCharts";
import {
  classroomOperationalCode,
  classroomPlanLabel,
} from "./classroomLabels";

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
  // Columnas del descuento secuencial (contrato Oleada III): solo aparecen
  // cuando la corrida trae las claves nuevas; con payloads viejos la tabla
  // se ve exactamente como hoy.
  const conDescuento = hasDiscountColumns(tableRows);
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
            {conDescuento ? (
              <>
                <th className="is-num">Elegibles bruto</th>
                <th className="is-num">Elegibles netos</th>
                <th className="is-num">Ya cubiertos</th>
                <th className="is-num">Aporte neto</th>
              </>
            ) : (
              <th className="is-num">Elegibles</th>
            )}
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
              {conDescuento ? (
                <>
                  <td className="is-num">{discountCellText(row, [...DISCOUNT_CELL_KEYS.bruto])}</td>
                  <td className="is-num">{discountCellText(row, [...DISCOUNT_CELL_KEYS.neto])}</td>
                  <td className="is-num">{discountCellText(row, [...DISCOUNT_CELL_KEYS.cubiertos])}</td>
                  <td className="is-num">{discountCellText(row, [...DISCOUNT_CELL_KEYS.aporte])}</td>
                </>
              ) : (
                <td className="is-num">{fmtInt(classroomRowNumber(row, ["eligible_n"]))}</td>
              )}
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
