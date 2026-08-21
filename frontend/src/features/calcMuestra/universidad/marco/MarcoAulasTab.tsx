/**
 * Pestaña "Cursos-horario" de Marco. Un solo bloque narrativo encabeza la
 * lectura: KPIs con procedencia del motor + embudo medido del proyecto. Debajo,
 * el histograma de tamaños se dibuja SOBRE los grupos que el usuario define
 * (grupos_tamano, persistidos en workspace.aulas_config), y la composición por
 * sexo por curso-horario con selector de facultad, orden y scroll.
 */
import { useMemo } from "react";
import { Grid3X3 } from "lucide-react";
import { EmptyState } from "../../../../components/States";
import {
  normalizeCalcMuestraAulasParticularidades,
  type CalcMuestraAulasState,
  type CalcMuestraWorkspace,
  type CalcMuestraWorkspaceAulasConfig,
  type CalcMuestraWorkspaceAulasSizeGroup,
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
  MarcoAulasHistograma,
  marcoFrameRows,
} from "./marcoCards";
import { CursosHorarioSexo } from "./CursosHorarioSexo";
import { GruposTamanoEditor } from "./GruposTamanoEditor";
import { ParticularidadesPanel } from "./ParticularidadesPanel";
import { normalizeParticularidadesDecisiones } from "./particularidadesModel";
import "../../didactica/didactica.css";
import "./marco.css";

const WEIGHTED_KEYS = ["eligible_n", "elegibles", "n_elegibles", "students_n", "matriculados", "total"];

export function MarcoAulasTab({
  workspace,
  aulasState,
  onWorkspace,
}: {
  workspace: CalcMuestraWorkspace;
  aulasState: CalcMuestraAulasState | null;
  onWorkspace: (workspace: CalcMuestraWorkspace) => void;
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
  // Particularidades detectadas (contrato calc_muestra_aulas_particularidades_v1):
  // tolerante a ausencia — marcos viejos sin el campo se comportan como hoy y el
  // panel muestra su estado vacío honesto.
  const particularidades = useMemo(
    () => normalizeCalcMuestraAulasParticularidades(frame?.particularidades ?? null),
    [frame?.particularidades],
  );
  const particularidadesDecisiones = useMemo(
    () => normalizeParticularidadesDecisiones(config.particularidades_decisiones),
    [config.particularidades_decisiones],
  );

  function updateConfig(patch: Partial<CalcMuestraWorkspaceAulasConfig>) {
    onWorkspace({
      ...workspace,
      aulas_config: normalizeUniversityAulasConfig({ ...config, ...patch }),
    });
  }

  function setSizeGroups(groups: CalcMuestraWorkspaceAulasSizeGroup[]) {
    updateConfig({ grupos_tamano: groups });
  }

  function setUseSizeGroups(value: boolean) {
    const base = ["faculty", "sex_top_1"];
    updateConfig({
      usar_grupos_tamano: value,
      estratos_selector: value ? [...base, "size_group"] : base,
    });
  }

  if (!classroomRowsRaw.length && !frameAuditNumber(frame, "classroom_n")) {
    return (
      <div
        className="cmv2-marco-stack"
        // También el vacío: es el estado en que un usuario nuevo encuentra
        // esta pestaña, y declarar sólo la rama con datos la deja fuera del
        // gate justo cuando más se ve.
        data-qa-geometry-group="calc-muestra/marco-aulas"
        data-qa-geometry-contract="intrinsic"
        data-qa-geometry-member
      >
        <EmptyState
          icon={<Grid3X3 size={20} />}
          title="El marco de cursos-horario aparece al construirlo"
          hint="Cuando la base esté leída, cada curso-horario se convierte en una unidad seleccionable con sus elegibles, docente y tamaño."
        />
      </div>
    );
  }

  return (
    <div
      className="cmv2-marco-stack"
      // Declarada para que el gate visual pueda auditarla: sin esto devolvía
      // «ok=true» sin haber mirado la pestaña.
      data-qa-geometry-group="calc-muestra/marco-aulas"
      data-qa-geometry-contract="intrinsic"
    >
      <section className="cmv2-panel cmv2-marco-aulas-head" data-qa-geometry-member>
        <div className="cmv2-marco-aulas-lead">
          <span className="cmv2-eyebrow">Marco de cursos-horario</span>
          <strong>De la matrícula elegible a las unidades que se pueden seleccionar</strong>
        </div>
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

      <ParticularidadesPanel
        particularidades={particularidades}
        decisiones={particularidadesDecisiones}
        onDecisiones={(next) => updateConfig({ particularidades_decisiones: next })}
      />

      <div className="cmv2-dashboard-chart-grid">
        <ClassroomPlotCard
          title="Tamaño de los cursos-horario"
          subtitle={`elegibles por curso-horario, con bandas ${(config.grupos_tamano ?? []).map((g) => g.id).join("-") || "G1-G4"} y mínimo operativo`}
          wide
        >
          <GruposTamanoEditor
            groups={config.grupos_tamano ?? []}
            enabled={config.usar_grupos_tamano}
            onGroupsChange={setSizeGroups}
            onEnabledChange={setUseSizeGroups}
          />
          <MarcoAulasHistograma frame={frame} workspace={workspace} minElegibles={minElegibles} />
        </ClassroomPlotCard>
      </div>

      <CursosHorarioSexo frame={frame} workspace={workspace} />
    </div>
  );
}
