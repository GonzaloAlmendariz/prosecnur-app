// modeloCampanas.ts — campañas de correo de Material de campo (ADR 0110, E1h).
//
// Un proyecto tiene varios correos («campañas»): cada uno con su plantilla,
// sus destinatarios y su export. Aquí vive la parte que puede equivocarse sin
// React: cómo se lee la campaña elegida en la dirección (`foco`), qué revisión
// se manda en la siguiente escritura, qué nombre es válido, cómo queda la lista
// después de crear, duplicar, renombrar o borrar, y los dos pasos del borrado.
//
// Dirección (§6 del contrato): la campaña es el `foco` de la pestaña Correos,
// `?seccion=catalogo&pestana=correos&foco=<campaign_id>`, y el bloque elegido
// va detrás del mismo separador que usa el editor de fichas:
// `foco=<campaign_id>~<block_id>`.

import {
  MAIL_PLATFORM_DEFAULT,
  MailApiError,
  mailSendInvitation,
  type MailBlock,
  type MailCampaign,
  type MailCampaignSummary,
  type MailSend,
  type MailSendBrief,
  type MailTemplate,
} from "../../../api/materialMail";
import { SEPARADOR_FOCO } from "../editor/modeloEditor";
import { CABECERA, SOBRE } from "./modeloCorreo";

export const LIMITE_CAMPANAS = 20;
export const LARGO_NOMBRE = 80;
export const LARGO_ACTOR = 60;

/** Origen de una campaña nueva: un preset real o la plantilla en blanco. */
export const ORIGEN_EN_BLANCO = "__blanco";

// ---------------------------------------------------------------------------
// Foco: `<campaign_id>` o `<campaign_id>~<block_id>`
// ---------------------------------------------------------------------------

export type FocoDelCorreo = { campaignId: string; blockId: string | null };

export type FocoDelCorreoResuelto = {
  /** Campaña que se mira; `null` sólo si el proyecto no tiene ninguna. */
  campaignId: string | null;
  /** Lo que viene después del separador, sin validar contra la plantilla. */
  blockId: string | null;
  /** Forma canónica del foco, o `null` si no queda nada que escribir. */
  canonico: string | null;
  /** La URL dice otra cosa que la forma canónica: se reescribe con `replace`. */
  reescribir: boolean;
};

export function serializarFocoCorreo(foco: FocoDelCorreo): string {
  return foco.blockId ? `${foco.campaignId}${SEPARADOR_FOCO}${foco.blockId}` : foco.campaignId;
}

/**
 * Lee el foco contra la lista de campañas.
 *
 * - Sin campañas, no hay foco que sostener: si la URL trae uno, se borra.
 * - Vacío, o una campaña que ya no existe (borrada en otra pestaña, enlace
 *   viejo): se reescribe a la primera campaña.
 * - `campana~` sin bloque se normaliza a `campana`.
 */
export function parseFocoCorreo(
  raw: string | null | undefined,
  campanas: readonly Pick<MailCampaignSummary, "campaign_id">[],
): FocoDelCorreoResuelto {
  const texto = (raw ?? "").trim();
  if (!campanas.length) {
    return { campaignId: null, blockId: null, canonico: null, reescribir: texto !== "" };
  }
  const primera = campanas[0].campaign_id;
  const aLaPrimera: FocoDelCorreoResuelto = { campaignId: primera, blockId: null, canonico: primera, reescribir: true };
  if (!texto) return aLaPrimera;
  const corte = texto.indexOf(SEPARADOR_FOCO);
  const campaignId = corte >= 0 ? texto.slice(0, corte) : texto;
  const blockId = corte >= 0 ? texto.slice(corte + SEPARADOR_FOCO.length) : "";
  if (!campanas.some((c) => c.campaign_id === campaignId)) return aLaPrimera;
  if (!blockId) return { campaignId, blockId: null, canonico: campaignId, reescribir: corte >= 0 };
  return { campaignId, blockId, canonico: texto, reescribir: false };
}

/** El foco que corresponde a lo elegido en el editor. El sobre no escribe bloque. */
export function focoDeSeleccion(campaignId: string, seleccion: string): string {
  return serializarFocoCorreo({ campaignId, blockId: seleccion === SOBRE ? null : seleccion });
}

