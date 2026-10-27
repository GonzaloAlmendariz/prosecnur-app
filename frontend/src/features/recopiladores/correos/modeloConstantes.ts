// =============================================================================
// modeloConstantes.ts — los datos fijos de la campaña (L6), sin React
// =============================================================================
// Espejo de collection_mail_constantes.R: `{{clave}}` vale lo mismo para toda la
// campaña (los premios, la duración, la promoción de egreso). La clave sale del
// nombre, como la de un campo, y no repite un campo, otro dato ni una reservada.

import type { MailConstant, MailTemplate } from "../../../api/materialMail";
import { claveDesdeRotulo } from "./modeloCorreo";

export const MAX_CONSTANTES = 20;
const RESERVADAS = ["nombre", "email", "correo"];

/** Un dato nuevo con su clave libre en esta plantilla. */
export function nuevaConstante(label: string, template: Pick<MailTemplate, "fields" | "constants">): MailConstant {
  const ocupadas = new Set([...RESERVADAS, ...template.fields.map((f) => f.key), ...(template.constants ?? []).map((c) => c.key)]);
  const base = claveDesdeRotulo(label);
  let key = base;
  for (let n = 2; ocupadas.has(key); n += 1) key = `${base.slice(0, 27)}_${n}`;
  return { key, label: label.trim() || key, value: "" };
}

/** La plantilla con los datos cambiados; sin datos, la clave no viaja. */
export function conConstantes(template: MailTemplate, constants: MailConstant[]): MailTemplate {
  const { constants: _previas, ...resto } = template;
  return constants.length ? { ...resto, constants } : resto;
}

/** Cuántas veces se usa `{{clave}}` en el correo (asunto, vista previa y bloques). */
export function usosDeConstante(template: Pick<MailTemplate, "subject" | "preheader" | "blocks">, key: string): number {
  const texto = JSON.stringify([template.subject, template.preheader, template.blocks]);
  return (texto.match(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g")) ?? []).length;
}
