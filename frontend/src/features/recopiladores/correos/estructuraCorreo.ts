// =============================================================================
// estructuraCorreo.ts — mover, insertar y medir zonas del correo (E1g §1–§2)
// =============================================================================
// Funciones puras de la capa de edición: dónde cae un bloque al soltarlo,
// cómo se inserta uno nuevo en un hueco, y qué zonas marca el render en la
// vista previa (`data-pulso-block`), sin contar filas (H-a).
//
// Dos reglas de forma vienen del render y se respetan aquí:
// - la cabecera va siempre arriba y no es un bloque (`__cabecera`);
// - el pie (`footer_legal`) se dibuja siempre al final, fuera de la tarjeta:
//   nada se mueve ni se inserta después de él, y él no se mueve.

import type { MailBlock, MailBlockType, MailCheck, MailTemplate } from "../../../api/materialMail";
import { CABECERA, bloqueNuevo, idLibre, nuevoIdDeBloque } from "./modeloCorreo";

/** Zona de la apertura de un recordatorio (addendum E1k): se edita en `send.opening`. */
export const APERTURA = "__apertura";

function indiceDelPie(blocks: readonly MailBlock[]): number {
  return blocks.findIndex((b) => b.type === "footer_legal");
}

/** Último índice al que puede llegar un bloque movible (antes del pie). */
function topeMovible(blocks: readonly MailBlock[]): number {
  const pie = indiceDelPie(blocks);
  return pie >= 0 ? pie - 1 : blocks.length - 1;
}

/** ¿Este bloque se puede arrastrar? Todos menos el pie. */
export function esMovible(template: Pick<MailTemplate, "blocks">, blockId: string): boolean {
  const b = template.blocks.find((x) => x.block_id === blockId);
  return Boolean(b) && b!.type !== "footer_legal";
}

/**
 * Mueve un bloque para que quede en la posición `indice` del arreglo final.
 * El pie no se mueve y nada pasa detrás de él; un índice fuera de rango se
 * acota. Si nada cambia, devuelve la misma plantilla (sin entrada de historial).
 */
export function moverBloqueA(template: MailTemplate, blockId: string, indice: number): MailTemplate {
  const desde = template.blocks.findIndex((b) => b.block_id === blockId);
  if (desde < 0 || template.blocks[desde].type === "footer_legal") return template;
  const blocks = [...template.blocks];
  const [movido] = blocks.splice(desde, 1);
  const pie = indiceDelPie(blocks);
  const tope = pie >= 0 ? pie : blocks.length;
  const destino = Math.max(0, Math.min(Math.trunc(indice), tope));
  if (destino === desde) return template;
  blocks.splice(destino, 0, movido);
  return { ...template, blocks };
}

/**
 * El índice final de un bloque que se suelta en el hueco `hueco` (0 = antes
 * del primero, n = después del último) de la lista ORIGINAL.
 */
export function indiceDesdeHueco(template: Pick<MailTemplate, "blocks">, blockId: string, hueco: number): number {
  const desde = template.blocks.findIndex((b) => b.block_id === blockId);
  if (desde < 0) return hueco;
  return hueco > desde ? hueco - 1 : hueco;
}

/** ¿Soltar ahí cambia algo? Los dos huecos que rodean al bloque no lo mueven. */
export function huecoMueve(template: Pick<MailTemplate, "blocks">, blockId: string, hueco: number): boolean {
  const desde = template.blocks.findIndex((b) => b.block_id === blockId);
  if (desde < 0) return false;
  if (hueco === desde || hueco === desde + 1) return false;
  return hueco <= topeMovible(template.blocks) + 1 || indiceDelPie(template.blocks) < 0;
}

/** Acota un hueco de inserción para que nunca quede detrás del pie. */
export function huecoValido(template: Pick<MailTemplate, "blocks">, hueco: number, type?: MailBlockType): number {
  const pie = indiceDelPie(template.blocks);
  const n = template.blocks.length;
  const h = Math.max(0, Math.min(Math.trunc(hueco), n));
  if (type === "footer_legal") return n;
  return pie >= 0 ? Math.min(h, pie) : h;
}

/** ¿Se puede agregar este tipo? El pie es único. */
export function tipoDisponible(template: Pick<MailTemplate, "blocks">, type: MailBlockType): boolean {
  return type !== "footer_legal" || !template.blocks.some((b) => b.type === "footer_legal");
}

