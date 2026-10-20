// =============================================================================
// modeloEnvios.ts — la invitación y sus recordatorios (ADR 0110, addendum E1k)
// =============================================================================
// Una campaña tiene de 1 a 6 envíos. El cuerpo del correo es común: cada envío
// cambia sólo su asunto, su preheader, su fecha prevista, a quién va y una
// apertura propia («Le recordamos que aún puede responder…»). Aquí vive la
// parte que se puede equivocar sin React:
//
// - alta y baja de recordatorios, con la invitación siempre primera;
// - el rótulo por defecto «Recordatorio N», que sigue a la posición;
// - el aviso de fechas (espejo del `send_dates` del backend);
// - cómo se reconcilia lo enviado con lo que devuelve el PUT: un recordatorio
//   nuevo viaja con un id LOCAL y vuelve con el `recordatorio-<k>` del servidor;
// - qué envío se mira en cada campaña (sessionStorage, nunca datos personales).

import {
  mailSendInvitation,
  type MailSend,
  type MailSendAudience,
  type MailTemplate,
} from "../../../api/materialMail";

export const MAX_ENVIOS = 6;
export const LARGO_ETIQUETA = 40;
export const LARGO_APERTURA = 600;
export const INVITACION = "invitacion";

/** Prefijo de un envío que todavía no se guardó: el servidor le asigna su id al guardar. */
const PREFIJO_LOCAL = "nuevo-";

export function esIdLocal(sendId: string): boolean {
  return sendId.startsWith(PREFIJO_LOCAL);
}

export const ROTULO_DE_AUDIENCIA: Record<MailSendAudience, string> = {
  todos: "Todos",
  sin_respuesta: "Sin respuesta",
  parcial: "Respuesta parcial",
  ambos: "Sin respuesta y parcial",
};

/** Las opciones de «a quién» de un recordatorio (los rótulos de «Send To» de SurveyMonkey). */
export const AUDIENCIAS_DE_RECORDATORIO: readonly Exclude<MailSendAudience, "todos">[] = ["sin_respuesta", "parcial", "ambos"];

const ROTULO_POR_DEFECTO = /^Recordatorio \d+$/;

/** «Recordatorio N» para la posición `i` (1 = el primer recordatorio). */
export function rotuloPorDefecto(i: number): string {
  return `Recordatorio ${i}`;
}

/** El primer envío es la invitación; si falta, se pone la de fábrica. */
export function conInvitacion(envios: readonly MailSend[]): MailSend[] {
  if (envios[0]?.kind === "invitacion") return [...envios];
  return [mailSendInvitation(), ...envios.filter((e) => e.kind !== "invitacion")];
}

/**
 * Los rótulos por defecto siguen a la posición: al quitar el Recordatorio 1,
 * el que era 2 pasa a ser 1. Un rótulo escrito a mano no se toca.
 */
export function renumerar(envios: readonly MailSend[]): MailSend[] {
  return envios.map((e, i) => (i > 0 && ROTULO_POR_DEFECTO.test(e.label) && e.label !== rotuloPorDefecto(i)
    ? { ...e, label: rotuloPorDefecto(i) }
    : e));
}

/** Un id local que no choca con ninguno de los envíos. */
function idLocalLibre(envios: readonly MailSend[]): string {
  const usados = new Set(envios.map((e) => e.send_id));
  for (let i = 1; i < 1000; i += 1) {
    const id = `${PREFIJO_LOCAL}${i}`;
    if (!usados.has(id)) return id;
  }
  return `${PREFIJO_LOCAL}${Date.now()}`;
}

export function puedeAgregar(envios: readonly MailSend[]): boolean {
  return envios.length < MAX_ENVIOS;
}

/**
 * Suma un recordatorio al final, para quienes no respondieron. Sin fecha: la
 * fecha prevista la pone quien planifica, no la app.
 */
