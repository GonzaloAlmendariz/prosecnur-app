// chequeoDeLaZona.ts — a qué chequeo lleva el punto de aviso de una zona.
//
// Un chequeo puede nombrar varias zonas (los textos por completar nombran la
// cabecera y el párrafo a la vez). El punto de la cabecera tiene que llevar a
// «Logos e imágenes subidos», no al primero de la lista que la menciona (#8
// del re-QA e10): primero los chequeos propios del tipo de la zona, después
// cualquiera que la nombre.

import type { MailBlockType, MailCheck, MailCheckCode } from "../../../api/materialMail";
import { CABECERA } from "./modeloCorreo";

const IMAGENES: readonly MailCheckCode[] = ["images_available", "images_alt", "image_width", "image_weight", "images_hosted", "images_public_url", "banner_size"];

/** Los chequeos que hablan de lo propio de cada tipo de zona, en orden de prioridad. */
const PROPIOS: Readonly<Partial<Record<string, readonly MailCheckCode[]>>> = {
  [CABECERA]: IMAGENES,
  image: IMAGENES,
  two_images: IMAGENES,
  feature: IMAGENES,
  greeting: ["greeting_trato", "greeting_trato_word", "sm_trato_blank"],
  button: ["survey_link", "sm_link_field_empty", "campana_button_contrast"],
  footer_legal: ["footer_unsub", "footer_optout", "campana_footer_contrast"],
  icon_text: ["icon_text_sm_icon", "piezas_contrast"],
  band: ["piezas_contrast"],
  ornament: ["piezas_contrast"],
};

/**
 * El índice, dentro de `fallas`, del chequeo al que lleva el punto de `zona`.
 * `tipo` es el tipo del bloque (o `CABECERA`); `-1` si ninguno la nombra.
 */
export function indiceDelChequeoDeLaZona(
  fallas: readonly Pick<MailCheck, "code" | "targets">[],
  zona: string,
  tipo: MailBlockType | typeof CABECERA | string | null,
): number {
  const nombran = fallas.map((c, i) => ({ c, i })).filter(({ c }) => c.targets.some((t) => t.block_id === zona));
  if (!nombran.length) return -1;
  const propios = (tipo ? PROPIOS[tipo] : undefined) ?? [];
  for (const code of propios) {
    const hit = nombran.find(({ c }) => c.code === code);
    if (hit) return hit.i;
  }
  return nombran[0].i;
}
