// Modelo puro del editor de correos (ADR 0110 §2). Sin React: rótulos, edición
// inmutable de la plantilla, problemas por bloque, textos de la revisión y la
// forma de la vista previa. Todo lo que aquí se decide se prueba con Vitest.

import {
  CLAVES_OBLIGATORIAS,
  esTipoDeSeccion,
  isOpaqueMailBlock,
  type MailBlock,
  type MailBlockType,
  type MailCheck,
  type MailCheckItem,
  type MailCheckItemValue,
  type MailField,
  type MailHeader,
  type MailProblem,
  type MailRecipientView,
  type MailRecipientsCounts,
  type MailRecipientsEncoding,
  type MailExportScope,
  type MailReview,
  type MailTemplate,
} from "../../../api/materialMail";
import type { TipoInsertable } from "./piezasGraficas";
import { sinEnfasis } from "./serializarTexto";

// ---- rótulos ------------------------------------------------------------------

export const ROTULO_DE_BLOQUE: Record<MailBlockType, string> = {
  greeting: "Saludo",
  heading: "Título",
  paragraph: "Párrafo",
  button: "Botón de acción",
  callout: "Recuadro",
  list: "Lista",
  divider: "Separador",
  image: "Imagen",
  signature: "Firma",
  footer_legal: "Pie legal",
  band: "Banda de color",
  ornament: "Separador decorativo",
  icon_text: "Ícono con texto",
  two_images: "Dos imágenes",
  feature: "Destacado",
  steps: "Pasos",
  deadline: "Fecha límite",
  benefits: "Beneficios",
  quote: "Cita",
  faq: "Preguntas frecuentes",
  contact: "Contacto",
};

export const DESCRIPCION_DE_BLOQUE: Record<MailBlockType, string> = {
  greeting: "Con el nombre de cada persona; si falta, va el texto de respaldo.",
  heading: "Un título o subtítulo para ordenar el correo.",
  paragraph: "Texto con énfasis en negrita o cursiva; los campos se tiñen para ver qué cambia por persona.",
  button: "Un enlace por persona, armado con su campo, o un enlace común para todos.",
  callout: "Para «Importante», las sesiones de una capacitación o las fechas.",
  list: "Una lista de puntos o numerada.",
  divider: "Una línea o un espacio entre dos partes del correo.",
  image: "Una imagen de la línea gráfica, con su texto alternativo; puede ir a todo el ancho.",
  signature: "Firma institucional del estudio, igual en todos los correos.",
  footer_legal: "La dirección y la baja que exige la plataforma. Un texto propio es opcional.",
  band: "Una franja de color a todo el ancho de la columna, de 8, 16 o 32 px de alto.",
  ornament: "Una onda, tres puntos o una línea doble entre dos partes del correo.",
  icon_text: "Un ícono de la casa junto a una línea de texto: una fecha, un lugar, un plazo.",
  two_images: "Dos imágenes lado a lado; en el teléfono se apilan. Cada una conserva su proporción.",
  feature: "Una foto junto a un título, un texto y un botón. En el teléfono la foto sube y ocupa el ancho.",
  steps: "Cómo responder en pasos numerados, a lo ancho o uno debajo de otro, con una foto arriba si quieres.",
  deadline: "El día en que cierra la encuesta, grande y centrado, con su botón. Sale igual en Outlook.",
  benefits: "De dos a cuatro razones para responder, cada una con su ícono. En el teléfono se apilan.",
  quote: "La voz de alguien del estudio, con su nombre y su cargo, y su retrato si lo tienes.",
  faq: "Las dudas de siempre con su respuesta, todas abiertas: en un correo no hay acordeones.",
  contact: "A quién escribir si hay dudas: nombre, cargo, correo y horario. Sin foto, van sus iniciales.",
};

export const ROTULO_DE_BLOQUE_OPACO = "Bloque no reconocido";

export function rotuloDeBloque(block: MailBlock): string {
  if (isOpaqueMailBlock(block)) return ROTULO_DE_BLOQUE_OPACO;
  return block.type === "image" && block.decorative ? "Imagen decorativa" : ROTULO_DE_BLOQUE[block.type];
}

export function descripcionDeBloque(block: MailBlock): string {
  if (isOpaqueMailBlock(block)) return `Tipo «${block.original_type}»: esta versión de la app no sabe editarlo. Se conserva tal cual al guardar.`;
  if (block.type === "image" && block.decorative) return "Un adorno de la línea gráfica: sale sin texto alternativo, a propósito.";
  return DESCRIPCION_DE_BLOQUE[block.type];
}

/**
 * C1: cada cuerpo del inspector es una pila de secciones independientes (campos,
 * listas, notas) con alto intrínseco.
 */
export const CUERPO_DEL_INSPECTOR = {
  "data-qa-geometry-group": "material-campo/correo/inspector",
  "data-qa-geometry-contract": "intrinsic",
} as const;

/** Pseudo-bloques: lo que se selecciona en la lista y no es un bloque del registro. */
export const SOBRE = "__sobre";
export const CABECERA = "__cabecera";
export type Seleccion = string;

/** Plantillas reales: de qué estudio salió cada una. */
const ORIGEN_DE_PRESET: Record<string, string> = {
  invitacion_encuesta_v1: "Acreditación PUCP 2026",
  recuperacion_estudiantes_v1: "CCSS Perfil 2026",
  invitacion_capacitacion_v1: "UNSA Hostigamiento 2026",
};

export function origenDePreset(presetId: string): string | null {
  return ORIGEN_DE_PRESET[presetId] ?? null;
}

/** Texto sin marcas para un resumen de una línea. */
export function textoPlano(text: string): string {
  return sinEnfasis(text).replace(/\s+/g, " ").trim();
}

/** Lo primero que dice el bloque, para reconocerlo en la lista. */
export function resumenDeBloque(block: MailBlock): string {
  if (isOpaqueMailBlock(block)) return block.original_type;
  switch (block.type) {
    case "greeting":
    case "heading":
    case "paragraph":
    case "button":
      return textoPlano(block.text);
    case "divider":
      return block.style === "espacio" ? "Espacio" : "Línea";
    case "image":
      // Sin descripción no se muestra el id del archivo: el subtítulo queda vacío.
      return block.decorative || altPendiente(block.alt) ? "" : textoPlano(block.alt);
    case "callout":
      return textoPlano(block.title ?? block.items[0] ?? "");
    case "list":
      return textoPlano(block.items[0] ?? "");
    case "signature":
      return textoPlano(block.name);
    case "footer_legal":
      return textoPlano(block.text ?? block.address ?? "");
    case "band":
      return "Banda de color";
    case "ornament":
      return block.style === "puntos" ? "Puntos" : block.style === "linea_doble" ? "Línea doble" : "Onda";
    case "icon_text":
      return textoPlano(block.text);
    case "two_images":
      return [block.alt_left, block.alt_right].filter((alt) => !altPendiente(alt)).map(textoPlano).join(" · ");
    case "feature":
    case "deadline":
      return textoPlano(block.title);
    case "steps":
    case "benefits":
    case "faq":
      return textoPlano(block.title ?? block.entries[0]?.title ?? "");
    case "quote":
      return textoPlano(block.text);
    case "contact":
      return textoPlano(block.name);
  }
}