/** Un bloque nuevo, con ids que no chocan (la imagen nombra su propio archivo). */
export function bloqueParaInsertar(template: MailTemplate, type: MailBlockType): MailBlock {
  const block = bloqueNuevo(type, nuevoIdDeBloque(type, template));
  if (block.type === "image") {
    const usados = [
      ...Object.keys(template.images),
      ...template.blocks.flatMap((b) => (b.type === "image" ? [b.image_ref] : [])),
    ];
    return { ...block, image_ref: idLibre("imagen", usados) };
  }
  return block;
}

/** Inserta un bloque nuevo en el hueco `hueco`. Devuelve también su id. */
export function insertarBloqueEn(template: MailTemplate, type: MailBlockType, hueco: number): { template: MailTemplate; block_id: string } | null {
  if (!tipoDisponible(template, type)) return null;
  const block = bloqueParaInsertar(template, type);
  const blocks = [...template.blocks];
  blocks.splice(huecoValido(template, hueco, type), 0, block);
  return { template: { ...template, blocks }, block_id: block.block_id };
}

// ---- zonas de la vista previa -------------------------------------------------

export type Rect = { x: number; y: number; w: number; h: number };

export type ZonaMedida = {
  id: string;
  /** `data-pulso-type` del render: `header`, `paragraph`, `footer_legal`, `opening`… */
  tipo: string;
  rect: Rect;
  /** Textos editables de la zona (`data-pulso-prop`), con su rectángulo. */
  props: { prop: string; rect: Rect }[];
  /** ¿La zona pinta una imagen de verdad? Sin ella es el hueco con el alt. */
  conImagen: boolean;
};

/** ¿La marca nombra una zona que la capa sabe tratar? */
export function esZonaEditable(id: string | null, template: Pick<MailTemplate, "blocks">): id is string {
  if (!id) return false;
  return id === CABECERA || id === APERTURA || template.blocks.some((b) => b.block_id === id);
}

type ElementoMedible = Pick<Element, "getAttribute" | "querySelectorAll" | "getBoundingClientRect" | "tagName"> & {
  cells?: ArrayLike<Element>;
};

function rectDe(el: Pick<Element, "getBoundingClientRect">, escala: number): Rect {
  const r = el.getBoundingClientRect();
  return { x: r.left * escala, y: r.top * escala, w: r.width * escala, h: r.height * escala };
}

/**
 * Las zonas del correo, leídas de las marcas del render y medidas en el
 * espacio de la hoja (rectángulos del iframe × escala). Una marca repetida o
 * que no nombra un bloque de la plantilla no es zona.
 */
export function zonasDeLaVista(
  doc: Pick<Document, "querySelectorAll">,
  template: Pick<MailTemplate, "blocks">,
  escala: number,
): ZonaMedida[] {
  const out: ZonaMedida[] = [];
  const vistas = new Set<string>();
  doc.querySelectorAll("[data-pulso-block]").forEach((nodo) => {
    const el = nodo as unknown as ElementoMedible;
    const id = el.getAttribute("data-pulso-block");
    if (!esZonaEditable(id, template) || vistas.has(id)) return;
    vistas.add(id);
    // La fila marca su `<tr>`; se mide su celda, que es lo que se ve.
    const celda = el.tagName === "TR" && el.cells && el.cells.length ? el.cells[0] : (nodo as Element);
    const props: ZonaMedida["props"] = [];
    (nodo as Element).querySelectorAll("[data-pulso-prop]").forEach((p) => {
      const prop = p.getAttribute("data-pulso-prop");
      if (prop) props.push({ prop, rect: rectDe(p, escala) });
    });
    if (el.getAttribute("data-pulso-prop")) props.push({ prop: el.getAttribute("data-pulso-prop")!, rect: rectDe(celda, escala) });
    out.push({
      id,
      tipo: el.getAttribute("data-pulso-type") ?? "",
      rect: rectDe(celda, escala),
      props,
      conImagen: (nodo as Element).querySelector("img") !== null,
    });
  });
  return out;
}

/** La propiedad de texto bajo el punto, o la primera de la zona. */
export function propEnElPunto(zona: Pick<ZonaMedida, "props">, x: number, y: number): string | null {
  const dentro = zona.props.filter((p) => x >= p.rect.x && x <= p.rect.x + p.rect.w && y >= p.rect.y && y <= p.rect.y + p.rect.h);
  if (dentro.length) return dentro.sort((a, b) => a.rect.w * a.rect.h - b.rect.w * b.rect.h)[0].prop;
  return null;
}

