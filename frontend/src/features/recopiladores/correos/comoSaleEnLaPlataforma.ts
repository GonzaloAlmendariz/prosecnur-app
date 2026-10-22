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

import { isOpaqueMailBlock, type MailBlock, type MailField, type MailGreetingBlock, type MailTemplate } from "../../../api/materialMail";
import { ROTULO_DE_PROP, propsDeTexto, textoDe, type PropDeTexto } from "./modeloCorreo";
import { tratoDelSaludo } from "./modeloTrato";
import { PATRON_CAMPO, PATRON_ENLACE, enfasisAHtml } from "./serializarTexto";

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
  if (opciones.enUrl) return texto.replace(PATRON_CAMPO, (_m, key: string) => campo(key, ctx, true));
  // El énfasis va antes que los enlaces y los campos: las etiquetas de la
  // plataforma (`*|FNAME|*`) también llevan asteriscos.
  let out = enfasisAHtml(texto);
  if (opciones.enlaces) {
    out = out.replace(PATRON_ENLACE, (_m, label: string, url: string) => `<a href="${textoEnLaPlataforma(url, template, dialecto, { enUrl: true, notas: ctx.notas })}">${label}</a>`);
  }
  out = out.replace(/\n/g, "<br>");
  return out.replace(PATRON_CAMPO, (_m, key: string) => campo(key, ctx, Boolean(opciones.enUrl)));
}

// ---- el saludo según la persona (F4) --------------------------------------------
// Espejo de `.cmail_trato_html` / `.cmail_trato_inline` (collection_mail_trato.R)
// en modo export: con el trato activo (por sexo y con columna), la primera
// aparición de la palabra de respaldo se cambia por la etiqueta del dialecto.

/** Etiqueta de Mailchimp del trato (`.CMAIL_TRATO_TAG`). */
export const ETIQUETA_DEL_TRATO = "SALUDO";

/** El dato personalizado de SurveyMonkey del trato: el declarado, o el primer CustomData libre. */
export function ranuraDelTrato(trato: { sm?: string }, fields: readonly Pick<MailField, "sm">[]): string {
  if (trato.sm) return trato.sm;
  const usados = new Set(
    fields.map((f) => /^CustomData(\d+)$/.exec(f.sm ?? "")?.[1]).filter((n): n is string => Boolean(n)).map(Number),
  );
  for (let i = 1; i <= 50; i += 1) if (!usados.has(i)) return `CustomData${i}`;
  return "CustomData50";
}

const MARCA_DEL_TRATO = "\u0000trato\u0000";

function saludoEnLaPlataforma(
  texto: string,
  block: MailGreetingBlock,
  template: Pick<MailTemplate, "fields">,
  dialecto: Dialecto,
  notas: Set<string>,
): string {
  const trato = tratoDelSaludo(block);
  const activo = trato.modo === "por_sexo" && Boolean(trato.columna);
  if (!activo || !texto.includes(trato.respaldo)) return textoEnLaPlataforma(texto, template, dialecto, { notas });
  const html = textoEnLaPlataforma(texto.replace(trato.respaldo, MARCA_DEL_TRATO), template, dialecto, { notas });
  const palabra = dialecto === "surveymonkey"
    ? `[${ranuraDelTrato(trato, template.fields)}]`
    : `*|IF:${ETIQUETA_DEL_TRATO}|**|${ETIQUETA_DEL_TRATO}|**|ELSE:|*${trato.respaldo}*|END:IF|*`;
  return html.replace(MARCA_DEL_TRATO, palabra);
}

function notasDelTrato(block: MailGreetingBlock, template: Pick<MailTemplate, "fields">, dialecto: Dialecto, notas: Set<string>): void {
  const trato = tratoDelSaludo(block);
  if (trato.modo !== "por_sexo") return;
  if (!trato.columna) {
    notas.add(`Sin columna de sexo el saludo dice «${trato.respaldo}» a todos: elígela en «Saludo según la persona».`);
    return;
  }
  notas.add(dialecto === "surveymonkey"
    ? `[${ranuraDelTrato(trato, template.fields)}] lleva «${trato.masculino}» o «${trato.femenino}»: lo trae escrito el archivo de contactos.`
    : `*|${ETIQUETA_DEL_TRATO}|* lleva «${trato.masculino}» o «${trato.femenino}» desde la audiencia; sin dato, «${trato.respaldo}».`);
}

/** Propiedades que admiten `[texto](url)` (`.CMAIL_LINK_PROPS`). */
const PROPS_CON_ENLACE: Partial<Record<MailBlock["type"], readonly PropDeTexto[]>> = {
  paragraph: ["text"],
  callout: ["title", "items"],
  list: ["items"],
  signature: ["lines"],
  footer_legal: ["text"],
  icon_text: ["text"],
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
    lineas.push({ rotulo: "Imagen", app: block.image_ref, plataforma: `<img src="${src}" alt="${block.decorative ? "" : block.alt}">` });
    if (!url && dialecto === "mailchimp") notas.add("El archivo viaja en el ZIP importable: Mailchimp lo sube y reescribe la ruta.");
    if (!url && dialecto === "surveymonkey") notas.add("SurveyMonkey sólo muestra imágenes con una URL https pública.");
    if (block.url) {
      lineas.push({ rotulo: "Enlace", app: block.url, plataforma: textoEnLaPlataforma(block.url, template, dialecto, { enUrl: true, notas }) });
    }
    return { dialecto, plataforma, lineas, notas: [...notas] };
  }

  if (block.type === "greeting") {
    const usaNombre = /\{\{\s*nombre\s*\}\}/.test(block.text);
    const texto = saludoEnLaPlataforma(block.text, block, template, dialecto, notas);
    notasDelTrato(block, template, dialecto, notas);
    if (dialecto === "mailchimp" && usaNombre && block.fallback) {
      lineas.push({
        rotulo: "Saludo",
        app: block.text,
        plataforma: `*|IF:FNAME|*${texto}*|ELSE:|*${saludoEnLaPlataforma(block.fallback, block, template, dialecto, notas)}*|END:IF|*`,
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
  // Piezas gráficas (E1o): tablas con color de fondo e imágenes, sin SVG ni posiciones libres.
  if (block.type === "band" || block.type === "ornament") {
    notas.add("Sale como una tabla con color de fondo: igual en Outlook, Gmail y el teléfono.");
    if (block.type === "ornament" && (block.style ?? "onda") === "onda") {
      notas.add(dialecto === "mailchimp"
        ? "La onda es una imagen que la app genera en el color elegido y viaja en el ZIP."
        : "SurveyMonkey no lleva imágenes dentro del correo: la onda sale como una banda sólida.");
    }
  }
  if (block.type === "icon_text") {
    notas.add(dialecto === "mailchimp"
      ? "El ícono es una imagen cuadrada que la app genera y viaja en el ZIP."
      : "SurveyMonkey sólo muestra el ícono con una dirección web https; sin ella, el texto sale solo.");
  }
  if (block.type === "two_images") {
    notas.add("Lado a lado en el escritorio; en el teléfono una va bajo la otra. Ninguna se estira.");
  }
  if (block.type === "footer_legal") {
    lineas.push({ rotulo: "Baja y dirección", app: "lo agrega la app", plataforma: PIE[dialecto] });
    notas.add(dialecto === "mailchimp"
      ? "Mailchimp exige la dirección y el enlace de baja en todo correo: la app los agrega siempre."
      : "SurveyMonkey exige el enlace de baja ([OptOutLink]): la app lo agrega siempre.");
  }
  return { dialecto, plataforma, lineas, notas: [...notas] };
}
