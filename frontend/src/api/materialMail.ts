// materialMail.ts — correos para Mailchimp de Material de campo (ADR 0110 §2,
// etapa E1f: «Correos: componer aquí, enviar en Mailchimp»).
//
// Contrato `collection_mail_template/v1`, todo bajo /api/recopiladores/:
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
// Vive aparte de `recopiladores.ts` porque es un dominio propio. Los
// normalizadores son defensivos: R serializa un vector de largo uno como
// escalar y una lista vacía con nombres como `{}`; un campo que falta se lee
// como ausente, no se inventa.
//
// **Privacidad.** Los destinatarios son datos personales: el backend nunca
// manda correos y este módulo no los guarda en ningún almacenamiento del
// navegador. Lo que llega vive en memoria mientras la vista existe.

import { ApiError, apiFetch, handle, headers } from "./core";

export const MAIL_TEMPLATE_SCHEMA = "collection_mail_template/v1";

export const MAIL_BLOCK_TYPES = [
  "greeting",
  "paragraph",
  "button",
  "callout",
  "list",
  "signature",
  "footer_legal",
] as const;
export type MailBlockType = (typeof MAIL_BLOCK_TYPES)[number];

export type MailAlign = "left" | "justify" | "center";
export type MailCalloutVariant = "box" | "bar";

export type MailGreetingBlock = { block_id: string; type: "greeting"; text: string; fallback?: string };
export type MailParagraphBlock = { block_id: string; type: "paragraph"; text: string; align?: MailAlign };
export type MailButtonBlock = { block_id: string; type: "button"; text: string; url: string; note?: string[] };
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
  | MailParagraphBlock
  | MailButtonBlock
  | MailCalloutBlock
  | MailListBlock
  | MailSignatureBlock
  | MailFooterBlock;

export type MailBlock = MailKnownBlock | MailOpaqueBlock;

export function isOpaqueMailBlock(block: MailBlock): block is MailOpaqueBlock {
  return block.type === MAIL_OPAQUE_BLOCK;
}

export type MailHeader =
  | { kind: "logos"; logo_ids: string[]; background: "dark" | "light" }
  | { kind: "banner"; image_ref: string };

export type MailImage = { alt: string; url?: string };

export type MailField = { key: string; tag: string; label: string; fallback?: string };

export type MailTemplate = {
  schema: typeof MAIL_TEMPLATE_SCHEMA;
  template_id: string;
  preset_id?: string;
  title?: string;
  revision: number;
  template_sha256?: string;
  subject: string;
  preheader: string;
  theme: { accent: string };
  header: MailHeader;
  images: Record<string, MailImage>;
  fields: MailField[];
  blocks: MailBlock[];
};

export type MailPreset = { preset_id: string; title: string; template: MailTemplate };

export type MailPresetsPayload = {
  schema: typeof MAIL_TEMPLATE_SCHEMA;
  reserved_tags: string[];
  block_types: MailBlockType[];
  presets: MailPreset[];
};

export type MailTemplatePayload = {
  state_revision: number;
  builtin: boolean;
  template: MailTemplate;
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
  template: MailTemplate;
};

export type MailPreviewMode = "preview" | "mailchimp";

export type MailRecipientView = {
  source: "imported" | "synthetic";
  index: number | null;
  nombre: string;
  fields: Record<string, string>;
};

export type MailPreview = {
  mode: MailPreviewMode;
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
] as const;
export type MailCheckCode = (typeof MAIL_CHECK_CODES)[number];

/** Un valor de una fila del detalle; las listas (`uses`, `tags`) llegan como texto. */
export type MailCheckItemValue = string | number | boolean | string[];

/** Un elemento del detalle: un id de imagen o una fila (etiqueta, columna, vacíos). */
export type MailCheckItem = string | Record<string, MailCheckItemValue>;

export type MailCheck = {
  code: string;
  status: MailCheckStatus;
  value: string | number | null;
  detail: string;
  items: MailCheckItem[];
};

export type MailReview = {
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
  artifacts: MailArtifact[];
  zip: MailArtifact | null;
  review: { ready: boolean; errors: number; warnings: number } | null;
  manifest: Record<string, unknown> | null;
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

export type MailRecipientSample = { index: number; nombre: string; fields: Record<string, string> };

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
};

