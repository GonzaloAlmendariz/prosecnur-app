// nombresDeImagen.ts — cómo se llama cada imagen del correo en la voz de la vista.
//
// El id de una imagen (`logo-cliente`, `pulso`) es el nombre del archivo en el
// ZIP: sirve a Mailchimp, no a quien arma el correo. Aquí se decide el nombre
// humano (su descripción, o el papel que cumple) y la frase de lo que falta
// subir. Ningún id llega a la pantalla desde aquí.

import type { MailBlock, MailTemplate } from "../../../api/materialMail";
import { altPendiente, resumenDeBloque } from "./modeloCorreo";

type Plantilla = Pick<MailTemplate, "header" | "images" | "blocks">;

export type ClaseDeImagen = "logo" | "banner" | "imagen";

/** «[Unidad solicitante]» → «Unidad solicitante»: los corchetes marcan un dato por llenar. */
function sinCorchetes(texto: string): string {
  return texto.trim().replace(/^\[(.*)\]$/s, "$1").trim();
}

function desdeElId(id: string): string {
  const t = id.replace(/[-_]+/g, " ").trim();
  return t ? t.charAt(0).toLocaleUpperCase("es-PE") + t.slice(1) : "Imagen";
}

function altDe(template: Plantilla, id: string): string {
  let delBloque = "";
  for (const b of template.blocks) {
    if (b.type === "image" && b.image_ref === id) delBloque = b.alt;
    // Un lado de un par de imágenes (E1o) se nombra con su descripción.
    else if (b.type === "two_images" && (b.left === id || b.right === id)) delBloque = b.left === id ? b.alt_left : b.alt_right;
    else if (b.type === "feature" && b.image_ref === id) delBloque = b.alt ?? "";
    if (delBloque) break;
  }
  const alt = template.images[id]?.alt || delBloque;
  return altPendiente(alt) ? "" : sinCorchetes(alt);
}

/** Qué papel cumple la imagen en el correo: logo de la franja, banner o imagen de un bloque. */
export function claseDeImagen(template: Pick<MailTemplate, "header">, id: string): ClaseDeImagen {
  const header = template.header;
  if (header.kind === "banner") return header.image_ref === id ? "banner" : "imagen";
  return header.logo_ids.includes(id) ? "logo" : "imagen";
}

/**
 * El nombre humano de una imagen: la descripción que le dio el equipo o, sin
 * ella, el papel que cumple («Logo 2», «Banner»). Nunca un nombre de serie de
 * la app: el correo no siempre es de Pulso PUCP (Gonzalo, 2026-10-24).
 */
export function nombreDeImagen(template: Plantilla, id: string): string {
  const clase = claseDeImagen(template, id);
  if (clase === "banner") return altDe(template, id) || "Banner";
  if (clase === "logo") return altDe(template, id) || rotuloDeLogo(template, id);
  return altDe(template, id) || desdeElId(id);
}

/** «Logo 2» por su lugar en la franja; «Logo» si es el único. */
export function rotuloDeLogo(template: Pick<MailTemplate, "header">, id: string): string {
  const logos = template.header.kind === "logos" ? template.header.logo_ids : [];
  return logos.length > 1 ? `Logo ${logos.indexOf(id) + 1}` : "Logo";
}

function enLista(partes: readonly string[]): string {
  if (partes.length <= 1) return partes[0] ?? "";
  return `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;
}

/**
 * Lo que falta subir, en una frase y sin nombrar a nadie: por su papel y
 * cuántas («Faltan los logos», «Falta el banner y una imagen»). `null` si no
 * falta nada. No nombra instituciones: el correo no siempre es de Pulso PUCP.
 */
export function fraseDeLoQueFalta(template: Plantilla, ids: readonly string[]): string | null {
  const unicos = Array.from(new Set(ids));
  if (!unicos.length) return null;
  const cuantas = (clase: ClaseDeImagen) => unicos.filter((id) => claseDeImagen(template, id) === clase).length;
  const logos = cuantas("logo");
  const enLaFranja = template.header.kind === "logos" ? template.header.logo_ids.length : 0;
  const imagenes = cuantas("imagen");
  const partes = [
    logos === 0 ? null
      : logos === enLaFranja ? (logos === 1 ? "el logo" : "los logos")
      : logos === 1 ? "un logo" : `${logos} logos`,
    cuantas("banner") ? "el banner" : null,
    imagenes === 0 ? null : imagenes === 1 ? "una imagen" : `${imagenes} imágenes`,
  ].filter((p): p is string => p !== null);
  return `${unicos.length === 1 ? "Falta" : "Faltan"} ${enLista(partes)}.`;
}

/** Lo que falta de una sola imagen de la cabecera, para su renglón: «Falta el logo 2». */
export function fraseDeLoQueFaltaDe(template: Plantilla, id: string): string {
  const clase = claseDeImagen(template, id);
  if (clase === "banner") return "Falta el banner";
  if (clase === "logo") return `Falta el ${rotuloDeLogo(template, id).toLocaleLowerCase("es-PE")}`;
  return "Falta una imagen";
}

/** Ids de la revisión (`images_available`) que no tienen archivo, sin repetir. */
export function idsSinArchivo(items: readonly unknown[]): string[] {
  return Array.from(new Set(items.filter((i): i is string => typeof i === "string" && i.length > 0)));
}

/**
 * Lo que la imagen dice ser: su descripción o el nombre de una imagen de serie.
 * A diferencia de `nombreDeImagen`, no cae al id ni al papel: `""` si no hay
 * nada humano que decir (una imagen decorativa, una recién subida sin alt).
 */
export function descripcionDeImagen(template: Plantilla, id: string): string {
  const alt = altDe(template, id);
  // El texto de serie de un bloque nuevo («Describe la imagen de la derecha») pide la descripción: no lo es.
  return INSTRUCCION_DE_ALT.test(alt) ? "" : alt;
}

/** Lo que traen de serie los bloques de imagen nuevos (`bloqueNuevo`): una instrucción, no una descripción. */
const INSTRUCCION_DE_ALT = /^describe la imagen( de la (izquierda|derecha))?$/i;

/** Subtítulo de la fila de la cabecera: «2 logos» o la descripción del banner; nunca su tipo ni su id. */
export function resumenDeCabecera(template: Plantilla): string {
  const header = template.header;
  if (header.kind === "logos") return `${header.logo_ids.length} ${header.logo_ids.length === 1 ? "logo" : "logos"}`;
  const descripcion = descripcionDeImagen(template, header.image_ref);
  // «Banner» ya es el título de la fila: repetirlo abajo no dice nada.
  return descripcion.toLocaleLowerCase("es-PE") === "banner" ? "" : descripcion;
}

/** Subtítulo de la fila de un bloque: las imágenes por su descripción, nunca por su id. */
export function resumenDeFila(template: Plantilla, block: MailBlock): string {
  // El alt del bloque se muestra como se muestra el texto de un párrafo; sin él,
  // la descripción de la imagen. Nunca el id del archivo.
  const lado = (alt: string, id: string) => (altPendiente(alt) ? descripcionDeImagen(template, id) : alt.trim());
  if (block.type === "image") return block.decorative ? "" : lado(block.alt, block.image_ref);
  if (block.type === "two_images") {
    return [lado(block.alt_left, block.left), lado(block.alt_right, block.right)].filter(Boolean).join(" · ");
  }
  return resumenDeBloque(block);
}
