// Búsqueda sobre el catálogo de encuestas SurveyMonkey del analista.
//
// Lo comparten la importación (`ImportSurveyMonkeyDialog`) y la declaración de
// una campaña complementaria (`CampanaComplementariaPanel`): las dos eligen una
// encuesta del mismo catálogo y aceptan un ID o el enlace que se copia de
// SurveyMonkey.

import type { SurveyMonkeyListItem } from "../../../api/multiIntegrado";

export function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function smSurveyTitle(item: SurveyMonkeyListItem): string {
  return item.nickname || item.title || item.id;
}

export function smSurveyMatchesQuery(item: SurveyMonkeyListItem, query: string): boolean {
  const tokens = normalizeSearch(query).split(" ").filter(Boolean);
  if (!tokens.length) return true;
  const haystack = normalizeSearch([item.id, item.title, item.nickname ?? ""].join(" "));
  return tokens.every((token) => haystack.includes(token));
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** «2026-10-12T…» → «12 oct 2026». Sin Intl: el resultado no depende del ICU. */
export function smFechaCorta(iso: string | null | undefined): string {
  const m = (iso ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  const mes = MESES[Number(m[2]) - 1];
  if (!mes) return "";
  return `${Number(m[3])} ${mes} ${m[1]}`;
}

function miles(n: number): string {
  // es-PE agrupa miles con coma («1,234»); a mano para no depender del ICU.
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function conteo(n: number, singular: string, plural: string): string {
  return `${miles(n)} ${n === 1 ? singular : plural}`;
}

/**
 * Lo que distingue dos encuestas hermanas en el buscador: respuestas,
 * preguntas y fecha de modificación (U5). Un conteo que el catálogo no trae
 * se omite; no se muestra como cero.
 */
export function smSurveyMetaParts(item: SurveyMonkeyListItem): string[] {
  const partes: string[] = [];
  if (typeof item.response_count === "number") {
    partes.push(conteo(item.response_count, "respuesta", "respuestas"));
  }
  if (typeof item.question_count === "number") {
    partes.push(conteo(item.question_count, "pregunta", "preguntas"));
  }
  const fecha = smFechaCorta(item.date_modified);
  if (fecha) partes.push(`modificada ${fecha}`);
  return partes;
}

export type IdEncuestaLeido =
  | { ok: true; id: string }
  | { ok: false; motivo: "vacio" | "enlace_sin_id" };

/**
 * Lee el ID de SurveyMonkey de lo que pegó el analista: el número tal cual o un
 * enlace de la encuesta (`/analyze/123456789`, `/design/123456789`, …).
 */
export function leerIdEncuesta(entrada: string): IdEncuestaLeido {
  const limpio = entrada.trim();
  if (!limpio) return { ok: false, motivo: "vacio" };
  const enEnlace = limpio.match(/surveymonkey\.com\/[^/]+\/(\d{6,12})(?:[?/#]|$)/i);
  if (enEnlace) return { ok: true, id: enEnlace[1] };
  if (/^https?:\/\//i.test(limpio)) return { ok: false, motivo: "enlace_sin_id" };
  return { ok: true, id: limpio };
}
