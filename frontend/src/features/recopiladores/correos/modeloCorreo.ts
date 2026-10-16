// Modelo puro del editor de correos (ADR 0110 §2). Sin React: rótulos, edición
// inmutable de la plantilla, problemas por bloque, textos de la revisión y la
// forma de la vista previa. Todo lo que aquí se decide se prueba con Vitest.

import type {
  MailBlock,
  MailBlockType,
  MailCheck,
  MailField,
  MailHeader,
  MailProblem,
  MailTemplate,
} from "../../../api/materialMail";

// ---- rótulos ------------------------------------------------------------------

export const ROTULO_DE_BLOQUE: Record<MailBlockType, string> = {
  greeting: "Saludo",
  paragraph: "Párrafo",
  button: "Botón de acción",
  callout: "Recuadro",
  list: "Lista",
  signature: "Firma",
  footer_legal: "Pie legal",
};

export const DESCRIPCION_DE_BLOQUE: Record<MailBlockType, string> = {
  greeting: "Con el nombre de cada persona; si falta, va el texto de respaldo.",
  paragraph: "Texto con énfasis en negrita; los campos se tiñen para ver qué cambia por persona.",
  button: "Un enlace por persona, armado con su campo, o un enlace común para todos.",
  callout: "Para «Importante», las sesiones de una capacitación o las fechas.",
  list: "Una lista de puntos o numerada.",
  signature: "Firma institucional del estudio, igual en todos los correos.",
  footer_legal: "Por qué recibe el correo y la dirección. Mailchimp agrega la baja (*|UNSUB|*).",
};

/**
 * C1: cada cuerpo del inspector es una pila de secciones independientes (campos,
 * listas, notas) con alto intrínseco.
 */
export const CUERPO_DEL_INSPECTOR = {
  "data-qa-geometry-group": "material-campo/catalogo/correos-inspector",
  "data-qa-geometry-contract": "intrinsic",
} as const;

/** Pseudo-bloques: lo que se selecciona en la lista y no es un bloque del registro. */
export const SOBRE = "__sobre";
export const CABECERA = "__cabecera";
export type Seleccion = string;

/** Plantillas reales: de qué estudio salió cada una. */
const ORIGEN_DE_PRESET: Record<string, string> = {
  recuperacion_estudiantes_v1: "CCSS Perfil 2026",
  invitacion_capacitacion_v1: "UNSA Hostigamiento 2026",
};

export function origenDePreset(presetId: string): string | null {
  return ORIGEN_DE_PRESET[presetId] ?? null;
}

/** Texto sin marcas para un resumen de una línea. */
export function textoPlano(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\s+/g, " ").trim();
}

/** Lo primero que dice el bloque, para reconocerlo en la lista. */
export function resumenDeBloque(block: MailBlock): string {
  switch (block.type) {
    case "greeting":
    case "paragraph":
    case "button":
      return textoPlano(block.text);
    case "callout":
      return textoPlano(block.title ?? block.items[0] ?? "");
    case "list":
      return textoPlano(block.items[0] ?? "");
    case "signature":
      return textoPlano(block.name);
    case "footer_legal":
      return textoPlano(block.text ?? block.address ?? "");
  }
}

export function rotuloDeCabecera(header: MailHeader): string {
  return header.kind === "banner" ? "Banner de mailing" : "Cabecera de logos";
}

// ---- campos de cada persona ---------------------------------------------------

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
  if (CLAVES_RESERVADAS.includes(field.key)) return `{{${field.key}}} es reservado.`;
  if (otros.some((o) => o.key === field.key)) return `{{${field.key}}} está repetido.`;
  if (!/^[A-Z0-9_]{1,10}$/.test(field.tag)) return "La etiqueta usa A-Z, 0-9 y _, hasta 10 caracteres.";
  if (ETIQUETAS_RESERVADAS.includes(field.tag) || field.tag.startsWith("MC_")) {
    return `*|${field.tag}|* es una etiqueta reservada de Mailchimp.`;
  }
  if (otros.some((o) => o.tag === field.tag)) return `*|${field.tag}|* está repetida.`;
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
  | "address";

const PROPS_DE_LISTA: readonly PropDeTexto[] = ["note", "items", "lines"];

export function esPropDeLista(prop: PropDeTexto): boolean {
  return PROPS_DE_LISTA.includes(prop);
}

