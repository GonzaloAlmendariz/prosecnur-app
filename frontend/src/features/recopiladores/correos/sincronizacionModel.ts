// Lo que dice la tarjeta de «Actualizar quién respondió»: una frase principal y
// solo las líneas que traen algo. Sin correos: el backend devuelve conteos.

import type { ResultadoDeSincronizacion } from "../../../api/mailchimpSync";

const n = (v: number) => v.toLocaleString("es-PE");
const personas = (v: number) => `${n(v)} ${v === 1 ? "persona" : "personas"}`;

export function resumenDeSincronizacion(r: ResultadoDeSincronizacion): { titulo: string; lineas: string[] } {
  const titulo = `${n(r.respondents)} de ${n(r.recipients_with_token)} ya respondieron; faltan ${n(r.pending)}.`;
  const lineas: string[] = [];
  const uno = (v: number, a: string, b: string) => (v === 1 ? a : b);
  if (!r.dry_run && r.respondents > 0) {
    lineas.push(r.tagged === r.respondents
      ? `En Mailchimp quedaron con la etiqueta «${r.tag}».`
      : `${personas(r.tagged)} ${uno(r.tagged, "quedó", "quedaron")} con la etiqueta «${r.tag}» en Mailchimp.`);
  }
  if (r.not_in_audience) lineas.push(`${personas(r.not_in_audience)} ${uno(r.not_in_audience, "no está", "no están")} en esa audiencia de Mailchimp: ${uno(r.not_in_audience, "no se pudo", "no se pudieron")} etiquetar.`);
  if (r.partial) lineas.push(`${personas(r.partial)} ${uno(r.partial, "dejó la encuesta a medias: sigue", "dejaron la encuesta a medias: siguen")} recibiendo recordatorios.`);
  if (r.from_other_campaign) lineas.push(`${n(r.from_other_campaign)} ${uno(r.from_other_campaign, "respuesta trae", "respuestas traen")} un token que no es de esta campaña.`);
  if (r.without_token) lineas.push(`${n(r.without_token)} ${uno(r.without_token, "respuesta entró", "respuestas entraron")} sin token y no se ${uno(r.without_token, "puede", "pueden")} atribuir.`);
  return { titulo, lineas };
}

/** La condición del segmento que hay que elegir en Mailchimp, dicha como allá. */
export function segmentoEnMailchimp(tag: string): string {
  return `Tags › contact is not tagged › ${tag}`;
}

// Lo último elegido por campaña, en este equipo: comodidad, no estado del proyecto.
const CLAVE = (campana: string) => `pulso.correos.sincronizacion.${campana}`;
export type EleccionRecordada = { survey_id: string; list_id: string; tag: string };

export function leerEleccion(campana: string | null): EleccionRecordada | null {
  if (!campana) return null;
  try {
    const raw = localStorage.getItem(CLAVE(campana));
    const v: unknown = raw ? JSON.parse(raw) : null;
    if (typeof v !== "object" || v === null) return null;
    const o = v as Record<string, unknown>;
    return { survey_id: String(o.survey_id ?? ""), list_id: String(o.list_id ?? ""), tag: String(o.tag ?? "") };
  } catch {
    return null;
  }
}

export function guardarEleccion(campana: string | null, e: EleccionRecordada): void {
  if (!campana) return;
  try {
    localStorage.setItem(CLAVE(campana), JSON.stringify(e));
  } catch {
    // Sin almacenamiento: se vuelve a elegir la próxima vez.
  }
}
