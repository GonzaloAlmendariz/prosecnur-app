const FIELD_LABELS: Record<string, string> = {
  operational_code: "Código de ficha",
  titular_operational_code: "Código titular",
  replacement_chain_code: "Cadena de reemplazo",
  operational_sequence: "Secuencia operativa",
  selection_slot_id: "Posición de muestra",
  sample_role: "Rol de muestra",
  sample_status: "Estado de muestra",
  wave: "Ola",
  replacement_order: "Orden en la cadena",
  orden: "Orden",
  classroom_id: "ID de curso-horario",
  label: "Curso-horario",
  course_id: "ID de curso",
  course_name: "Curso",
  section: "Sección",
  schedule: "Horario",
  teacher: "Docente",
  teacher_email: "Correo docente",
  faculty: "Facultad",
  program: "Carrera",
  level: "Nivel",
  stratum: "Estrato",
  eligible_n: "Estudiantes elegibles",
  expected_valid: "Válidas esperadas",
  link: "Enlace Kobo",
  qr: "Código QR",
  word_link: "Ficha Word",
  pdf_link: "Ficha PDF",
  package_label: "Etiqueta de ficha",
  package_status: "Estado de ficha",
  collector_id: "Origen",
  responsible: "Responsable",
  operational_status: "Estado operativo",
  replacement_for: "Reemplaza a",
  replacement_reason: "Motivo de reemplazo",
  replacement_note: "Nota de reemplazo",
  equivalence_level: "Nivel de equivalencia",
  chain_score: "Puntaje de cadena",
  chain_depth: "Profundidad de cadena",
  activation_weight_status: "Estado de ponderación",
  analysis_weight_warning: "Advertencia de ponderación",
  updated_at: "Actualizado",
  responses_total: "Respuestas totales",
  respuestas_validas: "Respuestas válidas",
  filter_passed: "Filtros aprobados",
  filter_rejected: "Filtros rechazados",
  brecha: "Brecha",
  application_state: "Estado de aplicación",
  aulas: "Cursos-horario",
  aulas_aplicadas: "Cursos-horario aplicados",
  avance_aulas_pct: "Avance de cursos-horario",
  avance_respuestas_pct: "Avance de respuestas",
  sex: "Sexo",
  target: "Meta",
  frame_n: "Universo",
  source: "Fuente",
  observed: "Observadas",
  missing: "Faltantes",
  progress_pct: "Avance",
  check: "Control",
  status: "Estado",
  detail: "Detalle",
  campo: "Campo",
  valor: "Valor",
  corrida: "Corrida",
  marco: "Marco",
  anonimas: "Respuestas anónimas",
  generado: "Generado",
};

const CHECK_LABELS: Record<string, string> = {
  anonymous_responses: "Respuestas anónimas",
  student_id_required: "Identificador estudiantil no requerido",
  unmapped_valid_responses: "Respuestas válidas sin curso-horario",
  // `duplicate_collectors` se retiró: en un estudio de aulas el mismo QR lo
  // escanean todos los alumnos, así que el colector se repite por diseño y ese
  // aviso saltaba siempre. Lo anómalo es la misma respuesta dos veces.
  duplicate_responses: "Respuestas repetidas",
  // El Excel no comprueba que asistentes − rechazos − duplicados cuadre con las
  // efectivas; la app sí.
  field_report_reconciliation: "Cuadre del parte de campo",
  // El lector no adivina qué es una columna sin nombre —sería peor—, pero sí
  // dice cuántas se quedaron fuera.
  unnamed_control_columns: "Columnas sin nombre en la Base de control",
  effective_representativity: "Representatividad efectiva",
  sex_faculty_quota: "Cuota por sexo y facultad",
  // Qué se está contando como respuesta válida. Se resolvía en silencio, y
  // contar TODO o filtrar por una columna equivocada dan números muy distintos.
  valid_response_criterion: "Criterio de respuesta válida",
};

const STATUS_LABELS: Record<string, string> = {
  ok: "Correcto",
  review: "Revisar",
  warning: "Advertencia",
  planificada: "Planificada",
  contactada: "Contactada",
  agendada: "Agendada",
  en_campo: "En campo",
  aplicada: "Aplicada",
  parcial: "Parcial",
  sin_acceso: "Sin acceso",
  cancelada: "Cancelada",
  reemplazo_pendiente: "Reemplazo pendiente",
  reemplazada: "Reemplazada",
  cerrada: "Cerrada",
  cerrando: "Cierre en curso",
  en_aplicacion: "En aplicación",
  lista: "Lista",
  pendiente: "Pendiente",
  cumplida: "Cumplida",
  en_riesgo: "En riesgo",
  sin_meta: "Sin meta",
  titular: "Titular",
  chain_reserve: "Reserva encadenada",
  extra_reserve_pool: "Reserva adicional",
  pdf_preparado: "PDF preparado",
  listo_para_pdf: "Listo para PDF",
  pendiente_enlace: "Falta enlace",
  plan_sex_top: "Plan por sexo",
  calc_muestra_faculty_sex: "Cálculo de muestra",
};

function normalizedKey(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function fallbackLabel(value: string) {
  const label = value.replaceAll("_", " ").trim();
  return label ? `${label.charAt(0).toUpperCase()}${label.slice(1)}` : value;
}

function presentDetail(value: unknown) {
  return String(value ?? "")
    .replaceAll("aula/collector/link", "curso-horario, origen y enlace")
    .replaceAll("Score efectivo", "Puntaje efectivo")
    .replace(/\bsexo\s+x\s+facultad\b/gi, "sexo por facultad");
}

export function aulasFieldLabel(field: string) {
  return FIELD_LABELS[field] ?? fallbackLabel(field);
}

export function aulasCheckLabel(check: unknown) {
  const key = normalizedKey(check);
  return CHECK_LABELS[key] ?? fallbackLabel(String(check ?? ""));
}

export function aulasStatusLabel(status: unknown) {
  const key = normalizedKey(status);
  return STATUS_LABELS[key] ?? (key ? fallbackLabel(String(status)) : "Por revisar");
}

function presentValue(field: string, value: unknown) {
  if (value == null) return "";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (field === "check") return aulasCheckLabel(value);
  if (field === "detail") return presentDetail(value);
  if (field === "campo") return aulasFieldLabel(String(value));
  if (
    field === "status"
    || field.endsWith("_status")
    || field.endsWith("_state")
    || field === "sample_role"
    || field === "source"
  ) {
    return aulasStatusLabel(value);
  }
  if (field === "link") return String(value).trim() ? "Guardado" : "";
  return value;
}

export function presentAulasRow(row: Readonly<Record<string, unknown>>) {
  return Object.fromEntries(
    Object.entries(row).map(([field, value]) => [field, presentValue(field, value)]),
  );
}

export function summarizeAulasValidation(rows: Array<Record<string, unknown>>) {
  if (!rows.length) return { label: "Sin controles disponibles", count: 0 };
  const count = rows.filter((row) => normalizedKey(row.status) !== "ok").length;
  if (!count) return { label: "Sin alertas", count: 0 };
  return { label: `${count} ${count === 1 ? "alerta" : "alertas"}`, count };
}
