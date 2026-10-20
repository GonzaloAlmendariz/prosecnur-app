// =============================================================================
// comoSaleEnLaPlataforma.ts — qué etiquetas produce cada bloque (E1g §3)
// =============================================================================
// El modo didáctico del inspector muestra «Cómo sale en Mailchimp»: el texto
// del bloque traducido a las etiquetas de la plataforma de envío. Copia las
// reglas del render (`.cmail_field_value`, el saludo y el pie en
// collection_mail_render.R / collection_mail_blocks.R) y la tabla de dialectos
// del addendum E1j (`.CMAIL_DIALECTS`):
//
// | qué                | mailchimp                              | surveymonkey             |
// |--------------------|----------------------------------------|--------------------------|
// | {{nombre}}         | *|FNAME|*                              | [FirstName]              |
// | {{campo}}          | *|TAG|* (con respaldo: *|IF:TAG|*…)    | [<sm>]; sin `sm`, vacío  |
// | respaldo           | *|IF:…|*…*|ELSE:|*…*|END:IF|*          | ninguno                  |
// | pie                | *|LIST:ADDRESSLINE|* y *|UNSUB|*       | [PrivacyLink] y [OptOutLink] |
// | imagen             | URL https o el archivo del ZIP         | sólo URL https           |
//
// Es una explicación, no el export: el HTML real lo escribe siempre el render.

import { isOpaqueMailBlock, type MailBlock, type MailField, type MailTemplate } from "../../../api/materialMail";
import { ROTULO_DE_PROP, propsDeTexto, textoDe, type PropDeTexto } from "./modeloCorreo";
import { PATRON_CAMPO, PATRON_ENLACE } from "./serializarTexto";

export type Dialecto = "mailchimp" | "surveymonkey";

export const NOMBRE_DE_PLATAFORMA: Record<Dialecto, string> = {
  mailchimp: "Mailchimp",
  surveymonkey: "SurveyMonkey",
};

export type LineaDePlataforma = { rotulo: string; app: string; plataforma: string };

export type ComoSale = {
  dialecto: Dialecto;
  plataforma: string;
  lineas: LineaDePlataforma[];
  /** Lo que conviene saber de esa traducción (un campo sin equivalente, un respaldo que no existe…). */
  notas: string[];
};

/** `sm` del campo (addendum E1j): `SurveyLink`, `LastName` o `CustomDataN`. */
function smDe(field: MailField | undefined): string | null {
  const sm = field?.sm;
  return typeof sm === "string" && sm ? sm : null;
}

type Contexto = { template: Pick<MailTemplate, "fields">; dialecto: Dialecto; notas: Set<string> };

function campo(key: string, ctx: Contexto, enUrl: boolean): string {
  const field = ctx.template.fields.find((f) => f.key === key);
  if (ctx.dialecto === "surveymonkey") {
    if (key === "nombre") {
      ctx.notas.add("SurveyMonkey no tiene respaldo: quien no tenga el nombre en Contactos verá un espacio vacío.");
      return "[FirstName]";
    }
    const sm = smDe(field);
    if (!sm) {
      ctx.notas.add(`«${field?.label ?? key}» no tiene equivalente en SurveyMonkey: asígnale un CustomData en los campos.`);
      return "";
    }
    if (field?.fallback) ctx.notas.add("SurveyMonkey no tiene respaldo: quien no tenga el dato verá un espacio vacío.");
    return `[${sm}]`;
  }
  if (key === "nombre") return "*|FNAME|*";
  const tag = field?.tag || key.toUpperCase();
  if (!enUrl && field?.fallback) {
    return `*|IF:${tag}|**|${tag}|**|ELSE:|*${field.fallback}*|END:IF|*`;
  }
  return `*|${tag}|*`;
}

/** Un texto del contrato con los campos, la negrita y los enlaces ya traducidos. */
export function textoEnLaPlataforma(
  texto: string,
  template: Pick<MailTemplate, "fields">,
  dialecto: Dialecto,
  opciones: { enUrl?: boolean; enlaces?: boolean; notas?: Set<string> } = {},
): string {
  const ctx: Contexto = { template, dialecto, notas: opciones.notas ?? new Set() };
  let out = texto;
  if (opciones.enlaces) {
    out = out.replace(PATRON_ENLACE, (_m, label: string, url: string) => `<a href="${textoEnLaPlataforma(url, template, dialecto, { enUrl: true, notas: ctx.notas })}">${label}</a>`);
  }
  out = out.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br>");
  return out.replace(PATRON_CAMPO, (_m, key: string) => campo(key, ctx, Boolean(opciones.enUrl)));
}

