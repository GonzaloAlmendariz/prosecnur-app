// materialMail.ts — correos para Mailchimp de Material de campo (ADR 0110 §2,
// etapa E1f: «Correos: componer aquí, enviar en Mailchimp»).
//
// Contrato `collection_mail_template/v2` (lee también v1), todo bajo /api/recopiladores/:
//   GET    mail-presets                 plantillas reales y registro de bloques
//   GET    mail-template                plantilla activa (o la de fábrica)
//   PUT    mail-template                guarda con revisión optimista
//   POST   mail-template/preview        HTML para la vista (borrador o guardada)
//   POST   mail-template/review         chequeos antes de exportar
//   POST   mail-template/export         ZIP para Mailchimp (plantilla GUARDADA)
//   POST   mail-recipients/import       CSV/XLSX de destinatarios (multipart)
//   GET    mail-recipients              resumen sin correos
//   PUT    mail-recipients/mapping      columnas → campos
//   DELETE mail-recipients              olvidar la lista
//
// Campañas (E1h, `collection_mail_campaigns/v1`): un proyecto tiene varios
// correos, cada uno con su plantilla y sus destinatarios.
//   GET    mail-campaigns               resumen de cada campaña (sin plantilla)
//   POST   mail-campaigns               crea desde un preset
//   POST   mail-campaigns/duplicate     copia la plantilla, nunca los destinatarios
//   PUT    mail-campaigns/meta          renombra o cambia el actor
//   POST   mail-campaigns/delete        borra con `confirm_name` idéntico al nombre
//
// Plataforma, envíos e importación (E1j·E1k·E1l):
//   - cada campaña sale para Mailchimp o SurveyMonkey (`platform`); pasar a
//     SurveyMonkey olvida sus destinatarios (`recipients_purged`);
//   - una campaña tiene de 1 a 6 envíos (`sends`): la invitación y sus
//     recordatorios, con asunto, preheader y apertura propios. PUT
//     mail-template guarda plantilla y envíos juntos; preview, review y export
//     aceptan `send_id` (o `send`, un borrador);
//   - POST mail-template/import-html lee un HTML existente y lo devuelve como
//     plantilla con su informe (no escribe nada); `import_id` lo cita después.
// Todo `mail-*` acepta `campaign_id` (consulta en GET/DELETE, cuerpo en
// POST/PUT, parte del multipart en el import). Con dos o más campañas es
// obligatorio: sin él el backend responde 422 E_COLLECTION_MAIL_CAMPAIGN_REQUIRED.
//
// Vive aparte de `recopiladores.ts` porque es un dominio propio. Los
// normalizadores son defensivos: R serializa un vector de largo uno como
// escalar y una lista vacía con nombres como `{}`; un campo que falta se lee
// como ausente, no se inventa.
//
// **Privacidad.** Los destinatarios son datos personales: el backend nunca
// manda correos y este módulo no los guarda en ningún almacenamiento del
// navegador. Lo que llega vive en memoria mientras la vista existe.

import { ApiError, apiFetch, handle, headers } from "./core";

/**
 * Esquema que escribe este cliente. El backend lee v1 y la sube a v2 sin
 * cambiar su contenido (E1g); PUT, vista previa y revisión aceptan las dos.
 */
export const MAIL_TEMPLATE_SCHEMA = "collection_mail_template/v2";
export const MAIL_TEMPLATE_SCHEMAS = ["collection_mail_template/v1", MAIL_TEMPLATE_SCHEMA] as const;
export type MailTemplateSchema = (typeof MAIL_TEMPLATE_SCHEMAS)[number];

export const MAIL_BLOCK_TYPES = [
  "greeting",
  "heading",
  "paragraph",
  "button",
  "callout",
  "list",
  "divider",
  "image",
  "signature",
  "footer_legal",
  // Piezas gráficas (E1o, collection_mail_piezas.R).
  "band",
  "ornament",
  "icon_text",
  "two_images",
] as const;
export type MailBlockType = (typeof MAIL_BLOCK_TYPES)[number];

export type MailAlign = "left" | "justify" | "center";
export type MailCalloutVariant = "box" | "bar" | "tinte";

/**
 * El saludo según la persona (ADR 0110 §«Saludo por sexo», C8). La palabra que
 * cambia es `respaldo` (su primera aparición en el texto del saludo): con
 * `por_sexo` y `columna`, cada persona recibe `masculino` o `femenino` según
 * esa columna de la lista; sin dato o sin columna, `respaldo`. Al `.pulso` sólo
 * entra el NOMBRE de la columna.
 */
export const MAIL_TRATO_MODOS = ["fijo", "por_sexo"] as const;
export type MailTratoModo = (typeof MAIL_TRATO_MODOS)[number];
export type MailTrato = {
  modo: MailTratoModo;
  columna?: string;
  masculino: string;
  femenino: string;
  respaldo: string;
  /** SurveyMonkey: `CustomDataN`; sin él, el backend usa el primero libre. */
  sm?: string;
};
export const MAIL_TRATO_PALABRAS = { masculino: "Estimado", femenino: "Estimada", respaldo: "Estimado(a)" } as const;

export type MailGreetingBlock = { block_id: string; type: "greeting"; text: string; fallback?: string; trato?: MailTrato };
export type MailHeadingBlock = {
  block_id: string;
  type: "heading";
  text: string;
  level?: "titulo" | "subtitulo";
  align?: "left" | "center";
};
export type MailParagraphBlock = {
  block_id: string;
  type: "paragraph";
  text: string;
  align?: MailAlign;
  size?: "normal" | "pequeno";
  tone?: "normal" | "suave";
};
export type MailButtonBlock = {
  block_id: string;
  type: "button";
  text: string;
  url: string;
  note?: string[];
  align?: "center" | "left";
  size?: "compacto" | "normal" | "grande";
  fill?: "solido" | "contorno";
};
export type MailDividerBlock = {
  block_id: string;
  type: "divider";
  style?: "linea" | "espacio";
  size?: "s" | "m" | "l";
};
export type MailImageBlock = {
  block_id: string;
  type: "image";
  image_ref: string;
  alt: string;
  /** 40 a 600 px; sin él, el ancho natural / 2. */
  width?: number;
  align?: "left" | "center" | "right";
  url?: string;
  /** A todo el ancho, sin margen. */
  bleed?: boolean;
  /** Decorativa (E1o): sale con alt vacío y la revisión no le pide descripción. */
  decorative?: boolean;
};

// ---- piezas gráficas (E1o) -------------------------------------------------------
// Enumeraciones cerradas, espejo de `.CMAIL_STYLE_ENUMS` y `.CMAIL_ICONS`. El
// color es opcional: sin él la pieza usa el acento (sobrio) o el relleno del
// botón (campaña), igual que el render.

/** Alto de la banda: 8, 16 o 32 px. */
export const MAIL_BAND_HEIGHTS = ["s", "m", "l"] as const;
export type MailBandHeight = (typeof MAIL_BAND_HEIGHTS)[number];
export const MAIL_ORNAMENT_STYLES = ["onda", "puntos", "linea_doble"] as const;
export type MailOrnamentStyle = (typeof MAIL_ORNAMENT_STYLES)[number];
export const MAIL_ICONS = [
  "calendario", "reloj", "candado", "sobre", "persona", "grupo",
  "mapa", "check", "info", "alerta", "regalo", "enlace",
] as const;
export type MailIcon = (typeof MAIL_ICONS)[number];

export type MailBandBlock = { block_id: string; type: "band"; color?: string; height?: MailBandHeight };
export type MailOrnamentBlock = { block_id: string; type: "ornament"; style?: MailOrnamentStyle; color?: string };
/** Sin `icon` el backend responde `missing_icon`: no se inventa uno al leer. */
export type MailIconTextBlock = { block_id: string; type: "icon_text"; icon?: MailIcon; text: string };
export type MailTwoImagesBlock = {
  block_id: string;
  type: "two_images";
  left: string;
  right: string;
  alt_left: string;
  alt_right: string;
};
export type MailCalloutBlock = {
  block_id: string;
  type: "callout";
  title?: string;
  items: string[];
  variant?: MailCalloutVariant;
};
export type MailListBlock = { block_id: string; type: "list"; items: string[]; ordered?: boolean };
export type MailSignatureBlock = {
  block_id: string;
  type: "signature";
  closing?: string;
  name: string;
  lines?: string[];
  url?: string;
};
export type MailFooterBlock = { block_id: string; type: "footer_legal"; text?: string; address?: string };

/**
 * Bloque de un tipo que este cliente no conoce (un backend más nuevo, o una
 * plantilla escrita a mano). No se edita ni se resume aquí, pero tampoco se
 * pierde: `raw` es el objeto tal como llegó y es lo que vuelve al backend.
 */
export const MAIL_OPAQUE_BLOCK = "__no_reconocido" as const;
export type MailOpaqueBlock = {
  block_id: string;
  type: typeof MAIL_OPAQUE_BLOCK;
  original_type: string;
  raw: Record<string, unknown>;
};

