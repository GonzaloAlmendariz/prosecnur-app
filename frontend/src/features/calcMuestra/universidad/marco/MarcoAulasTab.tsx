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
import { CifraFila, CifraMotor, FlujoVertical, TerminoChip } from "../ui";
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
  // Embudo canónico del marco de aula (total → presencial → tipo → ≥N → docente
  // → nivel → marco) cuando el frame lo trae del backend.
  const embudoAula = embudoAulaDesdeFrame(frame);

  if (!classroomRowsRaw.length && !frameAuditNumber(frame, "classroom_n")) {
    return (
      <div className="cmv2-marco-stack">
        <EmptyState
          icon={<Grid3X3 size={20} />}
          title="El marco de aulas aparece al construirlo"
          hint="Cuando la base esté leída, cada curso-horario se convierte en un aula seleccionable con sus elegibles, docente y tamaño."
        />
      </div>
    );
  }

  return (
    <div className="cmv2-marco-stack">
      <section className="cmv2-panel cmv2-marco-aulas-head">
        <p className="cmv2-marco-intro">
          La unidad que se sortea no es el estudiante sino el{" "}
          <TerminoChip termino="curso-horario">curso-horario</TerminoChip>: cada aula agrupa a sus
          matriculados y aporta un tamaño esperado. Aquí se audita cuántas aulas quedan seleccionables
          y con qué capacidad.
        </p>
        <CifraFila>
          <CifraMotor
            label="Aulas válidas"
            value={classroomN > 0 ? fmtInt(classroomN) : "pendiente"}
            detalle={classroomRowsRaw.length > classroomRows.length
              ? `de ${fmtInt(classroomRowsRaw.length)} detectadas`
              : "curso-horario seleccionable"}
            origen={classroomN > 0 ? "motor" : undefined}
            hero
          />
          <CifraMotor
            label="Elegibles en aulas"
            value={eligibleTotal > 0 ? fmtInt(eligibleTotal) : "pendiente"}
            detalle="suma de matriculados elegibles"
            origen={eligibleTotal > 0 ? "motor" : undefined}
          />
          <CifraMotor
            label="Promedio por aula"
            value={Number.isFinite(averageEligible) ? fmtDec(averageEligible) : "pendiente"}
            detalle="elegibles esperados por aula"
            origen={Number.isFinite(averageEligible) ? "motor" : undefined}
          />
          <CifraMotor
            label="Docentes o contactos"
            value={teacherCount > 0 ? fmtInt(teacherCount) : "pendiente"}
            detalle="para agenda y permisos"
            origen={teacherCount > 0 ? "motor" : undefined}
          />
        </CifraFila>
        {embudoAula && embudoAula.length >= 3 && (
          <div className="cmv2-marco-embudo-aula cmv2-marco-flujo-stagger">
            <FlujoVertical
              etapas={embudoEtapas(embudoAula, "aulas")}
              orientacion="horizontal"
              ariaLabel="Del total de curso-horario al marco depurado por las reglas de aula"
            />
          </div>
        )}
      </section>

      <MarcoAulasCapacidad frame={frame} workspace={workspace} />

      <div className="cmv2-dashboard-chart-grid">
        <ClassroomPlotCard
          title="Tamaño de aulas"
          subtitle={`elegibles por aula, con bandas ${(config.grupos_tamano ?? []).map((g) => g.id).join("-") || "G1-G4"} y mínimo por aula`}
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
