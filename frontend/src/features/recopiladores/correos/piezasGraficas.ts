// =============================================================================
// piezasGraficas.ts — la biblioteca de piezas gráficas del correo (E1o), sin React
// =============================================================================
// Banda de color, separador decorativo, ícono con texto, dos imágenes e imagen
// decorativa. Son bloques del registro cerrado (collection_mail_piezas.R), no
// un lienzo libre: Outlook y Gmail no respetan posiciones libres (ADR 0046 §11).
//
// Aquí vive lo que la vista decide de ellas: el color efectivo (el del bloque o,
// sin él, el acento en Sobrio y el relleno del botón en Campaña, como el
// render), cuánto se distingue del fondo, qué imágenes falta describir (una
// decorativa no) y cómo una subida de archivo renombra el lado de un par.
//
// «Ten cuidado que los elementos no se vean deformes» (Gonzalo, 2026-10-21):
// la proporción la fija el render con el tamaño real del archivo; la vista
// nunca da alto fijo a un <img> y muestra las miniaturas con object-fit: contain.

import {
  MAIL_BLOCK_TYPES,
  MAIL_ICONS,
  type MailBlock,
  type MailBlockType,
  type MailCheck,
  type MailIcon,
  type MailOrnamentStyle,
  type MailTemplate,
  type MailTheme,
} from "../../../api/materialMail";
import { altPendiente, editarBloque, idLibre, slugDeImagen } from "./modeloCorreo";
import { contraste, estiloDe } from "./modeloEstilo";

// ---- lo que se inserta ----------------------------------------------------------

/** «Imagen decorativa»: un bloque `image` con `decorative: true`, con su propia entrada en la biblioteca. */
export const IMAGEN_DECORATIVA = "image_decorativa" as const;
export type TipoInsertable = MailBlockType | typeof IMAGEN_DECORATIVA;

/** Las cinco piezas, en el orden de la biblioteca. */
export const PIEZAS_GRAFICAS: readonly TipoInsertable[] = ["band", "ornament", "icon_text", "two_images", IMAGEN_DECORATIVA];

/** El tipo de bloque que produce una entrada de la biblioteca. */
export function tipoDelInsertable(tipo: TipoInsertable): MailBlockType {
  return tipo === IMAGEN_DECORATIVA ? "image" : tipo;
}

/** ¿Lo que trae un arrastre es algo que la biblioteca sabe insertar? */
export function esInsertable(valor: string): valor is TipoInsertable {
  return valor === IMAGEN_DECORATIVA || (MAIL_BLOCK_TYPES as readonly string[]).includes(valor);
}

// ---- rótulos ----------------------------------------------------------------------

export const ROTULO_DE_ICONO: Record<MailIcon, string> = {
  calendario: "Calendario",
  reloj: "Reloj",
  candado: "Candado",
  sobre: "Sobre",
  persona: "Persona",
  grupo: "Grupo",
  mapa: "Mapa",
  check: "Visto bueno",
  info: "Información",
  alerta: "Alerta",
  regalo: "Regalo",
  enlace: "Enlace",
};

export const ICONOS_DE_PIEZA: readonly MailIcon[] = MAIL_ICONS;

export const ROTULO_DE_ORNAMENTO: Record<MailOrnamentStyle, string> = {
  onda: "Onda",
  puntos: "Puntos",
  linea_doble: "Línea doble",
};

/** Alto real de la banda (`.CMAIL_BAND_PX`). */
export const PX_DE_BANDA = { s: 8, m: 16, l: 32 } as const;

// ---- color --------------------------------------------------------------------------

const HEX = /^#[0-9a-f]{6}$/i;

/** El color que la pieza usa si no declara uno: el acento en Sobrio, el relleno del botón en Campaña. */
export function colorPorDefecto(theme: MailTheme): string {
  const efectivo = estiloDe(theme);
  return (efectivo.estilo === "campana" ? efectivo.boton : theme.accent).toLowerCase();
}

/** Sobre qué se ve la pieza: la tarjeta blanca en Sobrio, el fondo de la página en Campaña. */
export function fondoDeLasPiezas(theme: MailTheme): string {
  const efectivo = estiloDe(theme);
  return (efectivo.estilo === "campana" ? efectivo.fondo : "#ffffff").toLowerCase();
}

export function tieneColor(block: MailBlock): block is Extract<MailBlock, { type: "band" | "ornament" }> {
  return block.type === "band" || block.type === "ornament";
}