export function rotuloDeCabecera(header: MailHeader): string {
  return header.kind === "banner" ? "Banner" : "Cabecera de logos";
}

// ---- campos de cada persona ---------------------------------------------------

/** El marcador que deja una imagen nueva o importada sin descripción: cuenta como alt vacío. */
export const ALT_DE_RELLENO = "[Describe la imagen]";

/** ¿Falta describir la imagen? Vacía o con el marcador de relleno. */
export function altPendiente(alt: string | undefined): boolean {
  const t = (alt ?? "").trim();
  return !t || t === ALT_DE_RELLENO;
}

/** La primera imagen de la cabecera que no tiene texto alternativo, o `null`. */
export function cabeceraSinAlt(template: Pick<MailTemplate, "header" | "images">): string | null {
  const ids = template.header.kind === "banner" ? [template.header.image_ref] : template.header.logo_ids;
  return ids.find((id) => altPendiente(template.images[id]?.alt)) ?? null;
}

export const CAMPO_NOMBRE = "nombre";
const TOKEN = /\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/g;

export function camposUsados(text: string): string[] {
  return Array.from(new Set(Array.from(text.matchAll(TOKEN), (m) => m[1])));
}

/** `{{campo}}` → `*|ETIQUETA|*`, en el orden en que la plantilla los declara. */
export function etiquetasDeMailchimp(template: MailTemplate): { app: string; mc: string; key: string }[] {
  return [
    { key: CAMPO_NOMBRE, app: "{{nombre}}", mc: "*|FNAME|*" },
    ...template.fields.map((f) => ({ key: f.key, app: `{{${f.key}}}`, mc: `*|${f.tag}|*` })),
  ];
}

export const ETIQUETAS_RESERVADAS = ["EMAIL", "FNAME", "LNAME", "ADDRESS", "PHONE", "UNSUB", "LIST"];
const CLAVES_RESERVADAS = [CAMPO_NOMBRE, "email", "correo"];