export type MailKnownBlock =
  | MailGreetingBlock
  | MailHeadingBlock
  | MailParagraphBlock
  | MailButtonBlock
  | MailCalloutBlock
  | MailListBlock
  | MailDividerBlock
  | MailImageBlock
  | MailSignatureBlock
  | MailFooterBlock
  | MailBandBlock
  | MailOrnamentBlock
  | MailIconTextBlock
  | MailTwoImagesBlock;

export type MailBlock = MailKnownBlock | MailOpaqueBlock;

export function isOpaqueMailBlock(block: MailBlock): block is MailOpaqueBlock {
  return block.type === MAIL_OPAQUE_BLOCK;
}

export type MailHeader =
  | { kind: "logos"; logo_ids: string[]; background: "dark" | "light" }
  | { kind: "banner"; image_ref: string };

export type MailImage = { alt: string; url?: string };

export type MailField = {
  key: string;
  tag: string;
  label: string;
  fallback?: string;
  /** Etiqueta de SurveyMonkey (addendum E1j): `SurveyLink`, `LastName` o `CustomDataN`. */
  sm?: string;
  /**
   * A dónde lleva el campo cuando es un enlace: `encuesta` (el de la persona)
   * u `otro` (un enlace fijo). Uno `otro` no puede ir a `[SurveyLink]`.
   */
  destino?: MailFieldDestino;
};

export type MailFieldDestino = "encuesta" | "otro";

export type MailTemplate = {
  schema: MailTemplateSchema;
  template_id: string;
  preset_id?: string;
  title?: string;
  revision: number;
  template_sha256?: string;
  subject: string;
  preheader: string;
  /** `band` (E1j): color de la franja de cierre; el resto, el estilo del correo (E1n). */
  theme: MailTheme;
  header: MailHeader;
  images: Record<string, MailImage>;
  fields: MailField[];
  blocks: MailBlock[];
};

export type MailPreset = { preset_id: string; title: string; template: MailTemplate };

export type MailBand = "suave" | "acento";

/**
 * Estilo del correo (E1n, ampliación de `theme` sin cambio de esquema).
 * `estilo` ausente es `sobrio`, el render de siempre; `campana` pinta el fondo
 * de la página a todo el ancho y el cuerpo directo sobre él, sin tarjeta.
 */
export const MAIL_ESTILOS = ["sobrio", "campana"] as const;
export type MailEstilo = (typeof MAIL_ESTILOS)[number];
/** Alineación del cuerpo; ausente es `justify` en los dos estilos. */
export const MAIL_TEXT_ALIGNS = ["justify", "left", "center"] as const;
export type MailTextAlign = (typeof MAIL_TEXT_ALIGNS)[number];
export const MAIL_ONDAS = ["ninguna", "pie"] as const;
export type MailOnda = (typeof MAIL_ONDAS)[number];

export type MailTheme = {
  accent: string;
  link?: string;
  band?: MailBand;
  estilo?: MailEstilo;
  /** Sólo campaña: fondo de la página a todo el ancho; sin él, el acento. */
  page_bg?: string;
  /** Sólo campaña: relleno del botón; sin él, el amarillo de la casa. */
  button_bg?: string;
  /** Sin él, el de mejor contraste con `button_bg`. */
  button_text?: string;
  text_align?: MailTextAlign;
  onda?: MailOnda;
  /** Sin él, `button_bg`. */
  onda_color?: string;
};

/** Plataforma de envío de una campaña (E1j). Sin ella, la campaña es de Mailchimp. */
export const MAIL_PLATFORMS = ["mailchimp", "surveymonkey"] as const;
export type MailPlatform = (typeof MAIL_PLATFORMS)[number];
export const MAIL_PLATFORM_DEFAULT: MailPlatform = "mailchimp";

/** A quién va un envío: la invitación a todos; un recordatorio, a los rótulos de «Send To» de SurveyMonkey. */
export const MAIL_SEND_AUDIENCES = ["todos", "sin_respuesta", "parcial", "ambos"] as const;
export type MailSendAudience = (typeof MAIL_SEND_AUDIENCES)[number];
export type MailSendKind = "invitacion" | "recordatorio";

/**
 * Un envío de la campaña (E1k): la invitación o un recordatorio. El cuerpo es
 * el de la plantilla; el envío cambia sólo su asunto, su preheader y suma una
 * apertura. `send_id` lo asigna el servidor (`recordatorio-<k>`): un envío
 * recién agregado, todavía sin guardar, lleva un id local (ver modeloEnvios).
 */
export type MailSend = {
  send_id: string;
  kind: MailSendKind;
  label: string;
  /** AAAA-MM-DD, sólo para planificar. */
  date?: string;
  audience: MailSendAudience;
  subject?: string;
  preheader?: string;
  opening?: string;
  /** Nombre o id del recopilador de SurveyMonkey por el que sale. */
  collector_label?: string;
};

/** Lo que trae el resumen de campañas y la vista previa: sin asunto ni apertura. */
export type MailSendBrief = Pick<MailSend, "send_id" | "kind" | "label" | "date"> & { audience?: MailSendAudience };

/** Aviso de los envíos al guardar (no bloquea): hoy, `send_dates`. */
export type MailSendWarning = { code: string; send_id: string | null; detail: string };

export type MailPresetsPayload = {
  schema: typeof MAIL_TEMPLATE_SCHEMA;
  reserved_tags: string[];
  block_types: MailBlockType[];
  presets: MailPreset[];
};

export type MailTemplatePayload = {
  state_revision: number;
  /** Campaña a la que pertenece la plantilla; `null` si el backend no lo dice. */
  campaign_id?: string | null;
  builtin: boolean;
  template: MailTemplate;
  platform: MailPlatform;
  /** Los envíos completos de la campaña; al menos la invitación. */
  sends: MailSend[];
  /**
   * Problemas de la plantilla GUARDADA cuando ya no cumple el contrato (un
   * `.pulso` de otra versión o editado a mano). Vacío si es válida. Mientras
   * haya, exportar e importar responden 409: hay que guardarla corregida.
   */
  stored_problems: MailProblem[];
};

export type MailTemplatePutPayload = {
  noop: boolean;
  state_revision: number;
  campaign_id?: string | null;
  template: MailTemplate;
  /** Los envíos como quedaron: los recordatorios nuevos ya traen su `send_id`. */
  sends: MailSend[];
  send_warnings: MailSendWarning[];
};

/** `export`: el HTML de la plataforma de la campaña; `mailchimp` es su alias viejo. */
export type MailPreviewMode = "preview" | "export" | "mailchimp";

export type MailRecipientView = {
  source: "imported" | "synthetic";
  index: number | null;
  nombre: string;
  fields: Record<string, string>;
  /** La palabra del saludo de esta persona (C8), si el saludo es por sexo. */
  trato?: string;
};

export type MailPreview = {
  mode: MailPreviewMode;
  platform: MailPlatform;
  dialect: MailPlatform;
  /** El envío que se pintó (la invitación si no se pidió otro). */
  send: MailSendBrief | null;
  html: string;
  subject: string;
  preheader: string;
  bytes: number;
  recipient: MailRecipientView;
};

export type MailCheckStatus = "ok" | "warning" | "error";

export const MAIL_CHECK_CODES = [
  "subject",
  "preheader",
  "html_weight",
  "images_hosted",
  "images_available",
  "images_alt",
  "banner_size",
  "footer_unsub",
  "recipients",
  "tags_have_columns",
  "fields_empty",
  "names_unsplit",
  "duplicates_conflicting",
  "import_zip_weight",
  "accent_contrast",
  "image_width",
  "image_weight",
  // SurveyMonkey (E1j) y envíos (E1k).
  "survey_link",
  "footer_optout",
  "images_public_url",
  "sm_fields_mapped",
  "sm_fallback",
  "sm_custom_limit",
  "send_dates",
  "reminder_audience",
  "sm_link_field_empty",
  // Saludo por sexo (C8).
  "greeting_trato",
  "greeting_trato_word",
  "sm_trato_blank",
  // Estilo campaña (E1n): sólo con `theme.estilo = "campana"`; `value` es la razón de contraste.
  "campana_text_contrast",
  "campana_button_contrast",
  "campana_footer_contrast",
  // Textos de relleno entre corchetes sin completar («[fecha límite]»); bloquea exportar.
  "placeholders_pending",
  // Piezas gráficas (E1o): una pieza que casi no se distingue del fondo; íconos sin URL en SurveyMonkey.
  "piezas_contrast",
  "icon_text_sm_icon",
] as const;
export type MailCheckCode = (typeof MAIL_CHECK_CODES)[number];

/** Un valor de una fila del detalle; las listas (`uses`, `tags`) llegan como texto. */
export type MailCheckItemValue = string | number | boolean | string[];

/** Un elemento del detalle: un id de imagen o una fila (etiqueta, columna, vacíos). */
export type MailCheckItem = string | Record<string, MailCheckItemValue>;

/** Dónde se ve un chequeo en el correo: un bloque (o `__cabecera`) y, si aplica, su propiedad. */
export type MailCheckTarget = { block_id: string; prop?: string };

export type MailCheck = {
  code: string;
  status: MailCheckStatus;
  value: string | number | null;
  detail: string;
  items: MailCheckItem[];
  targets: MailCheckTarget[];
};

/** `completo`: plantilla + audiencia; `plantilla`: sólo el ZIP importable, sin datos personales. */
export type MailExportScope = "completo" | "plantilla";

