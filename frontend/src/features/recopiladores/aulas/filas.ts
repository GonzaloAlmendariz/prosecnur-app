// Cómo se lee una fila de agenda de aulas: identidad, etiquetas y claves de
// matching. Es el vocabulario del adapter `aulas_v1`.
//
// El orden de los fallbacks NO es cosmético. `classroomLabel` prefiere el código
// operativo sobre el `classroom_id` porque el primero es la identidad que el
// campo usa e imprime, y el segundo puede ser un id interno de la selección.
// Cambiar ese orden cambia lo que dice la ficha impresa.

import type { MonitoreoAulasPlanRow } from "../../../api/client";
import { fmt, normalizeText, normalizeMatchKey, sourceRowText } from "./texto";

export function classroomLabel(row: MonitoreoAulasPlanRow) {
  return normalizeText(row.operational_code) ||
    normalizeText(row.titular_operational_code) ||
    normalizeText(row.classroom_id) ||
    normalizeText(row.label) ||
    `Curso-horario ${fmt(row.orden)}`;
}

export function rowFaculty(row: MonitoreoAulasPlanRow) {
  return normalizeText(row.faculty) || "Sin facultad";
}

/** Clave de React. Incluye el índice porque dos reservas pueden coincidir en código y ola. */
export function rowKey(row: MonitoreoAulasPlanRow, index: number) {
  return `${classroomLabel(row)}-${normalizeText(row.wave)}-${index}`;
}

/**
 * Todas las formas con las que una celda pegada puede nombrar a esta fila. El
 * pegado manual llega de hojas de cálculo ajenas, así que se ofrece curso+horario
 * y curso+sección además de los códigos propios.
 */
export function rowMatchKeys(row: MonitoreoAulasPlanRow) {
  return [
    classroomLabel(row),
    row.classroom_id,
    row.operational_code,
    row.selection_slot_id,
    row.course_id && row.schedule ? `${row.course_id}-${row.schedule}` : "",
    row.course_id && row.section ? `${row.course_id}-${row.section}` : "",
  ].map(normalizeMatchKey).filter(Boolean);
}

export function rowLink(row: MonitoreoAulasPlanRow) {
  return normalizeText(row.link);
}

/**
 * Solo un QR que ya existe como recurso: una URL o un data-URL. Un texto
 * cualquiera en `row.qr` no es un QR y no debe llegar a un `<img>`.
 *
 * El data-URL sigue aceptándose porque hay proyectos que lo tienen persistido,
 * pero el ADR 0046 §13 manda dejar de producirlo: el QR autoritativo pasa al
 * backend R y el generador del front queda solo para preview.
 */
export function savedQrSrc(row: MonitoreoAulasPlanRow) {
  const saved = normalizeText(row.qr);
  if (/^(https?:|data:image)/i.test(saved)) return saved;
  return "";
}

/** Hay QR si está guardado o si hay enlace del cual generarlo localmente. */
export function hasQr(row: MonitoreoAulasPlanRow) {
  return Boolean(savedQrSrc(row) || rowLink(row));
}

export function roleLabel(row: MonitoreoAulasPlanRow) {
  const role = normalizeText(row.sample_role);
  if (role === "titular" || normalizeText(row.wave) === "M1") return "Titular";
  if (role === "chain_reserve") return `Reserva ${normalizeText(row.wave) || ""}`.trim();
  if (role === "extra_reserve_pool") return "Reserva adicional";
  return normalizeText(row.wave) || "Curso-horario";
}

export function sampleLabel(row: MonitoreoAulasPlanRow) {
  return normalizeText(row.wave) ||
    sourceRowText(row as Record<string, unknown>, ["muestra", "sample", "selection_label"]) ||
    "Selección";
}

export function packageLabel(row: MonitoreoAulasPlanRow) {
  return sourceRowText(row as Record<string, unknown>, ["package_label", "selection_label", "seleccion", "muestra"]) ||
    sampleLabel(row);
}

export function fichaId(row: MonitoreoAulasPlanRow) {
  return sourceRowText(row as Record<string, unknown>, ["cursohorario", "curso_horario", "course_schedule_id", "id_match"]) ||
    classroomLabel(row);
}

export function fichaVenue(row: MonitoreoAulasPlanRow) {
  return sourceRowText(row as Record<string, unknown>, [
    "pabellon_aula",
    "pabellon",
    "aula",
    "salon",
    "room",
    "building_room",
    "venue",
    "label",
    "section",
  ]) || "Por confirmar";
}

export function statusLabel(row: MonitoreoAulasPlanRow) {
  const status = normalizeText(row.operational_status);
  const labels: Record<string, string> = {
    agendada: "Agendada",
    aplicada: "Aplicada",
    parcial: "Parcial",
    pendiente: "Pendiente",
    sin_acceso: "Sin acceso",
    cancelada: "Cancelada",
    reemplazo_pendiente: "Reemplazo pendiente",
    reemplazada: "Reemplazada",
    cerrada: "Cerrada",
  };
  return labels[status] ?? (status || "Pendiente");
}