/** Un hueco de inserción: su índice, la línea `y` y el ancho de la tarjeta (`x`, `w`). */
export type Hueco = { hueco: number; y: number; x: number; w: number };

/**
 * Los huecos de inserción entre zonas del cuerpo, en el orden de la plantilla:
 * el 0 va bajo la cabecera, el último sobre el pie. `y` es la línea donde se
 * dibuja el indicador (mitad entre las dos zonas).
 */
export function huecosEntreZonas(zonas: readonly ZonaMedida[], template: Pick<MailTemplate, "blocks">): Hueco[] {
  const porId = new Map(zonas.map((z) => [z.id, z]));
  const cuerpo = template.blocks.filter((b) => b.type !== "footer_legal" && porId.has(b.block_id));
  if (!cuerpo.length) {
    const cab = porId.get(CABECERA);
    return cab ? [{ hueco: 0, y: cab.rect.y + cab.rect.h, x: cab.rect.x, w: cab.rect.w }] : [];
  }
  const out: Hueco[] = [];
  const indice = (id: string) => template.blocks.findIndex((b) => b.block_id === id);
  cuerpo.forEach((b, i) => {
    const z = porId.get(b.block_id)!;
    const previa = i === 0 ? porId.get(CABECERA) : porId.get(cuerpo[i - 1].block_id);
    const y = previa ? (previa.rect.y + previa.rect.h + z.rect.y) / 2 : z.rect.y;
    out.push({ hueco: indice(b.block_id), y, x: z.rect.x, w: z.rect.w });
  });
  const ultimo = porId.get(cuerpo[cuerpo.length - 1].block_id)!;
  out.push({ hueco: indice(cuerpo[cuerpo.length - 1].block_id) + 1, y: ultimo.rect.y + ultimo.rect.h, x: ultimo.rect.x, w: ultimo.rect.w });
  return out;
}

/** El hueco más cercano a una altura (al soltar un arrastre). */
export function huecoMasCercano(huecos: readonly Hueco[], y: number): Hueco | null {
  let mejor: Hueco | null = null;
  for (const h of huecos) if (!mejor || Math.abs(h.y - y) < Math.abs(mejor.y - y)) mejor = h;
  return mejor;
}

// ---- revisión junto al bloque ---------------------------------------------------

export type ChequeosDeZona = { errores: number; avisos: number; chequeos: MailCheck[] };

/** Los chequeos que no están bien, repartidos por el bloque que nombran sus `targets`. */
export function chequeosPorBloque(checks: readonly MailCheck[] | null | undefined): Record<string, ChequeosDeZona> {
  const out: Record<string, ChequeosDeZona> = {};
  for (const c of checks ?? []) {
    if (c.status === "ok") continue;
    const ids = new Set(c.targets.map((t) => t.block_id).filter(Boolean));
    for (const id of ids) {
      const z = (out[id] ??= { errores: 0, avisos: 0, chequeos: [] });
      z.chequeos.push(c);
      if (c.status === "error") z.errores += 1;
      else z.avisos += 1;
    }
  }
  return out;
}

/** El índice de un punto de lista (`items.2` → `["items", 2]`). */
export function propConIndice(prop: string): { base: string; indice: number | null } {
  const m = prop.match(/^([a-z_]+)\.(\d+)$/);
  return m ? { base: m[1], indice: Number(m[2]) } : { base: prop, indice: null };
}

// ---- texto de una zona -----------------------------------------------------------

/** Propiedades que la capa sabe editar en el sitio (el resto, en el inspector). */
const PROPS_EN_EL_SITIO = new Set(["text", "title", "items", "lines", "note", "name", "closing", "fallback", "address", "url", "opening"]);

export function editableEnElSitio(block: MailBlock | undefined, prop: string): boolean {
  const { base } = propConIndice(prop);
  if (!PROPS_EN_EL_SITIO.has(base)) return false;
  if (!block) return base === "opening";
  if (block.type === "image" || block.type === "divider" || block.type === "__no_reconocido") return false;
  // El enlace del botón no se ve en el correo: se edita en el inspector.
  return !(block.type === "button" && base === "url");
}