export type MailReview = {
  /** Dialecto con el que se revisó; `null` si el backend no lo dice. */
  platform: MailPlatform | null;
  send_id: string | null;
  template_sha256: string;
  ready: boolean;
  errors: number;
  warnings: number;
  checks: MailCheck[];
};

export type MailArtifact = {
  file_id: string;
  role: string;
  filename: string;
  media_type: string;
  size_bytes: number;
  sha256: string;
  audience: string;
  sensitivity: string;
};

export type MailExportPayload = {
  scope?: MailExportScope;
  platform: MailPlatform;
  send_id: string | null;
  /** SurveyMonkey: el HTML que va dentro del ZIP. */
  html: { name: string; bytes: number } | null;
  /** El ZIP que se importa en Mailchimp, dentro del paquete. */
  import_zip?: { size_bytes: number; entries: string[]; html: string } | null;
  artifacts: MailArtifact[];
  zip: MailArtifact | null;
  review: { ready: boolean; errors: number; warnings: number } | null;
  manifest: Record<string, unknown> | null;
  /**
   * Lo que el backend registró de esta exportación (ADR 0111 §8): el envío,
   * cuándo y por qué plataforma. Ausente en la campaña virtual o en un backend
   * anterior al registro.
   */
  export_recorded?: { send_id: string; last_export_at: string; last_export_platform: MailPlatform } | null;
};

export type MailNameFormat = "apellidos_coma_nombres" | "nombre";

export type MailRecipientsMapping = {
  email_column: string | null;
  name_column: string | null;
  name_format: MailNameFormat;
  fields: Record<string, string>;
};

export type MailRecipientsCounts = {
  total: number;
  valid: number;
  without_email: number;
  invalid_email: number;
  duplicated: number;
  names_unsplit: number;
  /** Correos repetidos cuyas filas traen otro dato (se usa la primera). */
  duplicated_conflicting: number;
  /** Destinatarios efectivos con algún campo sin dato. */
  persons_with_any_empty: number;
  /** Filas vacías del archivo que se descartaron; NO cuentan en `total`. */
  rows_blank_dropped: number;
};

export type MailRecipientsEncoding = "utf-8" | "windows-1252" | "utf-16";

export type MailRecipientSample = { index: number; nombre: string; fields: Record<string, string>; trato?: string };

/** Cómo se leyó «M» en la columna de sexo (se decide con todos sus valores). */
export const MAIL_TRATO_LECTURAS = ["m_f", "h_m", "m_ambigua", "sin_m"] as const;
export type MailTratoLectura = (typeof MAIL_TRATO_LECTURAS)[number];

/** El saludo por sexo resuelto contra la lista cargada (sin valores de nadie). */
export type MailRecipientsTrato = {
  block_id: string;
  columna: string | null;
  presente: boolean;
  lectura: MailTratoLectura | null;
  counts: { efectivos: number; masculino: number; femenino: number; sin_dato: number; no_reconocido: number } | null;
  /** Hasta 10 valores distintos que no se reconocieron. */
  no_reconocidos: string[];
  palabras: { masculino: string; femenino: string; respaldo: string } | null;
};

export type MailRecipients = {
  loaded: boolean;
  file_name: string | null;
  imported_at: string | null;
  row_count: number;
  /** Cómo se leyó el CSV; `null` en un XLSX o si el backend no lo dice. */
  encoding: MailRecipientsEncoding | null;
  columns: string[];
  mapping: MailRecipientsMapping | null;
  counts: MailRecipientsCounts | null;
  sample: MailRecipientSample[];
  /** Ausente si el saludo no es por sexo con columna, o en un backend anterior. */
  trato?: MailRecipientsTrato | null;
};

export type MailProblem = { path: string; code: string; detail: string };

/** Resumen de una campaña: lo que lista el selector, sin la plantilla completa. */
export type MailCampaignSummary = {
  campaign_id: string;
  name: string;
  actor: string;
  platform: MailPlatform;
  /** Los envíos, sin asunto ni apertura; al menos la invitación. */
  sends: MailSendBrief[];
  preset_id: string | null;
  subject: string;
  blocks: number;
  template_revision: number;
  template_sha256: string | null;
  updated_at: string | null;
  /** Hay una lista importada en esta sesión (no dice cuántas personas ni quiénes). */
  recipients_loaded: boolean;
};

export type MailCampaignsPayload = {
  state_revision: number;
  /** La lista viene de una plantilla única anterior, todavía sin escribir. */
  legacy_migrated: boolean;
  campaigns: MailCampaignSummary[];
};

export type MailCampaign = {
  campaign_id: string;
  name: string;
  actor: string;
  created_at: string | null;
  updated_at: string | null;
  duplicated_from: string | null;
  platform: MailPlatform;
  /** Vacío si la respuesta no los trae. */
  sends: MailSend[];
  /** `null` cuando la respuesta no trae plantilla (renombrar). */
  template: MailTemplate | null;
};

export type MailCampaignWrite = {
  state_revision: number;
  campaign: MailCampaign;
  /** Al crear la primera campaña se olvidó la lista de la campaña provisional. */
  recipients_purged_virtual: boolean;
};

export type MailCampaignDuplicate = MailCampaignWrite & { recipients_copied: boolean };

export type MailCampaignMeta = {
  noop: boolean;
  state_revision: number;
  campaign: MailCampaign;
  /** Pasar a SurveyMonkey olvidó la lista de destinatarios de la campaña. */
  recipients_purged: boolean;
};

/** Un ítem del informe de importación: qué se descartó, se movió o no se reconoció. */
export type MailImportReportItem = {
  code: string;
  selector: string | null;
  excerpt: string;
  reason: string;
  /** El bloque donde quedó (o lo que lo reemplazó), si hay uno. */
  block_id: string | null;
};

export type MailImportImage = { id: string; url: string | null; alt: string; status: "url" | "needs_upload" };

export type MailImportHtml = {
  import_id: string;
  sha256: string;
  bytes: number;
  /** `null`: no se reconoció ninguna plataforma (el backend omite el campo). */
  platform_detected: MailPlatform | null;
  platform_evidence: Record<MailPlatform, number>;
  template: MailTemplate;
  report: MailImportReportItem[];
  images: MailImportImage[];
  stats: { blocks: number; dropped_empty: number; discarded: string[] };
};

export type MailCampaignDelete = { state_revision: number; deleted: string; recipients_purged: boolean };

// ---- normalización ------------------------------------------------------------

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function contractError(detail: string): Error {
  return new Error(`El backend devolvió un correo inválido: ${detail}`);
}

/** Escalar de texto; un vector de largo uno de R llega como `["x"]`. */
function str(value: unknown): string {
  if (Array.isArray(value) && value.length === 1) return str(value[0]);
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function optStr(value: unknown): string | undefined {
  const text = str(value);
  return text ? text : undefined;
}

function strOrNull(value: unknown): string | null {
  const text = str(value).trim();
  return text ? text : null;
}

function num(value: unknown, fallback: number): number {
  if (Array.isArray(value) && value.length === 1) return num(value[0], fallback);
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(n) ? n : fallback;
}

function int(value: unknown, fallback = 0): number {
  return Math.trunc(num(value, fallback));
}

function bool(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0 && bool(value[0]);
  return value === true || value === "true" || value === 1;
}

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function stringMap(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value)) {
    const text = str(raw);
    if (typeof raw === "string" || Array.isArray(raw) || typeof raw === "number") out[key] = text;
  }
  return out;
}

function list(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  // Un único objeto donde se esperaba una lista (unboxing de R).
  return isRecord(value) ? [value] : [];
}

/** `#rrggbb` en minúsculas; `#RGB` se expande. Cualquier otra cosa es ausente. */
function hexColor(value: unknown): string | undefined {
  const text = str(value).trim();
  const seis = /^#([0-9a-f]{6})$/i.exec(text);
  if (seis) return `#${seis[1].toLowerCase()}`;
  const tres = /^#([0-9a-f]{3})$/i.exec(text);
  return tres ? `#${tres[1].split("").map((c) => c + c).join("").toLowerCase()}` : undefined;
}

function oneOf<T extends string>(value: unknown, options: readonly T[]): T | undefined {
  const text = str(value);
  return (options as readonly string[]).includes(text) ? (text as T) : undefined;
}

/** El trato de un saludo, con sus palabras por defecto; `undefined` si no hay. */
export function normalizeMailTrato(value: unknown): MailTrato | undefined {
  if (!isRecord(value)) return undefined;
  const palabra = (k: keyof typeof MAIL_TRATO_PALABRAS) => {
    const v = str(value[k]);
    return v.trim() ? v : MAIL_TRATO_PALABRAS[k];
  };
  const columna = str(value.columna).trim();
  const sm = str(value.sm).trim();
  return {
    modo: oneOf(value.modo, MAIL_TRATO_MODOS) ?? "por_sexo",
    ...(columna ? { columna } : {}),
    masculino: palabra("masculino"),
    femenino: palabra("femenino"),
    respaldo: palabra("respaldo"),
    ...(sm ? { sm } : {}),
  };
}