/**
 * Qué se elige en el editor para el bloque del foco: el sobre si no dice
 * ninguno, la cabecera o un bloque que exista. `null` = el bloque ya no está y
 * el foco se reescribe sin él.
 */
export function seleccionDelFoco(blockId: string | null, template: Pick<MailTemplate, "blocks"> | null): string | null {
  if (!blockId) return SOBRE;
  if (blockId === CABECERA) return CABECERA;
  return template?.blocks.some((b: MailBlock) => b.block_id === blockId) ? blockId : null;
}

// ---------------------------------------------------------------------------
// Revisión encadenada
// ---------------------------------------------------------------------------

/**
 * La revisión que se manda en la siguiente escritura (H-f).
 *
 * `state_revision` es una sola para todo el estado de Material de campo. Cada
 * escritura devuelve la nueva; una lectura que salió antes y llega después no
 * puede bajarla, o la siguiente escritura daría un 409 falso. Mismo criterio
 * que `revisionParaGuardar` del editor de fichas.
 */
export function revisionEncadenada(actual: number | null, nueva: number | null | undefined): number | null {
  if (nueva === null || nueva === undefined || !Number.isFinite(nueva)) return actual;
  if (actual === null) return nueva;
  return Math.max(actual, nueva);
}

// ---------------------------------------------------------------------------
// Nombre y actor
// ---------------------------------------------------------------------------

const FORMA_DE_CORREO = /[^\s@]+@[^\s@]+\.[^\s@]+/;

/** Por qué el nombre no sirve, o `null`. Nunca repite el valor escrito. */
export function problemaDelNombre(nombre: string): string | null {
  const limpio = nombre.trim();
  if (!limpio) return "Escribe un nombre para la campaña.";
  if (limpio.length > LARGO_NOMBRE) return `El nombre admite hasta ${LARGO_NOMBRE} caracteres.`;
  if (FORMA_DE_CORREO.test(limpio)) return "El nombre no puede tener forma de dirección de correo.";
  return null;
}

export function problemaDelActor(actor: string): string | null {
  const limpio = actor.trim();
  if (limpio.length > LARGO_ACTOR) return `El actor admite hasta ${LARGO_ACTOR} caracteres.`;
  if (FORMA_DE_CORREO.test(limpio)) return "El actor no puede tener forma de dirección de correo.";
  return null;
}

/** «Recuperación estudiantes · Estudiantes», o sólo el nombre si no hay actor. */
export function rotuloDeCampana(c: Pick<MailCampaignSummary, "name" | "actor">): string {
  const actor = c.actor.trim();
  return actor ? `${c.name} · ${actor}` : c.name;
}

/** Un nombre que no repite el de otra campaña: «Invitación docentes (2)». */
export function nombreLibre(base: string, campanas: readonly Pick<MailCampaignSummary, "name">[]): string {
  const limpio = base.trim().slice(0, LARGO_NOMBRE) || "Correo nuevo";
  const usados = new Set(campanas.map((c) => c.name.trim().toLocaleLowerCase("es-PE")));
  if (!usados.has(limpio.toLocaleLowerCase("es-PE"))) return limpio;
  for (let i = 2; i < 100; i += 1) {
    const sufijo = ` (${i})`;
    const candidato = `${limpio.slice(0, LARGO_NOMBRE - sufijo.length)}${sufijo}`;
    if (!usados.has(candidato.toLocaleLowerCase("es-PE"))) return candidato;
  }
  return limpio;
}

export function nombreDeCopia(nombre: string, campanas: readonly Pick<MailCampaignSummary, "name">[]): string {
  return nombreLibre(`${nombre} (copia)`, campanas);
}

// ---------------------------------------------------------------------------
// La lista después de cada escritura
// ---------------------------------------------------------------------------

/** El resumen de una campaña recién escrita, sin volver a pedir la lista. */
/** El resumen de un envío (lo que lista el selector): sin asunto ni apertura. */
export function resumenDeEnvio(e: MailSend): MailSendBrief {
  return { send_id: e.send_id, kind: e.kind, label: e.label, ...(e.date ? { date: e.date } : {}), audience: e.audience };
}

