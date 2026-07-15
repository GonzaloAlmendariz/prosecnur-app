/**
 * Pestaña "Variables" de Definición: mapeo MANUAL de las columnas de la base a
 * los roles que necesita el motor (§3.3.1). La detección automática solo
 * SUGIERE; nada queda "listo" hasta que el usuario confirma cada campo. El
 * estado durable vive en workspace.variable_mappings (confirmar = escribir la
 * columna, quitar = borrar la entrada). Las tarjetas diferencian variables
 * categóricas (categorías reales del marco) de numéricas (rango) — §3.3.2.
 */
import { useEffect, useRef, useState } from "react";
import { Database, ListChecks } from "lucide-react";
import { EmptyState } from "../../../../components/States";
import type {
  CalcMuestraAulasState,
  CalcMuestraWorkspace,
  CalcMuestraWorkspaceVariableMapping,
} from "../../../../api/client";
import { fmtInt, rowsFrom } from "../../sharedCore";
import { UNIVERSITY_REQUIRED_VARIABLES } from "../shared/constants";
import {
  inferUniversityColumn,
  universityColumnOptionsBySource,
  universityObservedCategoryRows,
  universityRoleColumnOptions,
  universitySourceGroupForRole,
  type UniversityObservedCategory,
} from "../shared/categorias";
import {
  isUniversityRoleConfirmed,
  universityConfirmedColumn,
  universityNumericColumnSummary,
  universityRoleValueType,
  upsertUniversityVariableMapping,
} from "./variableRoles";
import { VariableMapCard } from "./VariableMapCard";
import "./definicion.css";

/**
 * Separación por HOJA (§ADR 0035 fase 3): las tarjetas de rol se agrupan en dos
 * secciones sin overlap — arriba el estudiante (hoja de matrícula, source_role
 * base_madre), abajo el curso-horario (hoja de catálogo, source_role
 * catalogo_curso_horario). Cada rol cae en su sección por su `source_role`; el
 * orden dentro de cada sección respeta UNIVERSITY_REQUIRED_VARIABLES.
 */
type DefVariablesSourceGroup = "student" | "classroom";

const SECCIONES: Array<{ id: string; titulo: string; descripcion: string; group: DefVariablesSourceGroup }> = [
  {
    id: "estudiante",
    titulo: "Variables del estudiante",
    descripcion: "Columnas de la hoja de matrícula (una fila por estudiante).",
    group: "student",
  },
  {
    id: "curso_horario",
    titulo: "Variables del curso-horario",
    descripcion: "Columnas de la hoja de catálogo de cursos y horarios.",
    group: "classroom",
  },
];

/** Ampliación del "por qué" para los roles donde la description corta no basta. */
const MOTIVO_MOTOR: Record<string, string> = {
  faculty: "Con esta columna la calculadora arma los estratos por facultad y reparte las cuotas de la muestra en proporción al peso real de cada una en la población.",
  sex: "Es el control de cuota: la muestra final debe conservar la composición por sexo de la población, y el cierre estadístico se cuadra por celda facultad × sexo.",
  course_id: "Junto con el horario forma la unidad de selección: el curso-horario que se sortea y se visita en campo.",
  schedule: "Junto con el curso identifica cada curso-horario seleccionable y permite balancear turnos y planificar la visita en campo.",
  course_schedule_id: "Si la base ya trae un código único de curso-horario (por ejemplo NRC), la calculadora lo usa directamente como unidad de selección sin reconstruirlo.",
};

const BASE_BY_ROLE = new Map(UNIVERSITY_REQUIRED_VARIABLES.map((base) => [base.role, base]));