export function agregarRecordatorio(
  envios: readonly MailSend[],
  asuntoBase: string | null = null,
): { envios: MailSend[]; sendId: string | null } {
  const base = conInvitacion(envios);
  if (!puedeAgregar(base)) return { envios: base, sendId: null };
  const send_id = idLocalLibre(base);
  const subject = asuntoDeRecordatorio(asuntoBase);
  const nuevo: MailSend = {
    send_id, kind: "recordatorio", label: rotuloPorDefecto(base.length), audience: "sin_respuesta",
    ...(subject ? { subject } : {}),
  };
  return { envios: [...base, nuevo], sendId: send_id };
}

/** Largo máximo del asunto de un envío (el del campo en Envíos). */
export const LARGO_ASUNTO = 80;

/**
 * El asunto con que nace un recordatorio (F16): «Recordatorio: <asunto>».
 * Sin asunto de base no se inventa uno; si ya empieza así, no se repite.
 */
export function asuntoDeRecordatorio(asunto: string | null | undefined): string | null {
  const limpio = (asunto ?? "").replace(/\s+/g, " ").trim();
  if (!limpio || /^\[.*\]$/.test(limpio)) return null;
  const texto = /^recordatorio\s*:/i.test(limpio) ? limpio : `Recordatorio: ${limpio}`;
  return texto.length > LARGO_ASUNTO ? `${texto.slice(0, LARGO_ASUNTO - 1).trimEnd()}…` : texto;
}

