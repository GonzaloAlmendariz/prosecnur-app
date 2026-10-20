// materialCampanas.ts — registro de campañas de Material de campo (ADR 0111).
//
// Contrato `material_campaigns/v1`, bajo /api/recopiladores/:
//   GET  campaigns       lista de campañas del proyecto y qué tipos se pueden crear
//   POST campaigns       crea una campaña (`correo` delega en mail-campaigns)
//   PUT  campaigns/meta  renombra, cambia actor o plataforma, archiva o reabre
//
// La campaña es la entidad de primer nivel del módulo. Su id es `<tipo>.<ref>`:
// `aulas.principal` para el plan de aulas, `correo.<campaign_id>` para cada
// correo. Las campañas de correo se proyectan de `mail_campaigns`, que sigue
// siendo su única fuente; los endpoints `mail-*` no cambian.
//
// **Backend sin registro.** Un backend anterior a ff91e3baf no tiene esta ruta:
// las llamadas devuelven `null` (un 404 de RUTA, no un 404 de campaña) y quien
// las llama deriva la lista de lo que ya existe como respaldo: ver
// `features/recopiladores/campanas/derivacionTemporal.ts`.
//
// Notas del contrato real: el POST de correo exige `expected_state_revision`;
// aulas compara `expected_registry_revision` (opcional) y su 409 es
// `E_COLLECTION_CAMPAIGN_STALE`, el de correo sigue siendo
// `E_COLLECTION_STATE_STALE`. El GET trae también las archivadas.
//
// Normalización defensiva: R serializa un vector de largo uno como escalar y
// una lista vacía con nombres como `{}`. Una campaña con un id o un tipo que
// esta versión no conoce se descarta, no se inventa.

import { MAIL_PLATFORMS, type MailPlatform } from "./materialMail";
import { ApiError, apiFetch, handle, headers } from "./core";

export const MATERIAL_CAMPANAS_SCHEMA = "material_campaigns/v1";

export const TIPOS_DE_CAMPANA = ["aulas", "territorial", "correo"] as const;
export type TipoDeCampana = (typeof TIPOS_DE_CAMPANA)[number];

/** `^(aulas|territorial|correo)\.[a-z0-9][a-z0-9-]{0,39}$` (ADR 0111 §4). */
export const ID_DE_CAMPANA_RE = /^(aulas|territorial|correo)\.[a-z0-9][a-z0-9-]{0,39}$/;

export type EstadoCampanaAulas = {
  tipo: "aulas";
  unidades: number;
  titulares: number;
  con_enlace: number;
  /** `collection_deployment/v1`: `draft`, `prepared`, `handed_off`, `stale`… o `""`. */
  deployment_status: string;
  plan_desfasado: boolean;
};

export type EnvioDeCampana = {
  send_id: string;
  label: string;
  /** ISO de la última exportación del envío, o `null` si nunca se exportó. */
  last_export_at: string | null;
  /** Por qué plataforma salió esa exportación, o `null`. */
  last_export_platform: MailPlatform | null;
};

export type EstadoCampanaCorreo = {
  tipo: "correo";
  platform: MailPlatform;
  envios: number;
  bloques: number;
  recipients_loaded: boolean;
  envios_detalle: EnvioDeCampana[];
};

export type EstadoCampana = EstadoCampanaAulas | EstadoCampanaCorreo;

export type CampanaMaterial = {
  id: string;
  tipo: TipoDeCampana;
  name: string;
  actor: string;
  created_at: string | null;
  archived: boolean;
  /** `false`: proyectada de un estado anterior al registro, todavía sin escribir. */
  persisted: boolean;
  /** Lo que la campaña nombra en su fuente: `principal`, el `campaign_id` del correo. */
  ref: string;
  /** `null` cuando la respuesta no trae estado (o no es de un tipo conocido). */
  estado: EstadoCampana | null;
};

export type DisponibilidadDeTipo = {
  tipo: TipoDeCampana;
  disponible: boolean;
  /** Por qué no se puede crear, en el idioma de quien la usa. */
  motivo: string | null;
};

export type RegistroDeCampanas = {
  schema: typeof MATERIAL_CAMPANAS_SCHEMA;
  registry_revision: number | null;
  state_revision: number | null;
  campaigns: CampanaMaterial[];
  tipos: DisponibilidadDeTipo[];
};

