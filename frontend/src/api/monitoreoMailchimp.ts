// monitoreoMailchimp.ts — reportes de Mailchimp en Monitoreo › Acreditación ›
// Avance › Correo (checklist T3, 2026-10-22).
//
// Solo lectura del proveedor: el backend lee campañas, destinatarios por token,
// rebotes, bajas y quejas, y los cruza con el universo de Monitoreo. Ningún
// correo viaja en estos payloads (ADR 0005 y 0112): solo tokens y conteos.
//
// El normalizador es defensivo porque Plumber serializa con auto_unbox: una
// lista de un elemento llega como objeto suelto, un vector de largo uno como
// escalar, `NULL` como `{}` y un `NA` numérico como `null`. Una cifra ausente
// se conserva como `null` («sin dato»), nunca como cero.

import { apiFetch, handle, headers } from "./core";
import {
  booleano,
  escalar,
  lista,
  numeroONulo,
  registro,
  texto,
} from "./normalizarR";

// ---------- Tipos del contrato congelado ----------

export type MonitoreoMailchimpRitmo = "seguir" | "espaciar" | "detener" | "sin_envios";
export type MonitoreoMailchimpTipoEnvio = "invitacion" | "recordatorio";
/** `rebote_duro` | `limpiado`; otro texto del backend se conserva tal cual. */
export type MonitoreoMailchimpMotivoInvalido = string;

export type MonitoreoMailchimpUmbrales = {
  baja_espaciar: number | null;
  queja_espaciar: number | null;
  queja_detener: number | null;
};

export type MonitoreoMailchimpUltimoEnvio = {
  campaign_id: string;
  entregados: number | null;
  bajas: number | null;
  quejas: number | null;
  respuestas: number | null;
  tasa_baja: number | null;
  tasa_queja: number | null;
};

export type MonitoreoMailchimpPublico = {
  actor: string;
  universo: number | null;
  invitados: number | null;
  invalidos: number | null;
  alcanzable: number | null;
  efectivas: number | null;
  /** Proporciones 0–1. */
  tasa_universo: number | null;
  tasa_alcanzable: number | null;
  bajas: number | null;
  quejas: number | null;
  /** Número de campañas que tocaron al público. */
  envios: number | null;
  ultimo: MonitoreoMailchimpUltimoEnvio | null;
  ritmo: MonitoreoMailchimpRitmo;
  ritmo_motivo: string;
};

export type MonitoreoMailchimpCifrasEnvio = {
  enviados: number | null;
  entregados: number | null;
  rebotes_duros: number | null;
  rebotes_blandos: number | null;
  /** Destinatarios que abrieron, INCLUYE aperturas automáticas de Apple. */
  aperturas: number | null;
  /** Del reporte de Mailchimp, sin Apple. Llega `null` en `por_actor`: Mailchimp no lo separa por persona. */
  aperturas_sin_proxy: number | null;
  clics: number | null;
  bajas: number | null;
  quejas: number | null;
  respuestas: number | null;
  /** Proporciones 0–1 sobre entregados; `null` con base 0. `tasa_apertura` usa `aperturas_sin_proxy`. */
  tasa_apertura: number | null;
  tasa_clic: number | null;
  tasa_baja: number | null;
  tasa_queja: number | null;
};

export type MonitoreoMailchimpEnvioPorActor = MonitoreoMailchimpCifrasEnvio & { actor: string };

export type MonitoreoMailchimpEnvio = MonitoreoMailchimpCifrasEnvio & {
  campaign_id: string;
  titulo: string;
  asunto: string;
  enviado_at: string;
  etiqueta: string;
  tipo: MonitoreoMailchimpTipoEnvio;
  /** Cuenta por público: 1 = invitación, 2 = recordatorio 1…; `null` si el backend no lo calculó. */
  orden: number | null;
  /** Público mayoritario de los destinatarios (por token). */
  actor: string;
  por_actor: MonitoreoMailchimpEnvioPorActor[];
};

export type MonitoreoMailchimpInvalidoFila = {
  token: string;
  actor: string;
  motivo: MonitoreoMailchimpMotivoInvalido;
  campaign_id: string;
  fecha: string;
};

