// nombresDeImagen.ts — cómo se llama cada imagen del correo en la voz de la vista.
//
// El id de una imagen (`logo-cliente`, `pulso`) es el nombre del archivo en el
// ZIP: sirve a Mailchimp, no a quien arma el correo. Aquí se decide el nombre
// humano (su descripción, o el papel que cumple) y la frase de lo que falta
// subir. Ningún id llega a la pantalla desde aquí.

import type { MailTemplate } from "../../../api/materialMail";
import { altPendiente } from "./modeloCorreo";

type Plantilla = Pick<MailTemplate, "header" | "images" | "blocks">;

/** Las imágenes que trae la plantilla de serie: su nombre y cómo se dice «de quién». */
const CONOCIDAS: Readonly<Record<string, { nombre: string; de: string }>> = {
  "logo-cliente": { nombre: "Unidad solicitante", de: "de la unidad solicitante" },
  pulso: { nombre: "Pulso PUCP", de: "de Pulso PUCP" },
};

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
  const bloque = template.blocks.find((b) => b.type === "image" && b.image_ref === id);
  const alt = template.images[id]?.alt || (bloque && bloque.type === "image" ? bloque.alt : "");
  return altPendiente(alt) ? "" : sinCorchetes(alt);
}

/** Qué papel cumple la imagen en el correo: logo de la franja, banner o imagen de un bloque. */
export function claseDeImagen(template: Pick<MailTemplate, "header">, id: string): ClaseDeImagen {
  const header = template.header;
  if (header.kind === "banner") return header.image_ref === id ? "banner" : "imagen";
  return header.logo_ids.includes(id) ? "logo" : "imagen";
}

/** El nombre humano de una imagen: su descripción o, sin ella, el papel que cumple. */
export function nombreDeImagen(template: Plantilla, id: string): string {
  if (claseDeImagen(template, id) === "banner") return altDe(template, id) || "Banner de mailing";
  return altDe(template, id) || CONOCIDAS[id]?.nombre || desdeElId(id);
}

/** «de la unidad solicitante», «de Pulso PUCP» o «Facultad X» entre comillas. */
function deQuien(template: Plantilla, id: string): string {
  const nombre = nombreDeImagen(template, id);
  const conocida = CONOCIDAS[id];
  if (conocida && nombre.toLocaleLowerCase("es-PE") === conocida.nombre.toLocaleLowerCase("es-PE")) return conocida.de;
  return `«${nombre}»`;
}

function enLista(partes: readonly string[]): string {
  if (partes.length <= 1) return partes[0] ?? "";
  return `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;
}

/**
 * Lo que falta subir, en una frase: «Falta el logo de la unidad solicitante y
 * el de Pulso PUCP». `null` si no falta nada.
 */
export function fraseDeLoQueFalta(template: Plantilla, ids: readonly string[]): string | null {
  const unicos = Array.from(new Set(ids));
  if (!unicos.length) return null;
  const vistas = new Set<ClaseDeImagen>();
  const partes = unicos.map((id) => {
    const clase = claseDeImagen(template, id);
    const primera = !vistas.has(clase);
    vistas.add(clase);
    if (clase === "banner") return "el banner";
    const quien = deQuien(template, id);
    const articulo = clase === "logo" ? "el" : "la";
    // La segunda de la misma clase no repite el sustantivo: «y el de Pulso PUCP».
    if (!primera) return `${articulo} ${quien}`;
    return `${articulo} ${clase} ${quien}`;
  });
  return `Falta ${enLista(partes)}.`;
}

/** Ids de la revisión (`images_available`) que no tienen archivo, sin repetir. */
export function idsSinArchivo(items: readonly unknown[]): string[] {
  return Array.from(new Set(items.filter((i): i is string => typeof i === "string" && i.length > 0)));
}