/** El texto de `prop` (o del punto `items.2`) de un bloque. */
export function textoDeZona(block: MailBlock, prop: string): string {
  const { base, indice } = propConIndice(prop);
  const raw: unknown = (block as Record<string, unknown>)[base];
  if (indice !== null) return Array.isArray(raw) && typeof raw[indice] === "string" ? raw[indice] : "";
  if (Array.isArray(raw)) return raw.filter((v): v is string => typeof v === "string").join("\n");
  return typeof raw === "string" ? raw : "";
}

/** ¿El texto admite saltos de línea? Párrafos, pie y apertura. */
export function esMultilinea(type: string, prop: string): boolean {
  const { base } = propConIndice(prop);
  return (type === "paragraph" && base === "text") || type === "footer_legal" || base === "opening";
}

/** El bloque con el texto nuevo en `prop` o en el punto `items.N`. */
export function conTextoDeZona(block: MailBlock, prop: string, valor: string): MailBlock {
  const { base, indice } = propConIndice(prop);
  if (indice === null) {
    const next: Record<string, unknown> = { ...block };
    const opcional = ["fallback", "title", "closing", "address"].includes(base);
    if (valor === "" && opcional) delete next[base];
    else next[base] = valor;
    return next as MailBlock;
  }
  const raw: unknown = (block as Record<string, unknown>)[base];
  const lista = Array.isArray(raw) ? raw.filter((v): v is string => typeof v === "string") : [];
  const items = [...lista];
  items[indice] = valor;
  return { ...block, [base]: items } as MailBlock;
}

/** Agrega un punto vacío después de `indice`; devuelve el bloque y la prop del nuevo. */
export function conPuntoNuevo(block: MailBlock, prop: string): { block: MailBlock; prop: string } {
  const { base, indice } = propConIndice(prop);
  const raw: unknown = (block as Record<string, unknown>)[base];
  const items = Array.isArray(raw) ? raw.filter((v): v is string => typeof v === "string") : [];
  const at = indice === null ? items.length : indice + 1;
  items.splice(at, 0, "");
  return { block: { ...block, [base]: items } as MailBlock, prop: `${base}.${at}` };
}

/** Quita el punto `items.N`; nunca deja una lista requerida sin puntos. */
export function sinPunto(block: MailBlock, prop: string): { block: MailBlock; prop: string | null } {
  const { base, indice } = propConIndice(prop);
  const raw: unknown = (block as Record<string, unknown>)[base];
  const items = Array.isArray(raw) ? raw.filter((v): v is string => typeof v === "string") : [];
  if (indice === null || items.length <= 1) return { block, prop: null };
  items.splice(indice, 1);
  const next: Record<string, unknown> = { ...block, [base]: items };
  return { block: next as MailBlock, prop: indice > 0 ? `${base}.${indice - 1}` : `${base}.0` };
}

/** Al terminar de editar una lista, los puntos vacíos se van (el contrato no los admite). */
export function sinPuntosVacios(block: MailBlock, prop: string): MailBlock {
  const { base, indice } = propConIndice(prop);
  if (indice === null) return block;
  const raw: unknown = (block as Record<string, unknown>)[base];
  if (!Array.isArray(raw)) return block;
  const items = raw.filter((v): v is string => typeof v === "string" && v.trim() !== "");
  if (items.length === raw.length) return block;
  if (!items.length && base === "items") return block;
  const next: Record<string, unknown> = { ...block, [base]: items };
  if (!items.length) delete next[base];
  return next as MailBlock;
}

/**
 * El `src` que la vista previa ya pinta para la imagen de un bloque: lo que
 * hay entre su marca `data-pulso-block` y la siguiente. Sin imagen, `null`.
 */
export function srcDeImagenDelBloque(html: string | null | undefined, blockId: string): string | null {
  if (!html) return null;
  const marca = `data-pulso-block="${blockId}"`;
  const inicio = html.indexOf(marca);
  if (inicio < 0) return null;
  const resto = html.slice(inicio + marca.length);
  const fin = resto.indexOf("data-pulso-block=");
  const tramo = fin < 0 ? resto : resto.slice(0, fin);
  const m = tramo.match(/<img\b[^>]*?\ssrc="([^"]*)"/i);
  if (!m || !m[1]) return null;
  return m[1].replace(/&#(?:10|13);/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
}
