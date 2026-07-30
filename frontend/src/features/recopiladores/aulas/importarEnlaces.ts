// Parser del pegado manual de enlaces.
//
// El operador pega un bloque copiado de una hoja de cálculo ajena, y ahí no se
// puede exigir formato: el separador puede ser tab, punto y coma o coma, la
// cabecera puede venir o no, y las columnas pueden estar en cualquier orden con
// cualquiera de varios nombres.
//
// Reglas que sostienen el parser:
//  - Sin cabecera, la primera columna es la clave y el primer valor que parezca
//    URL es el enlace. Es la única heurística posible y se aplica solo ahí.
//  - Con cabecera, NADA se adivina por posición: una columna que no se nombró se
//    queda vacía. Adivinar sobre una cabecera presente es cómo un `qr` termina
//    en el campo `pdf`.
//  - Una fila sin clave, o con clave pero sin ningún enlace, se cuenta como
//    ignorada y se reporta. Descartarla en silencio deja al operador creyendo
//    que pegó 300 filas cuando entraron 280.

import type { MonitoreoAulasPlanRow } from "../../../api/client";
import { isUrl, normalizeHeader, normalizeText } from "./texto";
import { rowMatchKeys } from "./filas";

export type ManualLinkRecord = {
  key: string;
  surveyLink: string;
  qr: string;
  word: string;
  pdf: string;
  sample: string;
};

export type LinkParseResult = {
  records: ManualLinkRecord[];
  ignored: number;
};

export const LINK_IMPORT_EXAMPLE = [
  "cursohorario\tenlace\tqr\tword\tpdf",
  "MAT146-0205\thttps://encuesta/aula/MAT146-0205\thttps://drive/qr\thttps://drive/word\thttps://drive/pdf",
].join("\n");

export function splitImportLine(line: string) {
  if (line.includes("\t")) return line.split("\t");
  if (line.includes(";")) return line.split(";");
  return line.split(",");
}

export function headerIndex(headers: string[], names: string[]) {
  return headers.findIndex((header) => names.includes(header));
}

export function parseLinkClipboard(input: string): LinkParseResult {
  const lines = input.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return { records: [], ignored: 0 };
  const first = splitImportLine(lines[0]).map(normalizeHeader);
  const hasHeader = first.some((cell) => [
    "documentid",
    "id",
    "cursohorario",
    "qrlink",
    "wordlink",
    "pdflink",
    "url",
    "acortador",
  ].includes(cell));
  const headers = hasHeader ? first : [];
  const rows = hasHeader ? lines.slice(1) : lines;
  const keyIndex = hasHeader ? headerIndex(headers, ["documentid", "id", "idmatch", "cursohorario", "classroomid", "aulacodigo"]) : 0;
  const urlIndex = hasHeader ? headerIndex(headers, ["url", "acortador", "link", "enlace", "surveylink"]) : -1;
  const qrIndex = hasHeader ? headerIndex(headers, ["qrlink", "qr", "qrcode", "enlaceqr"]) : -1;
  const wordIndex = hasHeader ? headerIndex(headers, ["wordlink", "word", "docx", "fichaword"]) : -1;
  const pdfIndex = hasHeader ? headerIndex(headers, ["pdflink", "pdf", "fichapdf"]) : -1;
  const sampleIndex = hasHeader ? headerIndex(headers, ["muestra", "sample", "seleccion"]) : -1;
  const records: ManualLinkRecord[] = [];
  let ignored = 0;
  rows.forEach((line) => {
    const cells = splitImportLine(line).map((cell) => cell.trim());
    const key = normalizeText(cells[keyIndex >= 0 ? keyIndex : 0]);
    const urls = cells.filter(isUrl);
    const surveyLink = normalizeText(urlIndex >= 0 ? cells[urlIndex] : hasHeader ? "" : urls[0]);
    const qr = normalizeText(qrIndex >= 0 ? cells[qrIndex] : "");
    const word = normalizeText(wordIndex >= 0 ? cells[wordIndex] : "");
    const pdf = normalizeText(pdfIndex >= 0 ? cells[pdfIndex] : "");
    const sample = normalizeText(sampleIndex >= 0 ? cells[sampleIndex] : "");
    if (!key || (!surveyLink && !qr && !word && !pdf)) {
      ignored += 1;
      return;
    }
    records.push({ key, surveyLink, qr, word, pdf, sample });
  });
  return { records, ignored };
}

/**
 * Superpone lo pegado sobre la agenda. Lo pegado gana campo por campo, pero solo
 * donde trae valor: una celda vacía no borra el enlace que la fila ya tenía.
 */
export function applyManualLinks(
  rows: MonitoreoAulasPlanRow[],
  links: Map<string, ManualLinkRecord>,
) {
  if (!links.size) return rows;
  return rows.map((row) => {
    const match = rowMatchKeys(row).map((key) => links.get(key)).find(Boolean);
    if (!match) return row;
    return {
      ...row,
      link: match.surveyLink || row.link,
      qr: match.qr || row.qr,
      collector_id: match.sample || row.collector_id,
      word_link: match.word || row.word_link,
      pdf_link: match.pdf || row.pdf_link,
      manual_link_source: match.sample || row.manual_link_source || "pegado",
    };
  });
}