export function normalizeMailBlock(value: unknown): MailBlock | null {
  if (!isRecord(value)) return null;
  const block_id = str(value.block_id);
  if (!block_id) return null;
  const type = oneOf(value.type, MAIL_BLOCK_TYPES);
  if (!type) {
    // Fuera del registro que este cliente conoce: se conserva opaco para que
    // guardar no lo borre. Sin `type` no es un bloque, es basura.
    const original = str(value.type);
    return original ? { block_id, type: MAIL_OPAQUE_BLOCK, original_type: original, raw: { ...value } } : null;
  }
  switch (type) {
    case "greeting": {
      const trato = normalizeMailTrato(value.trato);
      return {
        block_id, type, text: str(value.text),
        ...(optStr(value.fallback) !== undefined ? { fallback: str(value.fallback) } : {}),
        ...(trato ? { trato } : {}),
      };
    }
    case "heading": {
      const level = oneOf(value.level, ["titulo", "subtitulo"] as const);
      const align = oneOf(value.align, ["left", "center"] as const);
      return { block_id, type, text: str(value.text), ...(level ? { level } : {}), ...(align ? { align } : {}) };
    }
    case "paragraph": {
      const align = oneOf(value.align, ["left", "justify", "center"] as const);
      const size = oneOf(value.size, ["normal", "pequeno"] as const);
      const tone = oneOf(value.tone, ["normal", "suave"] as const);
      return {
        block_id, type, text: str(value.text),
        ...(align ? { align } : {}), ...(size ? { size } : {}), ...(tone ? { tone } : {}),
      };
    }
    case "button": {
      const note = strings(value.note);
      const align = oneOf(value.align, ["center", "left"] as const);
      const size = oneOf(value.size, ["compacto", "normal", "grande"] as const);
      const fill = oneOf(value.fill, ["solido", "contorno"] as const);
      return {
        block_id, type, text: str(value.text), url: str(value.url),
        ...(note.length ? { note } : {}),
        ...(align ? { align } : {}), ...(size ? { size } : {}), ...(fill ? { fill } : {}),
      };
    }
    case "divider": {
      const style = oneOf(value.style, ["linea", "espacio"] as const);
      const size = oneOf(value.size, ["s", "m", "l"] as const);
      return { block_id, type, ...(style ? { style } : {}), ...(size ? { size } : {}) };
    }
    case "image": {
      const align = oneOf(value.align, ["left", "center", "right"] as const);
      const url = optStr(value.url);
      const width = value.width === undefined || value.width === null ? undefined : int(value.width, 0) || undefined;
      return {
        block_id, type, image_ref: str(value.image_ref), alt: str(value.alt),
        ...(width !== undefined ? { width } : {}),
        ...(align ? { align } : {}),
        ...(url !== undefined ? { url } : {}),
        ...(value.bleed !== undefined ? { bleed: bool(value.bleed) } : {}),
        ...(value.decorative !== undefined ? { decorative: bool(value.decorative) } : {}),
      };
    }
    case "band": {
      const color = hexColor(value.color);
      const height = oneOf(value.height, MAIL_BAND_HEIGHTS);
      return { block_id, type, ...(color ? { color } : {}), ...(height ? { height } : {}) };
    }
    case "ornament": {
      const style = oneOf(value.style, MAIL_ORNAMENT_STYLES);
      const color = hexColor(value.color);
      return { block_id, type, ...(style ? { style } : {}), ...(color ? { color } : {}) };
    }
    case "icon_text": {
      const icon = oneOf(value.icon, MAIL_ICONS);
      return { block_id, type, ...(icon ? { icon } : {}), text: str(value.text) };
    }
    case "two_images":
      return {
        block_id, type,
        left: str(value.left), right: str(value.right),
        alt_left: str(value.alt_left), alt_right: str(value.alt_right),
      };
    case "callout": {
      const variant = oneOf(value.variant, ["box", "bar", "tinte"] as const);
      const title = optStr(value.title);
      return {
        block_id,
        type,
        items: strings(value.items),
        ...(title !== undefined ? { title } : {}),
        ...(variant ? { variant } : {}),
      };
    }
    case "list":
      return { block_id, type, items: strings(value.items), ...(value.ordered !== undefined ? { ordered: bool(value.ordered) } : {}) };
    case "signature": {
      const lines = strings(value.lines);
      const closing = optStr(value.closing);
      const url = optStr(value.url);
      return {
        block_id,
        type,
        name: str(value.name),
        ...(closing !== undefined ? { closing } : {}),
        ...(lines.length ? { lines } : {}),
        ...(url !== undefined ? { url } : {}),
      };
    }
    case "footer_legal": {
      const text = optStr(value.text);
      const address = optStr(value.address);
      return { block_id, type, ...(text !== undefined ? { text } : {}), ...(address !== undefined ? { address } : {}) };
    }
  }
}

function normalizeHeader(value: unknown): MailHeader {
  if (isRecord(value) && str(value.kind) === "banner") {
    return { kind: "banner", image_ref: str(value.image_ref) };
  }
  const raw = isRecord(value) ? value : {};
  return {
    kind: "logos",
    logo_ids: strings(raw.logo_ids),
    background: str(raw.background) === "dark" ? "dark" : "light",
  };
}

function normalizeImages(value: unknown): Record<string, MailImage> {
  if (!isRecord(value)) return {};
  const out: Record<string, MailImage> = {};
  for (const [id, raw] of Object.entries(value)) {
    if (!isRecord(raw)) continue;
    const url = optStr(raw.url);
    out[id] = { alt: str(raw.alt), ...(url !== undefined ? { url } : {}) };
  }
  return out;
}

function normalizeFields(value: unknown): MailField[] {
  const out: MailField[] = [];
  for (const raw of list(value)) {
    if (!isRecord(raw)) continue;
    const key = str(raw.key);
    if (!key) continue;
    const fallback = optStr(raw.fallback);
    const sm = optStr(raw.sm);
    const destino = oneOf(raw.destino, ["encuesta", "otro"] as const);
    out.push({
      key,
      tag: str(raw.tag),
      label: str(raw.label) || key,
      ...(fallback !== undefined ? { fallback } : {}),
      ...(sm ? { sm } : {}),
      ...(destino ? { destino } : {}),
    });
  }
  return out;
}

/**
 * El tema: las claves del estilo (E1n) se conservan tal como llegan para que
 * la revisión del backend sea la que diga si un color no sirve; una
 * enumeración fuera de su registro se descarta (no tiene cómo dibujarse).
 */
export function normalizeMailTheme(value: unknown): MailTheme {
  const theme = isRecord(value) ? value : {};
  const band = oneOf(theme.band, ["suave", "acento"] as const);
  const estilo = oneOf(theme.estilo, MAIL_ESTILOS);
  const textAlign = oneOf(theme.text_align, MAIL_TEXT_ALIGNS);
  const onda = oneOf(theme.onda, MAIL_ONDAS);
  const color = (v: unknown): string | undefined => {
    const c = optStr(v)?.trim();
    return c ? c : undefined;
  };
  const out: MailTheme = { accent: str(theme.accent) || "#0b1f54" };
  if (optStr(theme.link) !== undefined) out.link = str(theme.link);
  if (band) out.band = band;
  if (estilo) out.estilo = estilo;
  const pageBg = color(theme.page_bg);
  if (pageBg) out.page_bg = pageBg;
  const buttonBg = color(theme.button_bg);
  if (buttonBg) out.button_bg = buttonBg;
  const buttonText = color(theme.button_text);
  if (buttonText) out.button_text = buttonText;
  if (textAlign) out.text_align = textAlign;
  if (onda) out.onda = onda;
  const ondaColor = color(theme.onda_color);
  if (ondaColor) out.onda_color = ondaColor;
  return out;
}

/**
 * `lenient`: para la plantilla guardada que el backend ya marcó inválida
 * (`stored_problems`): se lee igual —si es un objeto— para poder corregirla y
 * reemplazarla, en vez de dejar la vista sin correo.
 */
export function normalizeMailTemplate(value: unknown, opts: { lenient?: boolean } = {}): MailTemplate {
  if (!isRecord(value)) throw contractError("la plantilla no es un objeto.");
  if (!opts.lenient && !oneOf(value.schema, MAIL_TEMPLATE_SCHEMAS)) {
    throw contractError(`la plantilla no cumple ${MAIL_TEMPLATE_SCHEMAS.join(" ni ")}.`);
  }
  const blocks: MailBlock[] = [];
  const vistos = new Set<string>();
  for (const raw of list(value.blocks)) {
    const block = normalizeMailBlock(raw);
    // Un tipo desconocido llega opaco (ver `MailOpaqueBlock`); un id repetido
    // haría que dos bloques compartan selección.
    if (!block || vistos.has(block.block_id)) continue;
    vistos.add(block.block_id);
    blocks.push(block);
  }
  const theme = normalizeMailTheme(value.theme);
  const presetId = optStr(value.preset_id);
  const title = optStr(value.title);
  const sha = optStr(value.template_sha256);
  return {
    schema: MAIL_TEMPLATE_SCHEMA,
    template_id: str(value.template_id) || "correo",
    ...(presetId !== undefined ? { preset_id: presetId } : {}),
    ...(title !== undefined ? { title } : {}),
    revision: Math.max(1, int(value.revision, 1)),
    ...(sha !== undefined ? { template_sha256: sha } : {}),
    subject: str(value.subject),
    preheader: str(value.preheader),
    theme,
    header: normalizeHeader(value.header),
    images: normalizeImages(value.images),
    fields: normalizeFields(value.fields),
    blocks,
  };
}

