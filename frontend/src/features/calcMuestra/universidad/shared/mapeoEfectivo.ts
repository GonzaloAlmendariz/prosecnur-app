/**
 * El mapeo que de verdad viaja al motor al construir el marco.
 *
 * Nace de un defecto medido en el recorrido de un usuario nuevo (HSVG2026, dos
 * bases reales): la pestaña Variables muestra en cada select la columna
 * CONFIRMADA o, si no hay, la SUGERIDA (`selectValueFor` en DefVariablesTab),
 * pero al construir solo viajaba lo confirmado a mano. Con un usuario que se
 * fía de lo que ve —todo aparecía asignado— el payload salía con
 * `mapping: {}`, el motor R inferia por su cuenta con su propio matcher difuso
 * y la identidad del aula colapsaba a la franja horaria: **847 cursos-horario
 * en vez de 5.269**, anunciado con lenguaje de éxito.
 *
 * La regla que impone este módulo: **lo que la pantalla muestra es lo que se
 * usa**. Una sola definición del mapeo para las dos superficies; si mañana
 * cambia la sugerencia, cambia en las dos a la vez.
 */
import type {
  CalcMuestraAulasState,
  CalcMuestraWorkspace,
  CalcMuestraWorkspaceVariableMapping,
} from "../../../../api/client";
import {
  inferUniversityColumn,
  universityColumnOptionsBySource,
  universitySourceGroupForRole,
} from "./categorias";
import { UNIVERSITY_REQUIRED_VARIABLES } from "./constants";

/** Vocabulario del motor: algunos roles de la UI se llaman distinto en R. */
function rolDelMotor(role: string): string {
  if (role === "course_schedule_id") return "classroom_id";
  if (role === "classroom") return "classroom_label";
  if (role === "eligible") return "condition";
  return role;
}

function columnaConfirmada(
  mappings: CalcMuestraWorkspaceVariableMapping[] | undefined,
  role: string,
): string {
  for (const row of mappings ?? []) {
    if (row.role !== role) continue;
    const column = row.column?.trim();
    if (column) return column;
  }
  return "";
}

/** Una variable declarada contra una columna que su archivo ya no tiene. */
export type UniversityOrphanMapping = {
  role: string;
  label: string;
  column: string;
  source_role: string;
};

/**
 * Variables cuya columna confirmada YA NO existe entre las columnas de su
 * fuente.
 *
 * Es el estado que dejó mudo al proyecto HSVG2026: mapeo declarado contra una
 * base anterior («Código PUCP») sobre archivos que traen ALUMNO, la pantalla
 * mostrando «6 de 6 requeridas confirmadas» en verde y el motor muriendo al
 * reconstruir. Se intentó resolverlo sustituyendo la columna por la sugerida y
 * el remedio fue peor: cambiaba los números del estudio (21.920 → 2.461
 * estudiantes elegibles) sin avisar. Lo que corresponde es declararlo y que
 * decida quien conoce el estudio.
 *
 * Sin columnas conocidas para esa fuente no se acusa a nadie: un binding recién
 * declarado todavía no trae diagnósticos de hoja.
 */
export function universityOrphanMappings(
  workspace: CalcMuestraWorkspace,
  aulasState: CalcMuestraAulasState | null,
): UniversityOrphanMapping[] {
  const columnsBySource = universityColumnOptionsBySource(workspace, aulasState);
  const out: UniversityOrphanMapping[] = [];
  for (const base of UNIVERSITY_REQUIRED_VARIABLES) {
    const column = columnaConfirmada(workspace.variable_mappings, base.role);
    if (!column) continue;
    const columnas = universitySourceGroupForRole(base.source_role) === "classroom"
      ? columnsBySource.classroom
      : columnsBySource.student;
    if (!columnas.length) continue;
    if (columnas.includes(column)) continue;
    out.push({ role: base.role, label: base.label, column, source_role: base.source_role ?? "" });
  }
  return out;
}

/**
 * `{ rol_del_motor: [columna] }` con la columna confirmada por el usuario o, en
 * su defecto, la misma sugerencia que la pantalla ya está mostrando.
 *
 * Los mapeos confirmados que no pertenezcan al catálogo de variables conocidas
 * (roles propios de un estudio) se conservan tal cual: esto completa, nunca
 * recorta.
 */
export function universityEffectiveMappingPayload(
  workspace: CalcMuestraWorkspace,
  aulasState: CalcMuestraAulasState | null,
): Record<string, string[]> {
  const out: Record<string, string[]> = {};

  // 1 · Todo lo confirmado, incluidos roles fuera del catálogo conocido.
  for (const row of workspace.variable_mappings ?? []) {
    const column = row.column?.trim();
    if (!column) continue;
    out[rolDelMotor(row.role)] = [column];
  }

  // 2 · Para las variables conocidas sin confirmar, la sugerencia visible.
  const columnsBySource = universityColumnOptionsBySource(workspace, aulasState);
  for (const base of UNIVERSITY_REQUIRED_VARIABLES) {
    const rol = rolDelMotor(base.role);
    if (out[rol]) continue;
    if (columnaConfirmada(workspace.variable_mappings, base.role)) continue;
    const columnas = universitySourceGroupForRole(base.source_role) === "classroom"
      ? columnsBySource.classroom
      : columnsBySource.student;
    const sugerida = inferUniversityColumn(base.role, columnas);
    if (sugerida) out[rol] = [sugerida];
  }

  return out;
}