export function propsDeTexto(type: MailBlockType): PropDeTexto[] {
  switch (type) {
    case "greeting": return ["text", "fallback"];
    case "paragraph": return ["text"];
    case "button": return ["text", "url", "note"];
    case "callout": return ["title", "items"];
    case "list": return ["items"];
    case "signature": return ["closing", "name", "lines", "url"];
    case "footer_legal": return ["text", "address"];
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
  } else if (valor === "" && ["fallback", "title", "closing", "url", "address"].includes(prop) && block.type !== "button") {
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

// ---- edición de la plantilla --------------------------------------------------

function idsDe(template: MailTemplate): Set<string> {
  return new Set(template.blocks.map((b) => b.block_id));
}

export function nuevoIdDeBloque(type: MailBlockType, template: MailTemplate): string {
  const base = type.replace(/_/g, "-");
  const ids = idsDe(template);
  for (let n = 1; ; n += 1) {
    const id = `${base}-${n}`;
    if (!ids.has(id)) return id;
  }
}

export function bloqueNuevo(type: MailBlockType, block_id: string): MailBlock {
  switch (type) {
    case "greeting": return { block_id, type, text: "Estimado(a) {{nombre}}:", fallback: "Estimado(a):" };
    case "paragraph": return { block_id, type, text: "Escribe aquí el párrafo.", align: "justify" };
    case "button": return { block_id, type, text: "Acceder a la encuesta", url: "https://" };
    case "callout": return { block_id, type, title: "Importante:", items: ["Primer punto."], variant: "box" };
    case "list": return { block_id, type, items: ["Primer punto."], ordered: false };
    case "signature": return { block_id, type, closing: "Atentamente,", name: "Pulso PUCP" };
    case "footer_legal": return { block_id, type, text: "Recibe este correo porque forma parte de la población del estudio." };
  }
}

/** Agrega un bloque después del elegido (o antes del pie si no hay elegido). */
export function agregarBloque(template: MailTemplate, type: MailBlockType, despuesDe: string | null): { template: MailTemplate; block_id: string } {
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
  return JSON.stringify(resto);
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

export function usarBanner(template: MailTemplate, imageRef: string = BANNER_ID): MailTemplate {
  const images = { ...template.images };
  if (!images[imageRef]) images[imageRef] = { alt: "Banner del estudio" };
  return { ...template, images, header: { kind: "banner", image_ref: imageRef } };
}

export function usarLogos(template: MailTemplate, background: "dark" | "light" = "dark"): MailTemplate {
  const logo_ids = logosDeLaFranja(template);
  return { ...template, header: { kind: "logos", logo_ids: logo_ids.length ? logo_ids : ["pulso"], background } };
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
  preheader: "Texto de vista previa (preheader)",
  html_weight: "Peso del correo",
  images_hosted: "Imágenes alojadas, no incrustadas",
  images_available: "Imágenes en el proyecto",
  images_alt: "Texto alternativo en las imágenes",
  banner_size: "Banner de 1200 × 600",
  footer_unsub: "Pie con *|UNSUB|* y dirección",
  recipients: "Destinatarios con correo válido",
  tags_have_columns: "Etiquetas con columna en la audiencia",
  fields_empty: "Campos con dato para todos",
  names_unsplit: "Nombres separados del apellido",
};

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
      if (check.status === "ok") return "con URL pública";
      if (check.status === "warning") return `${v} por subir`;
      return "incrustadas";
    case "images_available":
      return check.status === "ok" ? "todas" : `${v} sin archivo`;
    case "images_alt":
      return check.status === "ok" ? "en todas" : `${v} sin texto`;
    case "banner_size":
      return typeof check.value === "string" ? check.value.replace("×", " × ") : check.status === "ok" ? "1200 × 600" : "sin medir";
    case "footer_unsub":
      return check.status === "ok" ? "Mailchimp lo exige" : "falta";
    case "recipients":
      return check.status === "error" && !v ? "sin importar" : `${v.toLocaleString("es-PE")} válidos`;
    case "tags_have_columns": {
      const total = check.items.length;
      return total ? `${total - v} de ${total}` : "sin etiquetas";
    }
    case "fields_empty":
      return v ? `${v.toLocaleString("es-PE")} sin dato` : "todos";
    case "names_unsplit":
      return v ? `${v.toLocaleString("es-PE")} sin separar` : "todos";
    default:
      return check.value === null ? "" : String(check.value);
  }
}

export function rotuloDeChequeo(check: MailCheck): string {
  return ROTULO_DE_CHEQUEO[check.code] ?? check.code;
}

/** Orden de lectura: primero lo que bloquea, después avisos, al final lo que está bien. */
export function chequeosOrdenados(checks: readonly MailCheck[]): MailCheck[] {
  const peso = { error: 0, warning: 1, ok: 2 } as const;
  return [...checks].sort((a, b) => peso[a.status] - peso[b.status]);
}

export function resumenDeRevision(errors: number, warnings: number): string {
  if (!errors && !warnings) return "Listo para exportar";
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
 * Qué fila de la tarjeta del correo corresponde a qué bloque.
 *
 * El render (`collection_mail_render.R`) escribe la tarjeta como una tabla:
 * cabecera, un separador, una fila por bloque —el pie legal no tiene fila ahí:
 * va en la tabla de abajo— y una franja de cierre. Si el HTML no tiene esa
 * forma, la vista no promete clics: devuelve `null` y la lista de la izquierda
 * sigue siendo el camino.
 */
export function filasDeLaTarjeta(template: MailTemplate): string[] {
  return [
    CABECERA,
    "",
    ...template.blocks.filter((b) => b.type !== "footer_legal").map((b) => b.block_id),
    "",
  ];
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
