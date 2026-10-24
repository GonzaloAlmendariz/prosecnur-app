// =============================================================================
// materialMailSecciones.ts — el resto del catálogo de secciones (GOAL editor de
// correos profesional, L6). Espejo de collection_mail_secciones.R.
// =============================================================================
// Todas las secciones nombran igual lo que significa lo mismo (`title`, `text`,
// `eyebrow`, `entries`, `name`, `role`, `image_ref`, `alt`, `crop`,
// `button_text`, `url`): así «Cambiar por» (L8) pasa el contenido de una a otra.

import type { MailBlock, MailCrop, MailFeatureBlock, MailIcon } from "./materialMail";

export const MAIL_SECTION_TYPES = ["steps", "deadline", "benefits", "quote", "faq", "contact"] as const;
export type MailSectionType = (typeof MAIL_SECTION_TYPES)[number];

export const MAIL_STEPS_LAYOUTS = ["columnas", "lista"] as const;
export type MailStepsLayout = (typeof MAIL_STEPS_LAYOUTS)[number];

/** Cuántas entradas lleva cada sección (`.CMAIL_ENTRIES_RANGE`). */
export const RANGO_DE_ENTRADAS = { steps: [1, 6], benefits: [2, 4], faq: [1, 8] } as const;
export type TipoConEntradas = keyof typeof RANGO_DE_ENTRADAS;

/** Un paso, un beneficio o una pregunta con su respuesta. El ícono, sólo en un beneficio. */
export type MailSectionEntry = { title: string; text?: string; icon?: MailIcon };

/** Una foto opcional: sin `image_ref` la sección sale sin ella. */
type ConFoto = { image_ref?: string; alt?: string; crop?: MailCrop };

export type MailStepsBlock = ConFoto & {
  block_id: string; type: "steps"; title?: string; entries: MailSectionEntry[]; layout?: MailStepsLayout;
};
export type MailDeadlineBlock = {
  block_id: string; type: "deadline"; eyebrow?: string; title: string; text?: string; button_text?: string; url?: string;
};
export type MailBenefitsBlock = { block_id: string; type: "benefits"; title?: string; entries: MailSectionEntry[] };
export type MailQuoteBlock = ConFoto & { block_id: string; type: "quote"; text: string; name: string; role?: string };
export type MailFaqBlock = { block_id: string; type: "faq"; title?: string; entries: MailSectionEntry[] };
export type MailContactBlock = ConFoto & {
  block_id: string; type: "contact"; eyebrow?: string; name: string; role?: string; text?: string; email?: string; phone?: string;
};

export type MailSectionBlock =
  | MailStepsBlock | MailDeadlineBlock | MailBenefitsBlock | MailQuoteBlock | MailFaqBlock | MailContactBlock;

/** Los textos que una sección no puede perder: vaciarlos no los quita (la revisión lo marca). */
export const CLAVES_OBLIGATORIAS: Record<MailSectionType, readonly string[]> = {
  steps: [], deadline: ["title"], benefits: [], quote: ["text", "name"], faq: [], contact: ["name"],
};

/** Secciones que pueden llevar una foto con su recorte (`.CMAIL_PHOTO_TYPES`). */
export const MAIL_PHOTO_TYPES = ["feature", "steps", "quote", "contact"] as const;
export type MailBlockConFoto = MailFeatureBlock | MailStepsBlock | MailQuoteBlock | MailContactBlock;

export function tieneFoto(block: MailBlock): block is MailBlockConFoto & MailBlock {
  return (MAIL_PHOTO_TYPES as readonly string[]).includes(block.type);
}

/** Las secciones que «Cambiar por» intercambia y que pueden llevar `guardado` (`.CMAIL_GUARDADO_TYPES`). */
export const MAIL_GUARDADO_TYPES = ["feature", ...MAIL_SECTION_TYPES] as const;
/** Lo que una sección conserva sin mostrar después de «Cambiar por» (L8). */
export type MailGuardado = { guardado?: Record<string, unknown> };

export function esTipoDeSeccion(type: string): type is MailSectionType {
  return (MAIL_SECTION_TYPES as readonly string[]).includes(type);
}

export function tieneEntradas(type: string): type is TipoConEntradas {
  return type === "steps" || type === "benefits" || type === "faq";
}

// ---- normalizador --------------------------------------------------------------

type Lector = {
  str: (v: unknown) => string;
  optStr: (v: unknown) => string | undefined;
  icon: (v: unknown) => MailIcon | undefined;
  crop: (v: unknown) => MailCrop | undefined;
};

function entradas(value: unknown, leer: Lector, conIcono: boolean): MailSectionEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === "object" && !Array.isArray(x))
    .map((x) => {
      const text = leer.optStr(x.text);
      const icon = conIcono ? leer.icon(x.icon) : undefined;
      return { title: leer.str(x.title), ...(text !== undefined ? { text } : {}), ...(icon ? { icon } : {}) };
    });
}

/** Normaliza una sección: deja sólo las claves de su tipo, con su forma. */
export function normalizeMailSection(value: Record<string, unknown>, block_id: string, type: MailSectionType, leer: Lector): MailSectionBlock {
  const opcional = (...ks: string[]) => Object.fromEntries(ks.flatMap((k) => {
    const v = leer.optStr(value[k]);
    return v !== undefined ? [[k, v]] : [];
  }));
  const crop = leer.crop(value.crop);
  const foto = { ...opcional("image_ref", "alt"), ...(crop ? { crop } : {}) };
  switch (type) {
    case "steps": {
      const l = leer.str(value.layout);
      const layout = (MAIL_STEPS_LAYOUTS as readonly string[]).includes(l) ? (l as MailStepsLayout) : undefined;
      return { block_id, type, ...opcional("title"), entries: entradas(value.entries, leer, false), ...(layout ? { layout } : {}), ...foto };
    }
    case "benefits": return { block_id, type, ...opcional("title"), entries: entradas(value.entries, leer, true) };
    case "faq": return { block_id, type, ...opcional("title"), entries: entradas(value.entries, leer, false) };
    case "deadline": return { block_id, type, title: leer.str(value.title), ...opcional("eyebrow", "text", "button_text", "url") };
    case "quote": return { block_id, type, text: leer.str(value.text), name: leer.str(value.name), ...opcional("role"), ...foto };
    case "contact":
      return { block_id, type, name: leer.str(value.name), ...opcional("eyebrow", "role", "text", "email", "phone"), ...foto };
  }
}