/** «exportado 20/10» de un envío, o vacío si nunca se exportó (F16). */
export function marcaDeExportado(iso: string | null | undefined): string {
  const m = (iso ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `exportado ${m[3]}/${m[2]}` : "";
}

/** Quita un recordatorio (la invitación no se quita) y renumera los rótulos por defecto. */
export function quitarEnvio(envios: readonly MailSend[], sendId: string): MailSend[] {
  if (sendId === INVITACION) return [...envios];
  const out = envios.filter((e) => e.send_id !== sendId);
  return out.length === envios.length ? [...envios] : renumerar(out);
}

/**
 * Cambia un envío. Un texto vacío en un campo opcional lo quita: vale el de la
 * plantilla. La invitación sigue yendo a todos.
 */
export function editarEnvio(envios: readonly MailSend[], sendId: string, cambio: Partial<Omit<MailSend, "send_id" | "kind">>): MailSend[] {
  return envios.map((e) => {
    if (e.send_id !== sendId) return e;
    const next: MailSend = { ...e, ...cambio };
    for (const key of ["date", "subject", "preheader", "opening", "collector_label"] as const) {
      if (key in cambio && !String(next[key] ?? "").trim()) delete next[key];
    }
    if (next.kind === "invitacion") next.audience = "todos";
    return next;
  });
}

/**
 * La apertura que se escribe sobre el correo (zona `__apertura` de la capa):
 * va al envío, nunca a la plantilla. Mientras se escribe se guarda tal cual
 * (también vacía); `cerrarApertura` la quita si quedó vacía al terminar.
 */
export function conApertura(envios: readonly MailSend[], sendId: string, valor: string): MailSend[] {
  return envios.map((e) => (e.send_id === sendId ? { ...e, opening: valor } : e));
}

export function cerrarApertura(envios: readonly MailSend[], sendId: string): MailSend[] {
  const e = envios.find((x) => x.send_id === sendId);
  return e && !e.opening?.trim() ? editarEnvio(envios, sendId, { opening: "" }) : [...envios];
}

// ---- fechas -------------------------------------------------------------------

/** «02/09», o vacío si no hay fecha (o no tiene la forma AAAA-MM-DD). */
export function fechaCorta(iso: string | undefined): string {
  const m = (iso ?? "").match(/^\d{4}-(\d{2})-(\d{2})$/);
  return m ? `${m[2]}/${m[1]}` : "";
}

/** «Invitación · 02/09», o sólo el rótulo si no tiene fecha. */
export function rotuloDeEnvio(envio: Pick<MailSend, "label" | "date">): string {
  const f = fechaCorta(envio.date);
  return f ? `${envio.label} · ${f}` : envio.label;
}

export type AvisoDeFecha = { sendId: string; detalle: string };

/**
 * Un recordatorio con fecha que no viene después de la del envío anterior
 * (espejo del aviso `send_dates`: no bloquea, sólo avisa).
 */
export function avisosDeFechas(envios: readonly MailSend[]): AvisoDeFecha[] {
  const out: AvisoDeFecha[] = [];
  for (let i = 1; i < envios.length; i += 1) {
    const actual = envios[i].date;
    const previa = envios[i - 1].date;
    if (actual && previa && actual <= previa) {
      out.push({
        sendId: envios[i].send_id,
        detalle: `${envios[i].label} tiene fecha ${fechaCorta(actual)}, que no es posterior a la de ${envios[i - 1].label} (${fechaCorta(previa)}).`,
      });
    }
  }
  return out;
}

// ---- lo que se manda y lo que vuelve ------------------------------------------------

/** Los envíos como los espera el PUT: un id local no viaja, el servidor asigna uno. */
export function enviosParaGuardar(envios: readonly MailSend[]): MailSend[] {
  return conInvitacion(envios).map((e) => (esIdLocal(e.send_id) ? { ...e, send_id: "" } : e));
}

/**
 * Lo que devolvió el PUT, alineado con lo enviado por posición. `ids` dice qué
 * id local pasó a qué id del servidor, para no perder el envío elegido.
 */
export function reconciliarEnvios(enviados: readonly MailSend[], respuesta: readonly MailSend[]): { envios: MailSend[]; ids: Record<string, string> } {
  const ids: Record<string, string> = {};
  enviados.forEach((e, i) => {
    const vuelto = respuesta[i];
    if (vuelto && e.send_id !== vuelto.send_id) ids[e.send_id] = vuelto.send_id;
  });
  return { envios: [...respuesta], ids };
}

/** Huella para saber si los envíos cambiaron (el orden de las claves no cuenta). */
export function huellaDeEnvios(envios: readonly MailSend[] | null | undefined): string {
  if (!envios) return "";
  return JSON.stringify(envios.map((e) => [
    e.send_id, e.kind, e.label, e.date ?? "", e.audience, e.subject ?? "", e.preheader ?? "", e.opening ?? "", e.collector_label ?? "",
  ]));
}

export function enviosCambiados(a: readonly MailSend[] | null | undefined, b: readonly MailSend[] | null | undefined): boolean {
  return huellaDeEnvios(a) !== huellaDeEnvios(b);
}

/** El envío elegido si existe; si no, la invitación. */
export function envioVigente(envios: readonly MailSend[], sendId: string | null | undefined): MailSend {
  return envios.find((e) => e.send_id === sendId) ?? envios[0] ?? mailSendInvitation();
}

/** Asunto efectivo del envío: el suyo, o el de la plantilla. */
export function asuntoDelEnvio(envio: Pick<MailSend, "subject">, template: Pick<MailTemplate, "subject">): string {
  return envio.subject?.trim() ? envio.subject : template.subject;
}

// ---- el envío que se mira, por campaña (sessionStorage) --------------------------

const CLAVE_ENVIO = "pulso.correos.envio.";

/** El envío que se miraba en esta campaña durante la sesión; `null` si ninguno. */
export function envioRecordado(campaignId: string): string | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage.getItem(CLAVE_ENVIO + campaignId);
  } catch {
    return null;
  }
}

export function recordarEnvio(campaignId: string, sendId: string): void {
  try {
    if (typeof sessionStorage === "undefined") return;
    // Un envío sin guardar no tiene id estable: no se recuerda.
    if (esIdLocal(sendId) || sendId === INVITACION) sessionStorage.removeItem(CLAVE_ENVIO + campaignId);
    else sessionStorage.setItem(CLAVE_ENVIO + campaignId, sendId);
  } catch {
    // Sin almacenamiento (modo privado): vale para esta vista.
  }
}

// ---- pasos en la plataforma --------------------------------------------------------

/** Dónde se pega el HTML de este envío en SurveyMonkey. */
export function pasosEnSurveyMonkey(envio: Pick<MailSend, "kind" | "audience">): string[] {
  if (envio.kind === "invitacion") return ["Recopilador", "Invitación por correo", "Mensaje", "HTML personalizado"];
  return ["Seguimiento", "Enviar recordatorio", ROTULO_DE_AUDIENCIA[envio.audience]];
}
