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
import {
  UNIVERSITY_FALLBACK_COLUMN_OPTIONS,
  UNIVERSITY_REQUIRED_VARIABLES,
} from "../shared/constants";
import {
  inferUniversityColumn,
  isUniversityUserFacingColumnName,
  universityColumnOptions,
  universityInspectedColumnOptions,
  universityObservedCategoryRows,
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

const GRUPOS: Array<{ id: string; titulo: string; roles: string[] }> = [
  { id: "identidad", titulo: "Identidad", roles: ["student_id"] },
  { id: "estratificacion", titulo: "Estratificación", roles: ["faculty", "sex", "program", "level", "formation", "age"] },
  { id: "aula", titulo: "Unidad curso-horario", roles: ["course_id", "schedule", "course_schedule_id", "classroom", "modality", "session_type", "course_level", "enrolled_total"] },
  { id: "operativo", titulo: "Operativo", roles: ["teacher", "teacher_type", "campus", "condition", "course_name"] },
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

  const detectedColumns = universityColumnOptions(workspace, aulasState).filter(isUniversityUserFacingColumnName);
  const inspectedColumns = universityInspectedColumnOptions(workspace);
  const suggestionColumns = inspectedColumns.length ? inspectedColumns : detectedColumns;
  const mappedColumns = (workspace.variable_mappings ?? [])
    .map((row) => row.column ?? "")
    .filter((column) => Boolean(column) && isUniversityUserFacingColumnName(column));
  const columns = Array.from(new Set([
    ...(suggestionColumns.length ? suggestionColumns : UNIVERSITY_FALLBACK_COLUMN_OPTIONS),
    ...mappedColumns,
  ])).sort((a, b) => a.localeCompare(b, "es"));

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

  function suggestionFor(role: string) {
    return inferUniversityColumn(role, suggestionColumns);
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

      {GRUPOS.map((grupo) => {
        const bases = grupo.roles.flatMap((role) => {
          const base = BASE_BY_ROLE.get(role);
          return base ? [base] : [];
        });
        if (!bases.length) return null;
        return (
          <div key={grupo.id} className="cmv2-defi-var-group">
            <div className="cmv2-defi-var-group-head">
              <span className="cmv2-eyebrow">{grupo.titulo}</span>
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
                    columns={columns}
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

      {!detectedColumns.length && (
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