export function normalizeMailPresets(value: unknown): MailPresetsPayload {
  if (!isRecord(value)) throw contractError("los presets no son un objeto.");
  const presets: MailPreset[] = [];
  const vistos = new Set<string>();
  for (const raw of list(value.presets)) {
    if (!isRecord(raw)) continue;
    const presetId = str(raw.preset_id);
    if (!presetId || vistos.has(presetId)) continue;
    let template: MailTemplate;
    try {
      template = normalizeMailTemplate(raw.template);
    } catch {
      continue;
    }
    vistos.add(presetId);
    presets.push({ preset_id: presetId, title: str(raw.title) || template.title || presetId, template });
  }
  const blockTypes = strings(value.block_types).filter((t): t is MailBlockType =>
    (MAIL_BLOCK_TYPES as readonly string[]).includes(t));
  return {
    schema: MAIL_TEMPLATE_SCHEMA,
    reserved_tags: strings(value.reserved_tags),
    block_types: blockTypes.length ? blockTypes : [...MAIL_BLOCK_TYPES],
    presets,
  };
}

/** Plataforma de la campaña; lo que no se reconoce (o falta) es Mailchimp, como en el backend. */
export function normalizeMailPlatform(value: unknown): MailPlatform {
  return oneOf(value, MAIL_PLATFORMS) ?? MAIL_PLATFORM_DEFAULT;
}

/** La invitación por defecto: lo que vale una campaña sin `sends` guardados. */
export function mailSendInvitation(): MailSend {
  return { send_id: "invitacion", kind: "invitacion", label: "Invitación", audience: "todos" };
}

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Un envío completo. `null` si no se puede leer su id. `posicion` (0 = la
 * invitación) sólo da el rótulo por defecto de un recordatorio sin etiqueta.
 */
export function normalizeMailSend(value: unknown, posicion: number): MailSend | null {
  if (!isRecord(value)) return null;
  const send_id = str(value.send_id).trim();
  if (!send_id) return null;
  const kind: MailSendKind = send_id === "invitacion" || str(value.kind) === "invitacion" ? "invitacion" : "recordatorio";
  const audience = kind === "invitacion"
    ? "todos"
    : oneOf(value.audience, ["sin_respuesta", "parcial", "ambos"] as const) ?? "sin_respuesta";
  const date = optStr(value.date);
  const subject = optStr(value.subject);
  const preheader = optStr(value.preheader);
  const opening = optStr(value.opening);
  const collector = optStr(value.collector_label);
  return {
    send_id,
    kind,
    label: str(value.label).trim() || (kind === "invitacion" ? "Invitación" : `Recordatorio ${Math.max(1, posicion)}`),
    ...(date && FECHA_ISO.test(date) ? { date } : {}),
    audience,
    ...(subject !== undefined ? { subject } : {}),
    ...(preheader !== undefined ? { preheader } : {}),
    ...(opening !== undefined ? { opening } : {}),
    ...(collector !== undefined ? { collector_label: collector } : {}),
  };
}

/**
 * Los envíos de una campaña: la invitación siempre primera (si no llega, se
 * pone la de fábrica, como hace el backend al leer) y sin ids repetidos.
 */
export function normalizeMailSends(value: unknown): MailSend[] {
  const out: MailSend[] = [];
  const vistos = new Set<string>();
  for (const raw of list(value)) {
    const send = normalizeMailSend(raw, Math.max(1, out.length));
    if (!send || vistos.has(send.send_id)) continue;
    // La invitación es una sola y va primera; un recordatorio no la reemplaza.
    if (send.kind === "invitacion" && out.length) continue;
    if (!out.length && send.kind !== "invitacion") {
      out.push(mailSendInvitation());
      vistos.add("invitacion");
    }
    vistos.add(send.send_id);
    out.push(send);
  }
  return out.length ? out : [mailSendInvitation()];
}

function normalizeSendBriefs(value: unknown): MailSendBrief[] {
  return normalizeMailSends(value).map(({ send_id, kind, label, date, audience }) => ({
    send_id, kind, label, ...(date ? { date } : {}), audience,
  }));
}

function normalizeSendWarnings(value: unknown): MailSendWarning[] {
  return list(value).flatMap((raw): MailSendWarning[] => {
    if (!isRecord(raw)) return [];
    const detail = str(raw.detail);
    if (!detail) return [];
    return [{ code: str(raw.code) || "send_dates", send_id: strOrNull(raw.send_id), detail }];
  });
}

/** Un envío como lo espera el backend: sin vacíos (null = el de la plantilla). */
export function serializeMailSend(send: MailSend): Record<string, unknown> {
  // Sin `send_id`, el servidor le asigna uno (un recordatorio todavía sin guardar).
  const out: Record<string, unknown> = { kind: send.kind, label: send.label, audience: send.audience };
  if (send.send_id.trim()) out.send_id = send.send_id;
  for (const key of ["date", "subject", "preheader", "opening", "collector_label"] as const) {
    const v = send[key];
    if (typeof v === "string" && v.trim()) out[key] = v;
  }
  return out;
}

export function normalizeMailTemplatePayload(value: unknown): MailTemplatePayload {
  if (!isRecord(value)) throw contractError("la respuesta no es un objeto.");
  const stored_problems = normalizeMailProblems({ problems: value.stored_problems });
  return {
    state_revision: int(value.state_revision, 0),
    campaign_id: strOrNull(value.campaign_id),
    builtin: bool(value.builtin),
    template: normalizeMailTemplate(value.template, { lenient: stored_problems.length > 0 }),
    platform: normalizeMailPlatform(value.platform),
    sends: normalizeMailSends(value.sends),
    stored_problems,
  };
}

export function normalizeMailTemplatePut(value: unknown): MailTemplatePutPayload {
  if (!isRecord(value)) throw contractError("la respuesta no es un objeto.");
  return {
    noop: bool(value.noop),
    state_revision: int(value.state_revision, 0),
    campaign_id: strOrNull(value.campaign_id),
    template: normalizeMailTemplate(value.template),
    sends: normalizeMailSends(value.sends),
    send_warnings: normalizeSendWarnings(value.send_warnings),
  };
}

function normalizeCampaignSummary(value: unknown): MailCampaignSummary | null {
  if (!isRecord(value)) return null;
  const campaign_id = str(value.campaign_id).trim();
  if (!campaign_id) return null;
  return {
    campaign_id,
    name: str(value.name) || campaign_id,
    actor: str(value.actor),
    platform: normalizeMailPlatform(value.platform),
    sends: normalizeSendBriefs(value.sends),
    preset_id: strOrNull(value.preset_id),
    subject: str(value.subject),
    blocks: Math.max(0, int(value.blocks, 0)),
    template_revision: Math.max(1, int(value.template_revision, 1)),
    template_sha256: strOrNull(value.template_sha256),
    updated_at: strOrNull(value.updated_at),
    recipients_loaded: bool(value.recipients_loaded),
  };
}

export function normalizeMailCampaigns(value: unknown): MailCampaignsPayload {
  if (!isRecord(value)) throw contractError("las campañas no son un objeto.");
  const campaigns: MailCampaignSummary[] = [];
  const vistos = new Set<string>();
  for (const raw of list(value.campaigns)) {
    const c = normalizeCampaignSummary(raw);
    if (!c || vistos.has(c.campaign_id)) continue;
    vistos.add(c.campaign_id);
    campaigns.push(c);
  }
  return {
    state_revision: int(value.state_revision, 0),
    legacy_migrated: bool(value.legacy_migrated),
    campaigns,
  };
}

export function normalizeMailCampaign(value: unknown): MailCampaign {
  if (!isRecord(value)) throw contractError("la campaña no es un objeto.");
  const campaign_id = str(value.campaign_id).trim();
  if (!campaign_id) throw contractError("la campaña no trae campaign_id.");
  let template: MailTemplate | null = null;
  if (isRecord(value.template)) {
    try {
      template = normalizeMailTemplate(value.template);
    } catch {
      template = null;
    }
  }
  return {
    campaign_id,
    name: str(value.name) || campaign_id,
    actor: str(value.actor),
    created_at: strOrNull(value.created_at),
    updated_at: strOrNull(value.updated_at),
    duplicated_from: strOrNull(value.duplicated_from),
    platform: normalizeMailPlatform(value.platform),
    sends: value.sends === undefined ? [] : normalizeMailSends(value.sends),
    template,
  };
}

export function normalizeMailCampaignWrite(value: unknown): MailCampaignWrite {
  if (!isRecord(value)) throw contractError("la respuesta no es un objeto.");
  return {
    state_revision: int(value.state_revision, 0),
    campaign: normalizeMailCampaign(value.campaign),
    recipients_purged_virtual: bool(value.recipients_purged_virtual),
  };
}

export function normalizeMailCampaignDuplicate(value: unknown): MailCampaignDuplicate {
  const base = normalizeMailCampaignWrite(value);
  return { ...base, recipients_copied: isRecord(value) && bool(value.recipients_copied) };
}

