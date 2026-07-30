// El manifiesto de entrega: qué recibe Monitoreo cuando Recopiladores cierra.
//
// Es la traza de qué unidad recibió qué acceso. Se emite en dos formas que deben
// decir lo mismo: un TSV que el operador puede pegar en una hoja, y un update
// parcial de la agenda que viaja por la API.
//
// `qr_estado` distingue importado de generado localmente porque son
// procedencias distintas: un QR importado vino de un proveedor y uno generado
// se armó acá. Colapsarlos perdería la única pista de dónde salió el acceso.

import type { MonitoreoAulasPlanRow } from "../../../api/client";
import { normalizeText, sourceRowText } from "./texto";
import { classroomLabel, packageLabel, rowFaculty, rowLink, sampleLabel, savedQrSrc } from "./filas";

export const RETURN_MANIFEST_HEADERS = [
  "curso_horario",
  "facultad",
  "carrera",
  "curso",
  "horario",
  "docente",
  "muestra",
  "enlace_aplicacion",
  "qr_estado",
  "word_link",
  "pdf_link",
  "fuente_enlace",
];

/** El TSV se rompe con tabs y saltos dentro de una celda. */
export function returnManifestCell(value: unknown) {
  return normalizeText(value).replace(/[\t\r\n]+/g, " ");
}

export function returnManifestRecord(row: MonitoreoAulasPlanRow) {
  const link = rowLink(row);
  return {
    curso_horario: classroomLabel(row),
    facultad: rowFaculty(row),
    carrera: normalizeText(row.program),
    curso: normalizeText(row.course_name),
    horario: normalizeText(row.schedule),
    docente: normalizeText(row.teacher),
    muestra: sampleLabel(row),
    enlace_aplicacion: link,
    qr_estado: savedQrSrc(row) ? "qr importado" : link ? "qr generado localmente" : "sin enlace",
    word_link: normalizeText(row.word_link),
    pdf_link: normalizeText(row.pdf_link),
    fuente_enlace: sourceRowText(row as Record<string, unknown>, ["manual_link_source", "collector_id"]) || (link ? "agenda" : ""),
  };
}

export function returnManifestTsv(rows: MonitoreoAulasPlanRow[]) {
  const body = rows.map((row) => {
    const record = returnManifestRecord(row);
    return RETURN_MANIFEST_HEADERS.map((header) => returnManifestCell(record[header as keyof typeof record])).join("\t");
  });
  return [RETURN_MANIFEST_HEADERS.join("\t"), ...body].join("\n");
}

export function returnAgendaUpdate(
  row: MonitoreoAulasPlanRow,
  packageStatus?: string,
): Partial<MonitoreoAulasPlanRow> {
  return {
    classroom_id: normalizeText(row.classroom_id),
    operational_code: normalizeText(row.operational_code),
    link: rowLink(row),
    qr: savedQrSrc(row),
    word_link: normalizeText(row.word_link),
    pdf_link: normalizeText(row.pdf_link),
    package_label: packageLabel(row),
    package_status: packageStatus || (rowLink(row) ? "listo_para_pdf" : "pendiente_enlace"),
    collector_id: sourceRowText(row as Record<string, unknown>, ["collector_id", "manual_link_source"]),
    responsible: normalizeText(row.responsible),
  };
}
