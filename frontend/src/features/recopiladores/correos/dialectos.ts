// =============================================================================
// dialectos.ts — qué etiqueta lleva cada campo en cada plataforma (E1j)
// =============================================================================
// Una campaña sale para Mailchimp o para SurveyMonkey. La plantilla es la
// misma: cambia cómo se escribe cada `{{campo}}` en el HTML. Mailchimp usa la
// etiqueta del campo (`*|CARRERA|*`); SurveyMonkey sólo conoce su propio
// vocabulario (`[FirstName]`, `[SurveyLink]`, `[LastName]`, `[CustomDataN]`), y
// la correspondencia de cada campo se guarda en `fields[].sm`.
//
// El HTML real lo escribe siempre el render del backend; esto alimenta la
// tabla del pie, el menú de campos y el modo didáctico.

import type { MailField, MailPlatform, MailTemplate } from "../../../api/materialMail";
import { CAMPO_NOMBRE } from "./modeloCorreo";
import { NOMBRE_DE_PLATAFORMA, type Dialecto } from "./comoSaleEnLaPlataforma";

export { NOMBRE_DE_PLATAFORMA };

/** `[CustomData1]` a `[CustomData50]`; fuera de Team/Enterprise el tope real es 6. */
export const MAX_CUSTOM_DATA = 50;
export const CUSTOM_DATA_SIN_ENTERPRISE = 6;

const PATRON_SM = /^(SurveyLink|LastName|CustomData([1-9]|[1-4][0-9]|50))$/;

/** Las etiquetas de SurveyMonkey que un campo puede tomar, en el orden del selector. */
export function opcionesSurveyMonkey(): string[] {
  return ["SurveyLink", "LastName", ...Array.from({ length: MAX_CUSTOM_DATA }, (_, i) => `CustomData${i + 1}`)];
}

export function esEtiquetaSurveyMonkey(valor: string): boolean {
  return PATRON_SM.test(valor);
}

/**
 * ¿Por qué ese campo no puede tomar esa etiqueta? `[SurveyLink]` es el enlace
 * de cada persona a la encuesta: un campo cuyo destino es `otro` (un enlace
 * fijo) no puede ir ahí.
 */
export function motivoSinEtiqueta(field: Pick<MailField, "destino">, sm: string): string | null {
  if (sm !== "SurveyLink") return null;
  if (field.destino === "otro") return "Este enlace no lleva a la encuesta: [SurveyLink] es el enlace de cada persona.";
  if (field.destino !== "encuesta") return "Primero di si este enlace es la encuesta.";
  return null;
}

/** Campos que se usan como enlace (en un botón, una imagen, una firma o un `[texto](url)`). */
export function camposDeEnlace(template: Pick<MailTemplate, "fields" | "blocks">): string[] {
  const urls: string[] = [];
  for (const b of template.blocks) {
    const r = b as Record<string, unknown>;
    if (typeof r.url === "string") urls.push(r.url);
    for (const v of Object.values(r)) {
      const textos = Array.isArray(v) ? v : [v];
      for (const t of textos) if (typeof t === "string") for (const m of t.matchAll(/\]\(([^)]*)\)/g)) urls.push(m[1]);
    }
  }
  return template.fields.filter((f) => urls.some((u) => u.includes(`{{${f.key}}}`))).map((f) => f.key);
}

/** El campo con su destino declarado; si deja de ser la encuesta, pierde [SurveyLink]. */
export function conDestino(template: MailTemplate, key: string, destino: "encuesta" | "otro"): MailTemplate {
  return {
    ...template,
    fields: template.fields.map((f) => {
      if (f.key !== key) return f;
      const next = { ...f, destino };
      if (destino === "otro" && next.sm === "SurveyLink") delete next.sm;
      return next;
    }),
  };
}