export function normalizeMailCampaignMeta(value: unknown): MailCampaignMeta {
  if (!isRecord(value)) throw contractError("la respuesta no es un objeto.");
  return {
    noop: bool(value.noop),
    state_revision: int(value.state_revision, 0),
    campaign: normalizeMailCampaign(value.campaign),
    recipients_purged: bool(value.recipients_purged),
  };
}

export function normalizeMailCampaignDelete(value: unknown): MailCampaignDelete {
  if (!isRecord(value)) throw contractError("la respuesta no es un objeto.");
  const deleted = str(value.deleted).trim();
  if (!deleted) throw contractError("el borrado no dice qué campaña borró.");
  return {
    state_revision: int(value.state_revision, 0),
    deleted,
    recipients_purged: bool(value.recipients_purged),
  };
}

export function normalizeMailPreview(value: unknown): MailPreview {
  if (!isRecord(value)) throw contractError("la vista previa no es un objeto.");
  const html = str(value.html);
  if (!html) throw contractError("la vista previa no trae HTML.");
  const recipient = isRecord(value.recipient) ? value.recipient : {};
  const index = recipient.index === undefined || recipient.index === null ? null : int(recipient.index, 0) || null;
  const send = isRecord(value.send) ? normalizeMailSend(value.send, 1) : null;
  const platform = normalizeMailPlatform(value.platform);
  return {
    mode: oneOf(value.mode, ["preview", "export", "mailchimp"] as const) ?? "preview",
    platform,
    dialect: value.dialect === undefined ? platform : normalizeMailPlatform(value.dialect),
    send: send ? { send_id: send.send_id, kind: send.kind, label: send.label, ...(send.date ? { date: send.date } : {}), audience: send.audience } : null,
    html,
    subject: str(value.subject),
    preheader: str(value.preheader),
    bytes: Math.max(0, int(value.bytes, html.length)),
    recipient: {
      source: str(recipient.source) === "imported" ? "imported" : "synthetic",
      index,
      nombre: str(recipient.nombre),
      fields: stringMap(recipient.fields),
      ...(optStr(recipient.trato) ? { trato: str(recipient.trato) } : {}),
    },
  };
}

const CHECK_ITEM_LISTS = new Set(["uses", "tags"]);

function normalizeCheckItem(value: unknown): MailCheckItem | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.length === 1) return normalizeCheckItem(value[0]);
  if (!isRecord(value)) return null;
  const out: Record<string, MailCheckItemValue> = {};
  for (const [key, raw] of Object.entries(value)) {
    // Listas de texto (`uses`, `tags`): siempre lista, aunque R mande un
    // vector de largo uno como escalar.
    if (CHECK_ITEM_LISTS.has(key)) {
      out[key] = strings(raw);
      continue;
    }
    const v = Array.isArray(raw) && raw.length === 1 ? raw[0] : raw;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") out[key] = v;
    else if (Array.isArray(v)) out[key] = strings(v);
  }
  // Una fila sin nada legible (sólo objetos anidados de un contrato más nuevo)
  // no se pinta como un renglón vacío.
  return Object.keys(out).length ? out : null;
}

export function normalizeMailCheck(value: unknown): MailCheck | null {
  if (!isRecord(value)) return null;
  const code = str(value.code);
  if (!code) return null;
  const status = oneOf(value.status, ["ok", "warning", "error"] as const) ?? "warning";
  const rawValue = Array.isArray(value.value) && value.value.length === 1 ? value.value[0] : value.value;
  return {
    code,
    status,
    value: typeof rawValue === "number" || typeof rawValue === "string" ? rawValue : null,
    detail: str(value.detail),
    items: list(value.items).map(normalizeCheckItem).filter((i): i is MailCheckItem => i !== null),
    targets: list(value.targets).flatMap((raw): MailCheckTarget[] => {
      if (!isRecord(raw)) return [];
      const block_id = str(raw.block_id);
      if (!block_id) return [];
      const prop = optStr(raw.prop);
      return [prop !== undefined ? { block_id, prop } : { block_id }];
    }),
  };
}

export function normalizeMailReview(value: unknown): MailReview {
  if (!isRecord(value)) throw contractError("la revisión no es un objeto.");
  const checks = list(value.checks).map(normalizeMailCheck).filter((c): c is MailCheck => c !== null);
  const errors = checks.filter((c) => c.status === "error").length;
  const warnings = checks.filter((c) => c.status === "warning").length;
  return {
    platform: oneOf(value.platform, MAIL_PLATFORMS) ?? null,
    send_id: strOrNull(value.send_id),
    template_sha256: str(value.template_sha256),
    // Se recalcula desde los chequeos: un `ready` que contradiga la lista no
    // puede habilitar la exportación.
    ready: errors === 0,
    errors,
    warnings,
    checks,
  };
}

function normalizeArtifact(value: unknown): MailArtifact | null {
  if (!isRecord(value)) return null;
  const file_id = str(value.file_id);
  if (!file_id) return null;
  return {
    file_id,
    role: str(value.role),
    filename: str(value.filename) || file_id,
    media_type: str(value.media_type),
    size_bytes: Math.max(0, int(value.size_bytes, 0)),
    sha256: str(value.sha256),
    audience: str(value.audience),
    sensitivity: str(value.sensitivity),
  };
}

export function normalizeMailExport(value: unknown): MailExportPayload {
  if (!isRecord(value)) throw contractError("la exportación no es un objeto.");
  const artifacts = list(value.artifacts).map(normalizeArtifact).filter((a): a is MailArtifact => a !== null);
  const zip = normalizeArtifact(value.zip) ?? artifacts.find((a) => a.role === "deliverable") ?? null;
  const review = isRecord(value.review)
    ? { ready: bool(value.review.ready), errors: int(value.review.errors, 0), warnings: int(value.review.warnings, 0) }
    : null;
  const scope = oneOf(value.scope, ["completo", "plantilla"] as const);
  const iz = isRecord(value.import_zip) ? value.import_zip : null;
  const html = isRecord(value.html) ? { name: str(value.html.name), bytes: Math.max(0, int(value.html.bytes, 0)) } : null;
  return {
    ...(scope ? { scope } : {}),
    platform: normalizeMailPlatform(value.platform),
    send_id: strOrNull(value.send_id),
    html,
    import_zip: iz ? { size_bytes: Math.max(0, int(iz.size_bytes, 0)), entries: strings(iz.entries), html: str(iz.html) } : null,
    artifacts,
    zip,
    review,
    manifest: isRecord(value.manifest) ? value.manifest : null,
    export_recorded: normalizeExportRecorded(value.export_recorded),
  };
}

function normalizeExportRecorded(value: unknown): MailExportPayload["export_recorded"] {
  if (!isRecord(value)) return null;
  const sendId = str(value.send_id).trim();
  const at = str(value.last_export_at).trim();
  if (!sendId || !at) return null;
  return { send_id: sendId, last_export_at: at, last_export_platform: normalizeMailPlatform(value.last_export_platform) };
}

function normalizeMapping(value: unknown): MailRecipientsMapping | null {
  if (!isRecord(value)) return null;
  return {
    email_column: strOrNull(value.email_column),
    name_column: strOrNull(value.name_column),
    name_format: str(value.name_format) === "apellidos_coma_nombres" ? "apellidos_coma_nombres" : "nombre",
    fields: stringMap(value.fields),
  };
}

function normalizeCounts(value: unknown): MailRecipientsCounts | null {
  if (!isRecord(value)) return null;
  return {
    total: Math.max(0, int(value.total, 0)),
    valid: Math.max(0, int(value.valid, 0)),
    without_email: Math.max(0, int(value.without_email, 0)),
    invalid_email: Math.max(0, int(value.invalid_email, 0)),
    duplicated: Math.max(0, int(value.duplicated, 0)),
    names_unsplit: Math.max(0, int(value.names_unsplit, 0)),
    duplicated_conflicting: Math.max(0, int(value.duplicated_conflicting, 0)),
    persons_with_any_empty: Math.max(0, int(value.persons_with_any_empty, 0)),
    rows_blank_dropped: Math.max(0, int(value.rows_blank_dropped, 0)),
  };
}

const EMAIL_EN_TEXTO = /[^\s@]+@[^\s@]+\.[^\s@]+/;

export function normalizeMailRecipients(value: unknown): MailRecipients {
  if (!isRecord(value)) throw contractError("los destinatarios no son un objeto.");
  const loaded = bool(value.loaded);
  const sample: MailRecipientSample[] = [];
  for (const raw of list(value.sample)) {
    if (!isRecord(raw)) continue;
    const fields = stringMap(raw.fields);
    // Defensa en profundidad: la vista nunca muestra un correo, aunque el
    // backend se equivocara y mandara una columna con uno.
    for (const [key, text] of Object.entries(fields)) {
      if (EMAIL_EN_TEXTO.test(text)) delete fields[key];
    }
    const nombre = str(raw.nombre);
    const trato = optStr(raw.trato);
    sample.push({
      index: Math.max(1, int(raw.index, sample.length + 1)),
      nombre: EMAIL_EN_TEXTO.test(nombre) ? "" : nombre,
      fields,
      ...(trato ? { trato } : {}),
    });
  }
  return {
    loaded,
    file_name: strOrNull(value.file_name),
    imported_at: strOrNull(value.imported_at),
    row_count: Math.max(0, int(value.row_count, 0)),
    encoding: oneOf(value.encoding, ["utf-8", "windows-1252", "utf-16"] as const) ?? null,
    columns: strings(value.columns),
    mapping: loaded ? normalizeMapping(value.mapping) : null,
    counts: loaded ? normalizeCounts(value.counts) : null,
    sample,
    trato: loaded ? normalizeRecipientsTrato(value.trato) : null,
  };
}

