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
