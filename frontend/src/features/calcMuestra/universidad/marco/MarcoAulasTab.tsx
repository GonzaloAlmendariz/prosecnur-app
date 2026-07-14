/**
 * Pestaña "Aulas" de Marco. El foco es la unidad seleccionable (curso-horario):
 * KPIs con procedencia del motor, capacidad del marco (embudo + lecturas),
 * histograma de tamaños con bandas G1-G4 y línea del mínimo por aula (solo
 * lectura: se decide en Aulas → Objetivo), composición por sexo por aula y
 * auditoría de aulas excluidas con su motivo.
 */
import { Grid3X3 } from "lucide-react";
import { EmptyState } from "../../../../components/States";
import type {
  CalcMuestraAulasState,
  CalcMuestraWorkspace,
} from "../../../../api/client";
import { embudoAulaDesdeFrame } from "../../dominio";
import { fmtDec, fmtInt } from "../../sharedCore";
import { frameAuditNumber } from "../shared/frame";
import { normalizeUniversityAulasConfig } from "../shared/study";
import { CifraFila, CifraMotor, FlujoVertical } from "../ui";
import { embudoEtapas } from "./embudoEtapas";
import {
  ClassroomPlotCard,
  countDistinctByKeys,
  sumRowsByKeys,
} from "./marcoCharts";
import {
  MarcoAulasCapacidad,
  MarcoAulasExcluidas,
  MarcoAulasHistograma,
  MarcoAulasSexo,
  marcoFrameRows,
} from "./marcoCards";
import "../../didactica/didactica.css";
import "./marco.css";

const WEIGHTED_KEYS = ["eligible_n", "elegibles", "n_elegibles", "students_n", "matriculados", "total"];

export function MarcoAulasTab({
  workspace,
  aulasState,
}: {
  workspace: CalcMuestraWorkspace;
  aulasState: CalcMuestraAulasState | null;
}) {
  const frame = aulasState?.frame ?? null;
  const config = normalizeUniversityAulasConfig(workspace.aulas_config);
  const minElegibles = Math.max(1, Math.round(config.min_elegibles_aula ?? 15));
  const { classroomRowsRaw, classroomRows } = marcoFrameRows(frame, workspace);
  const classroomN = Math.max(classroomRows.length, frameAuditNumber(frame, "classroom_included_n"));
  const eligibleTotal = sumRowsByKeys(classroomRows, WEIGHTED_KEYS);
  const averageEligible = classroomRows.length ? eligibleTotal / classroomRows.length : Number.NaN;
  const teacherCount = countDistinctByKeys(classroomRows, ["teacher", "docente", "profesor", "contacto"]);
  // Embudo medido del proyecto, con los pasos y el orden que entrega el backend.
  const embudoAula = embudoAulaDesdeFrame(frame);

  if (!classroomRowsRaw.length && !frameAuditNumber(frame, "classroom_n")) {
    return (
      <div className="cmv2-marco-stack">
        <EmptyState
          icon={<Grid3X3 size={20} />}
          title="El marco de cursos-horario aparece al construirlo"
          hint="Cuando la base esté leída, cada curso-horario se convierte en una unidad seleccionable con sus elegibles, docente y tamaño."
        />
      </div>
    );
  }

  return (
    <div className="cmv2-marco-stack">
      <section className="cmv2-panel cmv2-marco-aulas-head">
        <CifraFila>
          <CifraMotor
            label="Cursos-horario válidos"
            value={classroomN > 0 ? fmtInt(classroomN) : "pendiente"}
            detalle={classroomRowsRaw.length > classroomRows.length
              ? `de ${fmtInt(classroomRowsRaw.length)} detectados`
              : "curso-horario seleccionable"}
            origen={classroomN > 0 ? "motor" : undefined}
            hero
          />
          <CifraMotor
            label="Elegibles en cursos-horario"
            value={eligibleTotal > 0 ? fmtInt(eligibleTotal) : "pendiente"}
            detalle="suma de matriculados elegibles"
            origen={eligibleTotal > 0 ? "motor" : undefined}
          />
          <CifraMotor
            label="Promedio por curso-horario"
            value={Number.isFinite(averageEligible) ? fmtDec(averageEligible) : "pendiente"}
            detalle="elegibles esperados por curso-horario"
            origen={Number.isFinite(averageEligible) ? "motor" : undefined}
          />
          <CifraMotor
            label="Docentes o contactos"
            value={teacherCount > 0 ? fmtInt(teacherCount) : "pendiente"}
            detalle="para agenda y permisos"
            origen={teacherCount > 0 ? "motor" : undefined}
          />
        </CifraFila>
        {embudoAula && embudoAula.length >= 2 && (
          <div className="cmv2-marco-embudo-aula cmv2-marco-flujo-stagger">
            <FlujoVertical
              etapas={embudoEtapas(embudoAula, "cursos-horario")}
              orientacion={embudoAula.length >= 5 ? "adaptive" : "horizontal"}
              ariaLabel="Del total de cursos-horario al marco depurado por sus reglas de elegibilidad"
            />
          </div>
        )}
      </section>

      <MarcoAulasCapacidad frame={frame} workspace={workspace} />

      <div className="cmv2-dashboard-chart-grid">
        <ClassroomPlotCard
          title="Tamaño de los cursos-horario"
          subtitle={`elegibles por curso-horario, con bandas ${(config.grupos_tamano ?? []).map((g) => g.id).join("-") || "G1-G4"} y mínimo operativo`}
          wide
        >
          <MarcoAulasHistograma frame={frame} workspace={workspace} minElegibles={minElegibles} />
        </ClassroomPlotCard>
        <MarcoAulasSexo frame={frame} workspace={workspace} />
      </div>

      <MarcoAulasExcluidas frame={frame} workspace={workspace} minElegibles={minElegibles} />
    </div>
  );
}