/** El color con que sale la pieza; el ícono siempre usa el de la casa. */
export function colorDePieza(block: MailBlock, theme: MailTheme): string {
  if (tieneColor(block) && block.color && HEX.test(block.color)) return block.color.toLowerCase();
  return colorPorDefecto(theme);
}

/** La pieza con su color. `null` vuelve al de la casa; un color que no es #rrggbb no se aplica. */
export function conColor(block: MailBlock, color: string | null): MailBlock {
  if (!tieneColor(block)) return block;
  if (color === null) {
    const { color: _quitado, ...resto } = block;
    void _quitado;
    return resto as MailBlock;
  }
  const hex = color.trim().toLowerCase();
  return HEX.test(hex) ? ({ ...block, color: hex } as MailBlock) : block;
}

/** Mínimos del render (`.cmail_piezas_checks`): 1,5:1 para banda y separador, 3:1 para un ícono. */
export const CONTRASTE_DE_PIEZA = 1.5;
export const CONTRASTE_DE_ICONO = 3;

export type LecturaDePieza = { tono: "ok" | "warning"; frase: string; razon: number | null };

/** ¿Se distingue la pieza del fondo? Se dice mientras se elige; la revisión lo confirma. */
export function lecturaDePieza(color: string, fondo: string, minimo = CONTRASTE_DE_PIEZA): LecturaDePieza {
  const razon = contraste(color, fondo);
  if (razon === null) return { tono: "warning", frase: "Ese color no se puede leer: elige otro", razon };
  if (razon < minimo) return { tono: "warning", frase: "Casi no se distingue del fondo: elige un color que resalte", razon };
  return { tono: "ok", frase: "Se distingue del fondo", razon };
}

/** El chequeo `piezas_contrast` de la revisión, si nombra este bloque. */
export function chequeoDeContraste(checks: readonly MailCheck[] | null | undefined, blockId: string): MailCheck | null {
  return checks?.find((c) => c.code === "piezas_contrast" && c.status !== "ok" && c.targets.some((t) => t.block_id === blockId)) ?? null;
}

/** Id del PNG del ícono que genera el render (`.cmail_icon_id`): para darle una URL en SurveyMonkey. */
export function idDelIcono(icon: MailIcon, theme: MailTheme): string {
  return `icono-${icon}-${colorPorDefecto(theme).replace(/^#/, "")}`;
}

// ---- descripciones ------------------------------------------------------------------

export type DescripcionPendiente = { block_id: string; prop: "alt" | "alt_left" | "alt_right" };

/**
 * Las imágenes del cuerpo que falta describir, en el orden del correo. Una
 * imagen decorativa no la necesita (sale con alt vacío, a propósito); cada lado
 * de un par, sí.
 */
export function descripcionesPendientes(template: Pick<MailTemplate, "blocks">): DescripcionPendiente[] {
  const out: DescripcionPendiente[] = [];
  for (const b of template.blocks) {
    if (b.type === "image" && b.decorative !== true && altPendiente(b.alt)) out.push({ block_id: b.block_id, prop: "alt" });
    // La foto de un Destacado, sólo si la tiene.
    if (b.type === "feature" && b.image_ref && altPendiente(b.alt ?? "")) out.push({ block_id: b.block_id, prop: "alt" });
    if (b.type === "two_images") {
      if (altPendiente(b.alt_left)) out.push({ block_id: b.block_id, prop: "alt_left" });
      if (altPendiente(b.alt_right)) out.push({ block_id: b.block_id, prop: "alt_right" });
    }
  }
  return out;
}

// ---- imágenes de los bloques ------------------------------------------------------------

export type LadoDelPar = "left" | "right";

/** Los archivos que nombran los bloques del cuerpo (image y los dos lados de cada par). */
export function imagenesDelCuerpo(template: Pick<MailTemplate, "blocks">, salvo?: { block_id: string; lado?: LadoDelPar }): string[] {
  return template.blocks.flatMap((b) => {
    if (b.type === "image") return salvo && salvo.block_id === b.block_id ? [] : [b.image_ref];
    if (b.type === "feature") return !b.image_ref || (salvo && salvo.block_id === b.block_id) ? [] : [b.image_ref];
    if (b.type === "two_images") {
      return (["left", "right"] as const)
        .filter((lado) => !(salvo && salvo.block_id === b.block_id && salvo.lado === lado))
        .map((lado) => b[lado]);
    }
    return [];
  });
}

