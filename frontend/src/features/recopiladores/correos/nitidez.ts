// nitidez.ts — el aviso de nitidez de un bloque, dicho como qué hacer (#9).
//
// El backend avisa «Imágenes mostradas a más de la mitad de su ancho
// natural…» (`image_width`, collection_mail_checks.R) y trae en `items` cada
// imagen con el ancho con que sale (`width`) y el que tiene (`natural`). En el
// inspector del bloque eso se dice como lo que hay que hacer: cuál es y de
// cuántos píxeles subirla («al doble del ancho con que sale», comoArreglar.ts).

import type { MailBlock, MailCheck } from "../../../api/materialMail";

type Chica = { lado: "izquierda" | "derecha" | null; minimo: number };

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
    out.push({ lado, minimo: Math.ceil(ancho * 2) });
  }
  return out;
}

/** «La imagen de la izquierda es chica: súbela de al menos 1120 px de ancho.»; `null` si no aplica. */
export function fraseDeNitidez(check: Pick<MailCheck, "code" | "status" | "items">, block: MailBlock | undefined): string | null {
  if (check.code !== "image_width" || check.status === "ok" || !block) return null;
  const chicas = chicasDelBloque(check, block);
  if (!chicas.length) return null;
  if (chicas.length === 1) {
    const [c] = chicas;
    const cual = c.lado ? `La imagen de la ${c.lado}` : "La imagen";
    return `${cual} es chica: súbela de al menos ${c.minimo} px de ancho.`;
  }
  const minimo = Math.max(...chicas.map((c) => c.minimo));
  return `Las dos imágenes son chicas: súbelas de al menos ${minimo} px de ancho.`;
}
