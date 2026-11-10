// =============================================================================
// materialMailHermanas.ts — «Aplicar a las campañas hermanas» (GOAL editor de
// correos, L16; collection_mail_hermanas.R)
// =============================================================================
//   POST   mail-campaigns/apply-siblings   con `dry_run` dice qué cambiaría en cada
//                                          hermana; sin él, aplica a todas o a ninguna
// Exige `expected_revision` (la revisión global del estado).

import { apiFetch, headers } from "./core";
import { handleMail } from "./materialMail";

const BASE = "/api/recopiladores";

export type ParteHermana = "cuerpo" | "envios";

/** Lo que cambiaría (o cambió) en una campaña hermana. */
export type MailHermana = {
  campaign_id: string;
  name: string;
  /** «Asunto», «Bloques», «Recordatorio 1: asunto», «Recordatorio 2: se agrega»… */
  cambios: string[];
  campos_agregados: string[];
  datos_agregados: string[];
  /** Envíos de la hermana que el origen no tiene: quedan. */
  envios_que_quedan: string[];
  conserva: { registro: "tu" | "usted"; saludo: boolean; enlaces: string[]; datos: number };
  problemas: { path: string; detail: string }[];
};

export type MailHermanasPayload = {
  state_revision: number;
  dry_run: boolean;
  /** Cuántas variantes `[[tú|usted]]` tiene el origen (correo y envíos); con 0, el texto pasa tal cual. */
  variantes_origen: number;
  hermanas: MailHermana[];
};

const esObjeto = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === "object" && !Array.isArray(v);
const texto = (v: unknown): string => (Array.isArray(v) && v.length === 1 ? texto(v[0]) : typeof v === "string" ? v : "");
const textos = (v: unknown): string[] => (Array.isArray(v) ? v.map(texto).filter(Boolean) : texto(v) ? [texto(v)] : []);
const numero = (v: unknown): number => {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return Number.isFinite(n) ? n : 0;
};

export function normalizeMailHermana(value: unknown): MailHermana | null {
  if (!esObjeto(value)) return null;
  const campaign_id = texto(value.campaign_id);
  if (!campaign_id) return null;
  const c = esObjeto(value.conserva) ? value.conserva : {};
  return {
    campaign_id,
    name: texto(value.name) || campaign_id,
    cambios: textos(value.cambios),
    campos_agregados: textos(value.campos_agregados),
    datos_agregados: textos(value.datos_agregados),
    envios_que_quedan: textos(value.envios_que_quedan),
    conserva: {
      registro: texto(c.registro) === "tu" ? "tu" : "usted",
      saludo: c.saludo === true || (Array.isArray(c.saludo) && c.saludo[0] === true),
      enlaces: textos(c.enlaces),
      datos: numero(c.datos),
    },
    problemas: (Array.isArray(value.problemas) ? value.problemas : [])
      .filter(esObjeto)
      .map((p) => ({ path: texto(p.path), detail: texto(p.detail) })),
  };
}

export function normalizeMailHermanas(value: unknown): MailHermanasPayload {
  const v = esObjeto(value) ? value : {};
  return {
    state_revision: numero(v.state_revision),
    dry_run: v.dry_run === true || (Array.isArray(v.dry_run) && v.dry_run[0] === true),
    variantes_origen: numero(v.variantes_origen),
    hermanas: (Array.isArray(v.hermanas) ? v.hermanas : []).map(normalizeMailHermana).filter((h): h is MailHermana => h !== null),
  };
}

export async function apiMailApplySiblings(input: {
  expected_revision: number;
  campaign_id: string;
  target_ids: string[];
  partes: ParteHermana[];
  dry_run: boolean;
}): Promise<MailHermanasPayload> {
  const init: RequestInit = { method: "POST", headers: headers({ "Content-Type": "application/json" }), body: JSON.stringify(input) };
  return normalizeMailHermanas(await handleMail(await apiFetch(`${BASE}/mail-campaigns/apply-siblings`, init)));
}