function sinTildes(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Clave `{{…}}` desde un rótulo: minúsculas, a-z0-9 y `_`, hasta 30. */
export function claveDesdeRotulo(label: string): string {
  const base = sinTildes(label).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const conLetra = /^[a-z]/.test(base) ? base : `campo_${base}`;
  return conLetra.slice(0, 30).replace(/_+$/, "") || "campo";
}

/** Etiqueta de Mailchimp desde una clave: A-Z0-9_, hasta 10, nunca reservada. */
export function etiquetaDesdeClave(key: string): string {
  let tag = key.toUpperCase().replace(/[^A-Z0-9_]/g, "").slice(0, 10) || "CAMPO";
  if (ETIQUETAS_RESERVADAS.includes(tag) || tag.startsWith("MC_")) tag = `C_${tag}`.slice(0, 10);
  return tag;
}

/** Problema de un campo antes de enviarlo: el backend lo rechazaría igual. */
export function problemaDeCampo(field: MailField, otros: readonly MailField[]): string | null {
  if (!/^[a-z][a-z0-9_]{0,29}$/.test(field.key)) return "La clave va en minúsculas: a-z, 0-9 y _.";
  // Sin llaves ni etiquetas de plataforma (#5 del re-QA e10-2): el campo se nombra por su rótulo.
  const nombre = field.label.trim() || field.key;
  if (CLAVES_RESERVADAS.includes(field.key)) return `«${nombre}» es un nombre que la app ya usa: elige otro.`;
  if (otros.some((o) => o.key === field.key)) return `Ya hay otro campo «${nombre}».`;
  if (!/^[A-Z0-9_]{1,10}$/.test(field.tag)) return "La etiqueta usa A-Z, 0-9 y _, hasta 10 caracteres.";
  if (ETIQUETAS_RESERVADAS.includes(field.tag) || field.tag.startsWith("MC_")) {
    return `«${field.tag}» es una etiqueta reservada de Mailchimp.`;
  }
  if (otros.some((o) => o.tag === field.tag)) return `La etiqueta «${field.tag}» ya es de otro campo.`;
  if (!field.label.trim()) return "Falta el rótulo.";
  return null;
}

export function nuevoCampo(label: string, existentes: readonly MailField[]): MailField {
  const base = claveDesdeRotulo(label);
  let key = base;
  for (let n = 2; existentes.some((f) => f.key === key) || CLAVES_RESERVADAS.includes(key); n += 1) {
    key = `${base.slice(0, 27)}_${n}`;
  }
  let tag = etiquetaDesdeClave(key);
  for (let n = 2; existentes.some((f) => f.tag === tag); n += 1) {
    tag = `${etiquetaDesdeClave(key).slice(0, 8)}${n}`;
  }
  return { key, tag, label: label.trim() || key };
}

// ---- texto editable de un bloque ----------------------------------------------

/** Propiedades de texto que la persona edita, en el orden del inspector. */
export type PropDeTexto =
  | "text"
  | "fallback"
  | "url"
  | "note"
  | "title"
  | "items"
  | "closing"
  | "name"
  | "lines"
  | "address"
  | "alt"
  | "alt_left"
  | "alt_right"
  | "eyebrow"
  | "button_text"
  | "role"
  | "email"
  | "phone";

const PROPS_DE_LISTA: readonly PropDeTexto[] = ["note", "items", "lines"];

export function esPropDeLista(prop: PropDeTexto): boolean {
  return PROPS_DE_LISTA.includes(prop);
}

export function propsDeTexto(type: MailBlockType | MailBlock["type"]): PropDeTexto[] {
  switch (type) {
    case "greeting": return ["text", "fallback"];
    case "heading": return ["text"];
    case "paragraph": return ["text"];
    case "image": return ["alt", "url"];
    case "button": return ["text", "url", "note"];
    case "callout": return ["title", "items"];
    case "list": return ["items"];
    case "signature": return ["closing", "name", "lines", "url"];
    case "footer_legal": return ["text", "address"];
    case "icon_text": return ["text"];
    case "two_images": return ["alt_left", "alt_right"];
    // La foto y su descripción van en su propio panel (FotoDeLaSeccion).
    case "feature": return ["eyebrow", "title", "text", "button_text", "url"];
    // Resto del catálogo (L6): las entradas y la foto tienen su propio panel.
    case "steps": case "benefits": case "faq": return ["title"];
    case "deadline": return ["eyebrow", "title", "text", "button_text", "url"];
    case "quote": return ["text", "name", "role"];
    case "contact": return ["eyebrow", "name", "role", "email", "phone", "text"];
    default: return [];
  }
}

export const ROTULO_DE_PROP: Record<PropDeTexto, string> = {
  text: "Texto",
  fallback: "Si falta el nombre",
  url: "Enlace",
  note: "Nota bajo el botón",
  title: "Título",
  items: "Puntos",
  closing: "Despedida",
  name: "Firma",
  lines: "Líneas",
  address: "Dirección",
  alt: "Texto alternativo",
  eyebrow: "Antetítulo",
  button_text: "Texto del botón",
  role: "Cargo",
  email: "Correo",
  phone: "Teléfono",
  alt_left: "Descripción de la imagen izquierda",
  alt_right: "Descripción de la imagen derecha",
};

/** El texto de una propiedad como lo edita una caja: listas, una línea por punto. */
export function textoDe(block: MailBlock, prop: PropDeTexto): string {
  const raw: unknown = (block as Record<string, unknown>)[prop];
  if (Array.isArray(raw)) return raw.filter((v): v is string => typeof v === "string").join("\n");
  return typeof raw === "string" ? raw : "";
}

/**
 * El bloque con el texto nuevo. Una lista se parte por líneas y pierde las
 * vacías; una propiedad opcional vacía se quita (el backend no acepta `""`
 * donde espera un texto con contenido).
 */
export function conTexto(block: MailBlock, prop: PropDeTexto, valor: string): MailBlock {
  const next: Record<string, unknown> = { ...block };
  if (esPropDeLista(prop)) {
    const items = valor.split("\n").map((l) => l.trim()).filter(Boolean);
    if (items.length || prop === "items") next[prop] = items;
    else delete next[prop];
  } else if (valor === "" && block.type === "feature" && ["eyebrow", "text", "button_text", "url", "alt"].includes(prop)) {
    // El título del Destacado es obligatorio: se queda aunque se vacíe (la revisión lo marca).
    delete next[prop];
  } else if (valor === "" && esTipoDeSeccion(block.type) && !CLAVES_OBLIGATORIAS[block.type].includes(prop)) {
    // En una sección, lo opcional vacío se quita; lo obligatorio se queda (la revisión lo marca).
    delete next[prop];
  } else if (valor === "" && ["fallback", "title", "closing", "url", "address"].includes(prop) && block.type !== "button" && block.type !== "feature") {
    delete next[prop];
  } else {
    next[prop] = valor;
  }
  return next as MailBlock;
}

/** Inserta `{{clave}}` en la posición del cursor. */
export function insertarToken(valor: string, cursor: number | null, key: string): { valor: string; cursor: number } {
  const token = `{{${key}}}`;
  const at = cursor === null || cursor < 0 || cursor > valor.length ? valor.length : cursor;
  const antes = valor.slice(0, at);
  const sep = antes && !/\s$/.test(antes) ? " " : "";
  const out = `${antes}${sep}${token}${valor.slice(at)}`;
  return { valor: out, cursor: at + sep.length + token.length };
}

// ---- destinatarios -----------------------------------------------------------

const NOMBRE_DE_CODIFICACION: Record<MailRecipientsEncoding, string> = {
  "utf-8": "UTF-8",
  "windows-1252": "Windows-1252",
  "utf-16": "UTF-16",
};

/**
 * Lo que conviene saber de cómo se leyó la lista, sin alarmar: la codificación
 * del CSV (un Excel en Windows guarda en Windows-1252), las filas vacías que no
 * cuentan y los repetidos que traen otro dato.
 */
export function notasDeLectura(encoding: MailRecipientsEncoding | null, counts: MailRecipientsCounts | null): string[] {
  const notas: string[] = [];
  // #12: UTF-8 es lo normal y no se dice; sólo se avisa cuando se leyó de otro modo.
  if (encoding && encoding !== "utf-8") notas.push(`Leído como ${NOMBRE_DE_CODIFICACION[encoding]}`);
  if (counts?.rows_blank_dropped) {
    notas.push(`${counts.rows_blank_dropped.toLocaleString("es-PE")} ${counts.rows_blank_dropped === 1 ? "fila vacía descartada" : "filas vacías descartadas"}`);
  }
  if (counts?.duplicated_conflicting) {
    notas.push(`${counts.duplicated_conflicting.toLocaleString("es-PE")} ${counts.duplicated_conflicting === 1 ? "repetido trae" : "repetidos traen"} otro dato: va la primera fila`);
  }
  return notas;
}

// ---- enlace de cada persona --------------------------------------------------

export type TramoDeEnlace = { texto: string; campo: boolean };
export type EnlaceDeLaPersona = { personal: boolean; tramos: TramoDeEnlace[]; completo: string };

const PARECE_CORREO = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const CORREO_OCULTO = "[correo oculto]";

/**
 * El enlace del botón resuelto para la persona que se está mirando.
 *
 * Los `{{campo}}` se reemplazan por el dato de la persona (o el respaldo del
 * campo); un valor que parece un correo no se muestra. El origen
 * (`https://host`) se abrevia a `…` cuando detrás queda ruta o consulta: lo
 * que distingue a una persona de otra está ahí. Un enlace que es sólo un
 * origen (`https://example.org/`) se muestra entero.
 */
export function enlaceParaLaPersona(
  url: string,
  persona: Pick<MailRecipientView, "nombre" | "fields"> | null | undefined,
  campos: readonly MailField[],
): EnlaceDeLaPersona {
  const tramos: TramoDeEnlace[] = [];
  let personal = false;
  let desde = 0;
  for (const m of url.matchAll(TOKEN)) {
    const at = m.index ?? 0;
    if (at > desde) tramos.push({ texto: url.slice(desde, at), campo: false });
    const key = m[1];
    personal = true;
    const dato = key === CAMPO_NOMBRE ? persona?.nombre : persona?.fields[key];
    // Sin dato ni respaldo, el rótulo del campo («Carrera»), nunca su llave.
    const campo = campos.find((f) => f.key === key);
    const valor = dato?.trim() ? dato : campo?.fallback ?? (campo?.label.trim() || key);
    tramos.push({ texto: PARECE_CORREO.test(valor) ? CORREO_OCULTO : valor, campo: true });
    desde = at + m[0].length;
  }
  if (desde < url.length) tramos.push({ texto: url.slice(desde), campo: false });
  const completo = tramos.map((t) => t.texto).join("");
  const primero = tramos[0];
  if (primero) {
    const corto = primero.texto.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/?#]+/i, "…");
    // Si tras el origen no queda nada que distinga a la persona, va entero.
    if (completo.length - primero.texto.length + corto.length > 2) tramos[0] = { ...primero, texto: corto };
  }
  return { personal, tramos: tramos.filter((t) => t.texto !== ""), completo };
}

// ---- edición de la plantilla --------------------------------------------------

function idsDe(template: MailTemplate): Set<string> {
  return new Set(template.blocks.map((b) => b.block_id));
}

export function nuevoIdDeBloque(type: TipoInsertable, template: MailTemplate): string {
  const base = type.replace(/_/g, "-");
  const ids = idsDe(template);
  for (let n = 1; ; n += 1) {
    const id = `${base}-${n}`;
    if (!ids.has(id)) return id;
  }
}

export function bloqueNuevo(type: TipoInsertable, block_id: string): MailBlock {
  switch (type) {
    case "greeting": return { block_id, type, text: "Estimado(a) {{nombre}}:", fallback: "Estimado(a):" };
    case "paragraph": return { block_id, type, text: "Escribe aquí el párrafo.", align: "justify" };
    case "button": return { block_id, type, text: "Acceder a la encuesta", url: "https://" };
    case "callout": return { block_id, type, title: "Importante:", items: ["Primer punto."], variant: "box" };
    case "list": return { block_id, type, items: ["Primer punto."], ordered: false };
    case "heading": return { block_id, type, text: "Título de la sección", level: "subtitulo" };
    case "divider": return { block_id, type, style: "linea", size: "m" };
    case "image": return { block_id, type, image_ref: "imagen", alt: "Describe la imagen" };
    // Un dato por llenar, no una institución de serie: el correo no siempre es de Pulso PUCP.
    case "signature": return { block_id, type, closing: "Atentamente,", name: "[Quién firma]" };
    case "footer_legal": return { block_id, type };
    // Piezas gráficas (E1o): sin color, siguen el de la casa hasta que se elija otro.
    case "band": return { block_id, type, height: "m" };
    case "ornament": return { block_id, type, style: "onda" };
    case "icon_text": return { block_id, type, icon: "calendario", text: "Escribe aquí el dato: una fecha, un lugar o un plazo." };
    case "two_images":
      return {
        block_id, type, left: "imagen-izquierda", right: "imagen-derecha",
        alt_left: "Describe la imagen de la izquierda", alt_right: "Describe la imagen de la derecha",
      };
    // Sección Destacado: sin foto al insertarla (sale sin imagen hasta que se suba), sobre el tinte.
    case "feature":
      return {
        block_id, type, eyebrow: "Novedad", title: "Escribe aquí el título",
        text: "Cuéntalo en una o dos líneas.", button_text: "Responder la encuesta", url: "https://",
        layout: "izquierda", box: { bg: "tinte" },
      };
    // Resto del catálogo (L6): con su contenido de ejemplo, que se lee y se cambia.
    case "steps":
      return {
        block_id, type, title: "Cómo responder", layout: "columnas",
        entries: [
          { title: "Abre tu enlace", text: "Es personal: no lo reenvíes." },
          { title: "Responde con calma", text: "Toma unos diez minutos." },
          { title: "Envía al final", text: "Puedes pausar y volver cuando quieras." },
        ],
      };
    case "deadline":
      return {
        block_id, type, eyebrow: "La encuesta cierra el", title: "[Día y fecha de cierre]",
        button_text: "Responder ahora", url: "https://", box: { bg: "acento" },
      };
    case "benefits":
      return {
        block_id, type, title: "Por qué vale la pena responder",
        entries: [
          { title: "Es confidencial", text: "Nadie verá tu respuesta por separado.", icon: "candado" },
          { title: "Toma diez minutos", text: "Desde el celular, cuando puedas.", icon: "reloj" },
          { title: "Llega a quien decide", text: "Los resultados se presentan a las autoridades.", icon: "grupo" },
        ],
      };
    case "quote":
      return { block_id, type, text: "Escribe aquí lo que dice, entre una y tres líneas.", name: "[Quién lo dice]", role: "[Su cargo]" };
    case "faq":
      return {
        block_id, type, title: "Preguntas frecuentes",
        entries: [
          { title: "¿Quién verá mis respuestas?", text: "Sólo el equipo del estudio, y en conjunto." },
          { title: "¿Puedo responder desde el celular?", text: "Sí. El enlace se adapta a cualquier pantalla." },
        ],
      };
    case "contact":
      return { block_id, type, eyebrow: "¿Dudas? Escríbele a", name: "[Quién responde]", role: "[Su cargo]", email: "[correo@dominio]", box: { bg: "tinte" } };
    // «Imagen + texto»: un Destacado con la foto 4:3 a un lado y sin caja.
    case "imagen_texto":
      return {
        block_id, type: "feature", title: "Escribe aquí el título", text: "Cuéntalo en dos o tres líneas.",
        layout: "izquierda", crop: { ratio: "4:3" },
      };
    // Decorativa: sale con alt vacío y la revisión no le pide descripción.
    case "image_decorativa": return { block_id, type: "image", image_ref: "decorativa", alt: "", decorative: true };
  }
}

/** Agrega un bloque después del elegido (o antes del pie si no hay elegido). */
export function agregarBloque(template: MailTemplate, type: TipoInsertable, despuesDe: string | null): { template: MailTemplate; block_id: string } {
  const block = bloqueNuevo(type, nuevoIdDeBloque(type, template));
  const blocks = [...template.blocks];
  let at = despuesDe ? blocks.findIndex((b) => b.block_id === despuesDe) + 1 : 0;
  if (at <= 0) {
    const pie = blocks.findIndex((b) => b.type === "footer_legal");
    const firma = blocks.findIndex((b) => b.type === "signature");
    at = firma >= 0 ? firma : pie >= 0 ? pie : blocks.length;
  }
  // El pie va siempre al final: nada se agrega después de él.
  const pie = blocks.findIndex((b) => b.type === "footer_legal");
  if (pie >= 0 && at > pie && type !== "footer_legal") at = pie;
  blocks.splice(at, 0, block);
  return { template: { ...template, blocks }, block_id: block.block_id };
}

export function editarBloque(template: MailTemplate, blockId: string, update: (b: MailBlock) => MailBlock): MailTemplate {
  return { ...template, blocks: template.blocks.map((b) => (b.block_id === blockId ? update(b) : b)) };
}

export function quitarBloque(template: MailTemplate, blockId: string): MailTemplate {
  return { ...template, blocks: template.blocks.filter((b) => b.block_id !== blockId) };
}

export function moverBloque(template: MailTemplate, blockId: string, delta: -1 | 1): MailTemplate {
  const blocks = [...template.blocks];
  const i = blocks.findIndex((b) => b.block_id === blockId);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= blocks.length) return template;
  [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
  return { ...template, blocks };
}

export function puedeMover(template: MailTemplate, blockId: string, delta: -1 | 1): boolean {
  const i = template.blocks.findIndex((b) => b.block_id === blockId);
  const j = i + delta;
  return i >= 0 && j >= 0 && j < template.blocks.length;
}

/** Lo que define el correo, sin revisión ni huella: para saber si hay cambios. */
export function huellaDeEdicion(template: MailTemplate | null): string {
  if (!template) return "";
  const { revision: _r, template_sha256: _s, ...resto } = template;
  void _r;
  void _s;
  return JSON.stringify(conClavesOrdenadas(resto));
}

/**
 * El mismo valor con las claves de cada objeto en orden alfabético. La
 * plantilla que devuelve el backend no trae las claves en el orden en que el
 * editor las escribió (el saludo por sexo, sobre todo): sin esto, guardar
 * dejaba el correo «sin guardar» para siempre (F6).
 */
function conClavesOrdenadas(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(conClavesOrdenadas);
  if (valor === null || typeof valor !== "object") return valor;
  const fuente = valor as Record<string, unknown>;
  return Object.fromEntries(
    Object.keys(fuente).sort().filter((k) => fuente[k] !== undefined).map((k) => [k, conClavesOrdenadas(fuente[k])]),
  );
}

// ---- imágenes -----------------------------------------------------------------

/** Slug de un nombre de archivo, el mismo que el backend usa para los logos. */
export function slugDeImagen(nombre: string): string {
  const sinExt = nombre.replace(/\.[A-Za-z0-9]+$/, "");
  const slug = sinTildes(sinExt).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return (slug || "imagen").slice(0, 60).replace(/-+$/, "");
}

/** Un id libre que empieza por `base` (logo-cliente, logo-cliente-2…). */
export function idLibre(base: string, ocupados: Iterable<string>): string {
  const set = new Set(ocupados);
  if (!set.has(base)) return base;
  for (let n = 2; ; n += 1) {
    const id = `${base.slice(0, 56)}-${n}`;
    if (!set.has(id)) return id;
  }
}

export function idsDeImagenes(template: MailTemplate): string[] {
  return template.header.kind === "banner" ? [template.header.image_ref] : template.header.logo_ids;
}

/** Renombra una imagen en la cabecera y en el mapa, conservando su alt y su URL. */
export function renombrarImagen(template: MailTemplate, de: string, a: string): MailTemplate {
  if (de === a) return template;
  const images = { ...template.images };
  images[a] = images[de] ?? { alt: "" };
  delete images[de];
  const header: MailHeader = template.header.kind === "banner"
    ? { ...template.header, image_ref: template.header.image_ref === de ? a : template.header.image_ref }
    : { ...template.header, logo_ids: template.header.logo_ids.map((id) => (id === de ? a : id)) };
  return { ...template, images, header };
}

export const BANNER_ID = "banner-mailing";
export const BANNER_ANCHO = 1200;
export const BANNER_ALTO = 600;
export const MAX_LOGOS = 6;

/** Los logos de la franja: los del header, o los que el mapa recuerda si hoy hay banner. */
export function logosDeLaFranja(template: MailTemplate): string[] {
  const header = template.header;
  if (header.kind === "logos") return header.logo_ids;
  return Object.keys(template.images).filter((id) => id !== header.image_ref).slice(0, MAX_LOGOS);
}

/**
 * Un atributo HTML escapado de vuelta a texto. `htmlEscape` de R escapa los
 * saltos de línea que `base64_enc` mete en el data URI (`&#10;`); se quitan,
 * porque dentro de un data URI no significan nada.
 */
function atributoSinEntidades(valor: string): string {
  return valor
    .replace(/&#(?:10|13);/g, "")
    .replace(/&#(\d+);/g, (_m, d: string) => String.fromCharCode(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/**
 * Lo que la vista previa ya pinta de cada logo de la franja (data URI o URL).
 *
 * El render (`.cmail_header_html`) escribe la cabecera como la primera tabla
 * del correo: una celda `<td valign="middle">` por logo —con su `<img>`, o un
 * hueco con el alt si no hay archivo— y separadores con estilo propio. Si el
 * número de celdas no calza con los logos, no se promete nada: mapa vacío.
 */
export function logosDeLaVistaPrevia(html: string | null | undefined, logoIds: readonly string[]): Record<string, string> {
  if (!html || !logoIds.length) return {};
  const inicio = html.search(/<td[^>]*valign="middle"/i);
  if (inicio < 0) return {};
  const fin = html.indexOf("</table>", inicio);
  const cabecera = html.slice(inicio, fin < 0 ? undefined : fin);
  const celdas = Array.from(cabecera.matchAll(/<td valign="middle">\s*(?:<img\b[^>]*?\ssrc="([^"]*)"|<span\b)/gi));
  if (celdas.length !== logoIds.length) return {};
  const out: Record<string, string> = {};
  celdas.forEach((m, i) => {
    const src = m[1] ? atributoSinEntidades(m[1]) : "";
    if (src) out[logoIds[i]] = src;
  });
  return out;
}

export function usarBanner(template: MailTemplate, imageRef: string = BANNER_ID): MailTemplate {
  const images = { ...template.images };
  if (!images[imageRef]) images[imageRef] = { alt: "Banner del estudio" };
  return { ...template, images, header: { kind: "banner", image_ref: imageRef } };
}

export function usarLogos(template: MailTemplate, background: "dark" | "light" = "dark"): MailTemplate {
  const logo_ids = logosDeLaFranja(template);
  return { ...template, header: { kind: "logos", logo_ids: logo_ids.length ? logo_ids : ["pulso"], background } };
}

// ---- banners que ya traen los logos ---------------------------------------------

/** Lo que el equipo declaró de la imagen: `undefined` es «no se sabe» y se pregunta. */
export function traeLogosDe(template: Pick<MailTemplate, "images">, id: string): boolean | undefined {
  return template.images[id]?.trae_logos;
}

/**
 * Declara (o con `undefined`, olvida) si el banner ya trae los logos. Olvidar
 * es lo que hace un archivo nuevo: la respuesta era de la imagen anterior.
 */
export function conTraeLogos(template: MailTemplate, id: string, valor: boolean | undefined, alt = ""): MailTemplate {
  const actual = template.images[id];
  if (valor === undefined) {
    if (!actual || actual.trae_logos === undefined) return template;
    const { trae_logos: _t, ...sinDato } = actual;
    void _t;
    return { ...template, images: { ...template.images, [id]: sinDato } };
  }
  if (actual?.trae_logos === valor) return template;
  return { ...template, images: { ...template.images, [id]: { ...(actual ?? { alt }), trae_logos: valor } } };
}

/** ¿Sale la franja de logos? Sólo con la cabecera de logos. */
export function hayFranjaDeLogos(template: Pick<MailTemplate, "header">): boolean {
  return template.header.kind === "logos";
}

/** ¿El bloque es la imagen a sangre de arriba del correo, la que puede pasar a ser la cabecera? */
export function esBannerDeArriba(template: Pick<MailTemplate, "blocks">, blockId: string): boolean {
  const primero = template.blocks[0];
  return primero?.block_id === blockId && primero.type === "image" && primero.bleed === true;
}

/**
 * Quita la franja de logos porque el banner de arriba ya los trae: la imagen
 * a sangre pasa a ser la cabecera (banner) y deja de ser un bloque, para no
 * salir dos veces. Su descripción pasa a la imagen si allí faltaba. Sin un
 * banner de arriba, la plantilla no cambia.
 */
export function franjaPorElBanner(template: MailTemplate, blockId: string): MailTemplate {
  if (!hayFranjaDeLogos(template) || !esBannerDeArriba(template, blockId)) return template;
  const block = template.blocks[0];
  if (block.type !== "image") return template;
  const id = block.image_ref;
  const actual = template.images[id] ?? { alt: "" };
  const alt = actual.alt.trim() ? actual.alt : block.alt;
  return {
    ...template,
    images: { ...template.images, [id]: { ...actual, alt } },
    header: { kind: "banner", image_ref: id },
    blocks: template.blocks.slice(1),
  };
}

// ---- problemas del contrato ---------------------------------------------------

export type ProblemasPorDestino = {
  porBloque: Record<string, MailProblem[]>;
  sobre: MailProblem[];
  cabecera: MailProblem[];
  campos: MailProblem[];
  otros: MailProblem[];
};

/**
 * Reparte los problemas del 422 por destino. Las rutas vienen de R con índice
 * desde 1: `template.blocks[3].text` es el tercer bloque.
 */
export function repartirProblemas(problems: readonly MailProblem[], template: MailTemplate | null): ProblemasPorDestino {
  const out: ProblemasPorDestino = { porBloque: {}, sobre: [], cabecera: [], campos: [], otros: [] };
  for (const p of problems) {
    const bloque = p.path.match(/^template\.blocks\[(\d+)\]/);
    if (bloque && template) {
      const block = template.blocks[Number(bloque[1]) - 1];
      if (block) {
        (out.porBloque[block.block_id] ??= []).push(p);
        continue;
      }
    }
    if (/^template\.(subject|preheader)/.test(p.path)) out.sobre.push(p);
    else if (/^template\.(header|images|theme)/.test(p.path)) out.cabecera.push(p);
    else if (/^template\.fields/.test(p.path)) out.campos.push(p);
    else out.otros.push(p);
  }
  return out;
}

/** Qué propiedad nombra la ruta (`template.blocks[2].items[1]` → `items`). */
export function propDelProblema(path: string): string | null {
  return path.match(/^template\.blocks\[\d+\]\.([a-z_]+)/)?.[1] ?? null;
}

// ---- revisión -----------------------------------------------------------------

export const ROTULO_DE_CHEQUEO: Record<string, string> = {
  subject: "Asunto definido",
  preheader: "Texto de vista previa",
  html_weight: "Peso del correo",
  images_hosted: "Imágenes guardadas como archivo",
  images_available: "Logos e imágenes subidos",
  images_alt: "Descripción de cada imagen",
  placeholders_pending: "Textos por completar",
  banner_size: "Medidas del banner",
  footer_unsub: "Enlace para darse de baja y dirección",
  recipients: "Destinatarios con correo válido",
  tags_have_columns: "Cada campo con su columna en la lista",
  fields_empty: "Campos con dato para todos",
  names_unsplit: "Nombres separados del apellido",
  duplicates_conflicting: "Correos repetidos con datos distintos",
  import_zip_weight: "Peso del archivo para Mailchimp",
  accent_contrast: "El texto se lee sobre el color",
  image_width: "Nitidez de las imágenes",
  image_weight: "Peso de cada imagen",
  // SurveyMonkey (E1j) y envíos (E1k).
  survey_link: "Enlace a la encuesta",
  footer_optout: "Enlace para darse de baja",
  images_public_url: "Imágenes publicadas en la web",
  sm_fields_mapped: "Campos con etiqueta de SurveyMonkey",
  sm_fallback: "Datos que faltan en SurveyMonkey",
  sm_custom_limit: "Campos personalizados dentro del plan",
  sm_link_field_empty: "Cada persona con su enlace",
  sm_destination_mismatch: "Destino del enlace",
  send_dates: "Fechas de los envíos",
  reminder_audience: "A quién va el recordatorio",
  // Saludo por sexo (C8).
  greeting_trato: "Saludo según la persona",
  greeting_trato_word: "Palabra del saludo",
  sm_trato_blank: "Saludo de cada persona en SurveyMonkey",
  // Estilo campaña (E1n).
  campana_text_contrast: "El texto se lee sobre el fondo",
  campana_button_contrast: "El botón se lee sobre su color",
  campana_footer_contrast: "El pie se lee sobre el fondo",
  paragraph_accent_contrast: "Párrafos en tono acento se leen",
  // Piezas gráficas (E1o).
  piezas_contrast: "Las piezas gráficas se distinguen del fondo",
  icon_text_sm_icon: "Íconos en SurveyMonkey",
  // Un banner que ya trae los logos, con la franja de logos encima.
  logos_duplicados: "Logos repetidos",
};

/** Dónde se usa un campo (`uses` de `fields_empty`), en la voz de la vista. */
const LUGAR_DE_USO: Record<string, string> = {
  url: "enlace",
  asunto: "asunto",
  preheader: "vista previa",
  saludo: "saludo",
  saludo_sin_respaldo: "saludo sin respaldo",
  cuerpo: "cuerpo",
};

function listaDe(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  return typeof value === "string" && value ? [value] : [];
}

/** Un campo como lo nombra el equipo: su rótulo de la plantilla, nunca `*|ETIQUETA|*`. */
export type CampoConNombre = Pick<MailField, "key" | "tag" | "label">;

const NOMBRE_RESERVADO: Readonly<Record<string, string>> = { FNAME: "Nombre", LNAME: "Apellido", EMAIL: "Correo" };

/** El nombre humano de un campo que el backend señala por su etiqueta (`CARRERA`) o su clave. */
export function nombreDelCampo(tag: unknown, key: unknown, campos: readonly CampoConNombre[] = []): string {
  const t = typeof tag === "string" ? tag : "";
  const k = typeof key === "string" ? key : "";
  const campo = campos.find((c) => (t && c.tag === t) || (k && c.key === k));
  if (campo?.label) return campo.label;
  if (NOMBRE_RESERVADO[t]) return NOMBRE_RESERVADO[t];
  if (k === CAMPO_NOMBRE) return "Nombre";
  const crudo = (k || t).replace(/[_-]+/g, " ").trim().toLowerCase();
  return crudo ? crudo.charAt(0).toUpperCase() + crudo.slice(1) : "Campo";
}

/**
 * Una fila del detalle de un chequeo, en una línea y en la voz del equipo:
 * el campo por su nombre (`Carrera → CARRERA`), nunca su etiqueta de plataforma.
 */
export function textoDeItem(item: MailCheckItem, campos: readonly CampoConNombre[] = []): string {
  if (typeof item === "string") return item;
  const nombre = (it: Record<string, MailCheckItemValue>) => nombreDelCampo(it.tag, it.key, campos);
  if ("row" in item && "first_row" in item) {
    // duplicates_conflicting: filas del archivo, con el encabezado como fila 1.
    const tags = listaDe(item.tags).map((t) => nombreDelCampo(t, undefined, campos)).join(", ");
    return `Fila ${String(item.row)} repite la ${String(item.first_row)}${tags ? `: otro ${tags}` : ""}`;
  }
  if ("tag" in item && "column" in item) return `${nombre(item)} → ${String(item.column)}`;
  if ("tag" in item && "empty" in item) {
    const vacios = Number(item.empty) || 0;
    const usos = listaDe(item.uses).map((u) => LUGAR_DE_USO[u] ?? u);
    const donde = usos.length ? ` · en ${usos.join(", ")}` : "";
    const respaldo = item.fallback && item.fallback_covers !== false ? ` → «${String(item.fallback)}»` : "";
    const sinRespaldo = item.in_url === true ? " · sin respaldo posible" : item.fallback_covers === false && item.fallback ? " · el respaldo no alcanza" : "";
    return `${nombre(item)}: ${vacios} sin dato${respaldo}${donde}${sinRespaldo}`;
  }
  if ("tag" in item) return `${nombre(item)}: sin columna`;
  return Object.values(item).map((v) => (Array.isArray(v) ? v.join(", ") : String(v))).join(" · ");
}

function kb(bytes: number): string {
  return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString("es-PE")} KB`;
}

function n(value: MailCheck["value"]): number {
  return typeof value === "number" ? value : Number(value ?? 0) || 0;
}

/** La cifra corta que acompaña a cada chequeo, en la voz de la vista. */
export function cifraDeChequeo(check: MailCheck): string {
  const v = n(check.value);
  switch (check.code) {
    case "subject":
      return v ? `${v.toLocaleString("es-PE")} car.` : "falta";
    case "preheader":
      return v ? `${v.toLocaleString("es-PE")} car.` : "falta";
    case "html_weight":
      return `${kb(v)} de 102 KB`;
    case "images_hosted":
      // Desde E1g las imágenes viajan en el ZIP importable o con su URL:
      // sólo es error un `data:` dentro del HTML de Mailchimp.
      return check.status === "error" ? "incrustadas" : "en el archivo o con su dirección web";
    case "import_zip_weight":
      return `${kb(v)} de 1.024 KB`;
    case "accent_contrast":
    case "campana_text_contrast":
    case "campana_button_contrast":
    case "campana_footer_contrast":
    case "paragraph_accent_contrast":
      // La razón va sólo en el `title` (`tituloDeChequeo`): a la vista, si se lee.
      return check.status === "ok" ? "se lee bien" : "cuesta leerlo";
    case "logos_duplicados":
      return check.status === "ok" ? "una sola vez" : "podrían salir dos veces";
    case "greeting_trato":
    case "greeting_trato_word":
      // Su `value` es un conteo interno: el detalle ya dice a quién le cae el saludo.
      return "";
    case "image_width":
      return check.status === "ok" ? "nítidas" : `${v.toLocaleString("es-PE")} se verían borrosas`;
    case "image_weight":
      return check.status === "ok" ? "livianas" : `${v.toLocaleString("es-PE")} sobre 200 KB`;
    case "images_available":
      return check.status === "ok" ? "todas" : v === 1 ? "falta 1" : `faltan ${v}`;
    case "images_alt":
      return check.status === "ok" ? "en todas" : `${v} sin texto`;
    case "piezas_contrast":
      return check.status === "ok" ? "se distinguen" : v === 1 ? "1 casi no se ve" : `${v.toLocaleString("es-PE")} casi no se ven`;
    case "icon_text_sm_icon":
      return check.status === "ok" ? "con dirección web" : v === 1 ? "1 sale sin ícono" : `${v.toLocaleString("es-PE")} salen sin ícono`;
    case "placeholders_pending":
      return check.status === "ok" ? "ninguno" : v === 1 ? "queda 1" : `quedan ${v}`;
    case "banner_size":
      return typeof check.value === "string" ? check.value.replace("×", " × ") : check.status === "ok" ? "correcto" : "sin medir";
    case "footer_unsub":
      return check.status === "ok" ? "Mailchimp lo exige" : "falta";
    case "recipients":
      return check.status === "error" && !v ? "sin importar" : `${v.toLocaleString("es-PE")} válidos`;
    case "tags_have_columns": {
      const total = check.items.length;
      return total ? `${total - v} de ${total}` : "sin etiquetas";
    }
    case "fields_empty":
      if (!v && SIN_EFECTIVOS.test(check.detail)) return "sin destinatarios";
      return v ? `${v.toLocaleString("es-PE")} sin dato` : "todos";
    case "names_unsplit":
      return v ? `${v.toLocaleString("es-PE")} sin separar` : "todos";
    case "duplicates_conflicting":
      return v ? `${v.toLocaleString("es-PE")} en conflicto` : "ninguno";
    default:
      return check.value === null ? "" : String(check.value);
  }
}

const CONTRASTE: ReadonlySet<string> = new Set(["accent_contrast", "campana_text_contrast", "campana_button_contrast", "campana_footer_contrast", "paragraph_accent_contrast"]);

/** Una razón de contraste con coma decimal, como se escribe en el informe: `15,7:1`. */
export function razonDeContraste(v: number): string {
  return `${String(Math.round(v * 10) / 10).replace(".", ",")}:1`;
}

/** El `title` de un chequeo: la cifra técnica que la vista no muestra (la razón de contraste). */
export function tituloDeChequeo(check: MailCheck): string | undefined {
  const v = n(check.value);
  return CONTRASTE.has(check.code) && v > 0 ? `Contraste ${razonDeContraste(v)}` : undefined;
}

/** `fields_empty` sin nadie a quien revisar: «todos» sería falso. */
const SIN_EFECTIVOS = /^Sin destinatarios efectivos/i;

export function esChequeoConocido(check: Pick<MailCheck, "code">): boolean {
  return Object.prototype.hasOwnProperty.call(ROTULO_DE_CHEQUEO, check.code);
}

/** Un chequeo que esta versión no conoce se nombra con su `code`; su `detail` lo explica. */
export function rotuloDeChequeo(check: MailCheck): string {
  return esChequeoConocido(check) ? ROTULO_DE_CHEQUEO[check.code] : check.code;
}

/**
 * ¿Se muestra el `detail` del backend? Siempre que haya algo que corregir, y
 * también en un chequeo desconocido: sin rótulo propio, el detalle es lo único
 * que dice qué se revisó.
 */
export function muestraDetalle(check: MailCheck): boolean {
  if (!check.detail) return false;
  if (check.code === "fields_empty" && SIN_EFECTIVOS.test(check.detail)) return true;
  return check.status !== "ok" || !esChequeoConocido(check);
}

/** Orden de lectura: primero lo que bloquea, después avisos, al final lo que está bien. */
export function chequeosOrdenados(checks: readonly MailCheck[]): MailCheck[] {
  const peso = { error: 0, warning: 1, ok: 2 } as const;
  return [...checks].sort((a, b) => peso[a.status] - peso[b.status]);
}

/**
 * La revisión en tres grupos (H8): arriba lo que falta corregir, después los
 * avisos y, plegado, lo que está en orden. Cada grupo conserva el orden del
 * backend; las cuentas son las del encabezado y la pestaña.
 */
export function partesDeRevision(checks: readonly MailCheck[]): { porCorregir: MailCheck[]; avisos: MailCheck[]; enOrden: MailCheck[] } {
  return {
    porCorregir: checks.filter((c) => c.status === "error"),
    avisos: checks.filter((c) => c.status === "warning"),
    enOrden: checks.filter((c) => c.status === "ok"),
  };
}

export const TODO_EN_ORDEN = "Todo en orden: listo para exportar";

export function resumenDeRevision(errors: number, warnings: number): string {
  if (!errors && !warnings) return TODO_EN_ORDEN;
  const partes: string[] = [];
  if (errors) partes.push(`${errors} por corregir`);
  if (warnings) partes.push(`${warnings} ${warnings === 1 ? "aviso" : "avisos"}`);
  return partes.join(" · ");
}

// ---- vista previa -------------------------------------------------------------

export type VistaDelCorreo = "escritorio" | "telefono" | "oscuro";

export const ANCHO_DE_VISTA: Record<VistaDelCorreo, number> = {
  escritorio: 648,
  telefono: 375,
  oscuro: 648,
};

/** Colores del modo oscuro simulado; salen de los tokens del documento. */
export type PaletaOscura = { papel: string; tinta: string; suave: string };

/**
 * HTML para el `srcdoc` del iframe.
 *
 * El modo oscuro se simula como lo hacen Apple Mail y Gmail con un correo que
 * no declara el suyo: los fondos claros pasan a oscuros y el texto a claro,
 * pero los colores de marca —la franja de la cabecera, el botón— se respetan.
 * Así se ve lo que de verdad importa: un logo oscuro sobre una cabecera clara
 * desaparece. También se quita el margen del body para medir su alto real.
 */
export function htmlParaLaVista(html: string, vista: VistaDelCorreo, paleta?: PaletaOscura): string {
  const reglas = ["html,body{margin:0;overflow:hidden}"];
  if (vista === "oscuro" && paleta) {
    const { papel, tinta, suave } = paleta;
    reglas.push(
      `body,[bgcolor="#ffffff"],[style*="background-color:#ffffff"]{background-color:${papel}!important}`,
      `[style*="background-color:#f5f6f9"],[bgcolor="#f3f3f3"],[style*="background-color:#f3f3f3"]{background-color:${suave}!important}`,
      `p,li,ul,ol,td,span,strong{color:${tinta}!important}`,
      `[style*="border:1px solid #d6d6d6"],[style*="border-bottom:1px solid #d6d6d6"]{border-color:${suave}!important}`,
      // El texto del botón va sobre el acento: se queda claro.
      `td[bgcolor] a{color:${tinta}!important}`,
    );
  }
  const estilo = `<style data-pulso-vista>${reglas.join("")}</style>`;
  return /<\/head>/i.test(html) ? html.replace(/<\/head>/i, `${estilo}</head>`) : `${estilo}${html}`;
}

/**
 * ¿La marca `data-pulso-block` del HTML nombra una zona que el editor sabe
 * elegir? La cabecera o un bloque de la plantilla. El render marca las zonas
 * (E1g, H-a): ya no se cuentan filas, así un bloque nuevo no descuadra nada.
 */
export function esZonaDelCorreo(id: string | null | undefined, template: Pick<MailTemplate, "blocks">): id is string {
  if (!id) return false;
  return id === CABECERA || template.blocks.some((b) => b.block_id === id);
}

export function bloqueDelPie(template: MailTemplate): string | null {
  return template.blocks.find((b) => b.type === "footer_legal")?.block_id ?? null;
}

/** Escala para que el correo quepa en el lienzo sin recortarse (nunca agranda). */
export function escalaParaCaber(disponible: number | null, ancho: number): number {
  if (disponible === null || !Number.isFinite(disponible) || disponible <= 0 || ancho <= 0) return 1;
  return Math.min(1, Math.max(0.4, disponible / ancho));
}

export function pesoLegible(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toLocaleString("es-PE", { maximumFractionDigits: 1 })} MB`;
  return kb(bytes);
}

// ---- salida para Mailchimp ----------------------------------------------------

/** Chequeos de la audiencia: con `scope = "plantilla"` el backend no los corre. */
const CHEQUEOS_DE_AUDIENCIA: ReadonlySet<string> = new Set([
  "recipients",
  "tags_have_columns",
  "fields_empty",
  "names_unsplit",
  "duplicates_conflicting",
]);

/**
 * ¿La revisión impide esta salida? La plantilla sola no depende de la lista de
 * destinatarios: sólo la frenan los errores del correo mismo.
 */
export function revisionBloquea(review: Pick<MailReview, "ready" | "checks"> | null, scope: MailExportScope): boolean {
  if (!review) return false;
  if (scope === "completo") return !review.ready;
  return review.checks.some((c) => c.status === "error" && !CHEQUEOS_DE_AUDIENCIA.has(c.code));
}

