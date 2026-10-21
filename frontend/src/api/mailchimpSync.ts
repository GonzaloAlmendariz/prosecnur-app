// «Actualizar quién respondió» (Material de campo › Correos › Envíos).
// SurveyMonkey dice quién completó la encuesta (variable `t`); el backend lo
// cruza con los destinatarios de la campaña y pone una etiqueta en la audiencia
// de Mailchimp. Ninguna respuesta trae correos: solo conteos.

import { apiFetch, handle, headers } from "./core";

export type OpcionesDeSincronizacion = {
  surveymonkey: { connected: boolean; error: boolean; surveys: { id: string; title: string; response_count: number | null }[] };
  mailchimp: { connected: boolean; masked: string; error: boolean; audiences: { id: string; name: string; member_count: number | null }[] };
};

export type ResultadoDeSincronizacion = {
  recipients: number;
  recipients_with_token: number;
  responses: number;
  completed: number;
  partial: number;
  without_token: number;
  from_other_campaign: number;
  respondents: number;
  pending: number;
  tagged: number;
  not_in_audience: number;
  tag: string;
  dry_run: boolean;
  synced_at: string;
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const numOrNull = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

export function normalizeOpciones(raw: unknown): OpcionesDeSincronizacion {
  const r = isRecord(raw) ? raw : {};
  const sm = isRecord(r.surveymonkey) ? r.surveymonkey : {};
  const mc = isRecord(r.mailchimp) ? r.mailchimp : {};
  return {
    surveymonkey: {
      connected: sm.connected === true,
      error: sm.error === true,
      surveys: list(sm.surveys).filter(isRecord).map((s) => ({ id: str(s.id), title: str(s.title), response_count: numOrNull(s.response_count) }))
        .filter((s) => s.id),
    },
    mailchimp: {
      connected: mc.connected === true,
      masked: str(mc.masked),
      error: mc.error === true,
      audiences: list(mc.audiences).filter(isRecord).map((a) => ({ id: str(a.id), name: str(a.name), member_count: numOrNull(a.member_count) }))
        .filter((a) => a.id),
    },
  };
}

export function normalizeResultado(raw: unknown): ResultadoDeSincronizacion {
  const r = isRecord(raw) ? raw : {};
  return {
    recipients: num(r.recipients),
    recipients_with_token: num(r.recipients_with_token),
    responses: num(r.responses),
    completed: num(r.completed),
    partial: num(r.partial),
    without_token: num(r.without_token),
    from_other_campaign: num(r.from_other_campaign),
    respondents: num(r.respondents),
    pending: num(r.pending),
    tagged: num(r.tagged),
    not_in_audience: num(r.not_in_audience),
    tag: str(r.tag) || "Respondió",
    dry_run: r.dry_run === true,
    synced_at: str(r.synced_at),
  };
}

const BASE = "/api/recopiladores/mail-sync";

export async function apiOpcionesDeSincronizacion(): Promise<OpcionesDeSincronizacion> {
  return normalizeOpciones(await handle<unknown>(await apiFetch(`${BASE}/options`, { headers: headers() })));
}

export async function apiSincronizarRespuestas(input: {
  campaign_id: string | null;
  survey_id: string;
  list_id: string;
  tag: string;
  dry_run?: boolean;
}): Promise<ResultadoDeSincronizacion> {
  const res = await apiFetch(BASE, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  return normalizeResultado(await handle<unknown>(res));
}