export function normalizeRecipientsTrato(value: unknown): MailRecipientsTrato | null {
  if (!isRecord(value)) return null;
  const c = isRecord(value.counts) ? value.counts : null;
  const p = isRecord(value.palabras) ? value.palabras : null;
  return {
    block_id: str(value.block_id),
    columna: strOrNull(value.columna),
    presente: bool(value.presente),
    lectura: oneOf(value.lectura, MAIL_TRATO_LECTURAS) ?? null,
    counts: c
      ? {
        efectivos: Math.max(0, int(c.efectivos, 0)),
        masculino: Math.max(0, int(c.masculino, 0)),
        femenino: Math.max(0, int(c.femenino, 0)),
        sin_dato: Math.max(0, int(c.sin_dato, 0)),
        no_reconocido: Math.max(0, int(c.no_reconocido, 0)),
      }
      : null,
    no_reconocidos: strings(value.no_reconocidos).slice(0, 10),
    palabras: p ? { masculino: str(p.masculino), femenino: str(p.femenino), respaldo: str(p.respaldo) } : null,
  };
}

export function normalizeMailProblems(details: unknown): MailProblem[] {
  if (!isRecord(details)) return [];
  const out: MailProblem[] = [];
  for (const raw of list(details.problems)) {
    if (isRecord(raw)) {
      out.push({ path: str(raw.path), code: str(raw.code), detail: str(raw.detail) });
    } else if (typeof raw === "string") {
      // Forma vieja de collection_*: "<path> [<code>]: <detalle>".
      const m = raw.match(/^(\S+)\s+\[([^\]]+)\]:\s*(.+)$/);
      out.push(m ? { path: m[1], code: m[2], detail: m[3] } : { path: "", code: "", detail: raw });
    }
  }
  return out;
}

function normalizeImportReportItem(value: unknown): MailImportReportItem | null {
  if (!isRecord(value)) return null;
  const code = str(value.code);
  const reason = str(value.reason);
  // Un ítem sin código ni motivo no dice nada: no se pinta un renglón vacío.
  if (!code && !reason) return null;
  return {
    code: code || "unrecognized",
    selector: strOrNull(value.selector),
    excerpt: str(value.excerpt),
    reason,
    block_id: strOrNull(value.block_id),
  };
}

/**
 * Resultado de leer un HTML existente (E1l). El backend omite los campos nulos
 * (`platform_detected`, `url`, `block_id`): aquí se leen como ausentes. La
 * plantilla tiene que ser válida: sin ella no hay nada que crear.
 */
export function normalizeMailImportHtml(value: unknown): MailImportHtml {
  if (!isRecord(value)) throw contractError("la importación no es un objeto.");
  const import_id = str(value.import_id).trim();
  if (!import_id) throw contractError("la importación no trae import_id.");
  const evidence = isRecord(value.platform_evidence) ? value.platform_evidence : {};
  const stats = isRecord(value.stats) ? value.stats : {};
  const template = normalizeMailTemplate(value.template);
  return {
    import_id,
    sha256: str(value.sha256),
    bytes: Math.max(0, int(value.bytes, 0)),
    platform_detected: oneOf(value.platform_detected, MAIL_PLATFORMS) ?? null,
    platform_evidence: {
      mailchimp: Math.max(0, int(evidence.mailchimp, 0)),
      surveymonkey: Math.max(0, int(evidence.surveymonkey, 0)),
    },
    template,
    report: list(value.report).map(normalizeImportReportItem).filter((i): i is MailImportReportItem => i !== null),
    images: list(value.images).flatMap((raw): MailImportImage[] => {
      if (!isRecord(raw)) return [];
      const id = str(raw.id);
      if (!id) return [];
      const url = strOrNull(raw.url);
      return [{ id, url, alt: str(raw.alt), status: str(raw.status) === "url" && url ? "url" : "needs_upload" }];
    }),
    stats: {
      blocks: Math.max(0, int(stats.blocks, template.blocks.length)),
      dropped_empty: Math.max(0, int(stats.dropped_empty, 0)),
      discarded: strings(stats.discarded),
    },
  };
}

/**
 * La plantilla como la espera el backend: cada bloque opaco vuelve a ser el
 * objeto que llegó, intacto.
 */
export function serializeMailTemplate(template: MailTemplate): Record<string, unknown> {
  return {
    ...template,
    blocks: template.blocks.map((block) => (isOpaqueMailBlock(block) ? block.raw : block)),
  };
}

// ---- errores ------------------------------------------------------------------

/**
 * Error de la API de correos con el estado HTTP y los detalles del contrato.
 *
 * `ApiError` sólo guarda código y mensaje; aquí hacen falta los problemas por
 * ruta (`template.blocks[3].text`) para pintarlos junto a su bloque, y los
 * chequeos que bloquean una exportación.
 */
export class MailApiError extends ApiError {
  readonly status: number;
  readonly problems: MailProblem[];
  readonly checks: MailCheck[];
  /** `details.reason` del rechazo (p. ej. `too_large` de una imagen); sólo para elegir el aviso. */
  readonly reason: string;
  constructor(code: string, message: string, status: number, details: unknown) {
    super(code, message);
    this.name = "MailApiError";
    this.status = status;
    this.reason = isRecord(details) ? str(details.reason) : "";
    this.problems = normalizeMailProblems(details);
    this.checks = isRecord(details)
      ? list(details.checks).map(normalizeMailCheck).filter((c): c is MailCheck => c !== null)
      : [];
  }
}

async function handleMail(res: Response): Promise<unknown> {
  if (res.ok) return handle<unknown>(res);
  const raw = await res.clone().text().catch(() => "");
  let details: unknown = null;
  let message = "";
  try {
    const body: unknown = raw.trim() ? JSON.parse(raw) : null;
    const error = isRecord(body) && isRecord(body.error) ? body.error : null;
    details = error?.details ?? null;
    message = str(error?.message);
  } catch {
    details = null;
  }
  try {
    // `handle` conserva sus efectos (sesión perdida, sid nuevo) y arma el código.
    await handle<unknown>(res);
  } catch (cause) {
    if (cause instanceof ApiError) {
      const plain = message || cause.message.replace(new RegExp(`\\s·\\s${cause.code}$`), "");
      // `details.reason` es para el log, no para la persona; el error_id sí
      // sirve para pedir ayuda.
      const ref = isRecord(details) ? str(details.error_id) : "";
      throw new MailApiError(cause.code, ref ? `${plain} (ref. ${ref})` : plain, res.status, details);
    }
    throw cause;
  }
  throw new MailApiError(`HTTP_${res.status}`, `HTTP ${res.status}`, res.status, details);
}

const BASE = "/api/recopiladores";

function json(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  };
}

// ---- API ----------------------------------------------------------------------

/** `?campaign_id=` para los GET y DELETE; vacío si no hay campaña. */
function conCampana(path: string, campaignId?: string | null): string {
  return campaignId ? `${path}?campaign_id=${encodeURIComponent(campaignId)}` : path;
}

/** Suma `campaign_id` al cuerpo sólo si hay uno: sin él, el backend decide como antes. */
function cuerpoConCampana(body: Record<string, unknown>, campaignId?: string | null): Record<string, unknown> {
  return campaignId ? { ...body, campaign_id: campaignId } : body;
}

export async function apiMailPresets(): Promise<MailPresetsPayload> {
  return normalizeMailPresets(await handleMail(await apiFetch(`${BASE}/mail-presets`, { headers: headers() })));
}

export async function apiMailCampaigns(): Promise<MailCampaignsPayload> {
  return normalizeMailCampaigns(await handleMail(await apiFetch(`${BASE}/mail-campaigns`, { headers: headers() })));
}

/**
 * Crea una campaña desde un preset o desde una plantilla (la de un HTML
 * importado, con su `import_id`). Mandar los dos es un 422: o uno o el otro.
 */
export async function apiMailCampaignCreate(input: {
  expected_revision: number;
  name: string;
  actor?: string;
  preset_id?: string | null;
  platform?: MailPlatform;
  template?: MailTemplate | null;
  import_id?: string | null;
}): Promise<MailCampaignWrite> {
  const body: Record<string, unknown> = { expected_revision: input.expected_revision, name: input.name, actor: input.actor ?? "" };
  if (input.template) body.template = serializeMailTemplate(input.template);
  else if (input.preset_id) body.preset_id = input.preset_id;
  if (input.platform) body.platform = input.platform;
  if (input.import_id) body.import_id = input.import_id;
  return normalizeMailCampaignWrite(await handleMail(await apiFetch(`${BASE}/mail-campaigns`, json("POST", body))));
}