export type EscrituraDeCampana = {
  campaign: CampanaMaterial;
  registry_revision: number | null;
  state_revision: number | null;
};

// ---- normalización ------------------------------------------------------------

type Registro = Record<string, unknown>;

function esRegistro(valor: unknown): valor is Registro {
  return Boolean(valor) && typeof valor === "object" && !Array.isArray(valor);
}

function texto(valor: unknown): string {
  if (Array.isArray(valor) && valor.length === 1) return texto(valor[0]);
  if (typeof valor === "string") return valor;
  if (typeof valor === "number" && Number.isFinite(valor)) return String(valor);
  return "";
}

function textoONulo(valor: unknown): string | null {
  const t = texto(valor).trim();
  return t ? t : null;
}

function entero(valor: unknown, porDefecto = 0): number {
  if (Array.isArray(valor) && valor.length === 1) return entero(valor[0], porDefecto);
  const n = typeof valor === "number" ? valor : typeof valor === "string" ? Number(valor) : Number.NaN;
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : porDefecto;
}

function enteroONulo(valor: unknown): number | null {
  if (Array.isArray(valor) && valor.length === 1) return enteroONulo(valor[0]);
  const n = typeof valor === "number" ? valor : typeof valor === "string" && valor.trim() ? Number(valor) : Number.NaN;
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function logico(valor: unknown): boolean {
  if (Array.isArray(valor)) return valor.length > 0 && logico(valor[0]);
  return valor === true || valor === "true" || valor === 1;
}

function lista(valor: unknown): unknown[] {
  if (Array.isArray(valor)) return valor;
  return esRegistro(valor) ? [valor] : [];
}

export function esTipoDeCampana(valor: unknown): valor is TipoDeCampana {
  return typeof valor === "string" && (TIPOS_DE_CAMPANA as readonly string[]).includes(valor);
}

function normalizarEnvio(valor: unknown): EnvioDeCampana | null {
  if (!esRegistro(valor)) return null;
  const send_id = texto(valor.send_id).trim();
  if (!send_id) return null;
  const plataforma = texto(valor.last_export_platform);
  return {
    send_id,
    label: texto(valor.label).trim() || send_id,
    last_export_at: textoONulo(valor.last_export_at),
    last_export_platform: (MAIL_PLATFORMS as readonly string[]).includes(plataforma) ? (plataforma as MailPlatform) : null,
  };
}

function normalizarEstado(tipo: TipoDeCampana, valor: unknown): EstadoCampana | null {
  if (!esRegistro(valor)) return null;
  if (tipo === "aulas") {
    return {
      tipo,
      unidades: entero(valor.unidades),
      titulares: entero(valor.titulares),
      con_enlace: entero(valor.con_enlace),
      deployment_status: texto(valor.deployment_status).trim(),
      plan_desfasado: logico(valor.plan_desfasado),
    };
  }
  if (tipo === "correo") {
    const plataforma = texto(valor.platform);
    return {
      tipo,
      platform: (MAIL_PLATFORMS as readonly string[]).includes(plataforma) ? (plataforma as MailPlatform) : "mailchimp",
      envios: entero(valor.envios),
      bloques: entero(valor.bloques),
      recipients_loaded: logico(valor.recipients_loaded),
      envios_detalle: lista(valor.envios_detalle).map(normalizarEnvio).filter((e): e is EnvioDeCampana => e !== null),
    };
  }
  return null;
}

/**
 * `ref` llega como objeto (`{store, campaign_id}` o `{store, plan_id}`); lo que
 * la UI necesita es el nombre en su fuente: el `campaign_id` del correo o lo
 * que sigue al tipo en el id.
 */
function refDe(valor: unknown, id: string, tipo: TipoDeCampana): string {
  if (esRegistro(valor)) {
    const cid = texto(valor.campaign_id).trim();
    if (cid) return cid;
  } else {
    const plano = texto(valor).trim();
    if (plano) return plano;
  }
  return id.slice(tipo.length + 1);
}

export function normalizarCampana(valor: unknown): CampanaMaterial | null {
  if (!esRegistro(valor)) return null;
  const id = texto(valor.id).trim();
  const tipo = texto(valor.tipo).trim();
  if (!ID_DE_CAMPANA_RE.test(id) || !esTipoDeCampana(tipo) || !id.startsWith(`${tipo}.`)) return null;
  return {
    id,
    tipo,
    name: texto(valor.name).trim() || id,
    actor: texto(valor.actor).trim(),
    created_at: textoONulo(valor.created_at),
    archived: logico(valor.archived),
    persisted: logico(valor.persisted),
    ref: refDe(valor.ref, id, tipo),
    estado: normalizarEstado(tipo, valor.estado),
  };
}

/**
 * El motivo en el idioma de quien lo lee: sin la referencia interna del plan
 * que lo decidió («… de Hojas de ruta (E2)» → «… de Hojas de ruta»).
 */
export function motivoSinCodigo(motivo: string | null): string | null {
  if (!motivo) return motivo;
  const limpio = motivo.replace(/\s*\((?:[A-Z]\d+[a-z]?)(?:\s*[,;·]\s*[A-Z]\d+[a-z]?)*\)/g, "").replace(/\s{2,}/g, " ").trim();
  return limpio || null;
}

function normalizarTipo(valor: unknown): DisponibilidadDeTipo | null {
  if (!esRegistro(valor)) return null;
  const tipo = texto(valor.tipo).trim();
  if (!esTipoDeCampana(tipo)) return null;
  const disponible = logico(valor.disponible);
  return { tipo, disponible, motivo: disponible ? null : motivoSinCodigo(textoONulo(valor.motivo)) };
}

export function normalizarRegistroDeCampanas(valor: unknown): RegistroDeCampanas {
  if (!esRegistro(valor)) throw new Error("El backend devolvió un registro de campañas inválido.");
  const vistas = new Set<string>();
  const campaigns: CampanaMaterial[] = [];
  for (const crudo of lista(valor.campaigns)) {
    const campana = normalizarCampana(crudo);
    if (!campana || vistas.has(campana.id)) continue;
    vistas.add(campana.id);
    campaigns.push(campana);
  }
  const porTipo = new Map<TipoDeCampana, DisponibilidadDeTipo>();
  for (const crudo of lista(valor.tipos)) {
    const tipo = normalizarTipo(crudo);
    if (tipo && !porTipo.has(tipo.tipo)) porTipo.set(tipo.tipo, tipo);
  }
  return {
    schema: MATERIAL_CAMPANAS_SCHEMA,
    registry_revision: enteroONulo(valor.registry_revision),
    state_revision: enteroONulo(valor.state_revision),
    campaigns,
    // Los tres tipos, siempre y en orden; uno que no viene no se puede crear.
    tipos: TIPOS_DE_CAMPANA.map((tipo) => porTipo.get(tipo) ?? { tipo, disponible: false, motivo: null }),
  };
}

export function normalizarEscrituraDeCampana(valor: unknown): EscrituraDeCampana {
  const campaign = esRegistro(valor) ? normalizarCampana(valor.campaign) : null;
  if (!esRegistro(valor) || !campaign) throw new Error("El backend devolvió una campaña inválida.");
  return {
    campaign,
    registry_revision: enteroONulo(valor.registry_revision),
    state_revision: enteroONulo(valor.state_revision),
  };
}

/**
 * `facts["material-campo"].campaigns` del inicio del proyecto (ADR 0111 §9):
 * `{id, tipo, name, archived, resumen}`, donde `resumen` tiene la forma de
 * `estado`. Un backend anterior no lo manda: se lee como `undefined`.
 */
export function normalizarCampanasDelInicio(valor: unknown): CampanaMaterial[] | undefined {
  if (valor === undefined || valor === null) return undefined;
  const salida: CampanaMaterial[] = [];
  for (const crudo of lista(valor)) {
    if (!esRegistro(crudo)) continue;
    const campana = normalizarCampana({ ...crudo, estado: crudo.estado ?? crudo.resumen });
    if (campana) salida.push(campana);
  }
  return salida;
}

// ---- API ----------------------------------------------------------------------

const BASE = "/api/recopiladores/campaigns";

/**
 * ¿El backend no tiene la RUTA? Un 404 de campaña inexistente trae su código
 * `E_COLLECTION_CAMPAIGN_*` y es un error de verdad; un 404/405 sin él es una
 * versión del backend que todavía no publica el registro.
 */
async function rutaAusente(res: Response): Promise<boolean> {
  if (res.status !== 404 && res.status !== 405) return false;
  const crudo = await res.clone().text().catch(() => "");
  let codigo = "";
  try {
    const cuerpo: unknown = crudo.trim() ? JSON.parse(crudo) : null;
    if (esRegistro(cuerpo)) {
      const error = esRegistro(cuerpo.error) ? cuerpo.error : null;
      codigo = texto(error?.code ?? cuerpo.code);
    }
  } catch {
    codigo = "";
  }
  return !codigo.startsWith("E_COLLECTION_CAMPAIGN");
}

/** El registro, o `null` si este backend todavía no lo publica. */
export async function apiMaterialCampanas(): Promise<RegistroDeCampanas | null> {
  const res = await apiFetch(BASE, { headers: headers() });
  if (await rutaAusente(res)) return null;
  return normalizarRegistroDeCampanas(await handle<unknown>(res));
}

export type NuevaCampana = {
  tipo: TipoDeCampana;
  name: string;
  actor?: string;
  platform?: MailPlatform;
  preset_id?: string | null;
  import_id?: string | null;
  expected_state_revision?: number | null;
  expected_registry_revision?: number | null;
};

function cuerpoSinVacios(entrada: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(entrada).filter(([, v]) => v !== undefined && v !== null && v !== ""));
}