export function resumenDeCampana(c: MailCampaign, previo?: MailCampaignSummary | null): MailCampaignSummary {
  const t = c.template;
  return {
    campaign_id: c.campaign_id,
    name: c.name,
    actor: c.actor,
    platform: c.platform ?? previo?.platform ?? MAIL_PLATFORM_DEFAULT,
    sends: c.sends.length ? c.sends.map(resumenDeEnvio) : previo?.sends ?? [resumenDeEnvio(mailSendInvitation())],
    preset_id: t ? t.preset_id ?? null : previo?.preset_id ?? null,
    subject: t ? t.subject : previo?.subject ?? "",
    blocks: t ? t.blocks.length : previo?.blocks ?? 0,
    template_revision: t ? t.revision : previo?.template_revision ?? 1,
    template_sha256: t ? t.template_sha256 ?? null : previo?.template_sha256 ?? null,
    updated_at: c.updated_at ?? previo?.updated_at ?? null,
    // Una campaña nueva o duplicada nunca trae destinatarios (son datos personales).
    recipients_loaded: previo?.recipients_loaded ?? false,
  };
}

/** Reemplaza la campaña si existe; si no, la agrega al final. */
export function ponerCampana(campanas: readonly MailCampaignSummary[], resumen: MailCampaignSummary): MailCampaignSummary[] {
  const at = campanas.findIndex((c) => c.campaign_id === resumen.campaign_id);
  if (at < 0) return [...campanas, resumen];
  return campanas.map((c, i) => (i === at ? resumen : c));
}

export function quitarCampana(campanas: readonly MailCampaignSummary[], campaignId: string): MailCampaignSummary[] {
  return campanas.filter((c) => c.campaign_id !== campaignId);
}

/** Tras guardar la plantilla: el asunto y los bloques del resumen ya no son los de antes. */
export function conPlantillaGuardada(
  campanas: readonly MailCampaignSummary[],
  campaignId: string,
  template: MailTemplate,
  sends?: readonly MailSend[],
): MailCampaignSummary[] {
  return campanas.map((c) => (c.campaign_id === campaignId
    ? {
      ...c,
      ...(sends ? { sends: sends.map(resumenDeEnvio) } : {}),
      preset_id: template.preset_id ?? c.preset_id,
      subject: template.subject,
      blocks: template.blocks.length,
      template_revision: template.revision,
      template_sha256: template.template_sha256 ?? c.template_sha256,
    }
    : c));
}

export function conDestinatarios(
  campanas: readonly MailCampaignSummary[],
  campaignId: string,
  cargados: boolean,
): MailCampaignSummary[] {
  return campanas.map((c) => (c.campaign_id === campaignId && c.recipients_loaded !== cargados
    ? { ...c, recipients_loaded: cargados }
    : c));
}

/**
 * Qué campaña se mira después de borrar una: si era la abierta, la que estaba
 * al lado (la siguiente, o la anterior si era la última); si no, la misma.
 */
export function campanaTrasBorrar(
  antes: readonly MailCampaignSummary[],
  borrada: string,
  activa: string | null,
): string | null {
  const despues = quitarCampana(antes, borrada);
  if (!despues.length) return null;
  if (activa && activa !== borrada && despues.some((c) => c.campaign_id === activa)) return activa;
  const at = antes.findIndex((c) => c.campaign_id === borrada);
  return despues[Math.min(Math.max(at, 0), despues.length - 1)].campaign_id;
}

// ---------------------------------------------------------------------------
// Empezar en blanco
// ---------------------------------------------------------------------------

/**
 * Una plantilla mínima y válida sobre la identidad de otra: cabecera, logos,
 * campos, firma y pie se quedan; el cuerpo se reduce a un saludo y un párrafo
 * para escribir. El backend no tiene un preset en blanco: se crea la campaña
 * desde el de fábrica y se guarda esta encima.
 */
export function plantillaEnBlanco(base: MailTemplate, titulo: string): MailTemplate {
  const firma = base.blocks.find((b) => b.type === "signature");
  const pie = base.blocks.find((b) => b.type === "footer_legal");
  const blocks: MailBlock[] = [
    { block_id: "saludo", type: "greeting", text: "Estimado(a):" },
    { block_id: "mensaje", type: "paragraph", text: "[Escribe aquí el mensaje del correo.]" },
  ];
  if (firma) blocks.push(firma);
  if (pie) blocks.push(pie);
  const { preset_id: _preset, ...resto } = base;
  void _preset;
  return {
    ...resto,
    title: titulo,
    subject: "[Asunto del correo]",
    preheader: "",
    blocks,
  };
}

