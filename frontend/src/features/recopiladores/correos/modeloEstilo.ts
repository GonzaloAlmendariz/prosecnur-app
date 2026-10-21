// modeloEstilo.ts — el estilo del correo (E1n), sin React.
//
// `theme.estilo` ausente es «sobrio»: la tarjeta blanca de siempre. «Campaña»
// pinta el fondo de la página a todo el ancho y el cuerpo directo sobre él
// (como el correo de la DAF que eligió el equipo): en el teléfono es una
// columna y en el escritorio el color llena la ventana.
//
// El contraste se calcula aquí con la fórmula de WCAG 2.x —la misma que usa la
// revisión del backend— para decirlo mientras se elige; cuando la revisión
// trae su chequeo (`campana_*_contrast`), manda el suyo.

import type { MailCheck, MailEstilo, MailOnda, MailTextAlign, MailTheme } from "../../../api/materialMail";

/** Relleno del botón por defecto en Campaña (el amarillo de la casa, como el backend). */
export const AMARILLO_DE_LA_CASA = "#F9D53E";
/** Los dos colores de texto entre los que elige el render: grafito o blanco. */
export const GRAFITO = "#0B1F3A";
export const BLANCO = "#FFFFFF";

/** Mínimo de WCAG AA para texto normal. */
export const CONTRASTE_TEXTO = 4.5;
/** Mínimo para que un control se distinga de lo que lo rodea. */
export const CONTRASTE_CONTROL = 3;

const HEX = /^#([0-9a-f]{6})$/i;

export function esHex(color: string | undefined | null): color is string {
  return typeof color === "string" && HEX.test(color.trim());
}

/** `#rrggbb` en mayúsculas, para comparar y mostrar. */
export function hexCanonico(color: string): string {
  return color.trim().toUpperCase();
}

export function mismoColor(a: string | undefined, b: string | undefined): boolean {
  return Boolean(a && b) && hexCanonico(a as string) === hexCanonico(b as string);
}

