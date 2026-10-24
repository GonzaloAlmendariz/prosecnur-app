// =============================================================================
// materialMailMisSecciones.ts — «Mis secciones» del correo (GOAL editor
// profesional, L9; ADR 0113: viven en el estudio, en el `.pulso`)
// =============================================================================
//   GET    mail-sections          las del estudio
//   POST   mail-sections          guarda una copia de un bloque (sin id ni `guardado`)
//   POST   mail-sections/delete   la borra (los correos que la usan no cambian)
// Toda escritura exige `expected_revision` (la revisión global del estado).

import { apiFetch, headers } from "./core";
import { handleMail, normalizeMailBlock, type MailBlock } from "./materialMail";

const BASE = "/api/recopiladores";

/** Descripción y URL pública de una foto de la sección (las de `template.images`). */
export type MailSavedSectionImage = { alt?: string; url?: string };

export type MailSavedSection = {
  section_id: string;
  name: string;
  /** El bloque guardado; su `block_id` es de relleno: insertarlo le da uno nuevo. */
  block: MailBlock;
  images: Record<string, MailSavedSectionImage>;
  campaign_id?: string;
  created_at: string;
};

export type MailSectionsPayload = { state_revision: number; sections: MailSavedSection[] };

const esObjeto = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === "object" && !Array.isArray(v);
const texto = (v: unknown): string => (Array.isArray(v) && v.length === 1 ? texto(v[0]) : typeof v === "string" ? v : "");

function normalizeSavedImages(value: unknown): Record<string, MailSavedSectionImage> {
  if (!esObjeto(value)) return {};
  const out: Record<string, MailSavedSectionImage> = {};
  for (const [id, raw] of Object.entries(value)) {
    if (!esObjeto(raw)) continue;
    const alt = texto(raw.alt);
    const url = texto(raw.url);
    out[id] = { ...(alt ? { alt } : {}), ...(url ? { url } : {}) };
  }
  return out;
}

/** Una sección guardada; `null` si no trae un bloque que este cliente sepa leer. */
export function normalizeMailSavedSection(value: unknown): MailSavedSection | null {
  if (!esObjeto(value)) return null;
  const section_id = texto(value.section_id);
  const block = esObjeto(value.block) ? normalizeMailBlock({ ...value.block, block_id: "seccion-guardada" }) : null;
  if (!section_id || !block) return null;
  const campaign_id = texto(value.campaign_id);
  return {
    section_id, name: texto(value.name) || section_id, block, images: normalizeSavedImages(value.images),
    ...(campaign_id ? { campaign_id } : {}), created_at: texto(value.created_at),
  };
}

function normalizePayload(value: unknown): MailSectionsPayload {
  const v = esObjeto(value) ? value : {};
  const rev = Number(Array.isArray(v.state_revision) ? v.state_revision[0] : v.state_revision);
  const sections = Array.isArray(v.sections) ? v.sections.map(normalizeMailSavedSection).filter((s): s is MailSavedSection => s !== null) : [];
  return { state_revision: Number.isFinite(rev) ? rev : 0, sections };
}

function json(body: unknown): RequestInit {
  return { method: "POST", headers: headers({ "Content-Type": "application/json" }), body: JSON.stringify(body) };
}

export async function apiMailSections(): Promise<MailSectionsPayload> {
  return normalizePayload(await handleMail(await apiFetch(`${BASE}/mail-sections`, { headers: headers() })));
}

export async function apiMailSectionCreate(input: {
  expected_revision: number;
  name: string;
  block: MailBlock;
  images: Record<string, MailSavedSectionImage>;
  campaign_id?: string | null;
}): Promise<{ state_revision: number; section: MailSavedSection | null }> {
  const out = await handleMail(await apiFetch(`${BASE}/mail-sections`, json(input)));
  const v = esObjeto(out) ? out : {};
  return { state_revision: normalizePayload(v).state_revision, section: normalizeMailSavedSection(v.section) };
}

export async function apiMailSectionDelete(input: { expected_revision: number; section_id: string }): Promise<{ state_revision: number }> {
  return { state_revision: normalizePayload(await handleMail(await apiFetch(`${BASE}/mail-sections/delete`, json(input)))).state_revision };
}