export type MailProblem = { path: string; code: string; detail: string };

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

function oneOf<T extends string>(value: unknown, options: readonly T[]): T | undefined {
  const text = str(value);
  return (options as readonly string[]).includes(text) ? (text as T) : undefined;
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
    case "greeting":
      return { block_id, type, text: str(value.text), ...(optStr(value.fallback) !== undefined ? { fallback: str(value.fallback) } : {}) };
    case "paragraph": {
      const align = oneOf(value.align, ["left", "justify", "center"] as const);
      return { block_id, type, text: str(value.text), ...(align ? { align } : {}) };
    }
    case "button": {
      const note = strings(value.note);
      return { block_id, type, text: str(value.text), url: str(value.url), ...(note.length ? { note } : {}) };
    }
    case "callout": {
      const variant = oneOf(value.variant, ["box", "bar"] as const);
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
    out.push({
      key,
      tag: str(raw.tag),
      label: str(raw.label) || key,
      ...(fallback !== undefined ? { fallback } : {}),
    });
  }
  return out;
}

/**
 * `lenient`: para la plantilla guardada que el backend ya marcó inválida
 * (`stored_problems`): se lee igual —si es un objeto— para poder corregirla y
 * reemplazarla, en vez de dejar la vista sin correo.
 */
export function normalizeMailTemplate(value: unknown, opts: { lenient?: boolean } = {}): MailTemplate {
  if (!isRecord(value)) throw contractError("la plantilla no es un objeto.");
  if (!opts.lenient && str(value.schema) !== MAIL_TEMPLATE_SCHEMA) throw contractError(`la plantilla no cumple ${MAIL_TEMPLATE_SCHEMA}.`);
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
  const theme = isRecord(value.theme) ? value.theme : {};
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
    theme: { accent: str(theme.accent) || "#0b1f54" },
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

export function normalizeMailTemplatePayload(value: unknown): MailTemplatePayload {
  if (!isRecord(value)) throw contractError("la respuesta no es un objeto.");
  const stored_problems = normalizeMailProblems({ problems: value.stored_problems });
  return {
    state_revision: int(value.state_revision, 0),
    builtin: bool(value.builtin),
    template: normalizeMailTemplate(value.template, { lenient: stored_problems.length > 0 }),
    stored_problems,
  };
}

export function normalizeMailTemplatePut(value: unknown): MailTemplatePutPayload {
  if (!isRecord(value)) throw contractError("la respuesta no es un objeto.");
  return {
    noop: bool(value.noop),
    state_revision: int(value.state_revision, 0),
    template: normalizeMailTemplate(value.template),
  };
}

export function normalizeMailPreview(value: unknown): MailPreview {
  if (!isRecord(value)) throw contractError("la vista previa no es un objeto.");
  const html = str(value.html);
  if (!html) throw contractError("la vista previa no trae HTML.");
  const recipient = isRecord(value.recipient) ? value.recipient : {};
  const index = recipient.index === undefined || recipient.index === null ? null : int(recipient.index, 0) || null;
  return {
    mode: str(value.mode) === "mailchimp" ? "mailchimp" : "preview",
    html,
    subject: str(value.subject),
    preheader: str(value.preheader),
    bytes: Math.max(0, int(value.bytes, html.length)),
    recipient: {
      source: str(recipient.source) === "imported" ? "imported" : "synthetic",
      index,
      nombre: str(recipient.nombre),
      fields: stringMap(recipient.fields),
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
  };
}

export function normalizeMailReview(value: unknown): MailReview {
  if (!isRecord(value)) throw contractError("la revisión no es un objeto.");
  const checks = list(value.checks).map(normalizeMailCheck).filter((c): c is MailCheck => c !== null);
  const errors = checks.filter((c) => c.status === "error").length;
  const warnings = checks.filter((c) => c.status === "warning").length;
  return {
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
  return { artifacts, zip, review, manifest: isRecord(value.manifest) ? value.manifest : null };
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
    sample.push({
      index: Math.max(1, int(raw.index, sample.length + 1)),
      nombre: EMAIL_EN_TEXTO.test(nombre) ? "" : nombre,
      fields,
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
  constructor(code: string, message: string, status: number, details: unknown) {
    super(code, message);
    this.name = "MailApiError";
    this.status = status;
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

export async function apiMailPresets(): Promise<MailPresetsPayload> {
  return normalizeMailPresets(await handleMail(await apiFetch(`${BASE}/mail-presets`, { headers: headers() })));
}

export async function apiMailTemplate(): Promise<MailTemplatePayload> {
  return normalizeMailTemplatePayload(await handleMail(await apiFetch(`${BASE}/mail-template`, { headers: headers() })));
}

export async function apiMailTemplatePut(input: {
  template: MailTemplate;
  expected_revision: number;
}): Promise<MailTemplatePutPayload> {
  const body = { template: serializeMailTemplate(input.template), expected_revision: input.expected_revision };
  return normalizeMailTemplatePut(await handleMail(await apiFetch(`${BASE}/mail-template`, json("PUT", body))));
}

export async function apiMailPreview(input: {
  mode: MailPreviewMode;
  recipient_index?: number | null;
  template?: MailTemplate | null;
}): Promise<MailPreview> {
  const body: Record<string, unknown> = { mode: input.mode };
  if (input.recipient_index) body.recipient_index = input.recipient_index;
  if (input.template) body.template = serializeMailTemplate(input.template);
  return normalizeMailPreview(await handleMail(await apiFetch(`${BASE}/mail-template/preview`, json("POST", body))));
}

export async function apiMailReview(input: { template?: MailTemplate | null } = {}): Promise<MailReview> {
  const body = input.template ? { template: serializeMailTemplate(input.template) } : {};
  return normalizeMailReview(await handleMail(await apiFetch(`${BASE}/mail-template/review`, json("POST", body))));
}

/** Exporta la plantilla GUARDADA; el backend exige la revisión que la vista vio. */
export async function apiMailExport(input: { expected_revision: number }): Promise<MailExportPayload> {
  const body = { expected_revision: input.expected_revision };
  return normalizeMailExport(await handleMail(await apiFetch(`${BASE}/mail-template/export`, json("POST", body))));
}

export async function apiMailRecipientsImport(file: File, mapping?: MailRecipientsMapping | null): Promise<MailRecipients> {
  const fd = new FormData();
  fd.append("file", file, file.name);
  if (mapping) fd.append("mapping", JSON.stringify(mapping));
  return normalizeMailRecipients(await handleMail(await apiFetch(`${BASE}/mail-recipients/import`, {
    method: "POST",
    headers: headers(),
    body: fd,
  })));
}

export async function apiMailRecipients(): Promise<MailRecipients> {
  return normalizeMailRecipients(await handleMail(await apiFetch(`${BASE}/mail-recipients`, { headers: headers() })));
}

export async function apiMailRecipientsMapping(mapping: MailRecipientsMapping): Promise<MailRecipients> {
  return normalizeMailRecipients(await handleMail(await apiFetch(`${BASE}/mail-recipients/mapping`, json("PUT", { mapping }))));
}

export async function apiMailRecipientsDelete(): Promise<MailRecipients> {
  return normalizeMailRecipients(await handleMail(await apiFetch(`${BASE}/mail-recipients`, {
    method: "DELETE",
    headers: headers(),
  })));
}

/**
 * Sube un PNG como logo del proyecto (`brand_logo`) bajo el nombre `<id>.png`.
 *
 * El backend resuelve cada imagen del correo por el slug del nombre original
 * del archivo; subirlo con el id de la plantilla es lo que los une.
 */
export async function apiMailImageUpload(file: File, imageId: string): Promise<{ file_id: string; original_name: string }> {
  const fd = new FormData();
  fd.append("file", new File([file], `${imageId}.png`, { type: "image/png" }));
  const raw = await handleMail(await apiFetch(`/api/files/upload?kind=brand_logo`, {
    method: "POST",
    headers: headers(),
    body: fd,
  }));
  if (!isRecord(raw) || !str(raw.file_id)) throw contractError("la subida no devolvió el archivo.");
  return { file_id: str(raw.file_id), original_name: str(raw.original_name) };
}
