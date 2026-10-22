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

/** Lo que responden las rutas que corren como job: `{ok, job_id}`. */
export type InicioDeJob = { job_id: string };

export function normalizeInicioDeJob(raw: unknown): InicioDeJob {
  const r = isRecord(raw) ? raw : {};
  const job_id = str(r.job_id).trim();
  if (!job_id) throw new Error("El servidor no devolvió el trabajo en segundo plano. Reintenta.");
  return { job_id };
}

const postJson = (url: string, body: unknown) => apiFetch(url, {
  method: "POST",
  headers: headers({ "Content-Type": "application/json" }),
  body: JSON.stringify(body),
});

/** Arranca «Actualizar quién respondió» como job (1.2); el resultado se lee con `normalizeResultado`. */
export async function apiSincronizarRespuestas(input: {
  campaign_id: string | null;
  survey_id: string;
  list_id: string;
  tag: string;
  dry_run?: boolean;
}): Promise<InicioDeJob> {
  return normalizeInicioDeJob(await handle<unknown>(await postJson(BASE, input)));
}

// ---------- Cargar la audiencia (1.3) ----------

export type ResultadoDeAudiencia = {
  campaign_id: string;
  list_id: string;
  tag: string;
  recipients: number;
  created: number;
  updated: number;
  failed: number;
  /** Fallos por `error_code` de Mailchimp, de mayor a menor. Sin correos. */
  failed_by_reason: { code: string; n: number }[];
  tagged: number;
  merge_fields_created: string[];
  uploaded_at: string;
};

export function normalizeResultadoDeAudiencia(raw: unknown): ResultadoDeAudiencia {
  const r = isRecord(raw) ? raw : {};
  const motivos = isRecord(r.failed_by_reason) ? r.failed_by_reason : {};
  return {
    campaign_id: str(r.campaign_id),
    list_id: str(r.list_id),
    tag: str(r.tag),
    recipients: num(r.recipients),
    created: num(r.created),
    updated: num(r.updated),
    failed: num(r.failed),
    failed_by_reason: Object.entries(motivos)
      .map(([code, n]) => ({ code: code || "desconocido", n: num(n) }))
      .filter((m) => m.n > 0)
      .sort((a, b) => b.n - a.n || a.code.localeCompare(b.code)),
    tagged: num(r.tagged),
    // R entrega un vector de largo 1 como escalar y uno vacío como {}.
    merge_fields_created: (Array.isArray(r.merge_fields_created) ? r.merge_fields_created : typeof r.merge_fields_created === "string" ? [r.merge_fields_created] : [])
      .map(str).filter(Boolean),
    uploaded_at: str(r.uploaded_at),
  };
}

export async function apiCargarAudiencia(input: { campaign_id: string | null; list_id: string; tag?: string }): Promise<InicioDeJob> {
  const body = { campaign_id: input.campaign_id, list_id: input.list_id, ...(input.tag?.trim() ? { tag: input.tag.trim() } : {}) };
  return normalizeInicioDeJob(await handle<unknown>(await postJson(`${BASE}/audience`, body)));
}

// ---------- Crear el borrador (2.1) ----------

export type ResultadoDeBorrador = {
  mailchimp_campaign_id: string;
  web_id: string;
  /** Sólo `https://…admin.mailchimp.com/…`; cualquier otra cosa queda vacía. */
  edit_url: string;
  recipient_count: number | null;
  subject: string;
  title: string;
  images_uploaded: number;
};

const URL_DE_MAILCHIMP = /^https:\/\/[a-z0-9-]+\.admin\.mailchimp\.com\//i;

export function normalizeResultadoDeBorrador(raw: unknown): ResultadoDeBorrador {
  const r = isRecord(raw) ? raw : {};
  const edit = str(r.edit_url).trim();
  return {
    mailchimp_campaign_id: str(r.mailchimp_campaign_id),
    web_id: str(r.web_id),
    edit_url: URL_DE_MAILCHIMP.test(edit) ? edit : "",
    recipient_count: numOrNull(r.recipient_count),
    subject: str(r.subject),
    title: str(r.title),
    images_uploaded: num(r.images_uploaded),
  };
}

/** Crea la campaña como BORRADOR (síncrono). No hay ruta que envíe ni programe. */
export async function apiCrearBorrador(input: {
  campaign_id: string | null;
  send_id: string;
  list_id: string;
  from_name: string;
  reply_to: string;
  tag?: string;
  exclude_tag?: string;
}): Promise<ResultadoDeBorrador> {
  const opcional = (k: "tag" | "exclude_tag") => (input[k]?.trim() ? { [k]: input[k]?.trim() } : {});
  const body = {
    campaign_id: input.campaign_id,
    send_id: input.send_id,
    list_id: input.list_id,
    from_name: input.from_name.trim(),
    reply_to: input.reply_to.trim(),
    ...opcional("tag"),
    ...opcional("exclude_tag"),
  };
  return normalizeResultadoDeBorrador(await handle<unknown>(await postJson(`${BASE}/campaign`, body)));
}