/** La etiqueta de un campo en la plataforma; `null` si en SurveyMonkey no tiene correspondencia. */
export function etiquetaDeCampo(field: Pick<MailField, "key" | "tag" | "sm">, dialecto: Dialecto): string | null {
  if (field.key === CAMPO_NOMBRE) return dialecto === "surveymonkey" ? "[FirstName]" : "*|FNAME|*";
  if (dialecto === "mailchimp") return `*|${field.tag || field.key.toUpperCase()}|*`;
  return field.sm && esEtiquetaSurveyMonkey(field.sm) ? `[${field.sm}]` : null;
}

export type EtiquetaDePlataforma = { key: string; app: string; plataforma: string | null };

/** `{{campo}}` → etiqueta, empezando por el nombre (que no se declara en `fields`). */
export function etiquetasDePlataforma(template: Pick<MailTemplate, "fields">, dialecto: Dialecto): EtiquetaDePlataforma[] {
  return [
    { key: CAMPO_NOMBRE, app: `{{${CAMPO_NOMBRE}}}`, plataforma: dialecto === "surveymonkey" ? "[FirstName]" : "*|FNAME|*" },
    ...template.fields.map((f) => ({ key: f.key, app: `{{${f.key}}}`, plataforma: etiquetaDeCampo(f, dialecto) })),
  ];
}

/**
 * Una etiqueta de SurveyMonkey libre para un campo nuevo: el enlace va a
 * `[SurveyLink]` si nadie lo usa; el resto, al primer `CustomDataN` libre.
 */
export function smSugerido(template: Pick<MailTemplate, "fields">, key: string): string | null {
  const usados = new Set(template.fields.flatMap((f) => (f.key !== key && f.sm ? [f.sm] : [])));
  const field = template.fields.find((f) => f.key === key);
  // [SurveyLink] sólo para un enlace DECLARADO como la encuesta: con el destino
  // sin declarar no se adivina por el nombre del campo.
  if (field?.destino === "encuesta" && !usados.has("SurveyLink")) return "SurveyLink";
  for (let i = 1; i <= MAX_CUSTOM_DATA; i += 1) {
    if (!usados.has(`CustomData${i}`)) return `CustomData${i}`;
  }
  return null;
}

/** El campo con su etiqueta de SurveyMonkey; `null` la quita. */
export function conEtiquetaSurveyMonkey(template: MailTemplate, key: string, sm: string | null): MailTemplate {
  return {
    ...template,
    fields: template.fields.map((f) => {
      if (f.key !== key) return f;
      const { sm: _previo, ...resto } = f;
      void _previo;
      return sm && esEtiquetaSurveyMonkey(sm) ? { ...resto, sm } : resto;
    }),
  };
}

/** Por qué la correspondencia no sirve, o `null`: dos campos no comparten etiqueta. */
export function problemaDeEtiquetas(template: Pick<MailTemplate, "fields">): Record<string, string> {
  const out: Record<string, string> = {};
  // La etiqueta ya tomada se dice con el rótulo del campo que la tiene, sin llaves (#5 del re-QA e10-2).
  const vistos = new Map<string, string>();
  for (const f of template.fields) {
    if (!f.sm) continue;
    const previo = vistos.get(f.sm);
    const motivo = f.destino === "otro" ? motivoSinEtiqueta(f, f.sm) : null;
    if (motivo) out[f.key] = motivo;
    else if (previo) out[f.key] = `[${f.sm}] ya es de «${previo}».`;
    else vistos.set(f.sm, f.label.trim() || f.key);
    const n = f.sm.match(/^CustomData(\d+)$/);
    if (!out[f.key] && n && Number(n[1]) > CUSTOM_DATA_SIN_ENTERPRISE) {
      out[f.key] = `Fuera de los planes Team y Enterprise, SurveyMonkey sólo llega a [CustomData${CUSTOM_DATA_SIN_ENTERPRISE}].`;
    }
  }
  return out;
}

/** Qué hace cada plataforma con la audiencia y la salida, en una línea. */
export const RESUMEN_DE_PLATAFORMA: Record<MailPlatform, string> = {
  mailchimp: "Se importa como plantilla; la audiencia va aparte, en CSV.",
  surveymonkey: "Se pega como HTML personalizado; los contactos viven en el recopilador.",
};
