// camposDeclarados.ts — los campos que el correo usa y la campaña no declara.
//
// Un `{{carrera}}` tecleado en una campaña sin ese campo se veía como chip
// válido, la vista previa y la revisión respondían 422 y el lienzo quedaba
// quieto sin decir por qué (N5 del re-QA e10). El backend acepta «nombre» y
// las claves de `template.fields` (`.cmail_text_problems`); lo mismo se mira
// aquí antes de pedir nada, para marcar el chip y retener la vista previa.

import type { MailSend, MailTemplate } from "../../../api/materialMail";
import { PATRON_CAMPO } from "./serializarTexto";

/** Campos que existen en toda campaña. */
export const CAMPOS_DE_SIEMPRE: readonly string[] = ["nombre"];

/** Las claves que la campaña acepta. */
export function clavesDeclaradas(template: Pick<MailTemplate, "fields">): Set<string> {
  return new Set([...CAMPOS_DE_SIEMPRE, ...template.fields.map((f) => f.key)]);
}

function textosDe(valor: unknown, out: string[]): void {
  if (typeof valor === "string") out.push(valor);
  else if (Array.isArray(valor)) valor.forEach((v) => textosDe(v, out));
  else if (valor && typeof valor === "object") Object.values(valor).forEach((v) => textosDe(v, out));
}

/**
 * Las claves que aparecen en el correo (asunto, cabecera, bloques y el envío
 * que se mira) y no están declaradas, en el orden en que aparecen.
 */
export function camposNoDeclarados(
  template: Pick<MailTemplate, "fields" | "subject" | "preheader" | "header" | "blocks">,
  envio?: Pick<MailSend, "subject" | "preheader" | "opening"> | null,
): string[] {
  const textos: string[] = [];
  textosDe([template.subject, template.preheader, template.header, template.blocks], textos);
  if (envio) textosDe([envio.subject, envio.preheader, envio.opening], textos);
  const declaradas = clavesDeclaradas(template);
  const fuera: string[] = [];
  for (const t of textos) {
    for (const m of t.matchAll(new RegExp(PATRON_CAMPO.source, "g"))) {
      const key = m[1];
      if (!declaradas.has(key) && !fuera.includes(key)) fuera.push(key);
    }
  }
  return fuera;
}

/** «carrera» → «Carrera», «fecha_limite» → «Fecha limite»: nunca la llave. */
export function rotuloDeClave(key: string): string {
  const t = key.replace(/_+/g, " ").trim();
  return t ? t.charAt(0).toLocaleUpperCase("es-PE") + t.slice(1) : key;
}

/** El aviso junto al campo: qué falta y dónde se arregla. */
export function avisoDeCampoNoDeclarado(rotulo: string): string {
  return `${rotulo} no es un campo de esta campaña: agrégalo en Personas o quítalo.`;
}

/** El aviso del lienzo mientras la vista previa espera. */
export function avisoDeVistaRetenida(rotulos: readonly string[]): string {
  const lista = rotulos.length === 1 ? rotulos[0] : `${rotulos.slice(0, -1).join(", ")} y ${rotulos[rotulos.length - 1]}`;
  return `La vista previa muestra la última versión que se pudo armar: ${lista} no ${rotulos.length === 1 ? "es un campo" : "son campos"} de esta campaña.`;
}
