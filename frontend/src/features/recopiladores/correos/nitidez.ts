// nitidez.ts — el aviso de nitidez de un bloque, dicho como qué hacer (#9).
//
// El backend avisa «Imágenes mostradas a más de la mitad de su ancho
// natural…» (`image_width`, collection_mail_checks.R) y trae en `items` cada
// imagen con el ancho con que sale (`width`) y el que tiene (`natural`). En el
// inspector del bloque eso se dice como lo que hay que hacer: cuál es y de
// cuántos píxeles subirla («al doble del ancho con que sale», comoArreglar.ts).

import type { MailBlock, MailCheck, MailTemplate } from "../../../api/materialMail";
import { rotuloDeBloque } from "./modeloCorreo";
import { descripcionDeImagen } from "./nombresDeImagen";

type Chica = { id: string; lado: "izquierda" | "derecha" | null; minimo: number };

function chicasDelBloque(check: Pick<MailCheck, "items">, block: MailBlock): Chica[] {
  const out: Chica[] = [];
  for (const item of check.items) {
    if (typeof item === "string") continue;
    if (item.block_id !== block.block_id) continue;
    const ancho = Number(item.width);
    if (!Number.isFinite(ancho) || ancho <= 0) continue;
    const lado = block.type === "two_images"
      ? item.id === block.left ? "izquierda" : item.id === block.right ? "derecha" : null
      : null;
    out.push({ id: typeof item.id === "string" ? item.id : "", lado, minimo: Math.ceil(ancho * 2) });
  }
  return out;
}

/**
 * «La imagen de la izquierda es chica: súbela de al menos 1120 px de ancho.»;
 * `null` si no aplica. En el inspector del bloque basta el lado; en la
 * Revisión (`template`) se nombra cuál: por su descripción o por su bloque.
 */
export function fraseDeNitidez(
  check: Pick<MailCheck, "code" | "status" | "items">,
  block: MailBlock | undefined,
  template?: Pick<MailTemplate, "header" | "images" | "blocks"> | null,
): string | null {
  if (check.code !== "image_width" || check.status === "ok" || !block) return null;
  const chicas = chicasDelBloque(check, block);
  if (!chicas.length) return null;
  const nombre = (c: Chica) => (template && c.id ? descripcionDeImagen(template, c.id) : "");
  const bloque = `«${rotuloDeBloque(block)}»`;
  if (chicas.length === 1) {
    const [c] = chicas;
    const d = nombre(c);
    const arreglo = `es chica: súbela de al menos ${c.minimo} px de ancho.`;
    if (d) return `«${d}»${c.lado ? ` (${c.lado})` : ""} ${arreglo}`;
    if (!template) return `${c.lado ? `La imagen de la ${c.lado}` : "La imagen"} ${arreglo}`;
    return `${c.lado ? `La imagen de la ${c.lado} de ${bloque}` : `La imagen de ${bloque}`} ${arreglo}`;
  }
  const minimo = Math.max(...chicas.map((c) => c.minimo));
  const nombres = chicas.map(nombre);
  const cuales = nombres.every(Boolean)
    ? `«${nombres[0]}» y «${nombres[1]}»`
    : template ? `Las dos imágenes de ${bloque}` : "Las dos imágenes";
  return `${cuales} son chicas: súbelas de al menos ${minimo} px de ancho.`;
}