export type MonitoreoMailchimpInvalidos = {
  total: number | null;
  por_actor: { actor: string; n: number | null }[];
  filas: MonitoreoMailchimpInvalidoFila[];
};

export type MonitoreoMailchimpEstado = {
  ok: boolean;
  conectado: boolean;
  list_id: string;
  leido_at: string;
  umbrales: MonitoreoMailchimpUmbrales;
  avisos: string[];
  publicos: MonitoreoMailchimpPublico[];
  envios: MonitoreoMailchimpEnvio[];
  invalidos: MonitoreoMailchimpInvalidos;
};

export type MonitoreoMailchimpAudiencia = { id: string; name: string; member_count: number | null };

export type MonitoreoMailchimpAudiencias = {
  ok: boolean;
  conectado: boolean;
  audiencias: MonitoreoMailchimpAudiencia[];
};

// ---------- Normalizadores ----------

/** Lista de textos: arreglo, escalar suelto (auto_unbox) o `{}`/`null`. */
function textos(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(texto).filter(Boolean);
  const uno = texto(value);
  return uno ? [uno] : [];
}

const RITMOS: readonly MonitoreoMailchimpRitmo[] = ["seguir", "espaciar", "detener", "sin_envios"];

function ritmo(value: unknown): MonitoreoMailchimpRitmo {
  const v = texto(value).toLowerCase().replace(/[\s-]+/g, "_");
  return (RITMOS as readonly string[]).includes(v) ? (v as MonitoreoMailchimpRitmo) : "sin_envios";
}

function tipoEnvio(value: unknown, orden: number | null): MonitoreoMailchimpTipoEnvio {
  const v = texto(value).toLowerCase();
  if (v === "invitacion" || v === "invitación") return "invitacion";
  if (v === "recordatorio") return "recordatorio";
  return orden != null && orden > 1 ? "recordatorio" : "invitacion";
}

function cifrasEnvio(r: Record<string, unknown>): MonitoreoMailchimpCifrasEnvio {
  return {
    enviados: numeroONulo(r.enviados),
    entregados: numeroONulo(r.entregados),
    rebotes_duros: numeroONulo(r.rebotes_duros),
    rebotes_blandos: numeroONulo(r.rebotes_blandos),
    aperturas: numeroONulo(r.aperturas),
    aperturas_sin_proxy: numeroONulo(r.aperturas_sin_proxy),
    clics: numeroONulo(r.clics),
    bajas: numeroONulo(r.bajas),
    quejas: numeroONulo(r.quejas),
    respuestas: numeroONulo(r.respuestas),
    tasa_apertura: numeroONulo(r.tasa_apertura),
    tasa_clic: numeroONulo(r.tasa_clic),
    tasa_baja: numeroONulo(r.tasa_baja),
    tasa_queja: numeroONulo(r.tasa_queja),
  };
}

function ultimoEnvio(value: unknown): MonitoreoMailchimpUltimoEnvio | null {
  const r = registro(escalar(value));
  if (!Object.keys(r).length) return null;
  return {
    campaign_id: texto(r.campaign_id),
    entregados: numeroONulo(r.entregados),
    bajas: numeroONulo(r.bajas),
    quejas: numeroONulo(r.quejas),
    respuestas: numeroONulo(r.respuestas),
    tasa_baja: numeroONulo(r.tasa_baja),
    tasa_queja: numeroONulo(r.tasa_queja),
  };
}

function publico(r: Record<string, unknown>): MonitoreoMailchimpPublico {
  return {
    actor: texto(r.actor) || "Sin público",
    universo: numeroONulo(r.universo),
    invitados: numeroONulo(r.invitados),
    invalidos: numeroONulo(r.invalidos),
    alcanzable: numeroONulo(r.alcanzable),
    efectivas: numeroONulo(r.efectivas),
    tasa_universo: numeroONulo(r.tasa_universo),
    tasa_alcanzable: numeroONulo(r.tasa_alcanzable),
    bajas: numeroONulo(r.bajas),
    quejas: numeroONulo(r.quejas),
    envios: numeroONulo(r.envios),
    ultimo: ultimoEnvio(r.ultimo),
    ritmo: ritmo(r.ritmo),
    ritmo_motivo: texto(r.ritmo_motivo),
  };
}

