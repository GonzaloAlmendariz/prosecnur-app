// De dónde sale la agenda de cursos-horario, y cómo se agrupa para el paquete.
//
// Hay dos orígenes y no son intercambiables:
//  - `monitorAgendaFromState` — el plan que Monitoreo ya gobierna. Manda cuando
//    existe, porque ahí ya hay estado de campo (reemplazos, aplicadas).
//  - `calcSelectionAgenda` — la selección cruda de Cálculo de muestra. Es el
//    origen cuando Monitoreo todavía no tomó el plan.
//
// La normalización de `calcSelectionAgenda` es el corazón del adapter `aulas_v1`:
// convierte una fila del motor muestral en una fila de agenda operativa, leyendo
// cada campo por lista de alias porque el motor evolucionó sus nombres.

import type {
  CalcMuestraState,
  MonitoreoAulasDashboard,
  MonitoreoAulasPlanRow,
  MonitoreoState,
} from "../../../api/client";
import { normalizeText, sourceRowNumber, sourceRowText } from "./texto";
import { hasQr, packageLabel, rowFaculty, rowLink } from "./filas";

export function dashboardFromState(state: MonitoreoState | null): MonitoreoAulasDashboard | null {
  return state?.dashboard?.aulas_universitarias_reports ?? null;
}

export function monitorAgendaFromState(state: MonitoreoState | null) {
  const dashboard = dashboardFromState(state);
  if (dashboard?.agenda?.length) return dashboard.agenda;
  return state?.config?.aulas_universitarias?.plan ?? [];
}

/**
 * Selección del motor muestral → filas de agenda.
 *
 * `operational_status` se fija en "pendiente" a propósito: una selección recién
 * hecha no tiene estado de campo, y heredar cualquier otra cosa afirmaría un
 * avance que no ocurrió.
 */
export function calcSelectionAgenda(calcState: CalcMuestraState | null): MonitoreoAulasPlanRow[] {
  const selection = calcState?.aulas?.selection;
  const rows = (selection?.selection ?? []) as Array<Record<string, unknown>>;
  return rows.map((row, index) => {
    const wave = sourceRowText(row, ["wave", "muestra", "sample_wave"]) || "M1";
    const role = sourceRowText(row, ["sample_role", "rol_muestra"]) || (wave === "M1" ? "titular" : "chain_reserve");
    const classroomId = sourceRowText(row, ["classroom_id", "curso_horario", "course_schedule_id", "id_match", "id"]);
    return {
      selection_run_id: selection?.selection_run_id ?? "",
      operational_code: sourceRowText(row, ["operational_code", "codigo_operativo", "selection_slot_id"]) || classroomId,
      titular_operational_code: sourceRowText(row, ["titular_operational_code"]),
      replacement_chain_code: sourceRowText(row, ["replacement_chain_code"]),
      operational_sequence: sourceRowNumber(row, ["operational_sequence", "orden"], index + 1),
      selection_slot_id: sourceRowText(row, ["selection_slot_id"]),
      sample_role: role,
      wave,
      replacement_order: sourceRowNumber(row, ["replacement_order"], 0),
      orden: sourceRowNumber(row, ["orden", "rank"], index + 1),
      classroom_id: classroomId || `aula-${index + 1}`,
      label: sourceRowText(row, ["label", "classroom_label", "sesiones_y_aula", "aula", "section"]),
      course_id: sourceRowText(row, ["course_id", "curso_id", "curso"]),
      course_name: sourceRowText(row, ["course_name", "nombre_del_curso", "nombre_curso"]),
      section: sourceRowText(row, ["section", "seccion"]),
      schedule: sourceRowText(row, ["schedule", "horario"]),
      teacher: sourceRowText(row, ["teacher", "docente", "nombre_de_docente"]),
      teacher_email: sourceRowText(row, ["teacher_email", "correo_docente"]),
      faculty: sourceRowText(row, ["faculty", "facultad", "stratum"]),
      program: sourceRowText(row, ["program", "programa", "carrera"]),
      level: sourceRowText(row, ["level", "nivel", "ciclo"]),
      stratum: sourceRowText(row, ["stratum", "faculty", "facultad"]),
      eligible_n: sourceRowNumber(row, ["eligible_n", "matriculados_poblacion", "students_n"]),
      expected_valid: sourceRowNumber(row, ["expected_valid", "validos_esperados"], 0),
      link: sourceRowText(row, ["link", "url", "acortador", "enlace", "survey_link"]),
      qr: sourceRowText(row, ["qr", "qr_url", "qr_link"]),
      cursohorario: classroomId || sourceRowText(row, ["cursohorario", "curso_horario", "course_schedule_id", "id_match"]),
      pabellon_aula: sourceRowText(row, ["pabellon_aula", "pabellon", "aula", "salon", "room", "building_room", "venue", "label"]),
      collector_id: sourceRowText(row, ["collector_id", "recopilador_id"]),
      responsible: sourceRowText(row, ["responsible", "responsable"]),
      operational_status: "pendiente",
      replacement_for: sourceRowText(row, ["replacement_for"]),
      replacement_reason: sourceRowText(row, ["replacement_reason"]),
      replacement_note: sourceRowText(row, ["replacement_note"]),
      updated_at: selection?.generated_at ?? "",
    };
  });
}

export function facultyOptions(rows: MonitoreoAulasPlanRow[]) {
  return Array.from(new Set(rows.map(rowFaculty))).sort((a, b) => a.localeCompare(b, "es"));
}

export type PackageOutputGroup = {
  label: string;
  total: number;
  linked: number;
  missing: number;
  qr: number;
  word: number;
  pdf: number;
  students: number;
  ready: boolean;
};

/**
 * Agrupa por bloque de reparto, que es la unidad con la que el campo trabaja: un
 * paquete se imprime y se entrega completo. `ready` exige `total > 0` para no
 * declarar listo un grupo vacío.
 */
export function buildPackageOutputGroups(rows: MonitoreoAulasPlanRow[]): PackageOutputGroup[] {
  const groups = new Map<string, PackageOutputGroup>();
  rows.forEach((row) => {
    const label = packageLabel(row) || "Selección";
    const current = groups.get(label) ?? {
      label,
      total: 0,
      linked: 0,
      missing: 0,
      qr: 0,
      word: 0,
      pdf: 0,
      students: 0,
      ready: false,
    };
    const linked = Boolean(rowLink(row));
    current.total += 1;
    current.linked += linked ? 1 : 0;
    current.missing += linked ? 0 : 1;
    current.qr += hasQr(row) ? 1 : 0;
    current.word += normalizeText(row.word_link) ? 1 : 0;
    current.pdf += normalizeText(row.pdf_link) ? 1 : 0;
    const n = Number(row.eligible_n);
    current.students += Number.isFinite(n) ? n : 0;
    groups.set(label, current);
  });
  return Array.from(groups.values())
    .map((group) => ({ ...group, ready: group.total > 0 && group.missing === 0 }))
    .sort((a, b) => a.label.localeCompare(b.label, "es", { numeric: true }) || b.total - a.total);
}