/** Propiedades que admiten `[texto](url)` (`.CMAIL_LINK_PROPS`). */
const PROPS_CON_ENLACE: Partial<Record<MailBlock["type"], readonly PropDeTexto[]>> = {
  paragraph: ["text"],
  callout: ["title", "items"],
  list: ["items"],
  signature: ["lines"],
  footer_legal: ["text"],
};

export function admiteEnlaces(type: MailBlock["type"], prop: string): boolean {
  return (PROPS_CON_ENLACE[type] ?? []).some((p) => p === prop);
}

const PIE: Record<Dialecto, string> = {
  mailchimp: '*|LIST:ADDRESSLINE|*<br><a href="*|UNSUB|*">Dejar de recibir estos correos</a>',
  surveymonkey: '<a href="[PrivacyLink]">Privacidad</a> | Si desea darse de baja de esta encuesta, haga clic <a href="[OptOutLink]">aquí</a>.',
};

/**
 * Qué produce un bloque en la plataforma: una línea por texto (cada punto de
 * una lista es una línea) y las notas de esa traducción.
 */
export function comoSaleEnLaPlataforma(block: MailBlock, template: Pick<MailTemplate, "fields" | "images">, dialecto: Dialecto = "mailchimp"): ComoSale {
  const notas = new Set<string>();
  const lineas: LineaDePlataforma[] = [];
  const plataforma = NOMBRE_DE_PLATAFORMA[dialecto];
  if (isOpaqueMailBlock(block)) {
    return { dialecto, plataforma, lineas, notas: ["Este bloque se conserva tal cual; esta versión de la app no sabe traducirlo."] };
  }

  if (block.type === "image") {
    const url = template.images[block.image_ref]?.url;
    const src = url ?? (dialecto === "mailchimp" ? `${block.image_ref}.png` : "");
    lineas.push({ rotulo: "Imagen", app: block.image_ref, plataforma: `<img src="${src}" alt="${block.alt}">` });
    if (!url && dialecto === "mailchimp") notas.add("El archivo viaja en el ZIP importable: Mailchimp lo sube y reescribe la ruta.");
    if (!url && dialecto === "surveymonkey") notas.add("SurveyMonkey sólo muestra imágenes con una URL https pública.");
    if (block.url) {
      lineas.push({ rotulo: "Enlace", app: block.url, plataforma: textoEnLaPlataforma(block.url, template, dialecto, { enUrl: true, notas }) });
    }
    return { dialecto, plataforma, lineas, notas: [...notas] };
  }

  if (block.type === "greeting") {
    const usaNombre = /\{\{\s*nombre\s*\}\}/.test(block.text);
    const texto = textoEnLaPlataforma(block.text, template, dialecto, { notas });
    if (dialecto === "mailchimp" && usaNombre && block.fallback) {
      lineas.push({
        rotulo: "Saludo",
        app: block.text,
        plataforma: `*|IF:FNAME|*${texto}*|ELSE:|*${textoEnLaPlataforma(block.fallback, template, dialecto, { notas })}*|END:IF|*`,
      });
      notas.add("Quien no tiene nombre en la audiencia recibe el texto de respaldo.");
    } else {
      lineas.push({ rotulo: "Saludo", app: block.text, plataforma: texto });
    }
    return { dialecto, plataforma, lineas, notas: [...notas] };
  }

  for (const prop of propsDeTexto(block.type)) {
    const raw = (block as Record<string, unknown>)[prop];
    const valores = Array.isArray(raw) ? raw.filter((v): v is string => typeof v === "string") : [textoDe(block, prop)];
    valores.forEach((valor, i) => {
      if (!valor) return;
      const enUrl = prop === "url";
      const rotulo = Array.isArray(raw) && valores.length > 1 ? `${ROTULO_DE_PROP[prop]} ${i + 1}` : ROTULO_DE_PROP[prop];
      lineas.push({
        rotulo,
        app: valor,
        plataforma: textoEnLaPlataforma(valor, template, dialecto, { enUrl, enlaces: admiteEnlaces(block.type, prop), notas }),
      });
    });
  }
  if (block.type === "footer_legal") {
    lineas.push({ rotulo: "Baja y dirección", app: "lo agrega la app", plataforma: PIE[dialecto] });
    notas.add(dialecto === "mailchimp"
      ? "Mailchimp exige la dirección y el enlace de baja en todo correo: la app los agrega siempre."
      : "SurveyMonkey exige el enlace de baja ([OptOutLink]): la app lo agrega siempre.");
  }
  return { dialecto, plataforma, lineas, notas: [...notas] };
}
