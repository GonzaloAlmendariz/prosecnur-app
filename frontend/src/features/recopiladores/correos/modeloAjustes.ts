// modeloAjustes.ts — «Ajustes del correo» (E1p), sin React.
//
// Dos claves del tema, sin cambio de esquema:
//   width    560 | 600 | 640; ausente es 600. En el teléfono el correo ocupa la
//            pantalla y los márgenes bajan a 20 px: eso es fijo, sin control.
//   page_bg  el fondo de la página. Campaña: sin él, el acento. Sobrio: sin él,
//            el gris de la casa; con él, la tarjeta sigue blanca y el pie de
//            afuera calcula su tono (lo mide `campana_footer_contrast`).
// Los valores por defecto no se escriben: un correo sin tocar conserva su tema.

import { MAIL_WIDTHS, MAIL_WIDTH_DEFAULT, type MailCheck, type MailTemplate, type MailTheme, type MailWidth } from "../../../api/materialMail";
import type { VistaDelCorreo } from "./modeloCorreo";
import { BLANCO, CONTRASTE_TEXTO, contraste, esHex, estiloDe, hexCanonico, mismoColor, type Lectura } from "./modeloEstilo";

/** El gris de la página de siempre (`.CMAIL_PAGE_BG` del backend). */
export const GRIS_DE_LA_CASA = "#EEF1F5";
/** Las dos tintas entre las que el backend elige la del pie: blanco o el texto del cuerpo. */
const TINTA_DEL_CUERPO = "#22262E";

export const ANCHOS: readonly MailWidth[] = MAIL_WIDTHS;
export const ANCHO_RECOMENDADO: MailWidth = MAIL_WIDTH_DEFAULT;

export function anchoDe(theme: MailTheme): MailWidth {
  return theme.width ?? ANCHO_RECOMENDADO;
}

/** El tema con otro ancho; 600 quita la clave. */
export function conAncho(theme: MailTheme, ancho: MailWidth): MailTheme {
  const out: MailTheme = { ...theme };
  if (ancho === ANCHO_RECOMENDADO) delete out.width;
  else out.width = ancho;
  return out;
}

/** Ancho de la hoja en el lienzo: la columna más el margen de la página (12 + 12) y aire. */
export function anchoDeLaHoja(vista: VistaDelCorreo, theme: MailTheme | null | undefined): number {
  if (vista === "telefono") return 375;
  return (theme ? anchoDe(theme) : ANCHO_RECOMENDADO) + 48;
}

// ---- fondo de la página -----------------------------------------------------------

export type FondoDeLaPagina = {
  /** El color que se ve. */
  color: string;
  /** ¿Lo declara el tema? Sin él: el gris (sobrio) o el acento (campaña). */
  declarado: boolean;
  /** Lo que vale sin declarar. */
  porDefecto: string;
};

export function fondoDeLaPagina(theme: MailTheme): FondoDeLaPagina {
  const campana = estiloDe(theme).estilo === "campana";
  const porDefecto = campana ? hexCanonico(theme.accent) : GRIS_DE_LA_CASA;
  const declarado = esHex(theme.page_bg);
  return { color: declarado ? hexCanonico(theme.page_bg as string) : porDefecto, declarado, porDefecto };
}

/** El tema con otro fondo de página; `null` o el valor por defecto del estilo quitan la clave. */
export function conFondo(theme: MailTheme, color: string | null): MailTheme {
  const out: MailTheme = { ...theme };
  if (color === null || mismoColor(color, fondoDeLaPagina(theme).porDefecto)) delete out.page_bg;
  else out.page_bg = hexCanonico(color);
  return out;
}

/** Las muestras: en sobrio el gris primero; luego la cabecera (el acento) y hasta tres del banner. */
export function muestrasDeFondo(theme: MailTheme, delBanner: readonly string[] | null): string[] {
  const campana = estiloDe(theme).estilo === "campana";
  const out: string[] = [];
  for (const c of [...(campana ? [] : [GRIS_DE_LA_CASA]), theme.accent, ...(delBanner ?? []).slice(0, 3)]) {
    if (esHex(c) && !out.some((x) => mismoColor(x, c))) out.push(hexCanonico(c));
  }
  return out;
}

export function nombreDelFondo(color: string, theme: MailTheme): string {
  if (mismoColor(color, theme.accent)) return "Igual que la cabecera";
  if (mismoColor(color, GRIS_DE_LA_CASA)) return "Gris de la casa";
  return "Del banner";
}

/**
 * El pie de afuera (dirección y baja) sobre el fondo: el backend lo pinta con
 * la tinta atenuada de más contraste, que llega a 4.5:1 siempre que la tinta
 * pura llegue. Se mide con la tinta pura; si la revisión trae su chequeo, manda.
 */
export function lecturaDelPie(fondo: string, revision?: MailCheck | null): Lectura {
  const local = Math.max(contraste(fondo, BLANCO) ?? 0, contraste(fondo, TINTA_DEL_CUERPO) ?? 0);
  const tono: Lectura["tono"] = revision ? revision.status : local >= CONTRASTE_TEXTO ? "ok" : "error";
  const razon = revision && typeof revision.value === "number" && Number.isFinite(revision.value) ? revision.value : local || null;
  return {
    tono,
    frase: tono === "ok" ? "El pie se lee bien" : "El pie cuesta leerse: elige otro fondo",
    razon,
    detalle: revision?.detail || undefined,
  };
}

/**
 * El color con que el lienzo pinta alrededor de la hoja en Escritorio: el
 * fondo de la página si el correo lo tiene propio (campaña siempre; sobrio
 * sólo con `page_bg`). `null`: el lienzo de siempre.
 */
export function paginaDelLienzo(template: Pick<MailTemplate, "theme"> | null, vista: VistaDelCorreo): string | null {
  if (!template || vista !== "escritorio") return null;
  const fondo = fondoDeLaPagina(template.theme);
  const campana = estiloDe(template.theme).estilo === "campana";
  if (!campana && !fondo.declarado) return null;
  return esHex(fondo.color) ? fondo.color : null;
}