export async function apiMailCampaignDuplicate(input: {
  expected_revision: number;
  campaign_id: string;
  name?: string;
  actor?: string;
}): Promise<MailCampaignDuplicate> {
  const body: Record<string, unknown> = { expected_revision: input.expected_revision, campaign_id: input.campaign_id };
  if (input.name !== undefined) body.name = input.name;
  if (input.actor !== undefined) body.actor = input.actor;
  return normalizeMailCampaignDuplicate(await handleMail(await apiFetch(`${BASE}/mail-campaigns/duplicate`, json("POST", body))));
}

/** Renombra, cambia el actor o la plataforma. Pasar a SurveyMonkey olvida los destinatarios. */
export async function apiMailCampaignMeta(input: {
  expected_revision: number;
  campaign_id: string;
  name: string;
  actor: string;
  platform?: MailPlatform;
}): Promise<MailCampaignMeta> {
  return normalizeMailCampaignMeta(await handleMail(await apiFetch(`${BASE}/mail-campaigns/meta`, json("PUT", input))));
}

/** Borra con la segunda confirmación del lado del servidor: `confirm_name` idéntico al nombre. */
export async function apiMailCampaignDelete(input: {
  expected_revision: number;
  campaign_id: string;
  confirm_name: string;
}): Promise<MailCampaignDelete> {
  return normalizeMailCampaignDelete(await handleMail(await apiFetch(`${BASE}/mail-campaigns/delete`, json("POST", input))));
}

export async function apiMailTemplate(campaignId?: string | null): Promise<MailTemplatePayload> {
  return normalizeMailTemplatePayload(await handleMail(await apiFetch(conCampana(`${BASE}/mail-template`, campaignId), { headers: headers() })));
}

/**
 * Guarda la plantilla y, si vienen, los envíos: una sola subida de revisión.
 * Un recordatorio nuevo va sin `send_id` (o con uno local que el servidor no
 * conoce) y vuelve con el suyo; `import_id` cita el HTML importado del que
 * sale la plantilla.
 */
export async function apiMailTemplatePut(input: {
  template: MailTemplate;
  expected_revision: number;
  campaign_id?: string | null;
  sends?: readonly MailSend[] | null;
  import_id?: string | null;
}): Promise<MailTemplatePutPayload> {
  const base: Record<string, unknown> = { template: serializeMailTemplate(input.template), expected_revision: input.expected_revision };
  if (input.sends) base.sends = input.sends.map(serializeMailSend);
  if (input.import_id) base.import_id = input.import_id;
  const body = cuerpoConCampana(base, input.campaign_id);
  return normalizeMailTemplatePut(await handleMail(await apiFetch(`${BASE}/mail-template`, json("PUT", body))));
}

/** Envío de una vista previa o revisión: uno guardado (`send_id`) o un borrador (`send`). */
export type MailSendPedido = { send_id: string } | { send: MailSend };

function conEnvio(body: Record<string, unknown>, pedido: MailSendPedido | null | undefined): Record<string, unknown> {
  if (!pedido) return body;
  if ("send" in pedido) return { ...body, send: serializeMailSend(pedido.send) };
  return { ...body, send_id: pedido.send_id };
}

export async function apiMailPreview(input: {
  mode: MailPreviewMode;
  recipient_index?: number | null;
  template?: MailTemplate | null;
  campaign_id?: string | null;
  envio?: MailSendPedido | null;
}): Promise<MailPreview> {
  const body: Record<string, unknown> = conEnvio({ mode: input.mode }, input.envio);
  if (input.recipient_index) body.recipient_index = input.recipient_index;
  if (input.template) body.template = serializeMailTemplate(input.template);
  return normalizeMailPreview(await handleMail(await apiFetch(
    `${BASE}/mail-template/preview`,
    json("POST", cuerpoConCampana(body, input.campaign_id)),
  )));
}

export async function apiMailReview(input: {
  template?: MailTemplate | null;
  campaign_id?: string | null;
  scope?: MailExportScope;
  envio?: MailSendPedido | null;
} = {}): Promise<MailReview> {
  const base: Record<string, unknown> = conEnvio(input.template ? { template: serializeMailTemplate(input.template) } : {}, input.envio);
  if (input.scope) base.scope = input.scope;
  const body = cuerpoConCampana(base, input.campaign_id);
  return normalizeMailReview(await handleMail(await apiFetch(`${BASE}/mail-template/review`, json("POST", body))));
}

/** Exporta la plantilla GUARDADA; el backend exige la revisión que la vista vio. */
export async function apiMailExport(input: {
  expected_revision: number;
  campaign_id?: string | null;
  scope?: MailExportScope;
  /** Envío GUARDADO que se exporta; sin él, la invitación. */
  send_id?: string | null;
}): Promise<MailExportPayload> {
  const base: Record<string, unknown> = { expected_revision: input.expected_revision };
  if (input.scope) base.scope = input.scope;
  if (input.send_id) base.send_id = input.send_id;
  const body = cuerpoConCampana(base, input.campaign_id);
  return normalizeMailExport(await handleMail(await apiFetch(`${BASE}/mail-template/export`, json("POST", body))));
}

export async function apiMailRecipientsImport(
  file: File,
  mapping?: MailRecipientsMapping | null,
  campaignId?: string | null,
): Promise<MailRecipients> {
  const fd = new FormData();
  fd.append("file", file, file.name);
  if (mapping) fd.append("mapping", JSON.stringify(mapping));
  if (campaignId) fd.append("campaign_id", campaignId);
  return normalizeMailRecipients(await handleMail(await apiFetch(`${BASE}/mail-recipients/import`, {
    method: "POST",
    headers: headers(),
    body: fd,
  })));
}

export async function apiMailRecipients(campaignId?: string | null): Promise<MailRecipients> {
  return normalizeMailRecipients(await handleMail(await apiFetch(conCampana(`${BASE}/mail-recipients`, campaignId), { headers: headers() })));
}

export async function apiMailRecipientsMapping(mapping: MailRecipientsMapping, campaignId?: string | null): Promise<MailRecipients> {
  return normalizeMailRecipients(await handleMail(await apiFetch(
    `${BASE}/mail-recipients/mapping`,
    json("PUT", cuerpoConCampana({ mapping }, campaignId)),
  )));
}

export async function apiMailRecipientsDelete(campaignId?: string | null): Promise<MailRecipients> {
  return normalizeMailRecipients(await handleMail(await apiFetch(conCampana(`${BASE}/mail-recipients`, campaignId), {
    method: "DELETE",
    headers: headers(),
  })));
}

/** Tope del HTML que se importa (el backend responde 413 por encima). */
export const MAIL_IMPORT_HTML_MAX_BYTES = 512 * 1024;

/**
 * Lee un HTML existente y lo devuelve como plantilla con su informe (E1l). Es
 * una lectura: no escribe el estado. Con `file` va como multipart; con
 * `html`, en JSON.
 */
export async function apiMailImportHtml(
  input: { html: string; file_name: string; subject?: string } | { file: File; subject?: string },
): Promise<MailImportHtml> {
  let init: RequestInit;
  if ("file" in input) {
    const fd = new FormData();
    fd.append("file", input.file, input.file.name);
    if (input.subject?.trim()) fd.append("subject", input.subject.trim());
    init = { method: "POST", headers: headers(), body: fd };
  } else {
    const body: Record<string, unknown> = { html: input.html, file_name: input.file_name };
    if (input.subject?.trim()) body.subject = input.subject.trim();
    init = json("POST", body);
  }
  return normalizeMailImportHtml(await handleMail(await apiFetch(`${BASE}/mail-template/import-html`, init)));
}

/** Extensión que el backend acepta para una imagen del correo (PNG o JPEG). */
export function extensionDeImagen(file: Pick<File, "name" | "type">): "png" | "jpg" | null {
  const tipo = file.type.toLowerCase();
  const nombre = file.name.toLowerCase();
  if (tipo === "image/png" || nombre.endsWith(".png")) return "png";
  if (tipo === "image/jpeg" || /\.jpe?g$/.test(nombre)) return "jpg";
  return null;
}

/**
 * Sube una imagen del correo (`mail_image`, PNG o JPEG hasta 1 MB y de 40 a
 * 1.200 px de ancho) bajo el nombre `<id>.<ext>`.
 *
 * El backend resuelve cada imagen del correo por el slug del nombre original
 * del archivo y se queda con la más reciente; subirla con el id de la
 * plantilla es lo que las une. Un rechazo llega como 422
 * `E_COLLECTION_MAIL_IMAGE_INVALID` con `details.reason`.
 */
export async function apiMailImageUpload(file: File, imageId: string): Promise<{ file_id: string; original_name: string }> {
  const ext = extensionDeImagen(file) ?? "png";
  const fd = new FormData();
  fd.append("file", new File([file], `${imageId}.${ext}`, { type: ext === "jpg" ? "image/jpeg" : "image/png" }));
  const raw = await handleMail(await apiFetch(`/api/files/upload?kind=mail_image`, {
    method: "POST",
    headers: headers(),
    body: fd,
  }));
  if (!isRecord(raw) || !str(raw.file_id)) throw contractError("la subida no devolvió el archivo.");
  return { file_id: str(raw.file_id), original_name: str(raw.original_name) };
}