function rgbDe(color: string): [number, number, number] | null {
  const m = color.trim().match(HEX);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Luminancia relativa de WCAG 2.x; `null` si el color no es `#rrggbb`. */
export function luminancia(color: string): number | null {
  const rgb = rgbDe(color);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Razón de contraste de WCAG (1 a 21); `null` si algún color no se lee. */
export function contraste(a: string, b: string): number | null {
  const la = luminancia(a);
  const lb = luminancia(b);
  if (la === null || lb === null) return null;
  const [claro, oscuro] = la >= lb ? [la, lb] : [lb, la];
  return (claro + 0.05) / (oscuro + 0.05);
}

/** El texto que mejor se lee sobre un fondo: grafito o blanco. */
export function textoSobre(fondo: string): string {
  const conBlanco = contraste(fondo, BLANCO) ?? 0;
  const conGrafito = contraste(fondo, GRAFITO) ?? 0;
  return conBlanco >= conGrafito ? BLANCO : GRAFITO;
}

/** El estilo con sus valores por defecto ya puestos (lo que dibuja el render). */
export type EstiloEfectivo = {
  estilo: MailEstilo;
  fondo: string;
  boton: string;
  textoDelBoton: string;
  alineacion: MailTextAlign;
  onda: MailOnda;
};

export function estiloDe(theme: MailTheme): EstiloEfectivo {
  const fondo = esHex(theme.page_bg) ? theme.page_bg : theme.accent;
  const boton = esHex(theme.button_bg) ? theme.button_bg : AMARILLO_DE_LA_CASA;
  return {
    estilo: theme.estilo ?? "sobrio",
    fondo,
    boton,
    textoDelBoton: esHex(theme.button_text) ? theme.button_text : textoSobre(boton),
    alineacion: theme.text_align ?? "justify",
    onda: theme.onda ?? "ninguna",
  };
}

type CambioDeEstilo = Partial<Record<"estilo" | "page_bg" | "button_bg" | "button_text" | "text_align" | "onda" | "onda_color", string | null>>;

/**
 * El tema con un cambio de estilo. `null` quita la clave. El valor por defecto
 * no se escribe (`estilo: "sobrio"`, `text_align: "justify"`, `onda:
 * "ninguna"`): un correo sin tocar conserva su tema tal cual. Al cambiar el
 * relleno del botón se quita `button_text`: el texto vuelve a calcularse solo.
 * Las claves de Campaña se conservan al volver a Sobrio (el render no las usa)
 * para que volver a Campaña no pierda lo elegido.
 */
export function conEstilo(theme: MailTheme, cambio: CambioDeEstilo): MailTheme {
  const out: Record<string, unknown> = { ...theme };
  const POR_DEFECTO: Record<string, string> = { estilo: "sobrio", text_align: "justify", onda: "ninguna" };
  for (const [clave, valor] of Object.entries(cambio)) {
    if (valor === undefined) continue;
    if (valor === null || POR_DEFECTO[clave] === valor) delete out[clave];
    else out[clave] = valor;
  }
  if (cambio.button_bg !== undefined && cambio.button_text === undefined) delete out.button_text;
  return out as MailTheme;
}

// ---- lo que se dice del contraste -------------------------------------------------

export type Lectura = { tono: "ok" | "warning" | "error"; frase: string; razon: number | null; detalle?: string };

/** «4.6:1»: la razón, para el tooltip (la frase no la necesita). */
export const razonLegible = (r: number) => `${r.toFixed(1)}:1`;

/** El texto del cuerpo (grafito o blanco, el mejor) sobre el fondo de la página. */
export function lecturaDelFondo(fondo: string): Lectura {
  const texto = textoSobre(fondo);
  const razon = contraste(fondo, texto);
  if (razon === null) return { tono: "error", frase: "Ese color no es válido: elige uno de la lista", razon };
  if (razon >= CONTRASTE_TEXTO) return { tono: "ok", frase: "Se lee bien", razon };
  const hacia = texto === BLANCO ? "más oscuro" : "más claro";
  return { tono: "error", frase: `Poco contraste: elige un fondo ${hacia}`, razon };
}

/** El texto del botón sobre su relleno y el botón contra el fondo de la página. */
export function lecturaDelBoton(boton: string, textoDelBoton: string, fondo: string): Lectura {
  const razon = contraste(boton, textoDelBoton);
  if (razon === null) return { tono: "error", frase: "Ese color no es válido: elige uno de la lista", razon };
  if (razon < CONTRASTE_TEXTO) {
    const hacia = textoDelBoton === BLANCO ? "más oscuro" : "más claro";
    return { tono: "error", frase: `Poco contraste: elige un relleno ${hacia}`, razon };
  }
  const contraElFondo = contraste(boton, fondo) ?? 0;
  if (contraElFondo < CONTRASTE_CONTROL) {
    return { tono: "warning", frase: "El botón se confunde con el fondo: elige un relleno que se distinga más", razon };
  }
  return { tono: "ok", frase: "Se lee bien", razon };
}

/** Chequeos de la revisión que miran el estilo de Campaña. */
export const CHEQUEOS_DE_ESTILO = ["campana_text_contrast", "campana_button_contrast", "campana_footer_contrast"] as const;
export type ChequeoDeEstilo = (typeof CHEQUEOS_DE_ESTILO)[number];

/** Destino de los chequeos de estilo (`.CMAIL_IDENTITY_TARGET`): Identidad › Estilo. */
export const IDENTIDAD = "__identidad";

/** `data-foco` del control de Identidad › Estilo que corrige un `prop` del tema. */
export function focoDelEstilo(prop: string | undefined): string {
  return `estilo-${prop === "button_bg" ? "button_bg" : "page_bg"}`;
}

/**
 * Lo que se muestra junto a un control: el veredicto (tono y razón) es el de
 * la revisión si llegó, que es la fuente; la frase sigue corta y la del
 * backend, entera, queda en el tooltip.
 */
export function lecturaConRevision(local: Lectura, revision: MailCheck | null | undefined): Lectura {
  if (!revision) return local;
  const razon = typeof revision.value === "number" && Number.isFinite(revision.value) ? revision.value : local.razon;
  const frase = revision.status === "ok"
    ? "Se lee bien"
    : local.tono === revision.status ? local.frase : revision.status === "error" ? "Poco contraste: elige otro color" : "Se distingue poco: elige otro color";
  return { tono: revision.status, frase, razon, detalle: revision.detail || undefined };
}

// ---- colores del banner -----------------------------------------------------------

/**
 * Los colores que más pesan en una imagen (píxeles RGBA de un canvas). Se
 * agrupan por cubos de 32 niveles por canal, se descarta lo transparente y lo
 * casi blanco (el fondo de un banner no sirve de fondo de página: el texto
 * blanco no se leería) y se devuelven los `cuantos` más frecuentes que no se
 * parecen entre sí.
 */
export function coloresDominantes(pixeles: ArrayLike<number>, cuantos = 3): string[] {
  const cubos = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let k = 0; k + 3 < pixeles.length; k += 4) {
    const r = pixeles[k];
    const g = pixeles[k + 1];
    const b = pixeles[k + 2];
    if (pixeles[k + 3] < 200) continue;
    if (r > 235 && g > 235 && b > 235) continue;
    const clave = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
    const cubo = cubos.get(clave) ?? { n: 0, r: 0, g: 0, b: 0 };
    cubo.n += 1;
    cubo.r += r;
    cubo.g += g;
    cubo.b += b;
    cubos.set(clave, cubo);
  }
  const hex = (v: number) => Math.round(v).toString(16).padStart(2, "0");
  const elegidos: { color: string; rgb: [number, number, number] }[] = [];
  for (const c of [...cubos.values()].sort((a, b) => b.n - a.n)) {
    const rgb: [number, number, number] = [c.r / c.n, c.g / c.n, c.b / c.n];
    const parecido = elegidos.some((e) => Math.hypot(e.rgb[0] - rgb[0], e.rgb[1] - rgb[1], e.rgb[2] - rgb[2]) < 48);
    if (parecido) continue;
    elegidos.push({ color: `#${hex(rgb[0])}${hex(rgb[1])}${hex(rgb[2])}`.toUpperCase(), rgb });
    if (elegidos.length >= cuantos) break;
  }
  return elegidos.map((e) => e.color);
}

/** Lo que se ofrece como fondo: hasta tres colores del banner y el acento, sin repetir. */
export function sugerenciasDeFondo(delBanner: readonly string[] | null, acento: string): string[] {
  const out: string[] = [];
  for (const c of [...(delBanner ?? []).slice(0, 3), acento]) {
    if (esHex(c) && !out.some((x) => mismoColor(x, c))) out.push(hexCanonico(c));
  }
  return out;
}

/** Lo que se ofrece como relleno del botón: el amarillo de la casa, el banner y el acento. */
export function sugerenciasDeBoton(delBanner: readonly string[] | null, acento: string): string[] {
  const out: string[] = [];
  for (const c of [AMARILLO_DE_LA_CASA, ...(delBanner ?? []).slice(0, 3), acento]) {
    if (esHex(c) && !out.some((x) => mismoColor(x, c))) out.push(hexCanonico(c));
  }
  return out;
}