/** El id de imagen que nombra hoy un bloque (o un lado del par); `null` si no es de imagen. */
export function imagenDeBloque(block: MailBlock | undefined, lado?: LadoDelPar): string | null {
  if (!block) return null;
  if (block.type === "image") return block.image_ref;
  if (block.type === "two_images") return block[lado ?? "left"];
  // Un Destacado sin foto todavía: "" (subir le pone una).
  if (block.type === "feature") return block.image_ref ?? "";
  return null;
}

/**
 * Lo que cambia al subir el archivo de un bloque: el id sale del nombre del
 * archivo (a-z, 0-9 y guiones: Mailchimp lo usa como nombre en el ZIP), no
 * choca con otra imagen del correo y el bloque (o su lado) pasa a nombrarlo; la
 * entrada del mapa de imágenes se renombra con él. `null` si el bloque no es de imagen.
 */
export function conArchivoDeImagen(
  template: MailTemplate,
  blockId: string,
  nombreDelArchivo: string,
  lado?: LadoDelPar,
): { template: MailTemplate; id: string } | null {
  const block = template.blocks.find((b) => b.block_id === blockId);
  const actual = imagenDeBloque(block, lado);
  if (!block || actual === null) return null;
  const usados = [...Object.keys(template.images), ...imagenesDelCuerpo(template, { block_id: blockId, lado })].filter((id) => id !== actual);
  const id = idLibre(slugDeImagen(nombreDelArchivo), usados);
  if (id === actual) return { template, id };
  const images = { ...template.images };
  if (images[actual]) {
    images[id] = images[actual];
    delete images[actual];
  }
  const clave = block.type === "two_images" ? lado ?? "left" : "image_ref";
  return { template: { ...editarBloque(template, blockId, (b) => ({ ...b, [clave]: id }) as MailBlock), images }, id };
}

const ATRIBUTO_SRC = /\ssrc="([^"]*)"/i;

function srcLimpio(src: string): string {
  return src.replace(/&#(?:10|13);/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
}

/**
 * Lo que la vista previa ya pinta de cada lado de un par: el `<img>` de cada
 * lado lleva `data-pulso-prop="alt_left"` o `"alt_right"`. Un lado sin archivo
 * es un hueco con su descripción, sin `<img>`: queda `null`.
 */
export function srcsDelPar(html: string | null | undefined, blockId: string): Record<LadoDelPar, string | null> {
  const out: Record<LadoDelPar, string | null> = { left: null, right: null };
  if (!html) return out;
  const marca = `data-pulso-block="${blockId}"`;
  const inicio = html.indexOf(marca);
  if (inicio < 0) return out;
  const resto = html.slice(inicio + marca.length);
  const fin = resto.indexOf("data-pulso-block=");
  const tramo = fin < 0 ? resto : resto.slice(0, fin);
  for (const m of tramo.matchAll(/<img\b[^>]*>/gi)) {
    const lado = /data-pulso-prop="alt_(left|right)"/.exec(m[0])?.[1] as LadoDelPar | undefined;
    const src = ATRIBUTO_SRC.exec(m[0])?.[1];
    if (lado && src) out[lado] = srcLimpio(src);
  }
  return out;
}

export type Rect = { x: number; y: number; w: number; h: number };
export type LadoMedido = { lado: LadoDelPar; rect: Rect; conImagen: boolean };

type Medible = Pick<Element, "getAttribute" | "querySelectorAll" | "getBoundingClientRect">;

/**
 * Los dos lados de un par en la vista previa, medidos en el espacio de la
 * hoja. El render escribe una celda `cmail-stack` por lado, izquierda primero;
 * se mide lo que se ve dentro (la imagen o el hueco). Si no hay dos celdas, no
 * se promete nada.
 */
export function ladosDelPar(doc: Pick<Document, "querySelectorAll">, blockId: string, escala: number): LadoMedido[] {
  const fila = Array.from(doc.querySelectorAll("[data-pulso-block]")).find((n) => n.getAttribute("data-pulso-block") === blockId);
  if (!fila) return [];
  const celdas = Array.from(fila.querySelectorAll("td")).filter((td) => (td.getAttribute("class") ?? "").split(/\s+/).includes("cmail-stack"));
  if (celdas.length !== 2) return [];
  return celdas.map((td, i) => {
    const img = td.querySelector("img");
    const visible = (img ?? td.querySelector("span") ?? td) as unknown as Medible;
    const r = visible.getBoundingClientRect();
    return {
      lado: i === 0 ? "left" : "right",
      rect: { x: r.left * escala, y: r.top * escala, w: r.width * escala, h: r.height * escala },
      conImagen: img !== null,
    };
  });
}