function envio(r: Record<string, unknown>): MonitoreoMailchimpEnvio {
  const orden = numeroONulo(r.orden);
  return {
    ...cifrasEnvio(r),
    campaign_id: texto(r.campaign_id),
    titulo: texto(r.titulo),
    asunto: texto(r.asunto),
    enviado_at: texto(r.enviado_at),
    etiqueta: texto(r.etiqueta),
    tipo: tipoEnvio(r.tipo, orden),
    orden,
    actor: texto(r.actor),
    por_actor: lista(r.por_actor).map((a) => ({ ...cifrasEnvio(a), actor: texto(a.actor) || "Sin público" })),
  };
}

function invalidos(value: unknown): MonitoreoMailchimpInvalidos {
  const r = registro(escalar(value));
  return {
    total: numeroONulo(r.total),
    por_actor: lista(r.por_actor).map((a) => ({ actor: texto(a.actor) || "Sin público", n: numeroONulo(a.n) })),
    filas: lista(r.filas).map((f) => ({
      token: texto(f.token),
      actor: texto(f.actor),
      motivo: texto(f.motivo),
      campaign_id: texto(f.campaign_id),
      fecha: texto(f.fecha),
    })),
  };
}

export function normalizeMonitoreoMailchimpEstado(raw: unknown): MonitoreoMailchimpEstado {
  const r = registro(raw);
  const u = registro(escalar(r.umbrales));
  return {
    ok: r.ok === undefined ? true : booleano(r.ok),
    conectado: booleano(r.conectado),
    list_id: texto(r.list_id),
    leido_at: texto(r.leido_at),
    umbrales: {
      baja_espaciar: numeroONulo(u.baja_espaciar),
      queja_espaciar: numeroONulo(u.queja_espaciar),
      queja_detener: numeroONulo(u.queja_detener),
    },
    avisos: textos(r.avisos),
    publicos: lista(r.publicos).map(publico),
    envios: lista(r.envios).map(envio).filter((e) => e.campaign_id),
    invalidos: invalidos(r.invalidos),
  };
}

export function normalizeMonitoreoMailchimpAudiencias(raw: unknown): MonitoreoMailchimpAudiencias {
  const r = registro(raw);
  return {
    ok: r.ok === undefined ? true : booleano(r.ok),
    conectado: booleano(r.conectado),
    audiencias: lista(r.audiencias)
      .map((a) => ({ id: texto(a.id), name: texto(a.name), member_count: numeroONulo(a.member_count) }))
      .filter((a) => a.id),
  };
}

export function normalizeMonitoreoMailchimpSync(raw: unknown): { job_id: string } {
  const job_id = texto(registro(raw).job_id);
  if (!job_id) throw new Error("El servidor no devolvió el trabajo en segundo plano. Reintenta.");
  return { job_id };
}

// ---------- Rutas ----------

const BASE = "/api/monitoreo/mailchimp";

export async function getMonitoreoMailchimpEstado(): Promise<MonitoreoMailchimpEstado> {
  return normalizeMonitoreoMailchimpEstado(
    await handle<unknown>(await apiFetch(`${BASE}/estado`, { headers: headers() })),
  );
}

export async function getMonitoreoMailchimpAudiencias(): Promise<MonitoreoMailchimpAudiencias> {
  return normalizeMonitoreoMailchimpAudiencias(
    await handle<unknown>(await apiFetch(`${BASE}/audiencias`, { headers: headers() })),
  );
}

export async function postMonitoreoMailchimpConfig(input: { list_id: string }): Promise<MonitoreoMailchimpEstado> {
  return normalizeMonitoreoMailchimpEstado(
    await handle<unknown>(await apiFetch(`${BASE}/config`, {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ list_id: input.list_id }),
    })),
  );
}

/** Arranca la lectura de Mailchimp como job (`monitoreo.mailchimp_sync`). */
export async function postMonitoreoMailchimpSync(): Promise<{ job_id: string }> {
  return normalizeMonitoreoMailchimpSync(
    await handle<unknown>(await apiFetch(`${BASE}/sync`, {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({}),
    })),
  );
}
