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
  const columnsBySource = universityColumnOptionsBySource(workspace, aulasState);
  const columnasDe = (sourceRole: string | undefined | null) =>
    universitySourceGroupForRole(sourceRole) === "classroom"
      ? columnsBySource.classroom
      : columnsBySource.student;

  // 1 · Todo lo confirmado, incluidos roles fuera del catálogo conocido.
  for (const row of workspace.variable_mappings ?? []) {
    const column = row.column?.trim();
    if (!column) continue;
    out[rolDelMotor(row.role)] = [column];
  }

  // 2 · Las variables conocidas: sugerencia si no hay confirmada, y también si
  //     la confirmada ya NO existe entre las columnas de su fuente.
  //
  //     Ese segundo caso es real y estaba mudo: el proyecto HSVG2026 arrastraba
  //     un mapeo confirmado de una base anterior («Código PUCP») sobre archivos
  //     que traen ALUMNO. La pantalla lo daba por confirmado —6 de 6, en verde—
  //     y al reconstruir el motor moría con «No se encontro columna de
  //     estudiante». Es lo que le pasa a cualquiera que reemplace su base por
  //     una versión nueva con otros encabezados. Si no conocemos las columnas
  //     de esa fuente no se toca nada: sin evidencia no se descarta lo que el
  //     usuario declaró.
  for (const base of UNIVERSITY_REQUIRED_VARIABLES) {
    const rol = rolDelMotor(base.role);
    const confirmada = columnaConfirmada(workspace.variable_mappings, base.role);
    const columnas = columnasDe(base.source_role);
    const confirmadaExiste = !columnas.length || columnas.includes(confirmada);
    if (confirmada && confirmadaExiste) continue;
    if (!confirmada && out[rol]) continue;
    // La confirmada no existe: se retira del payload aunque no haya sugerencia.
    // Mandar una columna inexistente hace que el motor muera con un error
    // críptico; sin ella aplica su propia lectura de la base, que es lo que
    // hacía antes de que nadie la mapeara.
    if (confirmada && !confirmadaExiste) delete out[rol];
    const sugerida = inferUniversityColumn(base.role, columnas);
    if (sugerida) out[rol] = [sugerida];
  }

  return out;
}
