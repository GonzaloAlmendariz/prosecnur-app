// =============================================================================
// modeloRegistro.ts — tú o usted en el mismo correo (GOAL editor, L16), sin React
// =============================================================================
// Espejo de collection_mail_registro.R: `[[forma de tú|forma de usted]]` en el
// texto se escribe según el trato de la campaña (sin él, usted). Así un mismo
// cuerpo sirve a públicos que se tutean y a públicos que se tratan de usted.

import type { MailRegistro, MailTemplate } from "../../../api/materialMail";

export const VARIANTE_RE = /\[\[([^[\]|]*)\|([^[\]|]*)\]\]/g;

export function registroDe(template: Pick<MailTemplate, "registro">): MailRegistro {
  return template.registro ?? "usted";
}

/** La plantilla con su trato; «usted» es el de siempre y no viaja. */
export function conRegistro(template: MailTemplate, registro: MailRegistro): MailTemplate {
  const { registro: _previo, ...resto } = template;
  return registro === "tu" ? { ...resto, registro } : resto;
}

/** Un texto con cada variante escrita en el trato pedido. */
export function escribirVariantes(texto: string, registro: MailRegistro): string {
  return texto.replace(VARIANTE_RE, (_m, tu: string, usted: string) => (registro === "tu" ? tu : usted));
}

/** La variante lista para pegar en un texto. */
export function variante(tu: string, usted: string): string {
  return `[[${tu.replace(/[[\]|]/g, "")}|${usted.replace(/[[\]|]/g, "")}]]`;
}

function textosDe(valor: unknown, out: string[]): void {
  if (typeof valor === "string") out.push(valor);
  else if (Array.isArray(valor)) valor.forEach((v) => textosDe(v, out));
  else if (valor && typeof valor === "object") Object.values(valor).forEach((v) => textosDe(v, out));
}

/** Cuántas variantes de trato lleva el correo (asunto, vista previa, bloques y datos). */
export function variantesDelCorreo(template: Pick<MailTemplate, "subject" | "preheader" | "blocks" | "constants">): number {
  const textos: string[] = [];
  textosDe([template.subject, template.preheader, template.blocks, (template.constants ?? []).map((c) => c.value)], textos);
  return textos.reduce((n, t) => n + (t.match(VARIANTE_RE)?.length ?? 0), 0);
}
