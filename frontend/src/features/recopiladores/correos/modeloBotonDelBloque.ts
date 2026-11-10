// =============================================================================
// modeloBotonDelBloque.ts — el botón dentro de un Destacado o de una Fecha
// límite: quitarlo, ponerlo y separarlo como bloque propio, sin React
// =============================================================================
// Acreditación 2026, desde el R4: la DAA pidió el botón suelto después de los
// párrafos y, debajo, el premio sin botón propio. El modelo ya lo admitía (el
// bloque Botón y el botón opcional de la sección); faltaba hacerlo en un paso:
// el botón de la sección se quitaba vaciando dos campos, con un error entre
// uno y otro.

import type { MailBlock, MailButtonBlock, MailTemplate } from "../../../api/materialMail";
import { MAXIMO_DE_BLOQUES, enlaceDelCorreo } from "./estructuraCorreo";
import { nuevoIdDeBloque } from "./modeloCorreo";

type ConBoton = Extract<MailBlock, { type: "feature" | "deadline" }>;

export const TEXTO_DEL_BOTON_NUEVO = "Responder la encuesta";

/** ¿El bloque puede llevar un botón propio? (Destacado y Fecha límite.) */
export function admiteBoton(block: MailBlock): block is ConBoton {
  return block.type === "feature" || block.type === "deadline";
}

/** Tiene un botón que se ve: con texto. Es lo que se puede separar. */
export function tieneBoton(block: MailBlock): boolean {
  return admiteBoton(block) && Boolean(block.button_text?.trim());
}

/**
 * El botón está puesto aunque se esté reescribiendo: queda su texto o su
 * enlace. Vaciar el texto letra por letra no lo quita (ni esconde sus campos a
 * mitad de la edición); el interruptor sí.
 */
export function botonPuesto(block: MailBlock): boolean {
  return admiteBoton(block) && (block.button_text !== undefined || block.url !== undefined);
}

/** El bloque sin su botón: el texto, el enlace, el tamaño y el color se van juntos. */
export function sinBoton(block: MailBlock): MailBlock {
  if (!admiteBoton(block)) return block;
  const copia: Record<string, unknown> = { ...block };
  for (const k of ["button_text", "url", "button_size", "button_color"]) delete copia[k];
  return copia as MailBlock;
}

/**
 * El bloque con un botón: el texto que tenía o el de siempre, y el enlace que
 * tenía o el del correo (o el de relleno, que la revisión pide escribir).
 */
export function conBoton(block: MailBlock, template: Pick<MailTemplate, "blocks" | "fields">): MailBlock {
  if (!admiteBoton(block) || tieneBoton(block)) return block;
  return {
    ...block,
    button_text: TEXTO_DEL_BOTON_NUEVO,
    url: block.url?.trim() ? block.url : (enlaceDelCorreo(template) ?? "https://"),
  };
}

/** ¿Se puede separar el botón de este bloque? (Lo tiene y cabe un bloque más.) */
export function puedeSepararBoton(template: MailTemplate, blockId: string): boolean {
  const block = template.blocks.find((b) => b.block_id === blockId);
  return Boolean(block) && tieneBoton(block as MailBlock) && template.blocks.length < MAXIMO_DE_BLOQUES;
}

/**
 * Saca el botón de la sección a un bloque Botón propio, justo encima, con el
 * mismo texto, enlace, tamaño y alineación; la sección queda sin botón. El color
 * propio del botón no pasa: el bloque Botón usa el del tema. `null` si no hay
 * botón o no cabe otro bloque.
 */
export function separarBoton(template: MailTemplate, blockId: string): { template: MailTemplate; block_id: string } | null {
  if (!puedeSepararBoton(template, blockId)) return null;
  const i = template.blocks.findIndex((b) => b.block_id === blockId);
  const original = template.blocks[i] as ConBoton;
  const block_id = nuevoIdDeBloque("button", template);
  const grande = original.type === "feature" && original.button_size === "grande";
  const izquierda = original.type === "feature" && original.align !== "center";
  const boton: MailButtonBlock = {
    block_id,
    type: "button",
    text: original.button_text ?? TEXTO_DEL_BOTON_NUEVO,
    url: original.url ?? enlaceDelCorreo(template) ?? "https://",
    ...(grande ? { size: "grande" as const } : {}),
    ...(izquierda ? { align: "left" as const } : {}),
  };
  const blocks = [...template.blocks];
  blocks.splice(i, 1, boton, sinBoton(original));
  return { template: { ...template, blocks }, block_id };
}
