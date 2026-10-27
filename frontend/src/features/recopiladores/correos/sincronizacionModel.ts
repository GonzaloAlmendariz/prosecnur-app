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
  if (r.from_other_campaign) lineas.push(`${n(r.from_other_campaign)} ${uno(r.from_other_campaign, "respuesta llegó", "respuestas llegaron")} por un enlace que no es de esta campaña.`);
  if (r.without_token) lineas.push(`${n(r.without_token)} ${uno(r.without_token, "respuesta entró", "respuestas entraron")} sin enlace personal y no se ${uno(r.without_token, "puede", "pueden")} atribuir.`);
  return { titulo, lineas };
}

/**
 * «Actualizar quién respondió» se habilita con las conexiones, la encuesta y la
 * audiencia elegidas, salvo que la encuesta ya se sepa que no recibe la variable
 * de la campaña (`coincide === false`). Sin veredicto todavía no se bloquea: la
 * sincronización vuelve a revisar y dice la causa.
 */
export function puedeActualizar(p: {
  mailchimpListo: boolean;
  surveymonkeyConectado: boolean;
  encuesta: string;
  audiencia: string;
  coincide: boolean | null;
}): boolean {
  return p.mailchimpListo && p.surveymonkeyConectado && !!p.encuesta && !!p.audiencia && p.coincide !== false;
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

/**
 * Lo que hace que Gmail esconda un recordatorio tras «•••»: mismo asunto que la
 * invitación (lo junta en la conversación) o un cuerpo idéntico (sin apertura).
 */
export function avisosDeRecordatorio(asuntoRecordatorio: string, asuntoInvitacion: string, apertura: string | null | undefined): string[] {
  const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLocaleLowerCase("es-PE");
  const out: string[] = [];
  if (asuntoRecordatorio && norm(asuntoRecordatorio) === norm(asuntoInvitacion)) {
    out.push("El asunto es igual al de la invitación: Gmail juntará los dos correos y esconderá este. Cámbialo.");
  }
  if (!(apertura ?? "").trim()) {
    out.push("Sin apertura, el cuerpo es idéntico a la invitación y Gmail puede esconderlo tras «•••». Agrega una línea propia.");
  }
  return out;
}

/** Los pasos del recordatorio en Mailchimp, en el orden de su pantalla. */
export const PASOS_EN_MAILCHIMP = [
  "Pulsa «Actualizar quién respondió».",
  "En Mailchimp, abre el envío anterior y usa Replicate.",
  "Cambia el asunto por el de este recordatorio.",
  "En To, elige el segmento sin la etiqueta y envía con Send.",
] as const;