// ---------------------------------------------------------------------------
// Borrar en dos pasos
// ---------------------------------------------------------------------------

export type FaseDelBorrado =
  | { paso: "aviso" }
  | { paso: "nombre"; escrito: string; error: string }
  | { paso: "borrando"; escrito: string };

export type AccionDelBorrado =
  | { type: "continuar" }
  | { type: "escribir"; texto: string }
  | { type: "enviar" }
  | { type: "fallo"; mensaje: string }
  | { type: "volver" }
  | { type: "reiniciar" };

export const BORRADO_INICIAL: FaseDelBorrado = { paso: "aviso" };

/**
 * Paso 1 dice qué se pierde; paso 2 pide escribir el nombre, que viaja como
 * `confirm_name`. El backend vuelve a compararlo: la confirmación es doble.
 */
export function reducirBorrado(fase: FaseDelBorrado, accion: AccionDelBorrado): FaseDelBorrado {
  switch (accion.type) {
    case "reiniciar":
      return BORRADO_INICIAL;
    case "continuar":
      return fase.paso === "aviso" ? { paso: "nombre", escrito: "", error: "" } : fase;
    case "escribir":
      return fase.paso === "nombre" ? { paso: "nombre", escrito: accion.texto, error: "" } : fase;
    case "enviar":
      return fase.paso === "nombre" ? { paso: "borrando", escrito: fase.escrito } : fase;
    case "fallo":
      return fase.paso === "borrando" ? { paso: "nombre", escrito: fase.escrito, error: accion.mensaje } : fase;
    case "volver":
      return fase.paso === "nombre" ? BORRADO_INICIAL : fase;
  }
}

/** El nombre escrito es EXACTAMENTE el de la campaña (mayúsculas y tildes incluidas). */
export function nombreConfirmado(fase: FaseDelBorrado, nombre: string): boolean {
  return fase.paso === "nombre" && fase.escrito === nombre && nombre !== "";
}

// ---------------------------------------------------------------------------
// Avisos
// ---------------------------------------------------------------------------

const AVISO_DE_CAMPANA: Readonly<Record<string, string>> = {
  E_COLLECTION_MAIL_CAMPAIGN_NOT_FOUND: "Esa campaña ya no existe en el proyecto. Se volvió a leer la lista.",
  E_COLLECTION_MAIL_CAMPAIGN_REQUIRED: "Elige una campaña de correo.",
  E_COLLECTION_MAIL_CAMPAIGN_NAME: "El nombre o el actor tienen forma de dirección de correo: escribe un rótulo que no la tenga.",
  E_COLLECTION_MAIL_CAMPAIGN_LIMIT: `Un proyecto admite hasta ${LIMITE_CAMPANAS} campañas de correo. Borra una para crear otra.`,
  E_COLLECTION_MAIL_CAMPAIGN_CONFIRM: "El nombre escrito no coincide con el de la campaña.",
  E_COLLECTION_STATE_STALE: "Otro cambio del módulo se guardó antes. Se volvió a leer la lista de campañas.",
};

/** El aviso de una escritura de campañas rechazada; nunca repite el valor escrito. */
export function avisoDeCampana(cause: unknown, fallback: string): string {
  if (cause instanceof MailApiError && AVISO_DE_CAMPANA[cause.code]) return AVISO_DE_CAMPANA[cause.code];
  return cause instanceof Error && cause.message ? cause.message : fallback;
}

/** Rechazos tras los que la lista local ya no es la del servidor. */
export function hayQueReleerCampanas(cause: unknown): boolean {
  return cause instanceof MailApiError
    && (cause.code === "E_COLLECTION_STATE_STALE" || cause.code === "E_COLLECTION_MAIL_CAMPAIGN_NOT_FOUND");
}

export const AVISO_LISTA_PROVISIONAL =
  "La lista de destinatarios que estaba cargada antes de crear la campaña se olvidó: impórtala en esta campaña.";