export function DefVariablesTab({
  workspace,
  aulasState,
  onWorkspace,
}: {
  workspace: CalcMuestraWorkspace;
  aulasState: CalcMuestraAulasState | null;
  onWorkspace: (workspace: CalcMuestraWorkspace) => void;
}) {
  // Borrador local por rol: columna elegida en el select pero AÚN no confirmada.
  // No se persiste; la verdad durable es workspace.variable_mappings.
  const [draft, setDraft] = useState<Record<string, string>>({});
  // Micro-confirmación: pulso success de 300ms en la tarjeta recién confirmada
  // (solo visual; el estado real vive en variable_mappings).
  const [flashRole, setFlashRole] = useState<string | null>(null);
  const flashTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(flashTimer.current), []);

  function flash(role: string) {
    window.clearTimeout(flashTimer.current);
    setFlashRole(role);
    flashTimer.current = window.setTimeout(() => setFlashRole(null), 340);
  }

  // Columnas CRUDAS por hoja: cada rol ofrece SOLO su fuente (§3.3.1). Un rol de
  // curso-horario no debe ver columnas de estudiante ni al revés.
  const columnasPorFuente = universityColumnOptionsBySource(workspace, aulasState);
  const hasAnyColumns = columnasPorFuente.student.length > 0 || columnasPorFuente.classroom.length > 0;

  const frame = aulasState?.frame ?? null;
  const hasFrame = Boolean(frame);
  const populationRows = rowsFrom<Record<string, unknown>>(frame?.population);
  const classroomRows = rowsFrom<Record<string, unknown>>(frame?.aula_frame);

  const observedByRole = universityObservedCategoryRows(workspace, aulasState)
    .reduce<Map<string, UniversityObservedCategory[]>>((acc, row) => {
      const list = acc.get(row.role) ?? [];
      list.push(row);
      acc.set(row.role, list);
      return acc;
    }, new Map());

  const requiredRoles = UNIVERSITY_REQUIRED_VARIABLES.filter((base) => base.required).map((base) => base.role);
  const confirmedRequired = requiredRoles.filter((role) => isUniversityRoleConfirmed(workspace.variable_mappings, role));

  function columnsForRoleSource(sourceRole: string | undefined | null) {
    return universitySourceGroupForRole(sourceRole) === "classroom"
      ? columnasPorFuente.classroom
      : columnasPorFuente.student;
  }

  function suggestionFor(role: string) {
    const base = BASE_BY_ROLE.get(role);
    return inferUniversityColumn(role, columnsForRoleSource(base?.source_role));
  }

  function columnasDeRol(base: CalcMuestraWorkspaceVariableMapping) {
    return universityRoleColumnOptions(
      columnasPorFuente,
      base.source_role,
      universityConfirmedColumn(workspace.variable_mappings, base.role),
    );
  }

  function selectValueFor(role: string) {
    if (role in draft) return draft[role];
    const confirmed = universityConfirmedColumn(workspace.variable_mappings, role);
    return confirmed || suggestionFor(role);
  }

  function persistMapping(base: CalcMuestraWorkspaceVariableMapping, column: string) {
    onWorkspace({
      ...workspace,
      variable_mappings: upsertUniversityVariableMapping(workspace.variable_mappings, base, column),
    });
  }

  function handleConfirm(base: CalcMuestraWorkspaceVariableMapping) {
    persistMapping(base, selectValueFor(base.role));
    flash(base.role);
    setDraft((current) => {
      const next = { ...current };
      delete next[base.role];
      return next;
    });
  }

  function handleClear(base: CalcMuestraWorkspaceVariableMapping) {
    persistMapping(base, "");
    setDraft((current) => ({ ...current, [base.role]: "" }));
  }

  function confirmAllSuggestions() {
    let next: CalcMuestraWorkspaceVariableMapping[] = workspace.variable_mappings ?? [];
    for (const base of UNIVERSITY_REQUIRED_VARIABLES) {
      if (isUniversityRoleConfirmed(next, base.role)) continue;
      const suggested = suggestionFor(base.role);
      if (!suggested) continue;
      next = upsertUniversityVariableMapping(next, base, suggested);
    }
    onWorkspace({ ...workspace, variable_mappings: next });
    setDraft({});
  }

  const pendingSuggestions = UNIVERSITY_REQUIRED_VARIABLES.filter((base) =>
    !isUniversityRoleConfirmed(workspace.variable_mappings, base.role) && Boolean(suggestionFor(base.role))
  ).length;

  return (
    <section className="cmv2-panel cmv2-university-variable-map">
      <header className="cmv2-defi-var-head">
        <div className="cmv2-defi-var-head-copy">
          <span className="cmv2-eyebrow">Mapeo manual de columnas</span>
          <p>Confirma qué columna de tu base cumple cada rol. Las sugerencias son solo un punto de partida: nada queda listo hasta que lo confirmas.</p>
        </div>
        <div className="cmv2-defi-var-head-actions">
          <span className="cmv2-pill-soft" data-ok={confirmedRequired.length === requiredRoles.length || undefined}>
            {fmtInt(confirmedRequired.length)} de {fmtInt(requiredRoles.length)} requeridas confirmadas
          </span>
          {pendingSuggestions > 0 && (
            <button type="button" className="cmv2-defi-var-confirm-all" onClick={confirmAllSuggestions}>
              <ListChecks size={14} />
              Confirmar {fmtInt(pendingSuggestions)} sugerencia{pendingSuggestions === 1 ? "" : "s"}
            </button>
          )}
        </div>
      </header>

      {SECCIONES.map((seccion) => {
        const bases = UNIVERSITY_REQUIRED_VARIABLES.filter(
          (base) => universitySourceGroupForRole(base.source_role) === seccion.group,
        );
        if (!bases.length) return null;
        return (
          <div key={seccion.id} className="cmv2-defi-var-group" data-sheet={seccion.group}>
            <div className="cmv2-defi-var-group-head">
              <span className="cmv2-eyebrow">{seccion.titulo}</span>
              <p className="cmv2-defi-var-group-hint">{seccion.descripcion}</p>
            </div>
            <div className="cmv2-defi-var-grid cmv2-uni-stagger">
              {bases.map((base) => {
                const valueType = universityRoleValueType(base.role);
                const selectValue = selectValueFor(base.role);
                const numericRows = base.role === "enrolled_total" ? classroomRows : populationRows;
                const numeric = valueType === "numerica"
                  ? universityNumericColumnSummary(numericRows, selectValue)
                  : null;
                return (
                  <VariableMapCard
                    key={base.role}
                    base={base}
                    valueType={valueType}
                    columns={columnasDeRol(base)}
                    suggested={suggestionFor(base.role)}
                    confirmedColumn={universityConfirmedColumn(workspace.variable_mappings, base.role)}
                    selectValue={selectValue}
                    motivoExtra={MOTIVO_MOTOR[base.role]}
                    categories={observedByRole.get(base.role) ?? []}
                    numeric={numeric}
                    hasFrame={hasFrame}
                    flash={flashRole === base.role}
                    onSelect={(value) => setDraft((current) => ({ ...current, [base.role]: value }))}
                    onConfirm={() => handleConfirm(base)}
                    onClear={() => handleClear(base)}
                  />
                );
              })}
            </div>
          </div>
        );
      })}

      {!hasAnyColumns && (
        <EmptyState
          variant="inline"
          icon={<Database size={18} />}
          title="Sin columnas detectadas todavía"
          hint="Cuando cargues o construyas el marco en Bases, estas tarjetas propondrán columnas para que las confirmes. Mientras tanto puedes dejar preparado qué datos espera el estudio."
        />
      )}
    </section>
  );
}
