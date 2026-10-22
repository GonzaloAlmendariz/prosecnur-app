// Lo que dice la tarjeta «Mailchimp» de Envíos (cargar la audiencia, crear el
// borrador): una frase por resultado y solo las líneas que traen algo. Sin
// correos: el backend devuelve conteos. También recuerda, en este equipo, lo
// último elegido (comodidad, no estado del proyecto).

import type { ResultadoDeAudiencia, ResultadoDeBorrador } from "../../../api/mailchimpSync";
import type { MailSendKind } from "../../../api/materialMail";
import { ApiError } from "../../../api/core";

const n = (v: number) => v.toLocaleString("es-PE");
const uno = (v: number, a: string, b: string) => (v === 1 ? a : b);
const contactos = (v: number) => `${n(v)} ${uno(v, "contacto", "contactos")}`;

/** Los `error_code` de Mailchimp más comunes, dichos como se entienden. */
const MOTIVOS: Record<string, string> = {
  ERROR_CONTACT_EXISTS: "ya estaba en la audiencia",
  ERROR_GENERIC: "Mailchimp lo rechazó sin detalle",
  ERROR_INVALID_EMAIL: "correo no válido",
  ERROR_FAKE_EMAIL: "correo que Mailchimp considera falso",
  ERROR_COMPLIANCE: "se dio de baja antes y Mailchimp no deja volver a suscribirlo",
  ERROR_MERGE_FIELD: "un campo no tiene el formato que espera Mailchimp",
};

export function motivoDeFallo(code: string): string {
  return MOTIVOS[code.toUpperCase()] ?? code;
}

export function resumenDeAudiencia(r: ResultadoDeAudiencia): { titulo: string; lineas: string[] } {
  const titulo = `${contactos(r.recipients)} en Mailchimp: ${n(r.created)} ${uno(r.created, "nuevo", "nuevos")}, ${n(r.updated)} ${uno(r.updated, "actualizado", "actualizados")}.`;
  const lineas: string[] = [];
  if (r.failed > 0) {
    const detalle = r.failed_by_reason.map((m) => `${n(m.n)} por ${motivoDeFallo(m.code)}`).join("; ");
    lineas.push(`${n(r.failed)} no ${uno(r.failed, "se pudo", "se pudieron")} subir${detalle ? ` (${detalle})` : ""}.`);
  }
  if (r.tag) {
    lineas.push(r.tagged === r.recipients
      ? `Todos quedaron con la etiqueta «${r.tag}».`
      : `${contactos(r.tagged)} con la etiqueta «${r.tag}».`);
  }
  if (r.merge_fields_created.length) {
    lineas.push(`${uno(r.merge_fields_created.length, "Campo nuevo", "Campos nuevos")} en la audiencia: ${r.merge_fields_created.join(", ")}.`);
  }
  return { titulo, lineas };
}

export function resumenDeBorrador(r: ResultadoDeBorrador): { titulo: string; lineas: string[] } {
  const lineas: string[] = [];
  if (r.subject) lineas.push(`Asunto: «${r.subject}».`);
  lineas.push(r.recipient_count == null
    ? "Mailchimp todavía no calcula a cuántos irá."
    : `Irá a ${contactos(r.recipient_count)}.`);
  if (r.images_uploaded > 0) {
    lineas.push(`${n(r.images_uploaded)} ${uno(r.images_uploaded, "imagen subida", "imágenes subidas")} a Mailchimp.`);
  }
  return { titulo: "Borrador listo en Mailchimp.", lineas };
}

/** La etiqueta que el borrador deja fuera: la de «respondió» sólo en recordatorios. */
export function etiquetaExcluida(kind: MailSendKind, etiquetaRespondio: string): string | undefined {
  if (kind !== "recordatorio") return undefined;
  return etiquetaRespondio.trim() || "Respondió";
}

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Qué falta para crear el borrador, en una línea; vacío si está todo. */
export function faltaParaElBorrador(remitente: Remitente, audiencia: string): string {
  if (!audiencia) return "Elige la audiencia de Mailchimp.";
  if (!remitente.from_name.trim()) return "Escribe el nombre del remitente.";
  if (!CORREO.test(remitente.reply_to.trim())) return "Escribe un correo de respuesta válido.";
  return "";
}

/** Texto del avance de un job: «Mailchimp: 1,500 de 45,078 · 3%». */
export function textoDeAvance(progreso: { percent: number | null; message: string } | null, rotulo: string): string {
  if (!progreso) return `${rotulo}…`;
  const pct = progreso.percent != null ? ` · ${Math.round(progreso.percent)}%` : "";
  return `${progreso.message || rotulo}${pct}`;
}

const CODIGOS_DE_CONEXION = new Set(["E_MAILCHIMP_TOKEN", "E_MAILCHIMP_API", "E_MAILCHIMP_SYNC_SURVEYMONKEY"]);

/** El mensaje de un error; si es de conexión, remite a donde se arregla. */
export function mensajeDeError(e: unknown, porDefecto: string): string {
  // `ApiError` agrega « · E_CODIGO» al mensaje: es para el log, no para la persona.
  const base = e instanceof Error && e.message ? e.message.replace(/\s·\s[A-Z0-9_]+$/, "") : porDefecto;
  if (e instanceof ApiError && CODIGOS_DE_CONEXION.has(e.code)) {
    return `${base} Revisa la conexión en Configuración › Conexiones.`;
  }
  return base;
}

// ---------- Lo recordado en este equipo ----------

export type Remitente = { from_name: string; reply_to: string };
export type EleccionMailchimp = { list_id: string; tag: string };

const CLAVE_REMITENTE = "pulso.correos.mailchimp.remitente";
const CLAVE_CAMPANA = (campana: string) => `pulso.correos.mailchimp.${campana}`;

function leer(clave: string): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(clave);
    const v: unknown = raw ? JSON.parse(raw) : null;
    return typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function escribir(clave: string, valor: unknown): void {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    // Sin almacenamiento: se vuelve a escribir la próxima vez.
  }
}

const texto = (v: unknown) => (typeof v === "string" ? v : "");

export function leerRemitente(): Remitente {
  const o = leer(CLAVE_REMITENTE);
  return { from_name: texto(o?.from_name), reply_to: texto(o?.reply_to) };
}

export function guardarRemitente(r: Remitente): void {
  escribir(CLAVE_REMITENTE, { from_name: r.from_name.trim(), reply_to: r.reply_to.trim() });
}

export function leerEleccionMailchimp(campana: string | null): EleccionMailchimp | null {
  if (!campana) return null;
  const o = leer(CLAVE_CAMPANA(campana));
  return o ? { list_id: texto(o.list_id), tag: texto(o.tag) } : null;
}

export function guardarEleccionMailchimp(campana: string | null, e: EleccionMailchimp): void {
  if (campana) escribir(CLAVE_CAMPANA(campana), e);
}

/**
 * Los pasos de la tarjeta Mailchimp según el envío: «quién ya respondió» solo
 * existe en un recordatorio (la invitación va a todos).
 */
export type PasoMailchimp = "audiencia" | "respondieron" | "borrador";
export function pasosDelEnvio(kind: string): PasoMailchimp[] {
  return kind === "recordatorio" ? ["audiencia", "respondieron", "borrador"] : ["audiencia", "borrador"];
}