function json(method: string, body: Record<string, unknown>): RequestInit {
  return { method, headers: headers({ "Content-Type": "application/json" }), body: JSON.stringify(body) };
}

/** Crea una campaña; `null` si este backend todavía no publica el registro. */
export async function apiMaterialCampanaCrear(entrada: NuevaCampana): Promise<EscrituraDeCampana | null> {
  const res = await apiFetch(BASE, json("POST", cuerpoSinVacios(entrada)));
  if (await rutaAusente(res)) return null;
  return normalizarEscrituraDeCampana(await handle<unknown>(res));
}

export type CambioDeCampana = {
  id: string;
  name?: string;
  actor?: string;
  platform?: MailPlatform;
  archived?: boolean;
  expected_state_revision?: number | null;
  expected_registry_revision?: number | null;
};

/** Renombra, cambia actor o plataforma, archiva o reabre; `null` sin registro en el backend. */
export async function apiMaterialCampanaMeta(cambio: CambioDeCampana): Promise<EscrituraDeCampana | null> {
  const res = await apiFetch(`${BASE}/meta`, json("PUT", cuerpoSinVacios(cambio)));
  if (await rutaAusente(res)) return null;
  return normalizarEscrituraDeCampana(await handle<unknown>(res));
}

/** Avisos de las escrituras del registro; nunca repiten el valor escrito. */
const AVISO_DEL_REGISTRO: Readonly<Record<string, string>> = {
  E_COLLECTION_CAMPAIGN_NOT_FOUND: "Esa campaña ya no existe en el proyecto. Se volvió a leer la lista.",
  E_COLLECTION_CAMPAIGN_TIPO: "Ese tipo de campaña no existe.",
  E_COLLECTION_CAMPAIGN_TIPO_NO_DISPONIBLE: "Ese tipo de campaña todavía no se puede crear en este proyecto.",
  E_COLLECTION_CAMPAIGN_AULAS_UNICA: "El proyecto ya tiene su campaña de aulas: ábrela desde la lista.",
  E_COLLECTION_CAMPAIGN_STALE: "Otro cambio se guardó antes. Se volvió a leer la lista de campañas.",
  E_COLLECTION_STATE_STALE: "Otro cambio del módulo se guardó antes. Se volvió a leer la lista de campañas.",
  E_COLLECTION_CAMPAIGN_INVALID: "Ese cambio no aplica a este tipo de campaña.",
  E_COLLECTION_MAIL_CAMPAIGN_NAME: "El nombre o el actor tienen forma de dirección de correo: escribe un rótulo que no la tenga.",
};

export function avisoDelRegistro(causa: unknown, porDefecto: string): string {
  if (causa instanceof ApiError && AVISO_DEL_REGISTRO[causa.code]) return AVISO_DEL_REGISTRO[causa.code];
  return causa instanceof Error && causa.message ? causa.message : porDefecto;
}

/** Rechazos tras los que la lista local ya no es la del servidor. */
export function hayQueReleerElRegistro(causa: unknown): boolean {
  return causa instanceof ApiError
    && ["E_COLLECTION_CAMPAIGN_STALE", "E_COLLECTION_STATE_STALE", "E_COLLECTION_CAMPAIGN_NOT_FOUND"].includes(causa.code);
}
